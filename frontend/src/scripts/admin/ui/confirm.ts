/**
 * KEA Admin Panel - Confirmation Dialog
 * Styled Bootstrap modal for confirmations (replaces native confirm())
 */

import type { ConfirmOptions } from '../types';

declare const bootstrap: {
  Modal: new (element: HTMLElement) => BootstrapModal;
};

interface BootstrapModal {
  show(): void;
  hide(): void;
}

// Modal element IDs
const CONFIRM_MODAL_ID = 'confirmDialog';
const CONFIRM_TITLE_ID = 'confirmTitle';
const CONFIRM_MESSAGE_ID = 'confirmMessage';
const CONFIRM_BTN_ID = 'confirmAction';
const CANCEL_BTN_ID = 'confirmCancel';

// Cached modal instance
let confirmModal: BootstrapModal | null = null;
let currentResolve: ((value: boolean) => void) | null = null;

/**
 * Initialize the confirm dialog
 * Creates the modal HTML if it doesn't exist
 */
function ensureModalExists(): HTMLElement | null {
  let modalEl = document.getElementById(CONFIRM_MODAL_ID);

  if (!modalEl) {
    // Create modal HTML
    modalEl = document.createElement('div');
    modalEl.id = CONFIRM_MODAL_ID;
    modalEl.className = 'modal fade';
    modalEl.tabIndex = -1;
    modalEl.innerHTML = `
      <div class="modal-dialog modal-sm modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-body text-center py-4">
            <i class="bi bi-exclamation-triangle text-warning fs-1 mb-3 d-block"></i>
            <h5 id="${CONFIRM_TITLE_ID}" class="mb-2">Confirm Action</h5>
            <p id="${CONFIRM_MESSAGE_ID}" class="text-muted mb-0"></p>
          </div>
          <div class="modal-footer justify-content-center border-0 pt-0">
            <button type="button" id="${CANCEL_BTN_ID}" class="btn btn-secondary" data-bs-dismiss="modal">
              Cancel
            </button>
            <button type="button" id="${CONFIRM_BTN_ID}" class="btn btn-danger">
              Confirm
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalEl);

    // Add event listeners
    const confirmBtn = document.getElementById(CONFIRM_BTN_ID);
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        confirmModal?.hide();
        currentResolve?.(true);
        currentResolve = null;
      });
    }

    // Handle modal hidden event (cancel)
    modalEl.addEventListener('hidden.bs.modal', () => {
      if (currentResolve) {
        currentResolve(false);
        currentResolve = null;
      }
    });
  }

  return modalEl;
}

/**
 * Show a confirmation dialog
 * @returns Promise that resolves to true if confirmed, false if cancelled
 */
export async function showConfirm(options: ConfirmOptions): Promise<boolean> {
  const modalEl = ensureModalExists();
  if (!modalEl) {
    // Fallback to native confirm if modal creation fails
    return window.confirm(options.message);
  }

  // Get or create Bootstrap Modal instance
  if (!confirmModal) {
    confirmModal = new bootstrap.Modal(modalEl);
  }

  // Update modal content
  const titleEl = document.getElementById(CONFIRM_TITLE_ID);
  const messageEl = document.getElementById(CONFIRM_MESSAGE_ID);
  const confirmBtn = document.getElementById(CONFIRM_BTN_ID);
  const cancelBtn = document.getElementById(CANCEL_BTN_ID);

  if (titleEl) titleEl.textContent = options.title;
  if (messageEl) messageEl.textContent = options.message;

  if (confirmBtn) {
    confirmBtn.textContent = options.confirmLabel ?? 'Confirm';
    confirmBtn.className = `btn ${options.danger ? 'btn-danger' : 'btn-primary'}`;
  }

  if (cancelBtn) {
    cancelBtn.textContent = options.cancelLabel ?? 'Cancel';
  }

  // Return a promise that resolves when user makes a choice
  return new Promise((resolve) => {
    currentResolve = resolve;
    confirmModal?.show();
  });
}

/**
 * Convenience function for delete confirmation
 */
export async function confirmDelete(
  itemName: string,
  itemType = 'item'
): Promise<boolean> {
  return showConfirm({
    title: `Delete ${itemType}`,
    message: `Are you sure you want to delete ${itemName}?`,
    confirmLabel: 'Delete',
    danger: true,
  });
}

/**
 * Convenience function for action confirmation
 */
export async function confirmAction(
  action: string,
  message: string
): Promise<boolean> {
  return showConfirm({
    title: action,
    message,
    confirmLabel: action,
    danger: false,
  });
}
