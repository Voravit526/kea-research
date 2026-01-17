/**
 * Voice Input Module using Web Speech API (SpeechRecognition)
 */

// Type declarations for SpeechRecognition API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
    VoiceInput: typeof VoiceInput;
  }
}

export const VoiceInput = {
  recognition: null as SpeechRecognition | null,
  isListening: false,
  buttonEl: null as HTMLElement | null,
  textareaEl: null as HTMLTextAreaElement | null,

  /**
   * Check if speech recognition is supported
   */
  isSupported(): boolean {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  },

  /**
   * Initialize voice input with button and textarea
   */
  init(): void {
    if (!this.isSupported()) {
      console.warn('Speech recognition is not supported in this browser');
      // Hide the microphone button if not supported
      const micBtn = document.getElementById('micBtn');
      if (micBtn) {
        micBtn.style.display = 'none';
      }
      return;
    }

    // Get elements
    this.buttonEl = document.getElementById('micBtn');
    this.textareaEl = document.getElementById('chatInput') as HTMLTextAreaElement;

    if (!this.buttonEl || !this.textareaEl) {
      return;
    }

    // Setup recognition
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognitionAPI();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = this.getLanguage();

    // Handle results
    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Update textarea with recognized text
      if (this.textareaEl) {
        const currentText = this.textareaEl.value;
        if (finalTranscript) {
          // Add final transcript with a space if there's existing text
          this.textareaEl.value = currentText
            ? currentText + ' ' + finalTranscript
            : finalTranscript;
        }
      }
    };

    // Handle errors
    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      this.setButtonState('idle');
      this.isListening = false;

      // Show user-friendly error message
      if (event.error === 'not-allowed') {
        this.showToast('Microphone access denied. Please allow microphone permissions.');
      } else if (event.error === 'no-speech') {
        this.showToast('No speech detected. Please try again.');
      } else if (event.error !== 'aborted') {
        this.showToast('Speech recognition error. Please try again.');
      }
    };

    // Handle end
    this.recognition.onend = () => {
      this.setButtonState('idle');
      this.isListening = false;
    };

    // Handle start
    this.recognition.onstart = () => {
      this.setButtonState('recording');
      this.isListening = true;
    };

    // Attach click handler
    this.buttonEl.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggle();
    });
  },

  /**
   * Get current language for recognition
   */
  getLanguage(): string {
    // Try to get from settings or document
    const htmlLang = document.documentElement.lang || 'en';
    const langMap: Record<string, string> = {
      'en': 'en-US',
      'es': 'es-ES',
      'pt': 'pt-BR',
      'fr': 'fr-FR',
      'it': 'it-IT'
    };
    return langMap[htmlLang] || 'en-US';
  },

  /**
   * Toggle recording on/off
   */
  toggle(): void {
    if (this.isListening) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  },

  /**
   * Start recording
   */
  startRecording(): void {
    if (!this.recognition) return;

    try {
      // Update language before starting (in case it changed)
      this.recognition.lang = this.getLanguage();
      this.recognition.start();
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  },

  /**
   * Stop recording
   */
  stopRecording(): void {
    if (!this.recognition) return;

    try {
      this.recognition.stop();
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  },

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.isListening;
  },

  /**
   * Update button state
   */
  setButtonState(state: 'idle' | 'recording'): void {
    if (!this.buttonEl) return;

    const icon = this.buttonEl.querySelector('i');
    if (!icon) return;

    if (state === 'recording') {
      icon.classList.remove('bi-mic');
      icon.classList.add('bi-mic-fill');
      this.buttonEl.classList.add('text-danger', 'mic-recording');
      this.buttonEl.classList.remove('text-body-secondary');
    } else {
      icon.classList.remove('bi-mic-fill');
      icon.classList.add('bi-mic');
      this.buttonEl.classList.remove('text-danger', 'mic-recording');
      this.buttonEl.classList.add('text-body-secondary');
    }
  },

  /**
   * Show a toast notification
   */
  showToast(message: string): void {
    // Check if Bootstrap toast is available
    const toastContainer = document.getElementById('toastContainer');
    if (toastContainer && window.bootstrap?.Toast) {
      const toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'alert');
      toastEl.innerHTML = `
        <div class="toast-header">
          <i class="bi bi-mic-mute me-2 text-danger"></i>
          <strong class="me-auto">Voice Input</strong>
          <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body">${message}</div>
      `;
      toastContainer.appendChild(toastEl);
      const toast = new window.bootstrap.Toast(toastEl);
      toast.show();
      toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    } else {
      // Fallback to console
      console.warn(message);
    }
  }
};

window.VoiceInput = VoiceInput;
