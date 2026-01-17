/**
 * KEA Admin Panel - Modal Utilities
 * Bootstrap modal helpers and form state management
 */

declare const bootstrap: {
  Modal: {
    new (element: HTMLElement): BootstrapModal;
    getInstance(element: HTMLElement): BootstrapModal | null;
    getOrCreateInstance(element: HTMLElement): BootstrapModal;
  };
};

interface BootstrapModal {
  show(): void;
  hide(): void;
}

/**
 * Get or create a Bootstrap Modal instance
 * Uses Bootstrap's getOrCreateInstance to avoid conflicts with data-bs-toggle
 */
export function getModal(idOrSelector: string): BootstrapModal | null {
  // Normalize to CSS selector (add # if it's just an ID)
  const selector = idOrSelector.charAt(0) === '#' ? idOrSelector : `#${idOrSelector}`;

  // Find the element first
  const element = document.querySelector(selector) as HTMLElement | null;
  if (!element) {
    console.warn(`[Modal] Element not found: ${selector}`);
    return null;
  }

  try {
    // Use getOrCreateInstance to work with Bootstrap's auto-created instances
    return bootstrap.Modal.getOrCreateInstance(element);
  } catch (error) {
    console.warn(`[Modal] Failed to get modal: ${selector}`, error);
    return null;
  }
}

/**
 * Show a modal by selector
 */
export function showModal(selector: string): void {
  const modal = getModal(selector);
  modal?.show();
}

/**
 * Hide a modal by selector
 */
export function hideModal(selector: string): void {
  const modal = getModal(selector);
  modal?.hide();
}

/**
 * Reset a form within a modal
 */
export function resetModalForm(modalSelector: string, formSelector?: string): void {
  const modalEl = document.querySelector(modalSelector);
  if (!modalEl) return;

  const form = formSelector
    ? modalEl.querySelector(formSelector) as HTMLFormElement
    : modalEl.querySelector('form') as HTMLFormElement;

  if (form) {
    form.reset();
    // Clear validation states
    form.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
    form.querySelectorAll('.is-valid').forEach((el) => el.classList.remove('is-valid'));
    // Clear custom error messages
    form.querySelectorAll('.invalid-feedback').forEach((el) => {
      el.textContent = '';
    });
  }
}

/**
 * Set loading state on a button
 */
export function setButtonLoading(button: HTMLButtonElement | null, loading: boolean): void {
  if (!button) return;

  button.disabled = loading;
  button.classList.toggle('loading', loading);

  // Handle spinner element if present
  const spinner = button.querySelector('.loading-spinner');
  if (spinner) {
    spinner.classList.toggle('d-none', !loading);
  }
}

/**
 * Get form data as an object
 */
export function getFormData(form: HTMLFormElement): Record<string, string> {
  const formData = new FormData(form);
  const data: Record<string, string> = {};

  formData.forEach((value, key) => {
    if (typeof value === 'string') {
      data[key] = value;
    }
  });

  return data;
}

/**
 * Set form field values from an object
 */
export function setFormValues(
  form: HTMLFormElement,
  values: Record<string, string | boolean | number | null>
): void {
  Object.entries(values).forEach(([name, value]) => {
    const field = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (!field) return;

    if (field instanceof HTMLInputElement) {
      if (field.type === 'checkbox') {
        field.checked = Boolean(value);
      } else {
        field.value = value?.toString() ?? '';
      }
    } else if (field) {
      field.value = value?.toString() ?? '';
    }
  });
}

/**
 * Modal event helper - listen for modal events
 */
export function onModalEvent(
  selector: string,
  event: 'show' | 'shown' | 'hide' | 'hidden',
  callback: () => void
): () => void {
  const modalEl = document.querySelector(selector);
  if (!modalEl) {
    return () => {};
  }

  const eventName = `${event}.bs.modal`;
  const handler = () => callback();

  modalEl.addEventListener(eventName, handler);

  // Return cleanup function
  return () => modalEl.removeEventListener(eventName, handler);
}

/**
 * Create a simple modal opener that handles common patterns
 */
export function createModalHandler(config: {
  modalSelector: string;
  formSelector?: string;
  onOpen?: () => void;
  onClose?: () => void;
}): {
  open: () => void;
  close: () => void;
} {
  const { modalSelector, formSelector, onOpen, onClose } = config;

  return {
    open() {
      if (formSelector) {
        resetModalForm(modalSelector, formSelector);
      }
      onOpen?.();
      showModal(modalSelector);
    },
    close() {
      hideModal(modalSelector);
      onClose?.();
    },
  };
}
