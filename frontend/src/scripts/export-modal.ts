/**
 * Export Modal Logic
 */

import { ExportManager } from './export';
import { ChatManager } from './chat';

declare function t(key: string, vars?: Record<string, string | number>): string;
declare const bootstrap: any;

export const ExportModal = {
  init(): void {
    const exportChatBtn = document.getElementById('exportChatBtn');
    if (!exportChatBtn) return;

    exportChatBtn.addEventListener('click', async () => {
      const formatInput = document.querySelector('input[name="exportFormat"]:checked') as HTMLInputElement | null;
      const format = formatInput?.value || 'markdown';
      const includeTimestamps = (document.getElementById('includeTimestamps') as HTMLInputElement | null)?.checked ?? true;
      const includeMetadata = (document.getElementById('includeMetadata') as HTMLInputElement | null)?.checked ?? true;

      const options = {
        includeTimestamps,
        includeMetadata
      };

      const statusEl = document.getElementById('exportStatus');
      if (statusEl) {
        statusEl.classList.remove('d-none');
      }

      // Get the current active chat ID
      const chatId = ChatManager.currentChatId;
      if (chatId === null) {
        if (statusEl) {
          statusEl.innerHTML = `<div class="d-flex align-items-center text-danger"><i class="bi bi-x-circle me-2"></i><span>${t('js.noChatToExport')}</span></div>`;
        }
        return;
      }

      try {
        const result = await ExportManager.exportChat(chatId, format, options);
        if (statusEl) {
          statusEl.innerHTML = `<div class="d-flex align-items-center"><i class="bi bi-check-circle text-success me-2"></i><span>${t('js.exportSuccess', { filename: result.filename })}</span></div>`;
        }
      } catch (error) {
        if (statusEl) {
          statusEl.innerHTML = `<div class="d-flex align-items-center text-danger"><i class="bi bi-x-circle me-2"></i><span>${t('js.exportFailed', { error: (error as Error).message })}</span></div>`;
        }
      }
    });
  }
};

// Make it globally available
declare global {
  interface Window {
    ExportModal: typeof ExportModal;
  }
}

window.ExportModal = ExportModal;
