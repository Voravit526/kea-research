/**
 * KEA Admin Panel - Models Feature Module
 * Operations for AI model management
 */

import { AdminState } from '../state';
import { ModelsApi, ProvidersApi } from '../api';
import { AdminEvents } from '../events';
import type { DiscoveredModel, ModelCreateData, Provider } from '../types';

// Forward declaration for UI modules
let showToast: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
let showConfirm: (options: { title: string; message: string; danger?: boolean }) => Promise<boolean>;

/**
 * Set UI dependencies (called from index.ts)
 */
export function setModelsUIDeps(deps: {
  toast: typeof showToast;
  confirm: typeof showConfirm;
}): void {
  showToast = deps.toast;
  showConfirm = deps.confirm;
}

/**
 * Models Feature Module
 */
export const ModelsModule = {
  // Track current discover state
  _currentProviderId: null as number | null,
  _discoveredModels: [] as DiscoveredModel[],

  /**
   * Toggle model active/inactive
   */
  async toggle(id: number): Promise<void> {
    try {
      await ModelsApi.toggle(id);
      await ProvidersApi.reload();

      // Reload providers to get updated model states
      const providers = await ProvidersApi.list();
      AdminState.setProviders(providers);

      // Also reload provider sets to update the UI in provider sets tabs
      const { ProviderSetsModule } = await import('./provider-sets');
      await ProviderSetsModule.load();

      showToast?.('Success', 'Model toggled and reloaded', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to toggle model';
      showToast?.('Error', message, 'error');
    }
  },

  /**
   * Delete a model
   */
  async delete(id: number): Promise<void> {
    const confirmed = await showConfirm?.({
      title: 'Delete Model',
      message: 'Are you sure you want to delete this model?',
      danger: true,
    });

    if (!confirmed) return;

    try {
      await ModelsApi.delete(id);
      await ProvidersApi.reload();
      showToast?.('Success', 'Model deleted and reloaded', 'success');

      // Reload providers to get updated model list
      const providers = await ProvidersApi.list();
      AdminState.setProviders(providers);

      // Also reload provider sets to update the UI in provider sets tabs
      const { ProviderSetsModule } = await import('./provider-sets');
      await ProviderSetsModule.load();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete model';
      showToast?.('Error', message, 'error');
    }
  },

  /**
   * Discover available models for a provider
   */
  async discoverModels(providerId: number): Promise<DiscoveredModel[]> {
    this._currentProviderId = providerId;
    this._discoveredModels = [];

    try {
      const models = await ProvidersApi.discoverModels(providerId);
      this._discoveredModels = models;
      return models;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to discover models';
      throw new Error(message);
    }
  },

  /**
   * Add a selected model to provider
   * This replaces all existing models with the selected one
   */
  async addSelectedModel(
    providerId: number,
    modelId: string,
    displayName: string
  ): Promise<boolean> {
    try {
      // Get current provider to find existing models
      const provider = AdminState.getProviderById(providerId);

      if (provider) {
        // Delete all existing models for this provider
        for (const model of provider.models) {
          await ModelsApi.delete(model.id);
        }
      }

      // Add the new model as default
      const data: ModelCreateData = {
        provider_id: providerId,
        model_id: modelId,
        display_name: displayName,
        is_active: true,
        is_default: true,
      };

      await ModelsApi.create(data);
      await ProvidersApi.reload();

      // Reload providers to get updated model list
      const providers = await ProvidersApi.list();
      AdminState.setProviders(providers);

      showToast?.('Success', 'Model replaced and reloaded', 'success');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add model';
      showToast?.('Error', message, 'error');
      return false;
    }
  },

  /**
   * Get existing model IDs for a provider
   */
  getExistingModelIds(providerId: number): Set<string> {
    const provider = AdminState.getProviderById(providerId);
    return new Set(provider?.models.map((m) => m.model_id) || []);
  },

  /**
   * Open discover models modal
   */
  openDiscoverModal(providerId: number): void {
    const event = new CustomEvent('admin:open-discover-modal', {
      detail: { providerId },
    });
    document.dispatchEvent(event);
  },

  /**
   * Get current discovered models
   */
  getDiscoveredModels(): DiscoveredModel[] {
    return this._discoveredModels;
  },

  /**
   * Get current provider ID for discovery
   */
  getCurrentProviderId(): number | null {
    return this._currentProviderId;
  },
};

// Register event handlers
AdminEvents.registerHandlers({
  'model:toggle': async (action) => {
    if (action.type === 'model:toggle') {
      await ModelsModule.toggle(action.id);
    }
  },
  'model:delete': async (action) => {
    if (action.type === 'model:delete') {
      await ModelsModule.delete(action.id);
    }
  },
  'provider:discover': async (action) => {
    if (action.type === 'provider:discover') {
      ModelsModule.openDiscoverModal(action.id);
    }
  },
});
