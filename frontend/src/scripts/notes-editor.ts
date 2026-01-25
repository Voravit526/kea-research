/**
 * Notes Editor - Popover editor for adding notes to KEA Final Answers
 *
 * Provides a lightweight popover UI for saving personal notes on assistant messages.
 * Notes are stored in IndexedDB and persist across sessions.
 */

import { StorageUtils } from './storage';
import { KeaResearchDB } from './db';

export const NotesEditor = {
  popoverElement: null as HTMLElement | null,
  currentMessageId: null as number | null,
  currentButtonElement: null as HTMLElement | null,
  isInitialized: false,

  /**
   * Initialize the notes editor (creates popover element)
   */
  init(): void {
    if (this.isInitialized) return;
    this.createPopoverElement();
    this.attachGlobalListeners();
    this.isInitialized = true;
  },

  /**
   * Create the popover element and append to body
   */
  createPopoverElement(): void {
    const popover = document.createElement('div');
    popover.id = 'notes-editor-popover';
    popover.className = 'notes-editor-popover d-none';

    const t = window.t || ((key: string) => key); // Fallback if translations not loaded

    popover.innerHTML = `
      <div class="card border shadow-lg" style="width: 350px; max-width: 90vw;">
        <div class="card-body p-3">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="mb-0 fw-semibold">${t('js.notes.title') || 'Note'}</h6>
            <small class="text-body-secondary">
              <span id="notes-char-count">0</span>/500
            </small>
          </div>

          <textarea
            id="notes-editor-textarea"
            class="form-control mb-2"
            rows="6"
            maxlength="500"
            placeholder="${t('js.notes.placeholder') || 'Add your note...'}"
            style="resize: vertical; font-size: 0.9rem;"
          ></textarea>

          <div class="d-flex gap-2 justify-content-end">
            <button type="button" class="btn btn-sm btn-outline-secondary" id="notes-clear-btn">
              ${t('js.notes.clear') || 'Clear'}
            </button>
            <button type="button" class="btn btn-sm btn-kea" id="notes-save-btn">
              ${t('js.notes.save') || 'Save'}
            </button>
          </div>
        </div>
      </div>
    `;

    // Add scoped styles
    const style = document.createElement('style');
    style.textContent = `
      .notes-editor-popover {
        position: absolute;
        z-index: 1060;
      }

      .notes-editor-popover .card {
        background-color: var(--bs-body-bg);
        color: var(--bs-body-color);
        border-color: var(--bs-border-color);
      }

      .notes-editor-popover textarea {
        background-color: var(--bs-body-bg);
        color: var(--bs-body-color);
        border-color: var(--bs-border-color);
      }

      .notes-editor-popover textarea:focus {
        border-color: var(--bs-primary);
        box-shadow: 0 0 0 0.25rem rgba(50, 59, 28, 0.25);
      }

      [data-bs-theme="dark"] .notes-editor-popover textarea:focus {
        box-shadow: 0 0 0 0.25rem rgba(166, 141, 111, 0.25);
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(popover);
    this.popoverElement = popover;

    // Attach event listeners to popover buttons
    const textarea = popover.querySelector('#notes-editor-textarea') as HTMLTextAreaElement;
    const charCount = popover.querySelector('#notes-char-count') as HTMLElement;
    const clearBtn = popover.querySelector('#notes-clear-btn') as HTMLButtonElement;
    const saveBtn = popover.querySelector('#notes-save-btn') as HTMLButtonElement;

    if (textarea && charCount) {
      textarea.addEventListener('input', () => {
        const count = textarea.value.length;
        charCount.textContent = String(count);

        // Color feedback when near limit
        if (count >= 450) {
          charCount.classList.add('text-warning');
        } else {
          charCount.classList.remove('text-warning');
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.handleClear());
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.handleSave());
    }

    // Handle Enter key in textarea (Ctrl+Enter or Cmd+Enter to save)
    if (textarea) {
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          this.handleSave();
        }
      });
    }
  },

  /**
   * Attach global listeners for closing popover
   */
  attachGlobalListeners(): void {
    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!this.popoverElement || this.popoverElement.classList.contains('d-none')) {
        return;
      }

      const target = e.target as HTMLElement;

      // Don't close if clicking inside popover or on the notes button
      if (
        this.popoverElement.contains(target) ||
        (this.currentButtonElement && this.currentButtonElement.contains(target))
      ) {
        return;
      }

      this.hideEditor();
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.popoverElement && !this.popoverElement.classList.contains('d-none')) {
        this.hideEditor();
      }
    });

    // Close on scroll (prevents popover from being misaligned)
    window.addEventListener('scroll', () => {
      if (this.popoverElement && !this.popoverElement.classList.contains('d-none')) {
        this.hideEditor();
      }
    }, true);
  },

  /**
   * Show the notes editor popover
   */
  async showEditor(messageId: number, buttonElement: HTMLElement): Promise<void> {
    if (!this.popoverElement) return;

    this.currentMessageId = messageId;
    this.currentButtonElement = buttonElement;

    // Load existing note
    const note = await this.loadNote(messageId);

    const textarea = this.popoverElement.querySelector('#notes-editor-textarea') as HTMLTextAreaElement;
    const charCount = this.popoverElement.querySelector('#notes-char-count') as HTMLElement;

    if (textarea) {
      textarea.value = note;
      textarea.focus();

      // Update character count
      if (charCount) {
        charCount.textContent = String(note.length);
        if (note.length >= 450) {
          charCount.classList.add('text-warning');
        } else {
          charCount.classList.remove('text-warning');
        }
      }
    }

    // Position and show popover
    this.positionPopover(buttonElement);
    this.popoverElement.classList.remove('d-none');
  },

  /**
   * Hide the notes editor popover
   */
  hideEditor(): void {
    if (this.popoverElement) {
      this.popoverElement.classList.add('d-none');
    }
    this.currentMessageId = null;
    this.currentButtonElement = null;
  },

  /**
   * Position the popover near the button
   */
  positionPopover(buttonElement: HTMLElement): void {
    if (!this.popoverElement) return;

    const buttonRect = buttonElement.getBoundingClientRect();
    const popoverHeight = 280; // Estimated height
    const padding = 10;

    // Try to position below button
    let top = buttonRect.bottom + padding + window.scrollY;
    let left = buttonRect.right - 350 + window.scrollX; // Align right edge with button

    // If would overflow bottom, position above
    if (top + popoverHeight > window.innerHeight + window.scrollY) {
      top = buttonRect.top - popoverHeight - padding + window.scrollY;
    }

    // Ensure doesn't overflow left edge
    if (left < padding) {
      left = padding;
    }

    // Ensure doesn't overflow right edge
    if (left + 350 > window.innerWidth) {
      left = window.innerWidth - 350 - padding;
    }

    this.popoverElement.style.top = `${top}px`;
    this.popoverElement.style.left = `${left}px`;
  },

  /**
   * Load note from IndexedDB
   */
  async loadNote(messageId: number): Promise<string> {
    try {
      const message = await KeaResearchDB.get('messages', messageId);
      return message?.note || '';
    } catch (error) {
      console.error('Error loading note:', error);
      return '';
    }
  },

  /**
   * Handle Clear button click
   */
  handleClear(): void {
    const textarea = this.popoverElement?.querySelector('#notes-editor-textarea') as HTMLTextAreaElement;
    const charCount = this.popoverElement?.querySelector('#notes-char-count') as HTMLElement;

    if (textarea) {
      textarea.value = '';
      textarea.focus();
    }

    if (charCount) {
      charCount.textContent = '0';
      charCount.classList.remove('text-warning');
    }
  },

  /**
   * Handle Save button click
   */
  async handleSave(): Promise<void> {
    if (this.currentMessageId === null) return;

    const textarea = this.popoverElement?.querySelector('#notes-editor-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const note = textarea.value.trim();

    try {
      // Save to IndexedDB
      await StorageUtils.updateMessageNote(this.currentMessageId, note);

      // Update button icon
      if (this.currentButtonElement) {
        this.updateButtonIcon(this.currentButtonElement, note.length > 0);
      }

      // Hide popover
      this.hideEditor();
    } catch (error) {
      console.error('Error saving note:', error);
    }
  },

  /**
   * Update button icon based on note existence
   */
  updateButtonIcon(buttonElement: HTMLElement, hasNote: boolean): void {
    const icon = buttonElement.querySelector('i');
    if (!icon) return;

    if (hasNote) {
      // Change to filled pencil icon and add gold color
      icon.classList.remove('bi-pencil-square');
      icon.classList.add('bi-pencil-fill');
      icon.style.color = '#ffc107';
    } else {
      // Change back to outlined square pencil and remove color
      icon.classList.remove('bi-pencil-fill');
      icon.classList.add('bi-pencil-square');
      icon.style.color = '';
    }
  },

  /**
   * Update notes button with message ID and icon state
   * Called after message is saved to IndexedDB
   */
  async updateNotesButton(messageId: number, buttonId: string): Promise<void> {
    const button = document.getElementById(buttonId);
    if (!button) return;

    // Set message ID on button
    button.setAttribute('data-message-id', String(messageId));

    // Load note and update icon
    const note = await this.loadNote(messageId);
    this.updateButtonIcon(button, note.length > 0);
  },
};

// Global export
declare global {
  interface Window {
    NotesEditor: typeof NotesEditor;
    t: (key: string, vars?: Record<string, string | number>) => string;
  }
}

window.NotesEditor = NotesEditor;
