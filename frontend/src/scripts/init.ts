/**
 * Initialization Script
 */

import { KeaResearchDB } from './db';
import { StorageUtils } from './storage';
import { ThemeManager } from './theme';
import { ImageCompressor } from './image';
import { SettingsModal } from './settings-modal';
import { ExportModal } from './export-modal';
import { AttachmentManager } from './attachments';
import { ChatManager } from './chat';
import { SidebarManager } from './sidebar';
import { UserAuth } from './user-auth';
import { VoiceInput } from './voice-input';
import { Bookmarks } from './bookmarks';
import { setProviderCache } from './constants';
import { PipelineManager } from './pipeline';
import { initProviderSetSelector } from './provider-set-selector';
import { LayerManager } from './layer-manager';
import { TextSelectionTooltip } from './text-selection-tooltip';
import { LayerSelectionModal } from './layer-selection-modal';
import { NotesEditor } from './notes-editor';

declare function t(key: string, vars?: Record<string, string | number>): string;

/**
 * Safe module initialization wrapper
 */
async function safeInit(name: string, fn: () => Promise<void> | void): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch (error) {
    console.error(`Failed to initialize ${name}:`, error);
    return false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication first
  const authenticated = await UserAuth.init();
  if (!authenticated) {
    return; // Will redirect to login
  }

  // Initialize database (critical - fail fast)
  try {
    await KeaResearchDB.init();
  } catch (error) {
    console.error('Critical: Failed to initialize database:', error);
    return;
  }

  const settings = await StorageUtils.getSettings();

  // Load provider cache for icon consistency between admin and frontend
  try {
    const response = await fetch('/api/providers');
    const data = await response.json();
    if (data.providers) {
      setProviderCache(data.providers);
    }
  } catch (error) {
    console.error('Failed to load provider cache:', error);
  }

  // Initialize provider set selector
  await safeInit('ProviderSetSelector', () => initProviderSetSelector());

  // Apply theme from localStorage (fast, already set by inline script)
  ThemeManager.init();
  ThemeManager.listen();

  // Update greeting with user's display name or settings name for guests
  const welcomeGreeting = document.getElementById('welcomeGreeting');
  if (welcomeGreeting) {
    const displayName = UserAuth.isAuthenticated() ? UserAuth.getDisplayName() : settings.userName;
    welcomeGreeting.textContent = t('chat.welcomeGreeting', { userName: displayName });
  }

  // Set copyright year
  const copyrightYear = document.getElementById('copyrightYear');
  if (copyrightYear) {
    const startYear = 2025;
    const currentYear = new Date().getFullYear();
    const yearText = currentYear > startYear ? `© ${startYear}-${currentYear}` : `© ${startYear}`;
    copyrightYear.textContent = yearText;
  }

  // Load avatar
  const avatarEl = document.getElementById('navbarAvatar');
  if (avatarEl) {
    if (settings.avatarBlobId) {
      const blob = await StorageUtils.getAsset(settings.avatarBlobId);
      if (blob) {
        avatarEl.innerHTML = `<img src="${ImageCompressor.createObjectURL(blob)}" class="rounded-circle" width="36" height="36" alt="Avatar">`;
      } else {
        avatarEl.textContent = settings.avatar;
      }
    } else {
      avatarEl.textContent = settings.avatar;
    }
  }

  // Load background
  const mainContent = document.getElementById('mainContent');
  if (mainContent) {
    if (settings.backgroundBlobId) {
      const blob = await StorageUtils.getAsset(settings.backgroundBlobId);
      if (blob) {
        mainContent.style.backgroundImage = `url(${ImageCompressor.createObjectURL(blob)})`;
        mainContent.style.backgroundSize = 'cover';
        mainContent.style.backgroundPosition = 'center';
        mainContent.classList.add('has-custom-bg');
      }
    } else if (settings.background !== 'none') {
      mainContent.style.backgroundImage = `url(${settings.background})`;
      mainContent.style.backgroundSize = 'cover';
      mainContent.style.backgroundPosition = 'center';
      mainContent.classList.add('has-custom-bg');
    }
  }

  // Initialize modules with error boundaries
  await safeInit('SettingsModal', () => SettingsModal.init());
  await safeInit('ExportModal', () => ExportModal.init());
  await safeInit('AttachmentManager', () => AttachmentManager.init());
  await safeInit('ChatManager', () => ChatManager.init());
  await safeInit('SidebarManager', async () => {
    await SidebarManager.init();
    await SidebarManager.loadChatHistory();
  });
  await safeInit('VoiceInput', () => VoiceInput.init());
  await safeInit('Bookmarks', () => Bookmarks.init());
  await safeInit('PipelineManager', () => PipelineManager.loadViewPreference());

  // Initialize research layer modules
  await safeInit('LayerManager', () => LayerManager.init());
  await safeInit('TextSelectionTooltip', () => TextSelectionTooltip.init());
  await safeInit('LayerSelectionModal', () => LayerSelectionModal.init());
  await safeInit('NotesEditor', () => NotesEditor.init());

  // Setup logout button if user is authenticated
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    if (UserAuth.isAuthenticated()) {
      logoutBtn.classList.remove('d-none');
      logoutBtn.addEventListener('click', () => UserAuth.logout());
    }
  }

  console.log('✓ Kea initialized');
});
