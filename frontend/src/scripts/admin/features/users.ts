/**
 * KEA Admin Panel - Users Feature Module
 * CRUD operations for user management
 */

import { AdminState } from '../state';
import { UsersApi } from '../api';
import { AdminEvents } from '../events';
import type { User, UserCreateData, UserUpdateData } from '../types';

// Forward declaration for UI modules
let showToast: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
let showConfirm: (options: { title: string; message: string; danger?: boolean }) => Promise<boolean>;

/**
 * Set UI dependencies (called from index.ts)
 */
export function setUsersUIDeps(deps: {
  toast: typeof showToast;
  confirm: typeof showConfirm;
}): void {
  showToast = deps.toast;
  showConfirm = deps.confirm;
}

/**
 * Users Feature Module
 */
export const UsersModule = {
  /**
   * Load all users from API
   */
  async load(): Promise<void> {
    AdminState.setUsersLoading();

    try {
      const users = await UsersApi.list();
      AdminState.setUsers(users);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load users';
      AdminState.setUsersError(message);
      showToast?.('Error', message, 'error');
    }
  },

  /**
   * Create a new user
   */
  async create(data: UserCreateData): Promise<boolean> {
    try {
      await UsersApi.create(data);
      await this.load();
      showToast?.('Success', 'User created', 'success');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create user';
      showToast?.('Error', message, 'error');
      return false;
    }
  },

  /**
   * Update an existing user
   */
  async update(id: number, data: UserUpdateData): Promise<boolean> {
    try {
      await UsersApi.update(id, data);
      await this.load();
      showToast?.('Success', 'User updated', 'success');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update user';
      showToast?.('Error', message, 'error');
      return false;
    }
  },

  /**
   * Delete a user
   */
  async delete(id: number): Promise<void> {
    const user = this.getById(id);
    if (!user) return;

    const confirmed = await showConfirm?.({
      title: 'Delete User',
      message: `Are you sure you want to delete user "${user.username}"?`,
      danger: true,
    });

    if (!confirmed) return;

    try {
      await UsersApi.delete(id);
      showToast?.('Success', 'User deleted', 'success');
      await this.load();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete user';
      showToast?.('Error', message, 'error');
    }
  },

  /**
   * Get user by ID from state
   */
  getById(id: number): User | undefined {
    return AdminState.getUserById(id);
  },

  /**
   * Get all users from state
   */
  getAll(): User[] {
    return AdminState.users;
  },

  /**
   * Open edit modal for user
   */
  openEditModal(id: number): void {
    const user = this.getById(id);
    if (!user) return;

    const event = new CustomEvent('admin:open-user-modal', {
      detail: { mode: 'edit', user },
    });
    document.dispatchEvent(event);
  },

  /**
   * Open add modal for user
   */
  openAddModal(): void {
    const event = new CustomEvent('admin:open-user-modal', {
      detail: { mode: 'add' },
    });
    document.dispatchEvent(event);
  },
};

// Register event handlers
AdminEvents.registerHandlers({
  'user:edit': async (action) => {
    if (action.type === 'user:edit') {
      UsersModule.openEditModal(action.id);
    }
  },
  'user:delete': async (action) => {
    if (action.type === 'user:delete') {
      await UsersModule.delete(action.id);
    }
  },
});
