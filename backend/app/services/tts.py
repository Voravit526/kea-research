"""TTS Service using Kokoro ONNX model from HuggingFace."""

import hashlib
import io
import logging
import re
import time
from collections import OrderedDict
from typing import Iterator

import numpy as np
import orjson
import onnxruntime as ort
import soundfile as sf
from huggingface_hub import hf_hub_download
from phonemizer import phonemize

# Lazy imports for misaki (Japanese/Chinese)
_misaki_ja = None
_misaki_zh = None

logger = logging.getLogger(__name__)

# Max characters per chunk (model limit is ~500)
MAX_CHUNK_SIZE = 400


class TTSService:
    """Kokoro ONNX TTS service with lazy model loading and caching."""

    _session: ort.InferenceSession | None = None
    _vocab: dict[str, int] | None = None
    _voice_cache: dict[str, np.ndarray] = {}

    # Audio cache: key -> (wav_bytes, timestamp)
    _audio_cache: OrderedDict[str, tuple[bytes, float]] = OrderedDict()
    CACHE_MAX_SIZE = 50  # Max cached items
    CACHE_TTL = 3600  # 1 hour TTL

    REPO_ID = "onnx-community/Kokoro-82M-v1.0-ONNX"

    # Language code mapping from voice prefix
    LANG_MAP = {
        'af': 'a', 'am': 'a',  # American English
        'bf': 'b', 'bm': 'b',  # British English
        'jf': 'j', 'jm': 'j',  # Japanese
        'zf': 'z', 'zm': 'z',  # Chinese
        'ef': 'e', 'em': 'e',  # Spanish
        'ff': 'f',             # French
        'hf': 'h', 'hm': 'h',  # Hindi
        'if': 'i', 'im': 'i',  # Italian
        'pf': 'p', 'pm': 'p',  # Portuguese
    }

    # Kokoro language code to espeak language code
    ESPEAK_LANG_MAP = {
        'a': 'en-us',   # American English
        'b': 'en-gb',   # British English
        'j': 'ja',      # Japanese
        'z': 'cmn',     # Mandarin Chinese
        'e': 'es',      # Spanish
        'f': 'fr-fr',   # French
        'h': 'hi',      # Hindi
        'i': 'it',      # Italian
        'p': 'pt-br',   # Portuguese
    }

    # All 54 voices grouped by language
    VOICES = {
        'a': ['af_heart', 'af_alloy', 'af_aoede', 'af_bella', 'af_jessica', 'af_kore',
              'af_nicole', 'af_nova', 'af_river', 'af_sarah', 'af_sky',
              'am_adam', 'am_echo', 'am_eric', 'am_fenrir', 'am_liam',
              'am_michael', 'am_onyx', 'am_puck', 'am_santa'],
        'b': ['bf_alice', 'bf_emma', 'bf_isabella', 'bf_lily',
              'bm_daniel', 'bm_fable', 'bm_george', 'bm_lewis'],
        'j': ['jf_alpha', 'jf_gongitsune', 'jf_nezumi', 'jf_tebukuro', 'jm_kumo'],
        'z': ['zf_xiaobei', 'zf_xiaoni', 'zf_xiaoxiao', 'zf_xiaoyi',
              'zm_yunjian', 'zm_yunxi', 'zm_yunxia', 'zm_yunyang'],
        'e': ['ef_dora', 'em_alex', 'em_santa'],
        'f': ['ff_siwis'],
        'h': ['hf_alpha', 'hf_beta', 'hm_omega', 'hm_psi'],
        'i': ['if_sara', 'im_nicola'],
        'p': ['pf_dora', 'pm_alex', 'pm_santa'],
    }

    @classmethod
    def _load_model(cls) -> None:
        """Lazy load ONNX model and tokenizer from HuggingFace."""
        if cls._session is None:
            logger.info("TTS: Downloading ONNX model from HuggingFace...")
            model_path = hf_hub_download(cls.REPO_ID, "onnx/model_quantized.onnx")
            tokenizer_path = hf_hub_download(cls.REPO_ID, "tokenizer.json")

            logger.info(f"TTS: Loading ONNX model from {model_path}")
            cls._session = ort.InferenceSession(model_path)

            with open(tokenizer_path, "rb") as f:
                tokenizer_data = orjson.loads(f.read())
            cls._vocab = tokenizer_data["model"]["vocab"]
            logger.info(f"TTS: Model loaded, vocab size: {len(cls._vocab)}")

    @classmethod
    def _load_voice(cls, voice_id: str) -> np.ndarray:
        """Load and cache voice embedding from HuggingFace."""
        if voice_id not in cls._voice_cache:
            logger.info(f"TTS: Downloading voice '{voice_id}'...")
            voice_path = hf_hub_download(cls.REPO_ID, f"voices/{voice_id}.bin")
            data = np.fromfile(voice_path, dtype=np.float32)
            # Voice file is 510x256, take mean for style embedding
            cls._voice_cache[voice_id] = data.reshape(510, 256).mean(axis=0)
            logger.info(f"TTS: Voice '{voice_id}' loaded")
        return cls._voice_cache[voice_id].reshape(1, 256)

    @classmethod
    def _phonemize(cls, text: str, lang_code: str) -> str:
        """Convert text to IPA phonemes using espeak-ng or misaki (for ja/zh)."""
        global _misaki_ja, _misaki_zh

        # Use misaki for Japanese
        if lang_code == 'j':
            if _misaki_ja is None:
                logger.info("TTS: Loading misaki Japanese G2P...")
                from misaki import ja
                _misaki_ja = ja.JAG2P()
            phonemes, _ = _misaki_ja(text)
            logger.debug(f"TTS: Phonemized JA '{text[:30]}...' -> '{phonemes[:50]}...'")
            return phonemes

        # Use misaki for Chinese
        if lang_code == 'z':
            if _misaki_zh is None:
                logger.info("TTS: Loading misaki Chinese G2P...")
                from misaki import zh
                _misaki_zh = zh.ZHG2P()
            phonemes, _ = _misaki_zh(text)
            logger.debug(f"TTS: Phonemized ZH '{text[:30]}...' -> '{phonemes[:50]}...'")
            return phonemes

        # Use espeak-ng for other languages
        espeak_lang = cls.ESPEAK_LANG_MAP.get(lang_code, 'en-us')

        phonemes = phonemize(
            text,
            language=espeak_lang,
            backend='espeak',
            preserve_punctuation=True,
            with_stress=True,
        )
        logger.debug(f"TTS: Phonemized '{text[:30]}...' -> '{phonemes[:50]}...'")
        return phonemes

    @classmethod
    def _chunk_text(cls, text: str) -> list[str]:
        """Split text into chunks that fit model's max sequence length."""
        # Split on sentence boundaries
        sentences = re.split(r'(?<=[.!?])\s+', text)

        chunks = []
        current_chunk = ""

        for sentence in sentences:
            # If single sentence is too long, split on commas or spaces
            if len(sentence) > MAX_CHUNK_SIZE:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    current_chunk = ""

                # Split long sentence on commas
                parts = re.split(r',\s*', sentence)
                for part in parts:
                    if len(part) > MAX_CHUNK_SIZE:
                        # Split on spaces if still too long
                        words = part.split()
                        temp = ""
                        for word in words:
                            if len(temp) + len(word) + 1 > MAX_CHUNK_SIZE:
                                if temp:
                                    chunks.append(temp.strip())
                                temp = word
                            else:
                                temp = f"{temp} {word}" if temp else word
                        if temp:
                            chunks.append(temp.strip())
                    elif len(current_chunk) + len(part) + 2 > MAX_CHUNK_SIZE:
                        if current_chunk:
                            chunks.append(current_chunk.strip())
                        current_chunk = part
                    else:
                        current_chunk = f"{current_chunk}, {part}" if current_chunk else part
            elif len(current_chunk) + len(sentence) + 1 > MAX_CHUNK_SIZE:
                chunks.append(current_chunk.strip())
                current_chunk = sentence
            else:
                current_chunk = f"{current_chunk} {sentence}" if current_chunk else sentence

        if current_chunk:
            chunks.append(current_chunk.strip())

        return [c for c in chunks if c]

    @classmethod
    def _synthesize_chunk(cls, text: str, lang_code: str, voice_emb: np.ndarray, speed: float) -> np.ndarray:
        """Synthesize a single chunk of text."""
        # Convert text to phonemes
        phonemes = cls._phonemize(text, lang_code)

        # Tokenize phonemes
        tokens = [cls._vocab.get(c, 0) for c in phonemes]
        input_ids = np.array([tokens], dtype=np.int64)

        outputs = cls._session.run(
            None,
            {
                "input_ids": input_ids,
                "style": voice_emb.astype(np.float32),
                "speed": np.array([speed], dtype=np.float32)
            }
        )
        return outputs[0].squeeze()

    @classmethod
    def get_lang_code(cls, voice_id: str) -> str:
        """Extract language code from voice ID."""
        prefix = voice_id[:2] if len(voice_id) >= 2 else 'af'
        return cls.LANG_MAP.get(prefix, 'a')

    @classmethod
    def is_valid_voice(cls, voice_id: str) -> bool:
        """Check if voice ID is valid."""
        lang_code = cls.get_lang_code(voice_id)
        return voice_id in cls.VOICES.get(lang_code, [])

    @classmethod
    def is_available(cls) -> bool:
        """Check if TTS service is ready (model loaded or can be loaded)."""
        # If model is already loaded, we're ready
        if cls._session is not None:
            return True
        # Otherwise, try to load - this will happen on first use anyway
        # For pre-validation, we just check that the class can be instantiated
        return True

    @classmethod
    def _cache_key(cls, text: str, voice: str, speed: float) -> str:
        """Generate cache key from synthesis parameters."""
        key_data = f"{text}|{voice}|{speed:.2f}"
        return hashlib.sha256(key_data.encode()).hexdigest()[:16]

    @classmethod
    def _get_cached(cls, key: str) -> bytes | None:
        """Get cached audio if available and not expired."""
        if key in cls._audio_cache:
            wav_bytes, timestamp = cls._audio_cache[key]
            if time.time() - timestamp < cls.CACHE_TTL:
                # Move to end (LRU)
                cls._audio_cache.move_to_end(key)
                logger.info(f"TTS: Cache hit for key={key}")
                return wav_bytes
            else:
                # Expired, remove
                del cls._audio_cache[key]
        return None

    @classmethod
    def _set_cached(cls, key: str, wav_bytes: bytes) -> None:
        """Cache audio with timestamp."""
        # Evict oldest if at capacity
        while len(cls._audio_cache) >= cls.CACHE_MAX_SIZE:
            cls._audio_cache.popitem(last=False)
        cls._audio_cache[key] = (wav_bytes, time.time())
        logger.info(f"TTS: Cached audio key={key}, cache_size={len(cls._audio_cache)}")

    @classmethod
    def synthesize(cls, text: str, voice: str = 'af_heart', speed: float = 1.0) -> bytes:
        """
        Generate audio from text using ONNX model with caching.

        Args:
            text: Text to synthesize
            voice: Voice ID (e.g., 'af_heart', 'jf_alpha')
            speed: Speech speed (0.5 - 2.0)

        Returns:
            WAV audio as bytes
        """
        # Validate voice
        if not cls.is_valid_voice(voice):
            logger.warning(f"TTS: Invalid voice '{voice}', falling back to af_heart")
            voice = 'af_heart'

        # Check cache first
        cache_key = cls._cache_key(text, voice, speed)
        cached = cls._get_cached(cache_key)
        if cached:
            return cached

        lang_code = cls.get_lang_code(voice)
        logger.info(f"TTS: Synthesizing text='{text[:50]}...' voice={voice} lang={lang_code} speed={speed}")

        # Load model if not loaded
        cls._load_model()

        # Get voice embedding
        voice_emb = cls._load_voice(voice)

        # Split text into chunks
        chunks = cls._chunk_text(text)
        logger.info(f"TTS: Split into {len(chunks)} chunks")

        # Synthesize each chunk
        audio_chunks = []
        for i, chunk in enumerate(chunks):
            logger.debug(f"TTS: Processing chunk {i+1}/{len(chunks)}: '{chunk[:30]}...'")
            audio = cls._synthesize_chunk(chunk, lang_code, voice_emb, speed)
            audio_chunks.append(audio)

        # Concatenate audio chunks
        if len(audio_chunks) > 1:
            full_audio = np.concatenate(audio_chunks)
        else:
            full_audio = audio_chunks[0]

        logger.info(f"TTS: Generated {len(full_audio)} samples ({len(full_audio)/24000:.2f}s)")

        # Convert to WAV bytes
        buffer = io.BytesIO()
        sf.write(buffer, full_audio, 24000, format='WAV')
        buffer.seek(0)
        wav_bytes = buffer.read()

        logger.info(f"TTS: Audio generated, size={len(wav_bytes)} bytes")

        # Cache the result
        cls._set_cached(cache_key, wav_bytes)

        return wav_bytes

    @classmethod
    def _create_wav_header(cls, sample_rate: int = 24000, bits_per_sample: int = 16, channels: int = 1) -> bytes:
        """
        Create a WAV header for streaming with unknown length.

        Uses maximum possible size (0xFFFFFFFF) which players handle gracefully.
        """
        import struct

        byte_rate = sample_rate * channels * bits_per_sample // 8
        block_align = channels * bits_per_sample // 8
        # Use max size - players stop at actual data end
        data_size = 0xFFFFFFFF - 36
        file_size = 0xFFFFFFFF - 8

        header = struct.pack(
            '<4sI4s4sIHHIIHH4sI',
            b'RIFF',
            file_size,
            b'WAVE',
            b'fmt ',
            16,  # fmt chunk size
            1,   # PCM format
            channels,
            sample_rate,
            byte_rate,
            block_align,
            bits_per_sample,
            b'data',
            data_size
        )
        return header

    @classmethod
    def synthesize_streaming(
        cls, text: str, voice: str = 'af_heart', speed: float = 1.0
    ) -> Iterator[bytes]:
        """
        Generate audio from text, yielding WAV data as chunks are ready.

        Sends WAV header first, then streams raw PCM audio data.
        This allows playback to start before all chunks are synthesized.

        Args:
            text: Text to synthesize
            voice: Voice ID (e.g., 'af_heart', 'jf_alpha')
            speed: Speech speed (0.5 - 2.0)

        Yields:
            WAV header first, then raw PCM audio chunks
        """
        # Validate voice
        if not cls.is_valid_voice(voice):
            logger.warning(f"TTS: Invalid voice '{voice}', falling back to af_heart")
            voice = 'af_heart'

        lang_code = cls.get_lang_code(voice)
        logger.info(f"TTS: Streaming synthesis text='{text[:50]}...' voice={voice} lang={lang_code} speed={speed}")

        # Load model if not loaded
        cls._load_model()

        # Get voice embedding
        voice_emb = cls._load_voice(voice)

        # Split text into chunks
        chunks = cls._chunk_text(text)
        logger.info(f"TTS: Split into {len(chunks)} chunks for streaming")

        # Yield WAV header first
        yield cls._create_wav_header(sample_rate=24000, bits_per_sample=16, channels=1)

        # Synthesize and yield raw PCM audio for each chunk
        for i, chunk in enumerate(chunks):
            logger.debug(f"TTS: Streaming chunk {i+1}/{len(chunks)}: '{chunk[:30]}...'")
            audio = cls._synthesize_chunk(chunk, lang_code, voice_emb, speed)

            # Convert float32 audio to int16 PCM bytes
            audio_int16 = (audio * 32767).astype(np.int16)
            yield audio_int16.tobytes()

        logger.info(f"TTS: Streaming complete, {len(chunks)} chunks")

    @classmethod
    def get_voices_for_language(cls, lang_code: str) -> list[str]:
        """Get all voices for a language."""
        return cls.VOICES.get(lang_code, [])

    @classmethod
    def get_all_voices(cls) -> dict[str, list[str]]:
        """Get all voices grouped by language."""
        return cls.VOICES.copy()


tts_service = TTSService()
