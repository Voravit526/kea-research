/**
 * KEA Admin Panel - Providers Feature Module
 * CRUD operations and rendering for AI providers
 */

import { AdminState } from '../state';
import { ProvidersApi } from '../api';
import { AdminEvents } from '../events';
import type { Provider, ProviderCreateData, ProviderUpdateData } from '../types';

// Forward declaration for UI modules (will be imported when created)
let showToast: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
let showConfirm: (options: { title: string; message: string; danger?: boolean }) => Promise<boolean>;

/**
 * Set UI dependencies (called from index.ts after UI modules are loaded)
 */
export function setProvidersUIDeps(deps: {
  toast: typeof showToast;
  confirm: typeof showConfirm;
}): void {
  showToast = deps.toast;
  showConfirm = deps.confirm;
}

/**
 * Providers Feature Module
 */
export const ProvidersModule = {
  /**
   * Load all providers from API
   */
  async load(): Promise<void> {
    AdminState.setProvidersLoading();

    try {
      const providers = await ProvidersApi.list();
      AdminState.setProviders(providers);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load providers';
      AdminState.setProvidersError(message);
      showToast?.('Error', message, 'error');
    }
  },

  /**
   * Create a new provider
   * Returns the created provider on success, null on failure
   */
  async create(data: ProviderCreateData): Promise<Provider | null> {
    try {
      const newProvider = await ProvidersApi.create(data);
      await ProvidersApi.reload();
      await this.load();
      showToast?.('Success', 'Provider added and reloaded', 'success');
      return newProvider;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add provider';
      showToast?.('Error', message, 'error');
      return null;
    }
  },

  /**
   * Update an existing provider
   */
  async update(id: number, data: ProviderUpdateData): Promise<boolean> {
    try {
      await ProvidersApi.update(id, data);
      await ProvidersApi.reload();
      await this.load();
      showToast?.('Success', 'Provider updated and reloaded', 'success');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update provider';
      showToast?.('Error', message, 'error');
      return false;
    }
  },

  /**
   * Toggle provider active/inactive
   */
  async toggle(id: number): Promise<void> {
    try {
      await ProvidersApi.toggle(id);
      await ProvidersApi.reload();
      await this.load();
      showToast?.('Success', 'Provider toggled and reloaded', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to toggle provider';
      showToast?.('Error', message, 'error');
    }
  },

  /**
   * Delete a provider
   */
  async delete(id: number): Promise<void> {
    const confirmed = await showConfirm?.({
      title: 'Delete Provider',
      message: 'Are you sure you want to delete this provider and all its models?',
      danger: true,
    });

    if (!confirmed) return;

    try {
      await ProvidersApi.delete(id);
      await ProvidersApi.reload();
      showToast?.('Success', 'Provider deleted and reloaded', 'success');
      await this.load();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete provider';
      showToast?.('Error', message, 'error');
    }
  },

  /**
   * Reload all provider instances
   */
  async reload(): Promise<void> {
    try {
      await ProvidersApi.reload();

      // Reload providers list to update UI
      const providers = await ProvidersApi.list();
      AdminState.setProviders(providers);

      // Also reload provider sets to update the UI in provider sets tabs
      const { ProviderSetsModule } = await import('./provider-sets');
      await ProviderSetsModule.load();

      showToast?.('Success', 'Providers reloaded', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reload providers';
      showToast?.('Error', message, 'error');
    }
  },

  /**
   * Get provider by ID from state
   */
  getById(id: number): Provider | undefined {
    return AdminState.getProviderById(id);
  },

  /**
   * Get all providers from state
   */
  getAll(): Provider[] {
    return AdminState.providers;
  },

  /**
   * Open edit modal for provider (dispatches to UI)
   * This will be handled by the modal system
   */
  openEditModal(id: number): void {
    const provider = this.getById(id);
    if (!provider) return;

    // Dispatch custom event for modal to handle
    const event = new CustomEvent('admin:open-provider-modal', {
      detail: { mode: 'edit', provider },
    });
    document.dispatchEvent(event);
  },

  /**
   * Open add modal for provider
   */
  openAddModal(): void {
    const event = new CustomEvent('admin:open-provider-modal', {
      detail: { mode: 'add' },
    });
    document.dispatchEvent(event);
  },
};

// Register event handlers
AdminEvents.registerHandlers({
  'provider:toggle': async (action) => {
    if (action.type === 'provider:toggle') {
      await ProvidersModule.toggle(action.id);
    }
  },
  'provider:edit': async (action) => {
    if (action.type === 'provider:edit') {
      ProvidersModule.openEditModal(action.id);
    }
  },
  'provider:edit-api-key': async (action) => {
    if (action.type === 'provider:edit-api-key') {
      ProvidersModule.openEditModal(action.id);
      // Focus on the API key field after modal is shown
      setTimeout(() => {
        const apiKeyInput = document.getElementById('edit-provider-api-key') as HTMLInputElement | null;
        if (apiKeyInput) {
          apiKeyInput.focus();
          apiKeyInput.select();
        }
      }, 300);
    }
  },
  'provider:delete': async (action) => {
    if (action.type === 'provider:delete') {
      await ProvidersModule.delete(action.id);
    }
  },
});
