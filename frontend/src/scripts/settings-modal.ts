/**
 * Settings Modal Logic
 */

import { StorageUtils, updateSetting, type UserSettings } from './storage';
import { ThemeManager } from './theme';
import { ImageCompressor } from './image';
import { KeaResearchDB } from './db';
import { UserAuth, AppSettings } from './user-auth';
import { STORAGE_KEYS, UI_CONFIG } from './constants';
import { isMacOS } from './utils';
import { TTS, TTS_VOICES } from './tts';

declare function t(key: string, vars?: Record<string, string | number>): string;
declare const bootstrap: any;

export const SettingsModal = {
  async init(): Promise<void> {
    const modal = document.getElementById('settingsModal');
    if (!modal) return;

    modal.addEventListener('show.bs.modal', async () => {
      await this.loadSettings();
      await this.updateStorageInfo();
    });

    // Theme change - stored in localStorage only (not IndexedDB) for instant load
    const themeSelect = document.getElementById('themeSelect') as HTMLSelectElement | null;
    if (themeSelect) {
      themeSelect.addEventListener('change', (e) => {
        const theme = (e.target as HTMLSelectElement).value as 'light' | 'dark' | 'auto';
        localStorage.setItem('theme', theme);
        ThemeManager.apply(theme);
      });
    }

    // Username change
    const userName = document.getElementById('userName') as HTMLInputElement | null;
    if (userName) {
      userName.addEventListener('input', async (e) => {
        const settings = await StorageUtils.getSettings();
        settings.userName = (e.target as HTMLInputElement).value || 'User';
        await StorageUtils.saveSettings(settings);
        this.updateGreeting(settings.userName);
      });
    }

    // Custom searchable language dropdown
    this.initLanguageDropdown();

    // Send on Enter toggle
    const sendOnEnterToggle = document.getElementById('sendOnEnterToggle') as HTMLInputElement | null;
    if (sendOnEnterToggle) {
      sendOnEnterToggle.addEventListener('change', async (e) => {
        const settings = await StorageUtils.getSettings();
        settings.sendOnEnter = (e.target as HTMLInputElement).checked;
        await StorageUtils.saveSettings(settings);
        this.updateSendOnEnterHint(settings.sendOnEnter);
      });
    }

    // Compress images toggle
    const compressToggle = document.getElementById('compressAttachedImagesToggle') as HTMLInputElement | null;
    if (compressToggle) {
      compressToggle.addEventListener('change', async (e) => {
        const settings = await StorageUtils.getSettings();
        settings.compressAttachedImages = (e.target as HTMLInputElement).checked;
        await StorageUtils.saveSettings(settings);
        this.toggleCompressionOptions(settings.compressAttachedImages);
      });
    }

    // Compression quality
    const qualitySlider = document.getElementById('compressionQuality') as HTMLInputElement | null;
    if (qualitySlider) {
      qualitySlider.addEventListener('input', async (e) => {
        const value = (e.target as HTMLInputElement).value;
        const qualityValue = document.getElementById('compressionQualityValue');
        if (qualityValue) qualityValue.textContent = `${value}%`;
        const settings = await StorageUtils.getSettings();
        settings.compressionQuality = parseInt(value);
        await StorageUtils.saveSettings(settings);
      });
    }

    // Compression max dimension
    const dimensionSlider = document.getElementById('compressionMaxDimension') as HTMLInputElement | null;
    if (dimensionSlider) {
      dimensionSlider.addEventListener('input', async (e) => {
        const value = (e.target as HTMLInputElement).value;
        const dimensionValue = document.getElementById('compressionMaxDimensionValue');
        if (dimensionValue) dimensionValue.textContent = `${value}px`;
        const settings = await StorageUtils.getSettings();
        settings.compressionMaxDimension = parseInt(value);
        await StorageUtils.saveSettings(settings);
      });
    }

    // Avatar options
    document.querySelectorAll('.avatar-option').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        document.querySelectorAll('.avatar-option').forEach(b => b.classList.remove('active'));
        (btn as HTMLElement).classList.add('active');
        const settings = await StorageUtils.getSettings();
        settings.avatar = (btn as HTMLElement).dataset.avatar || '😊';
        settings.avatarBlobId = null;
        await StorageUtils.saveSettings(settings);
        this.updateAvatar(settings.avatar);
      });
    });

    // Custom avatar upload
    const avatarUpload = document.getElementById('customAvatarUpload') as HTMLInputElement | null;
    if (avatarUpload) {
      avatarUpload.addEventListener('change', async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file && file.type.startsWith('image/')) {
          const statusEl = document.getElementById('avatarUploadStatus');
          if (statusEl) {
            statusEl.textContent = t('js.compressing');
            statusEl.classList.remove('d-none');
          }
          try {
            const compressedBlob = await ImageCompressor.compressAvatar(file);
            const assetId = await StorageUtils.saveAsset('avatar', compressedBlob);
            const settings = await StorageUtils.getSettings();
            settings.avatarBlobId = assetId;
            settings.avatar = 'custom';
            await StorageUtils.saveSettings(settings);
            this.updateAvatar(ImageCompressor.createObjectURL(compressedBlob));
            document.querySelectorAll('.avatar-option').forEach(b => b.classList.remove('active'));
            if (statusEl) {
              statusEl.textContent = `✓ ${t('js.uploaded')}`;
              setTimeout(() => statusEl.classList.add('d-none'), 2000);
            }
            await this.updateStorageInfo();
          } catch (error) {
            if (statusEl) {
              statusEl.textContent = `✗ ${t('js.error')}`;
              statusEl.classList.remove('text-success');
              statusEl.classList.add('text-danger');
              setTimeout(() => statusEl.classList.add('d-none'), 2000);
            }
          }
        }
      });
    }

    // Background options
    document.querySelectorAll('.bg-option').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        document.querySelectorAll('.bg-option').forEach(b => b.classList.remove('active'));
        (btn as HTMLElement).classList.add('active');
        const settings = await StorageUtils.getSettings();
        settings.background = (btn as HTMLElement).dataset.bg || 'none';
        settings.backgroundBlobId = null;
        await StorageUtils.saveSettings(settings);
        this.updateBackground(settings.background);
      });
    });

    // Custom background upload
    const bgUpload = document.getElementById('customBgUpload') as HTMLInputElement | null;
    if (bgUpload) {
      bgUpload.addEventListener('change', async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file && file.type.startsWith('image/')) {
          const statusEl = document.getElementById('bgUploadStatus');
          if (statusEl) {
            statusEl.textContent = t('js.compressing');
            statusEl.classList.remove('d-none');
          }
          try {
            const compressedBlob = await ImageCompressor.compressBackground(file);
            const assetId = await StorageUtils.saveAsset('background', compressedBlob);
            const settings = await StorageUtils.getSettings();
            settings.backgroundBlobId = assetId;
            settings.background = 'custom';
            await StorageUtils.saveSettings(settings);
            this.updateBackground(ImageCompressor.createObjectURL(compressedBlob));
            document.querySelectorAll('.bg-option').forEach(b => b.classList.remove('active'));
            if (statusEl) {
              statusEl.textContent = `✓ ${t('js.uploaded')}`;
              setTimeout(() => statusEl.classList.add('d-none'), 2000);
            }
            await this.updateStorageInfo();
          } catch (error) {
            if (statusEl) {
              statusEl.textContent = `✗ ${t('js.error')}`;
              statusEl.classList.remove('text-success');
              statusEl.classList.add('text-danger');
              setTimeout(() => statusEl.classList.add('d-none'), 2000);
            }
          }
        }
      });
    }

    // Storage limit
    const storageLimitRange = document.getElementById('storageLimitRange') as HTMLInputElement | null;
    if (storageLimitRange) {
      storageLimitRange.addEventListener('input', async (e) => {
        const limitValue = (e.target as HTMLInputElement).value;
        const limitDisplay = document.getElementById('storageLimitValue');
        if (limitDisplay) limitDisplay.textContent = `${limitValue} MB`;
        const settings = await StorageUtils.getSettings();
        settings.storageLimit = parseInt(limitValue);
        await StorageUtils.saveSettings(settings);
        await this.updateStorageInfo();
      });
    }

    // TTS settings - Backend Kokoro TTS
    const ttsEnabledToggle = document.getElementById('ttsEnabledToggle') as HTMLInputElement | null;
    if (ttsEnabledToggle) {
      ttsEnabledToggle.addEventListener('change', async (e) => {
        await updateSetting('ttsEnabled', (e.target as HTMLInputElement).checked);
      });
    }

    const ttsLanguageSelect = document.getElementById('ttsLanguageSelect') as HTMLSelectElement | null;
    const ttsVoiceSelect = document.getElementById('ttsVoiceSelect') as HTMLSelectElement | null;

    if (ttsLanguageSelect) {
      ttsLanguageSelect.addEventListener('change', async (e) => {
        const lang = (e.target as HTMLSelectElement).value;
        const settings = await StorageUtils.getSettings();
        settings.ttsLanguage = lang as UserSettings['ttsLanguage'];
        // Update voice to first available for new language
        const defaultVoice = TTS.getDefaultVoice(lang);
        settings.ttsVoice = defaultVoice;
        await StorageUtils.saveSettings(settings);
        // Populate voices for selected language
        this.populateVoiceSelect(lang, defaultVoice);
      });
    }

    if (ttsVoiceSelect) {
      ttsVoiceSelect.addEventListener('change', async (e) => {
        await updateSetting('ttsVoice', (e.target as HTMLSelectElement).value);
      });
    }

    const ttsSpeedRange = document.getElementById('ttsSpeedRange') as HTMLInputElement | null;
    if (ttsSpeedRange) {
      ttsSpeedRange.addEventListener('input', async (e) => {
        const value = (e.target as HTMLInputElement).value;
        const speedValue = document.getElementById('ttsSpeedValue');
        if (speedValue) speedValue.textContent = `${value}x`;
        const settings = await StorageUtils.getSettings();
        settings.ttsSpeed = parseFloat(value);
        await StorageUtils.saveSettings(settings);
      });
    }

    // Preview button
    const ttsPreviewBtn = document.getElementById('ttsPreviewBtn');
    if (ttsPreviewBtn) {
      ttsPreviewBtn.addEventListener('click', async () => {
        const settings = await StorageUtils.getSettings();
        const btn = ttsPreviewBtn as HTMLButtonElement;
        const originalText = btn.innerHTML;

        try {
          btn.disabled = true;
          btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Loading...';
          await TTS.preview(settings.ttsVoice, settings.ttsLanguage, settings.ttsSpeed);
        } catch (error) {
          console.error('Preview failed:', error);
          btn.innerHTML = '<i class="bi bi-x-circle me-1"></i> Failed';
          setTimeout(() => { btn.innerHTML = originalText; btn.disabled = false; }, 2000);
          return;
        }

        btn.innerHTML = originalText;
        btn.disabled = false;
      });
    }

    // Clear storage
    const clearStorageBtn = document.getElementById('clearStorageBtn');
    if (clearStorageBtn) {
      clearStorageBtn.addEventListener('click', async () => {
        if (confirm(t('js.confirmClearStorage'))) {
          try {
            const stores = ['chats', 'messages', 'assets'];
            for (const store of stores) {
              const transaction = KeaResearchDB.db!.transaction(store, 'readwrite');
              const objectStore = transaction.objectStore(store);
              await new Promise<void>((resolve, reject) => {
                const request = objectStore.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
              });
            }

            const settings = await StorageUtils.getSettings();
            settings.avatarBlobId = null;
            settings.backgroundBlobId = null;
            settings.avatar = '😊';
            settings.background = 'none';
            await StorageUtils.saveSettings(settings);

            this.updateAvatar('😊');
            this.updateBackground('none');
            await this.updateStorageInfo();

            document.querySelectorAll('.avatar-option').forEach(btn => {
              (btn as HTMLElement).classList.toggle('active', (btn as HTMLElement).dataset.avatar === '😊');
            });
            document.querySelectorAll('.bg-option').forEach(btn => {
              (btn as HTMLElement).classList.toggle('active', (btn as HTMLElement).dataset.bg === 'none');
            });

            alert(t('js.storageClearedSuccess'));
          } catch (error) {
            console.error('Error clearing storage:', error);
            alert(t('js.storageClearFailed'));
          }
        }
      });
    }

    // Save settings button
    const saveSettingsBtn = document.getElementById('saveSettings');
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', () => {
        bootstrap.Modal.getInstance(modal)?.hide();
      });
    }
  },

  async loadSettings(): Promise<void> {
    const settings = await StorageUtils.getSettings();

    // Theme is stored in localStorage (not IndexedDB) for instant load
    const themeSelect = document.getElementById('themeSelect') as HTMLSelectElement | null;
    if (themeSelect) themeSelect.value = localStorage.getItem('theme') || 'auto';

    const userName = document.getElementById('userName') as HTMLInputElement | null;
    const userNameGroup = document.getElementById('userNameGroup') as HTMLElement | null;
    if (userName && userNameGroup) {
      if (UserAuth.isAuthenticated()) {
        // For authenticated users, show their display name and hide the input
        userName.value = UserAuth.getDisplayName();
        userName.disabled = true;
        userNameGroup.title = 'Name is set from your account';
      } else {
        // For guests, allow editing
        userName.value = settings.userName;
        userName.disabled = false;
        userNameGroup.title = '';
      }
    }

    // Update language dropdown display
    this.updateLanguageDisplay(settings.language);

    const sendOnEnterToggle = document.getElementById('sendOnEnterToggle') as HTMLInputElement | null;
    if (sendOnEnterToggle) sendOnEnterToggle.checked = settings.sendOnEnter;

    const compressToggle = document.getElementById('compressAttachedImagesToggle') as HTMLInputElement | null;
    if (compressToggle) compressToggle.checked = settings.compressAttachedImages;

    this.updateSendOnEnterHint(settings.sendOnEnter);

    const qualitySlider = document.getElementById('compressionQuality') as HTMLInputElement | null;
    const qualityValue = document.getElementById('compressionQualityValue');
    if (qualitySlider) qualitySlider.value = String(settings.compressionQuality);
    if (qualityValue) qualityValue.textContent = `${settings.compressionQuality}%`;

    const dimensionSlider = document.getElementById('compressionMaxDimension') as HTMLInputElement | null;
    const dimensionValue = document.getElementById('compressionMaxDimensionValue');
    if (dimensionSlider) dimensionSlider.value = String(settings.compressionMaxDimension);
    if (dimensionValue) dimensionValue.textContent = `${settings.compressionMaxDimension}px`;

    this.toggleCompressionOptions(settings.compressAttachedImages);

    document.querySelectorAll('.avatar-option').forEach(btn => {
      (btn as HTMLElement).classList.toggle('active', (btn as HTMLElement).dataset.avatar === settings.avatar);
    });
    document.querySelectorAll('.bg-option').forEach(btn => {
      (btn as HTMLElement).classList.toggle('active', (btn as HTMLElement).dataset.bg === settings.background);
    });

    const storageLimitRange = document.getElementById('storageLimitRange') as HTMLInputElement | null;
    const storageLimitValue = document.getElementById('storageLimitValue');
    const storageLimit = settings.storageLimit || 32;
    if (storageLimitRange) storageLimitRange.value = String(storageLimit);
    if (storageLimitValue) storageLimitValue.textContent = `${storageLimit} MB`;

    // Load TTS settings
    const ttsEnabledToggle = document.getElementById('ttsEnabledToggle') as HTMLInputElement | null;
    if (ttsEnabledToggle) ttsEnabledToggle.checked = settings.ttsEnabled;

    const ttsLanguageSelect = document.getElementById('ttsLanguageSelect') as HTMLSelectElement | null;
    if (ttsLanguageSelect) ttsLanguageSelect.value = settings.ttsLanguage;

    // Populate voices for current language and select saved voice
    this.populateVoiceSelect(settings.ttsLanguage, settings.ttsVoice);

    const ttsSpeedRange = document.getElementById('ttsSpeedRange') as HTMLInputElement | null;
    const ttsSpeedValue = document.getElementById('ttsSpeedValue');
    if (ttsSpeedRange) ttsSpeedRange.value = String(settings.ttsSpeed);
    if (ttsSpeedValue) ttsSpeedValue.textContent = `${settings.ttsSpeed}x`;

    // Check if TTS is disabled by admin
    this.updateTtsAdminState();
  },

  /**
   * Update TTS controls based on admin settings
   */
  updateTtsAdminState(): void {
    const adminDisabledAlert = document.getElementById('ttsAdminDisabledAlert');
    const ttsControlsContainer = document.getElementById('ttsControlsContainer');
    const ttsEnabledToggle = document.getElementById('ttsEnabledToggle') as HTMLInputElement | null;
    const ttsLanguageSelect = document.getElementById('ttsLanguageSelect') as HTMLSelectElement | null;
    const ttsVoiceSelect = document.getElementById('ttsVoiceSelect') as HTMLSelectElement | null;
    const ttsSpeedRange = document.getElementById('ttsSpeedRange') as HTMLInputElement | null;
    const ttsPreviewBtn = document.getElementById('ttsPreviewBtn') as HTMLButtonElement | null;

    const isDisabledByAdmin = !AppSettings.ttsEnabled;

    // Show/hide admin disabled alert
    if (adminDisabledAlert) {
      adminDisabledAlert.classList.toggle('d-none', !isDisabledByAdmin);
    }

    // Disable/enable all TTS controls
    if (ttsEnabledToggle) ttsEnabledToggle.disabled = isDisabledByAdmin;
    if (ttsLanguageSelect) ttsLanguageSelect.disabled = isDisabledByAdmin;
    if (ttsVoiceSelect) ttsVoiceSelect.disabled = isDisabledByAdmin;
    if (ttsSpeedRange) ttsSpeedRange.disabled = isDisabledByAdmin;
    if (ttsPreviewBtn) ttsPreviewBtn.disabled = isDisabledByAdmin;

    // Add visual feedback to the container
    if (ttsControlsContainer) {
      ttsControlsContainer.style.opacity = isDisabledByAdmin ? '0.5' : '1';
      ttsControlsContainer.style.pointerEvents = isDisabledByAdmin ? 'none' : 'auto';
    }
  },

  /**
   * Populate voice dropdown based on selected language
   */
  populateVoiceSelect(language: string, selectedVoice: string): void {
    const voiceSelect = document.getElementById('ttsVoiceSelect') as HTMLSelectElement | null;
    if (!voiceSelect) return;

    const voices = TTS_VOICES[language] || [];
    voiceSelect.innerHTML = '';

    for (const voice of voices) {
      const option = document.createElement('option');
      option.value = voice.id;
      option.textContent = `${voice.name} (${voice.gender === 'F' ? 'Female' : 'Male'})`;
      if (voice.id === selectedVoice) {
        option.selected = true;
      }
      voiceSelect.appendChild(option);
    }
  },

  /**
   * Initialize custom searchable language dropdown
   */
  initLanguageDropdown(): void {
    const dropdown = document.getElementById('languageDropdown');
    const searchInput = document.getElementById('languageSearch') as HTMLInputElement | null;
    const filterInput = document.getElementById('languageFilter') as HTMLInputElement | null;
    const menu = document.getElementById('languageDropdownMenu');
    const options = document.getElementById('languageOptions');
    const hiddenInput = document.getElementById('languageSelect') as HTMLInputElement | null;

    if (!dropdown || !searchInput || !menu || !options || !hiddenInput) return;

    // Toggle dropdown on search input click
    searchInput.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('d-none');
      if (!menu.classList.contains('d-none') && filterInput) {
        filterInput.value = '';
        filterInput.focus();
        // Reset filter - show all options
        options.querySelectorAll('.language-option').forEach(opt => opt.classList.remove('d-none'));
      }
    });

    // Filter options on typing
    if (filterInput) {
      filterInput.addEventListener('input', (e) => {
        const query = (e.target as HTMLInputElement).value.toLowerCase();
        options.querySelectorAll('.language-option').forEach(opt => {
          const text = opt.textContent?.toLowerCase() || '';
          const value = (opt as HTMLElement).dataset.value?.toLowerCase() || '';
          if (text.includes(query) || value.includes(query)) {
            opt.classList.remove('d-none');
          } else {
            opt.classList.add('d-none');
          }
        });
      });

      // Prevent dropdown from closing when clicking filter
      filterInput.addEventListener('click', (e) => e.stopPropagation());
    }

    // Handle option selection
    options.querySelectorAll('.language-option').forEach(opt => {
      opt.addEventListener('click', async (e) => {
        e.stopPropagation();
        const newLang = (opt as HTMLElement).dataset.value || '';
        const settings = await StorageUtils.getSettings();
        settings.language = newLang;
        await StorageUtils.saveSettings(settings);
        // Set cookie for server-side detection
        document.cookie = `${STORAGE_KEYS.LANGUAGE}=${newLang};path=/;max-age=${UI_CONFIG.COOKIE_MAX_AGE_SECONDS};SameSite=Lax`;
        // Reload page to apply new language
        window.location.reload();
      });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
      menu.classList.add('d-none');
    });

    // Prevent dropdown from closing when clicking inside menu
    menu.addEventListener('click', (e) => e.stopPropagation());
  },

  /**
   * Update language dropdown display with current language
   */
  updateLanguageDisplay(langCode: string): void {
    const searchInput = document.getElementById('languageSearch') as HTMLInputElement | null;
    const options = document.getElementById('languageOptions');
    const hiddenInput = document.getElementById('languageSelect') as HTMLInputElement | null;

    if (!searchInput || !options) return;

    // Find the option with matching data-value and get its text
    const selectedOption = options.querySelector(`.language-option[data-value="${langCode}"]`) as HTMLElement | null;
    if (selectedOption) {
      searchInput.value = selectedOption.textContent || langCode;
      // Mark as active
      options.querySelectorAll('.language-option').forEach(opt => opt.classList.remove('active'));
      selectedOption.classList.add('active');
    }

    // Update hidden input
    if (hiddenInput) hiddenInput.value = langCode;
  },

  updateSendOnEnterHint(sendOnEnter: boolean): void {
    const hint = document.getElementById('sendOnEnterHint');
    if (!hint) return;
    const modKey = isMacOS() ? '⌘' : 'Ctrl';
    if (sendOnEnter) {
      hint.textContent = 'Press Enter to send, Shift+Enter for new line';
    } else {
      hint.textContent = `Press ${modKey}+Enter to send, Enter for new line`;
    }
  },

  toggleCompressionOptions(enabled: boolean): void {
    const options = document.getElementById('compressionOptions');
    if (options) {
      options.style.display = enabled ? 'block' : 'none';
    }
  },

  updateGreeting(userName: string): void {
    const greeting = document.getElementById('welcomeGreeting');
    if (greeting) {
      // For authenticated users, always use their display name
      const displayName = UserAuth.isAuthenticated() ? UserAuth.getDisplayName() : userName;
      greeting.textContent = t('chat.welcomeGreeting', { userName: displayName });
    }
  },

  updateAvatar(avatarSource: string): void {
    const avatarEl = document.getElementById('navbarAvatar');
    if (!avatarEl) return;
    if (avatarSource.startsWith('blob:') || avatarSource.startsWith('data:')) {
      avatarEl.innerHTML = `<img src="${avatarSource}" class="rounded-circle" width="36" height="36" alt="Avatar">`;
    } else {
      avatarEl.textContent = avatarSource;
    }
  },

  updateBackground(backgroundSource: string): void {
    const mainContent = document.getElementById('mainContent');
    if (!mainContent) return;
    if (backgroundSource === 'none') {
      mainContent.style.backgroundImage = '';
      mainContent.classList.remove('has-custom-bg');
    } else {
      mainContent.style.backgroundImage = `url(${backgroundSource})`;
      mainContent.style.backgroundSize = 'cover';
      mainContent.style.backgroundPosition = 'center';
      mainContent.classList.add('has-custom-bg');
    }
  },

  async updateStorageInfo(): Promise<void> {
    const info = await StorageUtils.getStorageInfo();
    if (info) {
      const storageUsed = document.getElementById('storageUsed');
      if (storageUsed) storageUsed.textContent = `${info.used} MB`;
      const progressBar = document.getElementById('storageProgressBar');
      if (progressBar) {
        progressBar.style.width = `${info.percentage}%`;
        const percent = parseFloat(info.percentage);
        progressBar.className = 'progress-bar ' + (percent > 80 ? 'bg-danger' : percent > 50 ? 'bg-warning' : 'bg-success');
      }
    }
  }
};

// Make it globally available
declare global {
  interface Window {
    SettingsModal: typeof SettingsModal;
  }
}

window.SettingsModal = SettingsModal;
