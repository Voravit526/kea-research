/**
 * Export Manager
 */

import { StorageUtils, Chat, ChatMessage } from './storage';
import { escapeHtml } from './utils';

declare function t(key: string, vars?: Record<string, string | number>): string;

interface ExportOptions {
  includeTimestamps: boolean;
  includeMetadata: boolean;
}

// Formatter type for provider response formatting
type ProviderFormatter = (provider: string, content: string) => string;

// Formatters for different export formats
const formatters = {
  markdown: (p: string, c: string) => `### ${p}\n${c}`,
  text: (p: string, c: string) => `[${p.toUpperCase()}]\n${c}`,
  html: (p: string, c: string) => `<div class="provider"><strong>${escapeHtml(p)}</strong><div>${escapeHtml(c)}</div></div>`
};

export const ExportManager = {
  // Generic helper to extract message content with custom formatting
  getFormattedContent(
    msg: ChatMessage,
    formatter: ProviderFormatter,
    separator: string,
    escapeUserContent: boolean
  ): string {
    if (msg.role === 'user' && msg.content) {
      return escapeUserContent ? escapeHtml(msg.content) : msg.content;
    }
    if (msg.providerResponses && Object.keys(msg.providerResponses).length > 0) {
      return Object.entries(msg.providerResponses)
        .filter(([_, data]) => data.content)
        .map(([provider, data]) => formatter(provider, data.content))
        .join(separator);
    }
    const fallback = msg.content || '';
    return escapeUserContent ? escapeHtml(fallback) : fallback;
  },

  // Convenience methods using the generic helper
  getMessageContent(msg: ChatMessage): string {
    return this.getFormattedContent(msg, formatters.markdown, '\n\n', false);
  },

  getMessageContentText(msg: ChatMessage): string {
    return this.getFormattedContent(msg, formatters.text, '\n\n', false);
  },

  getMessageContentHTML(msg: ChatMessage): string {
    return this.getFormattedContent(msg, formatters.html, '', true);
  },

  getFilename(format: string, chatTitle: string): string {
    const date = new Date().toISOString().split('T')[0];
    const sanitizedTitle = (chatTitle || 'chat').replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 25);
    return `kea_${sanitizedTitle}_${date}.${format}`;
  },

  exportMarkdown(chat: Chat, messages: ChatMessage[], options: ExportOptions): string {
    const lines: string[] = [];
    if (options.includeMetadata) {
      lines.push(`# ${chat.title || t('js.chatExport')}`);
      lines.push(`**${t('js.exportDate')}**: ${new Date().toISOString()}`);
      lines.push(`**${t('js.messages')}**: ${messages.length}`);
      lines.push('', '---', '');
    }
    messages.forEach((msg, index) => {
      lines.push(`## ${t('js.message')} ${index + 1}`);
      lines.push(`**${msg.role === 'user' ? t('js.roleUser') : t('js.roleAssistant')}**`);
      if (options.includeTimestamps && msg.timestamp) {
        lines.push(`*${new Date(msg.timestamp).toLocaleString()}*`);
      }
      lines.push('', this.getMessageContent(msg), '', '---', '');
    });
    return lines.join('\n');
  },

  exportHTML(chat: Chat, messages: ChatMessage[], options: ExportOptions): string {
    const html: string[] = [];
    html.push('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">');
    html.push(`<title>${chat.title || t('js.chatExport')}</title>`);
    html.push('<style>body{font-family:system-ui,-apple-system,sans-serif;max-width:900px;margin:40px auto;padding:20px;line-height:1.6}');
    html.push('.header{border-bottom:2px solid #ddd;padding-bottom:20px;margin-bottom:30px}.message{margin-bottom:30px;padding:15px;border-radius:8px}');
    html.push('.user{background:#e3f2fd}.assistant{background:#f5f5f5}.role{font-weight:bold}.timestamp{font-size:.85em;color:#666;margin:5px 0}');
    html.push('.content{margin-top:10px}.provider{margin:15px 0;padding:12px;background:#fff;border-left:3px solid #007bff;border-radius:4px}');
    html.push('.provider strong{color:#007bff;display:block;margin-bottom:8px}.provider div{white-space:pre-wrap}</style></head><body>');
    if (options.includeMetadata) {
      html.push(`<div class="header"><h1>${chat.title || t('js.chatExport')}</h1>`);
      html.push(`<p><strong>${t('js.exportDate')}:</strong> ${new Date().toLocaleString()}</p>`);
      html.push(`<p><strong>${t('js.messages')}:</strong> ${messages.length}</p></div>`);
    }
    messages.forEach((msg) => {
      html.push(`<div class="message ${msg.role}"><div class="role">${msg.role === 'user' ? t('js.roleUser') : t('js.roleAssistant')}</div>`);
      if (options.includeTimestamps && msg.timestamp) {
        html.push(`<div class="timestamp">${new Date(msg.timestamp).toLocaleString()}</div>`);
      }
      html.push(`<div class="content">${this.getMessageContentHTML(msg)}</div></div>`);
    });
    html.push('</body></html>');
    return html.join('');
  },

  exportJSON(chat: Chat, messages: ChatMessage[], options: ExportOptions): string {
    return JSON.stringify({
      version: '1.0',
      exportDate: new Date().toISOString(),
      chat: { id: chat.id, title: chat.title, createdAt: chat.createdAt, updatedAt: chat.updatedAt },
      messages: messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content || null,
        providerResponses: msg.providerResponses || undefined,
        timestamp: options.includeTimestamps ? msg.timestamp : undefined
      })),
      messageCount: messages.length
    }, null, 2);
  },

  exportText(chat: Chat, messages: ChatMessage[], options: ExportOptions): string {
    const lines: string[] = [];
    if (options.includeMetadata) {
      lines.push(`${t('js.chat')}: ${chat.title || t('js.untitled')}`, `${t('js.exportDate')}: ${new Date().toLocaleString()}`, `${t('js.messages')}: ${messages.length}`, '', '='.repeat(60), '');
    }
    messages.forEach((msg) => {
      lines.push(`[${msg.role === 'user' ? t('js.roleUser').toUpperCase() : t('js.roleAssistant').toUpperCase()}]`);
      if (options.includeTimestamps && msg.timestamp) {
        lines.push(`${t('js.time')}: ${new Date(msg.timestamp).toLocaleString()}`);
      }
      lines.push('', this.getMessageContentText(msg), '', '-'.repeat(60), '');
    });
    return lines.join('\n');
  },

  downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async exportChat(chatId: number, format: string, options: ExportOptions): Promise<{ success: boolean; filename: string }> {
    // Fetch real chat and messages from IndexedDB
    const chat = await StorageUtils.getChat(chatId);
    if (!chat) {
      throw new Error(t('js.chatNotFound'));
    }
    const messages = await StorageUtils.getMessages(chatId);

    let content: string, mimeType: string, extension: string;
    switch (format) {
      case 'markdown':
        content = this.exportMarkdown(chat, messages, options);
        mimeType = 'text/markdown';
        extension = 'md';
        break;
      case 'html':
        content = this.exportHTML(chat, messages, options);
        mimeType = 'text/html';
        extension = 'html';
        break;
      case 'json':
        content = this.exportJSON(chat, messages, options);
        mimeType = 'application/json';
        extension = 'json';
        break;
      case 'txt':
        content = this.exportText(chat, messages, options);
        mimeType = 'text/plain';
        extension = 'txt';
        break;
      default:
        throw new Error('Invalid format');
    }

    const filename = this.getFilename(extension, chat.title);
    this.downloadFile(content, filename, mimeType);
    return { success: true, filename };
  }
};

// Make it globally available
declare global {
  interface Window {
    ExportManager: typeof ExportManager;
  }
}

window.ExportManager = ExportManager;
