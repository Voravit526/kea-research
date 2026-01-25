/**
 * Layer Manager - Minimal utilities for research layer operations
 */

import { StorageUtils, type Chat } from './storage';

declare function t(key: string, vars?: Record<string, string | number>): string;

export const LayerManager = {
  /**
   * Initialize layer manager
   */
  async init(): Promise<void> {
    // Attach delete button handler
    const deleteBtn = document.getElementById('deleteLayerBtn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        this.deleteCurrentLayer();
      });
    }
  },

  /**
   * Check if currently viewing a layer chat
   */
  isInLayer(): boolean {
    if (!window.ChatManager || !window.ChatManager.currentChatId) {
      return false;
    }
    const breadcrumbNav = document.querySelector('#layerView nav[aria-label="breadcrumb"]');
    return breadcrumbNav ? !breadcrumbNav.classList.contains('d-none') : false;
  },

  /**
   * Get parent chat from current layer chat
   */
  async getParentChat(): Promise<Chat | null> {
    if (!window.ChatManager || !window.ChatManager.currentChatId) {
      return null;
    }

    const currentChat = await StorageUtils.getChat(window.ChatManager.currentChatId);
    if (!currentChat || !currentChat.parentMessageId) {
      return null;
    }

    const parentMsg = await StorageUtils.getParentMessage(window.ChatManager.currentChatId);
    if (!parentMsg) {
      return null;
    }

    return await StorageUtils.getChat(parentMsg.chatId);
  },

  /**
   * Delete current layer chat
   */
  async deleteCurrentLayer(): Promise<void> {
    if (!window.ChatManager || !window.ChatManager.currentChatId) {
      return;
    }

    const currentChat = await StorageUtils.getChat(window.ChatManager.currentChatId);
    if (!currentChat || !currentChat.parentMessageId) {
      return;
    }

    // Delete layer confirmation message
    const confirmMsg = t('layers.deleteConfirm') || 'Delete this research layer and all its messages?';
    if (!confirm(confirmMsg)) {
      return;
    }

    const parentMsg = await StorageUtils.getParentMessage(window.ChatManager.currentChatId);

    // Delete chat (cascade deletes messages)
    await StorageUtils.deleteChat(window.ChatManager.currentChatId);

    // Load parent chat
    if (parentMsg && window.ChatManager) {
      await window.ChatManager.loadChat(parentMsg.chatId);
    }
  },
};

// Make LayerManager globally available
declare global {
  interface Window {
    LayerManager: typeof LayerManager;
  }
}

window.LayerManager = LayerManager;
