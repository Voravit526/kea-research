/**
 * KEA Admin Panel - Settings Feature Module
 * App settings management (guest access, TTS, etc.)
 */

import { AdminState } from '../state';
import { SettingsApi } from '../api';
import { AdminEvents } from '../events';
import type { AppSettings, SettingsUpdateData } from '../types';

// Forward declaration for UI modules
let showToast: (title: string, message: string, type: 'success' | 'error' | 'info') => void;

/**
 * Set UI dependencies (called from index.ts)
 */
export function setSettingsUIDeps(deps: {
  toast: typeof showToast;
}): void {
  showToast = deps.toast;
}

/**
 * Settings Feature Module
 */
export const SettingsModule = {
  /**
   * Load app settings from API
   */
  async load(): Promise<void> {
    try {
      const settings = await SettingsApi.get();
      AdminState.setSettings(settings);
    } catch (error) {
      console.error('Failed to load app settings:', error);
    }
  },

  /**
   * Update guest access setting
   */
  async updateGuestAccess(enabled: boolean): Promise<void> {
    // Optimistic update
    AdminState.updateSetting('allow_guest_access', enabled);

    try {
      await SettingsApi.update({ allow_guest_access: enabled });
      showToast?.('Success', 'Settings updated', 'success');
    } catch (error) {
      // Revert on error
      AdminState.updateSetting('allow_guest_access', !enabled);
      const message = error instanceof Error ? error.message : 'Failed to update settings';
      showToast?.('Error', message, 'error');
    }
  },

  /**
   * Update TTS enabled setting
   */
  async updateTtsEnabled(enabled: boolean): Promise<void> {
    // Optimistic update
    AdminState.updateSetting('tts_enabled', enabled);

    try {
      await SettingsApi.update({ tts_enabled: enabled });
      showToast?.('Success', 'TTS settings updated', 'success');
    } catch (error) {
      // Revert on error
      AdminState.updateSetting('tts_enabled', !enabled);
      const message = error instanceof Error ? error.message : 'Failed to update TTS settings';
      showToast?.('Error', message, 'error');
    }
  },

  /**
   * Update any setting
   */
  async update(data: SettingsUpdateData): Promise<boolean> {
    try {
      const settings = await SettingsApi.update(data);
      AdminState.setSettings(settings);
      showToast?.('Success', 'Settings updated', 'success');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update settings';
      showToast?.('Error', message, 'error');
      return false;
    }
  },

  /**
   * Get current settings from state
   */
  get(): AppSettings | null {
    return AdminState.settings;
  },

  /**
   * Check if guest access is enabled
   */
  isGuestAccessEnabled(): boolean {
    return AdminState.settings?.allow_guest_access ?? false;
  },

  /**
   * Check if TTS is enabled
   */
  isTtsEnabled(): boolean {
    return AdminState.settings?.tts_enabled ?? false;
  },
};

// Register event handlers
AdminEvents.registerHandlers({
  'settings:toggle-guest': async (action) => {
    if (action.type === 'settings:toggle-guest') {
      await SettingsModule.updateGuestAccess(action.enabled);
    }
  },
  'settings:toggle-tts': async (action) => {
    if (action.type === 'settings:toggle-tts') {
      await SettingsModule.updateTtsEnabled(action.enabled);
    }
  },
});
