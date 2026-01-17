"""TTS API endpoint."""

import asyncio
import logging

from fastapi import APIRouter
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

from app.services.tts import tts_service
from app.utils.exceptions import raise_internal_error

logger = logging.getLogger(__name__)

router = APIRouter()


class TTSRequest(BaseModel):
    """Request model for TTS synthesis."""
    text: str = Field(..., min_length=1, max_length=5000, description="Text to synthesize")
    voice: str = Field(default='af_heart', description="Voice ID (e.g., 'af_heart', 'jf_alpha')")
    speed: float = Field(default=1.0, ge=0.5, le=2.0, description="Speech speed (0.5 - 2.0)")


@router.post("/tts")
async def synthesize(request: TTSRequest) -> Response:
    """
    POST /api/tts - Generate speech from text

    Returns WAV audio file.

    Supports 42 voices across 9 languages:
    - American English (a): af_heart, am_adam, etc.
    - British English (b): bf_emma, bm_george, etc.
    - Japanese (j): jf_alpha, jm_kumo, etc.
    - Chinese (z): zf_xiaobei, zm_yunjian, etc.
    - Spanish (e): ef_dora, em_alex, etc.
    - French (f): ff_siwis
    - Hindi (h): hf_alpha, hm_omega, etc.
    - Italian (i): if_sara, im_nicola
    - Portuguese (p): pf_dora, pm_alex, etc.
    """
    try:
        # Run TTS synthesis in thread pool to avoid blocking event loop
        # Model loading and inference can take several seconds on first call
        audio_bytes = await asyncio.to_thread(
            tts_service.synthesize,
            text=request.text,
            voice=request.voice,
            speed=request.speed
        )
        return Response(
            content=audio_bytes,
            media_type="audio/wav",
            headers={
                "Content-Disposition": "inline; filename=speech.wav",
                "Cache-Control": "no-cache"
            }
        )
    except Exception as e:
        logger.error(f"TTS endpoint error: {e}", exc_info=True)
        raise_internal_error(f"TTS generation failed: {str(e)}")


@router.post("/tts/stream")
async def synthesize_stream(request: TTSRequest) -> StreamingResponse:
    """
    POST /api/tts/stream - Stream speech generation

    Returns WAV audio chunks as they're generated, allowing playback to start
    before the full text is synthesized. Better for long texts.
    """
    # Pre-validate: ensure TTS service is available before starting stream
    # This catches initialization errors early with proper HTTP error response
    try:
        if not tts_service.is_available():
            raise_internal_error("TTS service is not available - model may still be loading")
        if not tts_service.is_valid_voice(request.voice):
            raise_internal_error(f"Invalid voice: {request.voice}")
    except Exception as e:
        logger.error(f"TTS pre-validation error: {e}", exc_info=True)
        raise_internal_error(f"TTS validation failed: {str(e)}")

    async def generate():
        """Async generator that runs TTS streaming in thread pool."""
        import queue
        import threading

        result_queue: queue.Queue = queue.Queue()

        def run_synthesis():
            """Run synthesis in thread, pushing chunks to queue."""
            try:
                for chunk in tts_service.synthesize_streaming(
                    text=request.text,
                    voice=request.voice,
                    speed=request.speed
                ):
                    result_queue.put(("chunk", chunk))
                result_queue.put(("done", None))
            except Exception as e:
                logger.error(f"TTS synthesis thread error: {e}", exc_info=True)
                result_queue.put(("error", str(e)))

        # Start synthesis in background thread
        thread = threading.Thread(target=run_synthesis, daemon=True)
        thread.start()

        # Yield chunks as they become available
        while True:
            try:
                # Wait for next chunk - 120s timeout per chunk for long synthesis
                event_type, data = await asyncio.to_thread(
                    result_queue.get, block=True, timeout=120.0
                )
                if event_type == "chunk":
                    yield data
                elif event_type == "done":
                    break
                elif event_type == "error":
                    logger.error(f"TTS streaming error: {data}")
                    break
            except queue.Empty:
                logger.error("TTS streaming timeout - no chunk received in 120s")
                break
            except Exception as e:
                logger.error(f"TTS streaming queue error: {e}", exc_info=True)
                break

    return StreamingResponse(
        generate(),
        media_type="audio/wav",
        headers={
            "Content-Disposition": "inline; filename=speech.wav",
            "Cache-Control": "no-cache",
            "X-Content-Type-Options": "nosniff",
        }
    )


@router.get("/tts/voices")
async def list_voices():
    """
    GET /api/tts/voices - List all available voices

    Returns voices grouped by language code.
    """
    return {
        "voices": tts_service.get_all_voices(),
        "languages": {
            "a": "American English",
            "b": "British English",
            "j": "Japanese",
            "z": "Mandarin Chinese",
            "e": "Spanish",
            "f": "French",
            "h": "Hindi",
            "i": "Italian",
            "p": "Brazilian Portuguese",
        }
    }
