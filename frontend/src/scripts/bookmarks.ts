/**
 * Bookmarks Module - Manage chat bookmarks and UI updates
 */

import { StorageUtils, type Chat } from './storage';
import { escapeHtml, formatDate } from './utils';

export const Bookmarks = {
  /**
   * Initialize bookmarks - update badge count on load
   */
  async init(): Promise<void> {
    await this.updateBadge();

    // Setup modal event listener
    const modal = document.getElementById('bookmarksModal');
    if (modal) {
      modal.addEventListener('show.bs.modal', () => {
        this.loadModal();
      });
    }
  },

  /**
   * Toggle bookmark state for a chat
   */
  async toggle(chatId: number): Promise<boolean> {
    const newState = await StorageUtils.toggleBookmark(chatId);
    await this.updateBadge();
    return newState;
  },

  /**
   * Update the navbar bookmark icon (filled if any bookmarks exist)
   */
  async updateBadge(): Promise<void> {
    const count = await StorageUtils.getBookmarkCount();
    const icon = document.getElementById('bookmarksIcon');

    if (icon) {
      if (count > 0) {
        icon.classList.remove('bi-journal-bookmark');
        icon.classList.add('bi-journal-bookmark-fill');
      } else {
        icon.classList.remove('bi-journal-bookmark-fill');
        icon.classList.add('bi-journal-bookmark');
      }
    }
  },

  /**
   * Load bookmarked chats into the modal
   */
  async loadModal(): Promise<void> {
    const listEl = document.getElementById('bookmarksList');
    const emptyEl = document.getElementById('bookmarksEmpty');

    if (!listEl) return;

    const chats = await StorageUtils.getBookmarkedChats();

    if (chats.length === 0) {
      listEl.innerHTML = '';
      if (emptyEl) emptyEl.classList.remove('d-none');
      return;
    }

    if (emptyEl) emptyEl.classList.add('d-none');

    listEl.innerHTML = chats.map((chat: Chat) => `
      <a href="#" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center bookmark-item"
         data-chat-id="${chat.id}">
        <div class="me-auto">
          <div class="fw-medium">${escapeHtml(chat.title)}</div>
          <small class="text-muted">${formatDate(chat.updatedAt)}</small>
        </div>
        <button class="btn btn-link btn-sm text-danger p-0 unbookmark-btn"
                data-chat-id="${chat.id}" title="Remove bookmark">
          <i class="bi bi-bookmark-x"></i>
        </button>
      </a>
    `).join('');

    // Attach click handlers
    listEl.querySelectorAll('.bookmark-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        // Don't navigate if clicking unbookmark button
        if (target.closest('.unbookmark-btn')) {
          e.preventDefault();
          return;
        }

        const chatId = item.getAttribute('data-chat-id');
        if (chatId) {
          // Close modal and load chat
          const modalEl = document.getElementById('bookmarksModal');
          const modal = modalEl ? window.bootstrap?.Modal.getInstance(modalEl) : null;
          if (modal) modal.hide();

          // Dispatch event to load the chat (handled by sidebar.ts or chat.ts)
          window.dispatchEvent(new CustomEvent('loadChat', { detail: { chatId: parseInt(chatId) } }));
        }
      });
    });

    // Attach unbookmark handlers
    listEl.querySelectorAll('.unbookmark-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const chatId = btn.getAttribute('data-chat-id');
        if (chatId) {
          await this.toggle(parseInt(chatId));
          // Refresh the modal list
          await this.loadModal();
          // Update sidebar if visible
          window.dispatchEvent(new CustomEvent('refreshSidebar'));
        }
      });
    });
  }
};

// Make it globally available
declare global {
  interface Window {
    Bookmarks: typeof Bookmarks;
    bootstrap?: {
      Toast: new (el: HTMLElement) => { show(): void };
      Modal: {
        getInstance(el: HTMLElement): { hide(): void } | null;
      };
    };
  }
}

window.Bookmarks = Bookmarks;
