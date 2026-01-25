/**
 * Sidebar Manager
 */

import { StorageUtils, Chat } from './storage';
import { escapeHtml, formatDate } from './utils';
import { UI_CONFIG } from './constants';

export const SidebarManager = {
  sidebar: null as HTMLElement | null,
  sidebarToggle: null as HTMLElement | null,
  mainContent: null as HTMLElement | null,
  chatInputWrapper: null as HTMLElement | null,
  chatHistoryList: null as HTMLElement | null,
  chatHistoryEmpty: null as HTMLElement | null,
  isMobile: false,
  activeChatId: null as number | null,

  async init(): Promise<void> {
    this.sidebar = document.getElementById('sidebarNav');
    this.sidebarToggle = document.getElementById('sidebarToggle');
    this.mainContent = document.getElementById('mainContent');
    this.chatInputWrapper = document.getElementById('chatInputWrapper');
    this.chatHistoryList = document.getElementById('chatHistoryList');
    this.chatHistoryEmpty = document.getElementById('chatHistoryEmpty');

    if (!this.sidebar || !this.sidebarToggle || !this.mainContent || !this.chatInputWrapper) {
      console.warn('Sidebar elements not found');
      return;
    }

    this.checkScreenSize();
    await this.loadSavedState();
    this.updateLayout();
    this.setupEventListeners();
    this.setupChatListDelegation();

    this.sidebarToggle.addEventListener('click', async () => {
      this.sidebar?.classList.toggle('d-none');
      this.sidebar?.classList.toggle('d-flex');
      this.updateLayout();
      await this.saveState();
    });

    const sidebarClose = document.getElementById('sidebarClose');
    if (sidebarClose) {
      sidebarClose.addEventListener('click', async () => {
        this.sidebar?.classList.add('d-none');
        this.sidebar?.classList.remove('d-flex');
        this.updateLayout();
        await this.saveState();
      });
    }

    window.addEventListener('resize', () => {
      this.checkScreenSize();
      this.updateLayout();
    });
  },

  async loadSavedState(): Promise<void> {
    if (this.isMobile || !this.sidebar) return;
    const settings = await StorageUtils.getSettings();
    if (settings.sidebarHidden) {
      this.sidebar.classList.add('d-none');
      this.sidebar.classList.remove('d-flex');
    }
  },

  async saveState(): Promise<void> {
    if (this.isMobile || !this.sidebar) return;
    const settings = await StorageUtils.getSettings();
    settings.sidebarHidden = this.sidebar.classList.contains('d-none');
    await StorageUtils.saveSettings(settings);
  },

  checkScreenSize(): void {
    if (!this.sidebar) return;
    this.isMobile = window.innerWidth < UI_CONFIG.SIDEBAR_BREAKPOINT;
    if (this.isMobile) {
      this.sidebar.classList.add('d-none', 'position-fixed', 'top-0', 'start-0', 'h-100');
      this.sidebar.classList.remove('d-flex');
      this.sidebar.style.width = UI_CONFIG.SIDEBAR_WIDTH;
      this.sidebar.style.zIndex = UI_CONFIG.SIDEBAR_Z_INDEX;
    } else {
      this.sidebar.classList.remove('position-fixed', 'top-0', 'start-0');
      this.sidebar.style.width = '';
      this.sidebar.style.zIndex = '';
    }
  },

  updateLayout(): void {
    if (!this.sidebar || !this.mainContent || !this.chatInputWrapper) return;
    const sidebarHidden = this.sidebar.classList.contains('d-none');

    if (this.isMobile) {
      this.mainContent.classList.remove('col-lg-10');
      this.mainContent.classList.add('col-12');
      this.chatInputWrapper.classList.remove('w-50');
    } else {
      if (sidebarHidden) {
        this.mainContent.classList.remove('col-12', 'col-lg-10');
        this.mainContent.classList.add('col-12');
        this.chatInputWrapper.classList.add('w-50');
      } else {
        this.mainContent.classList.remove('col-12');
        this.mainContent.classList.add('col-12', 'col-lg-10');
        this.chatInputWrapper.classList.add('w-50');
      }
    }
  },

  // ========== Chat History Functions ==========

  async loadChatHistory(): Promise<void> {
    if (!this.chatHistoryList) return;

    try {
      const chats = await StorageUtils.getAllChats();
      this.renderChatList(chats);
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  },

  renderChatList(chats: Chat[]): void {
    if (!this.chatHistoryList || !this.chatHistoryEmpty) return;

    // Filter out layer chats (show only top-level chats)
    const topLevelChats = chats.filter((c: Chat) => !c.parentMessageId);

    if (topLevelChats.length === 0) {
      this.chatHistoryEmpty.classList.remove('d-none');
      // Remove all chat items but keep the empty message
      const chatItems = this.chatHistoryList.querySelectorAll('.chat-history-item');
      chatItems.forEach(item => item.remove());
      return;
    }

    this.chatHistoryEmpty.classList.add('d-none');

    // Generate HTML for chat items
    const chatItemsHtml = topLevelChats.map(chat => {
      const isActive = chat.id === this.activeChatId;
      const isBookmarked = chat.isBookmarked === true;
      const title = escapeHtml(chat.title || 'Untitled');
      const date = formatDate(chat.updatedAt);
      const bookmarkIcon = isBookmarked ? 'bi-bookmark-fill' : 'bi-bookmark';
      const bookmarkClass = isBookmarked ? '' : 'opacity-0';

      return `
        <div class="chat-history-item list-group-item list-group-item-action border-0 rounded mb-1 p-2 ${isActive ? 'active bg-kea' : 'bg-transparent'}"
             data-chat-id="${chat.id}" data-bookmarked="${isBookmarked}" role="button">
          <div class="d-flex justify-content-between align-items-start">
            <div class="flex-grow-1 overflow-hidden me-2">
              <div class="fw-semibold text-truncate small">${title}</div>
              <small class="${isActive ? 'text-white-50' : 'text-muted'}">${date}</small>
            </div>
            <div class="d-flex gap-1">
              <button class="btn btn-sm btn-link ${isActive ? 'text-white' : 'text-warning'} p-0 chat-bookmark-btn ${bookmarkClass}"
                      data-chat-id="${chat.id}" title="${isBookmarked ? 'Remove bookmark' : 'Bookmark'}">
                <i class="bi ${bookmarkIcon}"></i>
              </button>
              <button class="btn btn-sm btn-link ${isActive ? 'text-white' : 'text-danger'} p-0 chat-delete-btn opacity-0"
                      data-chat-id="${chat.id}" title="Delete">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Replace content (keep empty message element)
    const existingItems = this.chatHistoryList.querySelectorAll('.chat-history-item');
    existingItems.forEach(item => item.remove());
    this.chatHistoryEmpty.insertAdjacentHTML('beforebegin', chatItemsHtml);

    // Note: Event listeners are set up via delegation in setupChatListDelegation()
    // which is called once during init, not on every render
  },

  /**
   * Set up event delegation for chat list (called once during init)
   */
  setupChatListDelegation(): void {
    if (!this.chatHistoryList) return;

    // Delegated click handler for all chat list interactions
    this.chatHistoryList.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;

      // Handle delete button click
      const deleteBtn = target.closest('.chat-delete-btn') as HTMLElement | null;
      if (deleteBtn) {
        e.stopPropagation();
        const chatId = parseInt(deleteBtn.getAttribute('data-chat-id') || '');
        if (!isNaN(chatId) && chatId > 0) {
          await this.onChatDelete(chatId);
        }
        return;
      }

      // Handle bookmark button click
      const bookmarkBtn = target.closest('.chat-bookmark-btn') as HTMLElement | null;
      if (bookmarkBtn) {
        e.stopPropagation();
        const chatId = parseInt(bookmarkBtn.getAttribute('data-chat-id') || '');
        if (!isNaN(chatId) && chatId > 0) {
          await this.onChatBookmark(chatId, bookmarkBtn);
        }
        return;
      }

      // Handle chat item click (load chat)
      const chatItem = target.closest('.chat-history-item') as HTMLElement | null;
      if (chatItem) {
        const chatId = parseInt(chatItem.getAttribute('data-chat-id') || '');
        if (!isNaN(chatId) && chatId > 0) {
          this.onChatClick(chatId);
        }
      }
    });

    // Delegated mouseenter/mouseleave for hover effects
    this.chatHistoryList.addEventListener('mouseenter', (e) => {
      const target = e.target as HTMLElement;
      const chatItem = target.closest('.chat-history-item');
      if (chatItem) {
        const deleteBtn = chatItem.querySelector('.chat-delete-btn');
        const bookmarkBtn = chatItem.querySelector('.chat-bookmark-btn');
        if (deleteBtn) deleteBtn.classList.remove('opacity-0');
        if (bookmarkBtn) bookmarkBtn.classList.remove('opacity-0');
      }
    }, true);

    this.chatHistoryList.addEventListener('mouseleave', (e) => {
      const target = e.target as HTMLElement;
      const chatItem = target.closest('.chat-history-item');
      if (chatItem) {
        const deleteBtn = chatItem.querySelector('.chat-delete-btn');
        const bookmarkBtn = chatItem.querySelector('.chat-bookmark-btn');
        const isBookmarked = chatItem.getAttribute('data-bookmarked') === 'true';
        if (deleteBtn) deleteBtn.classList.add('opacity-0');
        // Keep bookmark icon visible if bookmarked
        if (bookmarkBtn && !isBookmarked) bookmarkBtn.classList.add('opacity-0');
      }
    }, true);
  },

  async onChatClick(chatId: number): Promise<void> {
    // Load chat via ChatManager
    if (window.ChatManager && typeof window.ChatManager.loadChat === 'function') {
      await window.ChatManager.loadChat(chatId);
      this.setActiveChat(chatId);
    }
  },

  async onChatDelete(chatId: number): Promise<void> {
    if (!confirm('Delete this conversation?')) return;

    try {
      await StorageUtils.deleteChat(chatId);

      // If deleting active chat, start new chat
      if (chatId === this.activeChatId) {
        if (window.ChatManager && typeof window.ChatManager.newChat === 'function') {
          await window.ChatManager.newChat();
        }
        this.activeChatId = null;
      }

      // Refresh the list
      await this.loadChatHistory();
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  },

  setActiveChat(chatId: number | null): void {
    this.activeChatId = chatId;

    // Update active state in UI
    if (this.chatHistoryList) {
      this.chatHistoryList.querySelectorAll('.chat-history-item').forEach(item => {
        const itemChatId = parseInt(item.getAttribute('data-chat-id') || '0');
        const isActive = itemChatId === chatId;

        // Toggle active and background classes
        item.classList.toggle('active', isActive);
        item.classList.toggle('bg-kea', isActive);
        item.classList.toggle('bg-transparent', !isActive);

        // Update date text color
        const dateEl = item.querySelector('small');
        if (dateEl) {
          dateEl.classList.toggle('text-white-50', isActive);
          dateEl.classList.toggle('text-muted', !isActive);
        }

        // Update delete button color
        const deleteBtn = item.querySelector('.chat-delete-btn');
        if (deleteBtn) {
          deleteBtn.classList.toggle('text-white', isActive);
          deleteBtn.classList.toggle('text-danger', !isActive);
        }

        // Update bookmark button color
        const bookmarkBtn = item.querySelector('.chat-bookmark-btn');
        if (bookmarkBtn) {
          bookmarkBtn.classList.toggle('text-white', isActive);
          bookmarkBtn.classList.toggle('text-warning', !isActive);
        }
      });
    }
  },

  async onChatBookmark(chatId: number, btnEl: HTMLElement): Promise<void> {
    try {
      const newState = await StorageUtils.toggleBookmark(chatId);

      // Update button icon
      const icon = btnEl.querySelector('i');
      if (icon) {
        if (newState) {
          icon.classList.remove('bi-bookmark');
          icon.classList.add('bi-bookmark-fill');
        } else {
          icon.classList.remove('bi-bookmark-fill');
          icon.classList.add('bi-bookmark');
        }
      }

      // Update data attribute on parent
      const parentItem = btnEl.closest('.chat-history-item');
      if (parentItem) {
        parentItem.setAttribute('data-bookmarked', String(newState));
      }

      // Update bookmark badge in navbar
      if (window.Bookmarks && typeof window.Bookmarks.updateBadge === 'function') {
        await window.Bookmarks.updateBadge();
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  },

  // Listen for external refresh events
  setupEventListeners(): void {
    window.addEventListener('refreshSidebar', () => {
      this.loadChatHistory();
    });

    window.addEventListener('loadChat', async (e: Event) => {
      const customEvent = e as CustomEvent;
      const chatId = customEvent.detail?.chatId;
      if (chatId) {
        await this.onChatClick(chatId);
      }
    });
  },

};

// Make it globally available
declare global {
  interface Window {
    SidebarManager: typeof SidebarManager;
    Bookmarks?: {
      updateBadge(): Promise<void>;
    };
  }
}

window.SidebarManager = SidebarManager;
