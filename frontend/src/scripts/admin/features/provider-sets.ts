/**
 * KEA Admin Panel - Provider Sets Feature Module
 * CRUD operations and rendering for provider sets
 */

import { AdminState } from '../state';
import { ProviderSetsApi, ProvidersApi } from '../api';
import { AdminEvents } from '../events';
import type { ProviderSet, ProviderSetCreateData, ProviderSetUpdateData } from '../types';

// Forward declaration for UI modules (will be imported when created)
let showToast: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
let showConfirm: (options: { title: string; message: string; danger?: boolean }) => Promise<boolean>;

/**
 * Set UI dependencies (called from index.ts after UI modules are loaded)
 */
export function setProviderSetsUIDeps(deps: {
  toast: typeof showToast;
  confirm: typeof showConfirm;
}): void {
  showToast = deps.toast;
  showConfirm = deps.confirm;
}

/**
 * Provider Sets Feature Module
 */
export const ProviderSetsModule = {
  /**
   * Load all provider sets from API
   */
  async load(): Promise<void> {
    AdminState.setProviderSetsLoading();

    try {
      const providerSets = await ProviderSetsApi.list();
      AdminState.setProviderSets(providerSets);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load provider sets';
      AdminState.setProviderSetsError(message);
      showToast?.('Error', message, 'error');
    }
  },

  /**
   * Create a new provider set
   */
  async create(data: ProviderSetCreateData): Promise<boolean> {
    try {
      await ProviderSetsApi.create(data);
      await this.load();
      showToast?.('Success', 'Provider set created', 'success');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create provider set';
      showToast?.('Error', message, 'error');
      return false;
    }
  },

  /**
   * Update an existing provider set
   */
  async update(id: number, data: ProviderSetUpdateData): Promise<boolean> {
    try {
      await ProviderSetsApi.update(id, data);
      await this.load();
      showToast?.('Success', 'Provider set updated', 'success');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update provider set';
      showToast?.('Error', message, 'error');
      return false;
    }
  },

  /**
   * Toggle provider set active/inactive
   */
  async toggle(id: number): Promise<void> {
    try {
      await ProviderSetsApi.toggle(id);
      await this.load();
      showToast?.('Success', 'Provider set toggled', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to toggle provider set';
      showToast?.('Error', message, 'error');
    }
  },

  /**
   * Delete a provider set
   */
  async delete(id: number): Promise<void> {
    const providerSet = this.getById(id);
    if (providerSet?.is_system) {
      showToast?.('Error', 'Cannot delete system provider sets', 'error');
      return;
    }

    const confirmed = await showConfirm?.({
      title: 'Delete Provider Set',
      message: 'Are you sure you want to delete this provider set?',
      danger: true,
    });

    if (!confirmed) return;

    try {
      await ProviderSetsApi.delete(id);
      showToast?.('Success', 'Provider set deleted', 'success');
      await this.load();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete provider set';
      showToast?.('Error', message, 'error');
    }
  },

  /**
   * Toggle a member's enabled status within a set
   */
  async toggleMember(setId: number, memberId: number): Promise<void> {
    try {
      await ProviderSetsApi.toggleMember(setId, memberId);
      await ProvidersApi.reload();
      await this.load();
      showToast?.('Success', 'Provider toggled in set', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to toggle provider';
      showToast?.('Error', message, 'error');
    }
  },

  /**
   * Add a provider to a custom set
   */
  async addMember(setId: number, providerId: number): Promise<boolean> {
    try {
      await ProviderSetsApi.addMember(setId, providerId);
      await this.load();
      showToast?.('Success', 'Provider added to set', 'success');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add provider';
      showToast?.('Error', message, 'error');
      return false;
    }
  },

  /**
   * Remove a provider from a custom set
   */
  async removeMember(setId: number, memberId: number): Promise<void> {
    const providerSet = this.getById(setId);
    if (providerSet?.is_system) {
      showToast?.('Error', 'Cannot remove providers from system sets', 'error');
      return;
    }

    const confirmed = await showConfirm?.({
      title: 'Remove Provider',
      message: 'Are you sure you want to remove this provider from the set?',
      danger: true,
    });

    if (!confirmed) return;

    try {
      await ProviderSetsApi.removeMember(setId, memberId);
      await this.load();
      showToast?.('Success', 'Provider removed from set', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove provider';
      showToast?.('Error', message, 'error');
    }
  },

  /**
   * Set the active tab and update UI accordingly
   */
  setActiveTab(name: string): void {
    AdminState.setActiveSetTab(name);

    // Update Add Provider button visibility and data attribute based on whether it's a system set
    const addProviderBtn = document.getElementById('addProviderBtn');
    if (addProviderBtn) {
      const activeSet = this.getByName(name);
      if (activeSet && !activeSet.is_system) {
        addProviderBtn.classList.remove('d-none');
        // Set the data-add-to-set attribute so the modal knows which set to add the provider to
        addProviderBtn.setAttribute('data-add-to-set', activeSet.id.toString());
      } else {
        addProviderBtn.classList.add('d-none');
        addProviderBtn.removeAttribute('data-add-to-set');
      }
    }
  },

  /**
   * Get provider set by ID from state
   */
  getById(id: number): ProviderSet | undefined {
    return AdminState.getProviderSetById(id);
  },

  /**
   * Get provider set by name from state
   */
  getByName(name: string): ProviderSet | undefined {
    return AdminState.getProviderSetByName(name);
  },

  /**
   * Get all provider sets from state
   */
  getAll(): ProviderSet[] {
    return AdminState.providerSets;
  },

  /**
   * Open edit modal for provider set (dispatches to UI)
   */
  openEditModal(id: number): void {
    const providerSet = this.getById(id);
    if (!providerSet) return;

    if (providerSet.is_system) {
      showToast?.('Error', 'Cannot edit system provider sets', 'error');
      return;
    }

    // Dispatch custom event for modal to handle
    const event = new CustomEvent('admin:open-provider-set-modal', {
      detail: { mode: 'edit', providerSet },
    });
    document.dispatchEvent(event);
  },

  /**
   * Open create modal for provider set
   */
  openCreateModal(): void {
    const event = new CustomEvent('admin:open-provider-set-modal', {
      detail: { mode: 'create' },
    });
    document.dispatchEvent(event);
  },

  /**
   * Open add member modal for a provider set
   */
  openAddMemberModal(setId: number): void {
    const providerSet = this.getById(setId);
    if (!providerSet) return;

    if (providerSet.is_system) {
      showToast?.('Error', 'Cannot add providers to system sets', 'error');
      return;
    }

    // Dispatch custom event for modal to handle
    const event = new CustomEvent('admin:open-add-member-modal', {
      detail: { providerSet },
    });
    document.dispatchEvent(event);
  },
};

// Register event handlers
AdminEvents.registerHandlers({
  'provider-set:select-tab': async (action) => {
    if (action.type === 'provider-set:select-tab') {
      ProviderSetsModule.setActiveTab(action.name);
    }
  },
  'provider-set:toggle': async (action) => {
    if (action.type === 'provider-set:toggle') {
      await ProviderSetsModule.toggle(action.id);
    }
  },
  'provider-set:edit': async (action) => {
    if (action.type === 'provider-set:edit') {
      ProviderSetsModule.openEditModal(action.id);
    }
  },
  'provider-set:delete': async (action) => {
    if (action.type === 'provider-set:delete') {
      await ProviderSetsModule.delete(action.id);
    }
  },
  'provider-set:member-toggle': async (action) => {
    if (action.type === 'provider-set:member-toggle') {
      await ProviderSetsModule.toggleMember(action.setId, action.memberId);
    }
  },
  'provider-set:add-member': async (action) => {
    if (action.type === 'provider-set:add-member') {
      ProviderSetsModule.openAddMemberModal(action.setId);
    }
  },
  'provider-set:remove-member': async (action) => {
    if (action.type === 'provider-set:remove-member') {
      await ProviderSetsModule.removeMember(action.setId, action.memberId);
    }
  },
});
