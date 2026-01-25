/**
 * Layer Selection Modal - Show list of research layers when multiple exist
 */

import { StorageUtils, type Chat } from './storage';

declare function t(key: string): string;

export const LayerSelectionModal = {
  modalEl: null as HTMLElement | null,
  isInitialized: false,
  currentParentMessageId: null as number | null,

  /**
   * Initialize modal element
   */
  init(): void {
    if (this.isInitialized) return;

    // Create modal HTML
    const modalHTML = `
      <div class="modal fade" id="layerSelectionModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="bi bi-stack me-2"></i>
                <span>${t('layers.selectLayer') || 'Select Research Layer'}</span>
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-0">
              <div id="layerList" class="list-group list-group-flush">
                <!-- Dynamic layer items will be inserted here -->
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Append to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modalEl = document.getElementById('layerSelectionModal');

    this.isInitialized = true;
  },

  /**
   * Show modal with layers for a specific message
   */
  async show(parentMessageId: number): Promise<void> {
    if (!this.isInitialized) {
      this.init();
    }

    this.currentParentMessageId = parentMessageId;

    // Fetch layer chats (chats with this parentMessageId)
    const layerChats = await StorageUtils.getLayerChatsForMessage(parentMessageId);

    // Render layer list
    await this.renderLayerList(layerChats);

    // Show modal using Bootstrap's Modal API
    if (this.modalEl && window.bootstrap) {
      const bsModal = new window.bootstrap.Modal(this.modalEl);
      bsModal.show();
    }
  },

  /**
   * Render the list of layer chats
   */
  async renderLayerList(layerChats: Chat[]): Promise<void> {
    const listContainer = document.getElementById('layerList');
    if (!listContainer) return;

    // Clear existing items
    listContainer.innerHTML = '';

    if (layerChats.length === 0) {
      listContainer.innerHTML = `
        <div class="p-4 text-center text-muted">
          <i class="bi bi-inbox fs-3 d-block mb-2"></i>
          <p class="mb-0">No research layers yet</p>
        </div>
      `;
      return;
    }

    // Create items for each layer chat
    for (const chat of layerChats) {
      const item = await this.createLayerItem(chat);
      listContainer.insertAdjacentHTML('beforeend', item);
    }

    // Attach click handlers
    listContainer.querySelectorAll('[data-chat-id]').forEach(item => {
      item.addEventListener('click', async (e) => {
        e.preventDefault();
        const chatId = parseInt(item.getAttribute('data-chat-id') || '0', 10);
        if (chatId) {
          await this.selectLayer(chatId);
        }
      });
    });
  },

  /**
   * Create HTML for a single layer chat item
   */
  async createLayerItem(chat: Chat): Promise<string> {
    // Get message count for this chat
    const messages = await StorageUtils.getMessages(chat.id!);
    const messageCount = messages.length;

    // Format timestamp
    const createdAt = new Date(chat.createdAt);
    const timestamp = createdAt.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Truncate chat title for display
    const displayText = chat.title.length > 60
      ? chat.title.substring(0, 60) + '...'
      : chat.title;

    return `
      <button class="list-group-item list-group-item-action d-flex justify-content-between align-items-start py-3 px-4"
              data-chat-id="${chat.id}"
              style="border: none; border-bottom: 1px solid var(--bs-border-color);">
        <div class="flex-grow-1 text-start me-3">
          <div class="fw-semibold text-truncate mb-1" style="max-width: 400px;" title="${this.escapeHtml(chat.title)}">
            ${this.escapeHtml(displayText)}
          </div>
          <small class="text-muted">
            <i class="bi bi-chat-dots me-1"></i>${messageCount} ${messageCount === 1 ? 'message' : 'messages'}
            <span class="mx-2">•</span>
            <i class="bi bi-calendar3 me-1"></i>${timestamp}
          </small>
        </div>
        <div class="flex-shrink-0">
          <i class="bi bi-chevron-right text-muted"></i>
        </div>
      </button>
    `;
  },

  /**
   * Handle layer chat selection
   */
  async selectLayer(chatId: number): Promise<void> {
    // Hide modal
    if (this.modalEl && window.bootstrap) {
      const bsModal = window.bootstrap.Modal.getInstance(this.modalEl);
      if (bsModal) {
        bsModal.hide();
      }
    }

    // Load the selected layer chat via ChatManager
    if (window.ChatManager) {
      await window.ChatManager.loadChat(chatId);
    }
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },
};

// Global type declarations
declare global {
  interface Window {
    LayerSelectionModal: typeof LayerSelectionModal;
    bootstrap?: {
      Modal: new (element: HTMLElement) => {
        show(): void;
        hide(): void;
      };
      Modal: {
        getInstance(element: HTMLElement): { show(): void; hide(): void } | null;
      };
    };
  }
}

window.LayerSelectionModal = LayerSelectionModal;
