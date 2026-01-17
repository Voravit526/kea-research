/**
 * Text-to-Speech Module using Backend Kokoro TTS
 *
 * Supports 42 voices across 9 languages via /api/tts endpoint.
 */

import { stripMarkdown } from './utils';

// Voice definitions for all 9 languages
export const TTS_VOICES: Record<string, Array<{ id: string; name: string; gender: 'F' | 'M' }>> = {
  'en-us': [
    { id: 'af_heart', name: 'Heart', gender: 'F' },
    { id: 'af_alloy', name: 'Alloy', gender: 'F' },
    { id: 'af_aoede', name: 'Aoede', gender: 'F' },
    { id: 'af_bella', name: 'Bella', gender: 'F' },
    { id: 'af_jessica', name: 'Jessica', gender: 'F' },
    { id: 'af_kore', name: 'Kore', gender: 'F' },
    { id: 'af_nicole', name: 'Nicole', gender: 'F' },
    { id: 'af_nova', name: 'Nova', gender: 'F' },
    { id: 'af_river', name: 'River', gender: 'F' },
    { id: 'af_sarah', name: 'Sarah', gender: 'F' },
    { id: 'af_sky', name: 'Sky', gender: 'F' },
    { id: 'am_adam', name: 'Adam', gender: 'M' },
    { id: 'am_echo', name: 'Echo', gender: 'M' },
    { id: 'am_eric', name: 'Eric', gender: 'M' },
    { id: 'am_fenrir', name: 'Fenrir', gender: 'M' },
    { id: 'am_liam', name: 'Liam', gender: 'M' },
    { id: 'am_michael', name: 'Michael', gender: 'M' },
    { id: 'am_onyx', name: 'Onyx', gender: 'M' },
    { id: 'am_puck', name: 'Puck', gender: 'M' },
    { id: 'am_santa', name: 'Santa', gender: 'M' },
  ],
  'en-gb': [
    { id: 'bf_alice', name: 'Alice', gender: 'F' },
    { id: 'bf_emma', name: 'Emma', gender: 'F' },
    { id: 'bf_isabella', name: 'Isabella', gender: 'F' },
    { id: 'bf_lily', name: 'Lily', gender: 'F' },
    { id: 'bm_daniel', name: 'Daniel', gender: 'M' },
    { id: 'bm_fable', name: 'Fable', gender: 'M' },
    { id: 'bm_george', name: 'George', gender: 'M' },
    { id: 'bm_lewis', name: 'Lewis', gender: 'M' },
  ],
  'ja': [
    { id: 'jf_alpha', name: 'Alpha', gender: 'F' },
    { id: 'jf_gongitsune', name: 'Gongitsune', gender: 'F' },
    { id: 'jf_nezumi', name: 'Nezumi', gender: 'F' },
    { id: 'jf_tebukuro', name: 'Tebukuro', gender: 'F' },
    { id: 'jm_kumo', name: 'Kumo', gender: 'M' },
  ],
  'zh': [
    { id: 'zf_xiaobei', name: 'Xiaobei', gender: 'F' },
    { id: 'zf_xiaoni', name: 'Xiaoni', gender: 'F' },
    { id: 'zf_xiaoxiao', name: 'Xiaoxiao', gender: 'F' },
    { id: 'zf_xiaoyi', name: 'Xiaoyi', gender: 'F' },
    { id: 'zm_yunjian', name: 'Yunjian', gender: 'M' },
    { id: 'zm_yunxi', name: 'Yunxi', gender: 'M' },
    { id: 'zm_yunxia', name: 'Yunxia', gender: 'M' },
    { id: 'zm_yunyang', name: 'Yunyang', gender: 'M' },
  ],
  'es': [
    { id: 'ef_dora', name: 'Dora', gender: 'F' },
    { id: 'em_alex', name: 'Alex', gender: 'M' },
    { id: 'em_santa', name: 'Santa', gender: 'M' },
  ],
  'fr': [
    { id: 'ff_siwis', name: 'Siwis', gender: 'F' },
  ],
  'hi': [
    { id: 'hf_alpha', name: 'Alpha', gender: 'F' },
    { id: 'hf_beta', name: 'Beta', gender: 'F' },
    { id: 'hm_omega', name: 'Omega', gender: 'M' },
    { id: 'hm_psi', name: 'Psi', gender: 'M' },
  ],
  'it': [
    { id: 'if_sara', name: 'Sara', gender: 'F' },
    { id: 'im_nicola', name: 'Nicola', gender: 'M' },
  ],
  'pt': [
    { id: 'pf_dora', name: 'Dora', gender: 'F' },
    { id: 'pm_alex', name: 'Alex', gender: 'M' },
    { id: 'pm_santa', name: 'Santa', gender: 'M' },
  ],
};

// Preview texts for each language
export const PREVIEW_TEXTS: Record<string, string> = {
  'en-us': 'Hello! This is a preview of the selected voice.',
  'en-gb': 'Hello! This is a preview of the selected voice.',
  'ja': 'こんにちは！これは選択した音声のプレビューです。',
  'zh': '你好！这是所选语音的预览。',
  'es': '¡Hola! Esta es una vista previa de la voz seleccionada.',
  'fr': 'Bonjour! Ceci est un aperçu de la voix sélectionnée.',
  'hi': 'नमस्ते! यह चयनित आवाज़ का पूर्वावलोकन है।',
  'it': "Ciao! Questa è un'anteprima della voce selezionata.",
  'pt': 'Olá! Esta é uma prévia da voz selecionada.',
};

type TTSState = 'idle' | 'loading' | 'playing' | 'paused';


export const TTS = {
  // HTMLAudioElement for playback (cross-browser compatible)
  currentAudio: null as HTMLAudioElement | null,
  currentAudioUrl: null as string | null,
  currentButtonEl: null as HTMLElement | null,
  currentRestartBtn: null as HTMLElement | null,
  currentState: 'idle' as TTSState,
  previewAudio: null as HTMLAudioElement | null,
  audioUnlocked: false,

  /**
   * Unlock audio on Safari by playing silent audio (must be called from user gesture)
   */
  unlockAudio(): void {
    if (this.audioUnlocked) return;
    try {
      const audio = new Audio();
      // Tiny silent WAV (44 bytes)
      audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      audio.volume = 0.01;
      audio.play().then(() => {
        this.audioUnlocked = true;
        audio.pause();
      }).catch(() => {});
    } catch (e) {
      // Ignore errors
    }
  },

  /**
   * Check if currently playing
   */
  isPlaying(): boolean {
    return this.currentState === 'playing';
  },

  /**
   * Check if paused (audio loaded but not playing)
   */
  isPaused(): boolean {
    return this.currentState === 'paused';
  },

  /**
   * Check if TTS is globally enabled by admin
   */
  isGloballyEnabled(): boolean {
    return window.AppSettings?.ttsEnabled !== false;
  },

  /**
   * Speak text using streaming endpoint for faster playback on long texts
   */
  async speak(text: string, buttonEl: HTMLElement, restartBtn?: HTMLElement | null): Promise<void> {
    // Unlock audio immediately on user gesture (Safari requirement)
    this.unlockAudio();

    // Check if TTS is globally enabled by admin
    if (!this.isGloballyEnabled()) {
      console.warn('TTS is disabled by administrator');
      return;
    }

    // Store restart button reference
    if (restartBtn) {
      this.currentRestartBtn = restartBtn;
    }

    // If loading, ignore click (prevent double-fetch)
    if (this.currentState === 'loading') {
      return;
    }

    // If playing, pause
    if (this.isPlaying()) {
      this.pause();
      return;
    }

    // If paused, check if same button (compare by ID to avoid reference issues)
    if (this.isPaused() && this.currentAudio) {
      const isSameButton = this.currentButtonEl?.id === buttonEl.id;
      if (isSameButton) {
        this.resume();
        return;
      }
      // Different button - stop current and start new
      this.stop();
    }

    const cleanText = stripMarkdown(text);
    if (!cleanText) return;

    // Get TTS settings
    const settings = await window.StorageUtils.getSettings();

    this.currentButtonEl = buttonEl;
    this.currentState = 'loading';
    this.setButtonState(buttonEl, 'loading');
    this.updateRestartButtonVisibility(true);

    try {
      // Pre-create Audio element to maintain user gesture context (Safari requirement)
      this.currentAudio = new Audio();

      // Set up event handlers early
      this.currentAudio.onended = () => {
        if (this.currentState === 'playing') {
          this.cleanup();
        }
      };

      this.currentAudio.onerror = () => {
        console.error('Audio playback error');
        this.cleanup();
      };

      // Fetch audio from backend
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText,
          voice: settings.ttsVoice,
          speed: settings.ttsSpeed
        })
      });

      if (!response.ok) {
        throw new Error(`TTS failed: ${response.status}`);
      }

      // Get audio blob
      const audioBlob = await response.blob();

      // Convert to data URL using FileReader (Safari compatibility)
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read audio'));
        reader.readAsDataURL(audioBlob);
      });

      // Clean up previous blob URL if any
      if (this.currentAudioUrl && this.currentAudioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(this.currentAudioUrl);
      }
      this.currentAudioUrl = dataUrl;

      // Set source and play
      this.currentAudio.src = dataUrl;
      await this.currentAudio.play();

      // Set state AFTER audio starts
      this.currentState = 'playing';
      this.setButtonState(buttonEl, 'playing');

    } catch (error) {
      console.error('TTS error:', error);
      this.cleanup();
    }
  },

  /**
   * Pause current playback
   */
  pause(): void {
    if (this.isPlaying() && this.currentAudio) {
      this.currentAudio.pause();
      this.currentState = 'paused';
      if (this.currentButtonEl) {
        this.setButtonState(this.currentButtonEl, 'paused');
      }
    }
  },

  /**
   * Resume paused playback
   */
  resume(): void {
    if (this.isPaused() && this.currentAudio) {
      this.currentAudio.play();
      this.currentState = 'playing';
      if (this.currentButtonEl) {
        this.setButtonState(this.currentButtonEl, 'playing');
      }
    }
  },

  /**
   * Restart playback from beginning
   */
  restart(): void {
    if (this.currentAudio) {
      this.currentAudio.currentTime = 0;
      if (this.isPaused() || this.isPlaying()) {
        this.currentAudio.play();
        this.currentState = 'playing';
        if (this.currentButtonEl) {
          this.setButtonState(this.currentButtonEl, 'playing');
        }
      }
    }
  },

  /**
   * Stop and cleanup current playback
   */
  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.onended = null;
    }
    this.cleanup();
  },

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.onended = null;
      this.currentAudio = null;
    }
    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }
    if (this.currentButtonEl) {
      this.setButtonState(this.currentButtonEl, 'idle');
    }
    this.updateRestartButtonVisibility(false);
    this.currentButtonEl = null;
    this.currentRestartBtn = null;
    this.currentState = 'idle';
  },

  /**
   * Show/hide restart button
   */
  updateRestartButtonVisibility(show: boolean): void {
    if (this.currentRestartBtn) {
      this.currentRestartBtn.classList.toggle('d-none', !show);
    }
  },

  /**
   * Update button icon based on state
   */
  setButtonState(buttonEl: HTMLElement, state: TTSState): void {
    const icon = buttonEl.querySelector('i');
    if (!icon) return;

    icon.classList.remove('bi-volume-up', 'bi-pause-fill', 'bi-hourglass-split', 'bi-play-fill');
    buttonEl.classList.remove('tts-playing', 'tts-paused');

    switch (state) {
      case 'loading':
        icon.classList.add('bi-hourglass-split');
        break;
      case 'playing':
        icon.classList.add('bi-pause-fill');
        buttonEl.classList.add('tts-playing');
        break;
      case 'paused':
        icon.classList.add('bi-play-fill');
        buttonEl.classList.add('tts-paused');
        break;
      default:
        icon.classList.add('bi-volume-up');
    }
  },

  /**
   * Preview voice in settings (uses non-streaming for short preview text)
   */
  async preview(voice: string, language: string, speed: number = 1.0): Promise<void> {
    // Stop any existing preview
    if (this.previewAudio) {
      this.previewAudio.pause();
      this.previewAudio = null;
    }

    const text = PREVIEW_TEXTS[language] || PREVIEW_TEXTS['en-us'];

    try {
      // Use non-streaming endpoint for short preview text (faster for small texts)
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, speed })
      });

      if (!response.ok) {
        throw new Error(`Preview failed: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      this.previewAudio = new Audio(audioUrl);
      this.previewAudio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        this.previewAudio = null;
      };

      await this.previewAudio.play();
    } catch (error) {
      console.error('TTS preview error:', error);
      throw error;
    }
  },

  /**
   * Stop preview playback
   */
  stopPreview(): void {
    if (this.previewAudio) {
      this.previewAudio.pause();
      this.previewAudio = null;
    }
  },

  /**
   * Get voices for a language
   */
  getVoicesForLanguage(language: string): Array<{ id: string; name: string; gender: 'F' | 'M' }> {
    return TTS_VOICES[language] || [];
  },

  /**
   * Get default voice for a language
   */
  getDefaultVoice(language: string): string {
    const voices = TTS_VOICES[language];
    return voices && voices.length > 0 ? voices[0].id : 'af_heart';
  },

  /**
   * Attach TTS handler to a button
   */
  attachToButton(buttonEl: HTMLElement, text: string): void {
    buttonEl.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.speak(text, buttonEl);
    });
  }
};

// Make it globally available
declare global {
  interface Window {
    TTS: typeof TTS;
    TTS_VOICES: typeof TTS_VOICES;
  }
}

window.TTS = TTS;
window.TTS_VOICES = TTS_VOICES;
