/**
 * KEA Admin Panel - Toast Notification System
 * Queue-managed toast notifications with Bootstrap Toast
 */

import type { ToastType, ToastOptions } from '../types';

declare const bootstrap: {
  Toast: new (element: HTMLElement) => { show(): void; hide(): void };
};

/**
 * Toast icons for each type
 */
const TOAST_ICONS: Record<ToastType, string> = {
  success: 'bi-check-circle text-success',
  error: 'bi-exclamation-circle text-danger',
  info: 'bi-info-circle text-primary',
  warning: 'bi-exclamation-triangle text-warning',
};

/**
 * Default duration for toasts (ms)
 */
const DEFAULT_DURATION = 3000;

/**
 * Toast Manager - Handles notifications with queue management
 */
class ToastManager {
  private queue: ToastOptions[] = [];
  private isShowing = false;
  private toastEl: HTMLElement | null = null;
  private toastIcon: HTMLElement | null = null;
  private toastTitle: HTMLElement | null = null;
  private toastMessage: HTMLElement | null = null;
  private bsToast: { show(): void; hide(): void } | null = null;
  private initialized = false;

  /**
   * Initialize toast manager with DOM elements
   * Call this after DOM is ready
   */
  init(): void {
    if (this.initialized) return;

    this.toastEl = document.getElementById('toast');
    this.toastIcon = document.getElementById('toast-icon');
    this.toastTitle = document.getElementById('toast-title');
    this.toastMessage = document.getElementById('toast-message');

    if (this.toastEl) {
      this.bsToast = new bootstrap.Toast(this.toastEl);
      this.initialized = true;
    }
  }

  /**
   * Show a toast notification
   */
  show(options: ToastOptions): void {
    this.queue.push(options);
    if (!this.isShowing) {
      this.processQueue();
    }
  }

  /**
   * Process the toast queue
   */
  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) {
      this.isShowing = false;
      return;
    }

    this.isShowing = true;
    const options = this.queue.shift()!;
    await this.displayToast(options);

    // Small delay between toasts
    await new Promise((r) => setTimeout(r, 300));
    this.processQueue();
  }

  /**
   * Display a single toast
   */
  private displayToast(options: ToastOptions): Promise<void> {
    return new Promise((resolve) => {
      if (!this.initialized) {
        this.init();
      }

      if (!this.toastEl || !this.bsToast) {
        console.warn('[Toast] Toast element not found');
        resolve();
        return;
      }

      // Set content
      if (this.toastIcon) {
        this.toastIcon.className = `bi ${TOAST_ICONS[options.type]} me-2`;
      }
      if (this.toastTitle) {
        this.toastTitle.textContent = options.title;
      }
      if (this.toastMessage) {
        this.toastMessage.textContent = options.message;
      }

      // Show toast
      this.bsToast.show();

      // Auto-resolve after duration
      const duration = options.duration ?? DEFAULT_DURATION;
      setTimeout(resolve, duration);
    });
  }

  // ========== Convenience Methods ==========

  /**
   * Show success toast
   */
  success(message: string, title = 'Success'): void {
    this.show({ title, message, type: 'success' });
  }

  /**
   * Show error toast
   */
  error(message: string, title = 'Error'): void {
    this.show({ title, message, type: 'error' });
  }

  /**
   * Show info toast
   */
  info(message: string, title = 'Info'): void {
    this.show({ title, message, type: 'info' });
  }

  /**
   * Show warning toast
   */
  warning(message: string, title = 'Warning'): void {
    this.show({ title, message, type: 'warning' });
  }
}

// Export singleton instance
export const Toast = new ToastManager();

/**
 * Legacy showToast function for backward compatibility
 */
export function showToast(
  title: string,
  message: string,
  type: ToastType = 'info'
): void {
  Toast.show({ title, message, type });
}
