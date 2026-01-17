/**
 * KEA Admin Panel - Event Delegation System
 * Single listeners that route actions based on data-action attributes
 */

import type { AdminAction } from './types';

// Action handlers will be registered by feature modules
type ActionHandlerFn = (action: AdminAction) => Promise<void>;
const actionHandlers: Map<string, ActionHandlerFn> = new Map();

/**
 * Admin Event Router
 *
 * Implements event delegation pattern - single listeners on document
 * that route actions based on data-action attributes.
 *
 * Usage in HTML:
 * <button data-action="provider:toggle" data-id="1">Toggle</button>
 * <input type="checkbox" data-action="settings:toggle-guest">
 *
 * Replaces inline handlers like onclick="toggleProvider(1)"
 */
export const AdminEvents = {
  _initialized: false,

  /**
   * Initialize event delegation
   * Should be called once on app startup
   */
  init(): void {
    if (this._initialized) return;
    this._initialized = true;

    // Single click handler for all click actions
    document.addEventListener('click', this.handleClick.bind(this));

    // Single change handler for toggles/inputs
    document.addEventListener('change', this.handleChange.bind(this));
  },

  /**
   * Register a handler for a specific action type
   */
  registerHandler(actionType: string, handler: ActionHandlerFn): void {
    actionHandlers.set(actionType, handler);
  },

  /**
   * Register multiple handlers at once
   */
  registerHandlers(handlers: Record<string, ActionHandlerFn>): void {
    Object.entries(handlers).forEach(([type, handler]) => {
      actionHandlers.set(type, handler);
    });
  },

  /**
   * Handle click events with data-action attributes
   */
  handleClick(event: Event): void {
    const target = event.target as HTMLElement;
    const actionEl = target.closest('[data-action]') as HTMLElement | null;

    if (!actionEl) return;

    const actionType = actionEl.dataset.action;
    if (!actionType) return;

    // Skip if this is a form element that should use change event
    if (actionEl instanceof HTMLInputElement || actionEl instanceof HTMLSelectElement) {
      return;
    }

    // Get ID if present
    const id = actionEl.dataset.id ? parseInt(actionEl.dataset.id, 10) : undefined;

    // Prevent default for buttons to avoid form submission
    if (actionEl instanceof HTMLButtonElement) {
      event.preventDefault();
    }

    // Build and dispatch action
    const action = this.buildAction(actionType, { id, element: actionEl });
    if (action) {
      this.dispatch(action);
    }
  },

  /**
   * Handle change events for toggles and inputs
   */
  handleChange(event: Event): void {
    const target = event.target as HTMLInputElement | HTMLSelectElement;

    if (!target.dataset.action) return;

    const actionType = target.dataset.action;
    const id = target.dataset.id ? parseInt(target.dataset.id, 10) : undefined;
    const checked = target instanceof HTMLInputElement ? target.checked : undefined;
    const value = target.value;

    // Build and dispatch action
    const action = this.buildAction(actionType, { id, checked, value, element: target });
    if (action) {
      this.dispatch(action);
    }
  },

  /**
   * Build typed action from string action type
   */
  buildAction(
    actionType: string,
    params: {
      id?: number;
      checked?: boolean;
      value?: string;
      element?: HTMLElement;
    }
  ): AdminAction | null {
    const { id, checked, element } = params;

    switch (actionType) {
      // Provider actions
      case 'provider:toggle':
        return id !== undefined ? { type: 'provider:toggle', id } : null;
      case 'provider:edit':
        return id !== undefined ? { type: 'provider:edit', id } : null;
      case 'provider:edit-api-key':
        return id !== undefined ? { type: 'provider:edit-api-key', id } : null;
      case 'provider:delete':
        return id !== undefined ? { type: 'provider:delete', id } : null;
      case 'provider:discover':
        return id !== undefined ? { type: 'provider:discover', id } : null;

      // Model actions
      case 'model:toggle':
        return id !== undefined ? { type: 'model:toggle', id } : null;
      case 'model:delete':
        return id !== undefined ? { type: 'model:delete', id } : null;

      // Provider set actions
      case 'provider-set:select-tab': {
        const name = element?.dataset.name;
        return name ? { type: 'provider-set:select-tab', name } : null;
      }
      case 'provider-set:toggle':
        return id !== undefined ? { type: 'provider-set:toggle', id } : null;
      case 'provider-set:edit':
        return id !== undefined ? { type: 'provider-set:edit', id } : null;
      case 'provider-set:delete':
        return id !== undefined ? { type: 'provider-set:delete', id } : null;
      case 'provider-set:member-toggle': {
        const setId = element?.dataset.setId ? parseInt(element.dataset.setId, 10) : undefined;
        const memberId = element?.dataset.memberId ? parseInt(element.dataset.memberId, 10) : undefined;
        return setId !== undefined && memberId !== undefined
          ? { type: 'provider-set:member-toggle', setId, memberId }
          : null;
      }
      case 'provider-set:add-member':
        return id !== undefined ? { type: 'provider-set:add-member', setId: id } : null;
      case 'provider-set:remove-member': {
        const setId = element?.dataset.setId ? parseInt(element.dataset.setId, 10) : undefined;
        const memberId = element?.dataset.memberId ? parseInt(element.dataset.memberId, 10) : undefined;
        return setId !== undefined && memberId !== undefined
          ? { type: 'provider-set:remove-member', setId, memberId }
          : null;
      }

      // User actions
      case 'user:edit':
        return id !== undefined ? { type: 'user:edit', id } : null;
      case 'user:delete':
        return id !== undefined ? { type: 'user:delete', id } : null;

      // Settings actions
      case 'settings:toggle-guest':
        return { type: 'settings:toggle-guest', enabled: checked ?? false };
      case 'settings:toggle-tts':
        return { type: 'settings:toggle-tts', enabled: checked ?? false };

      default:
        console.warn(`[AdminEvents] Unknown action type: ${actionType}`);
        return null;
    }
  },

  /**
   * Dispatch action to registered handler
   */
  async dispatch(action: AdminAction): Promise<void> {
    const handler = actionHandlers.get(action.type);

    if (handler) {
      try {
        await handler(action);
      } catch (error) {
        console.error(`[AdminEvents] Action ${action.type} failed:`, error);
        // Error handling (toast notification) should be done in the handler
      }
    } else {
      console.warn(`[AdminEvents] No handler registered for action: ${action.type}`);
    }
  },

  /**
   * Emit a custom event (for programmatic triggering)
   */
  emit(action: AdminAction): void {
    this.dispatch(action);
  },

  /**
   * Get all registered action types (for debugging)
   */
  getRegisteredActions(): string[] {
    return Array.from(actionHandlers.keys());
  },
};

// Type augmentation for global access (optional)
declare global {
  interface Window {
    AdminEvents?: typeof AdminEvents;
  }
}
