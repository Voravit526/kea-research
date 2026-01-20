/**
 * KEA Admin Panel - Version Checker Feature Module
 * Checks for software updates from GitHub
 */

import { AdminEvents } from '../events';
import { AdminApi } from '../api';
import type { VersionInfo } from '../types';

// Forward declaration for UI modules
let showToast: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
let showModal: (selector: string) => void;

/**
 * Set UI dependencies (called from index.ts)
 */
export function setVersionCheckerUIDeps(deps: {
  toast: typeof showToast;
  modal: typeof showModal;
}): void {
  showToast = deps.toast;
  showModal = deps.modal;
}

// Module state
let versionInfo: VersionInfo | null = null;

/**
 * Version Checker Feature Module
 */
export const VersionCheckerModule = {
  /**
   * Check for version updates
   */
  async checkVersion(): Promise<void> {
    try {
      versionInfo = await AdminApi.version.check();

      // Update sidebar badge
      const sidebarBadge = document.getElementById('update-badge');
      const sidebarLink = document.getElementById('version-check-link');

      // Update navbar button and badge
      const navbarBtn = document.getElementById('version-navbar-btn');
      const navbarBadge = document.getElementById('version-navbar-badge');

      if (versionInfo.has_update) {
        // Sidebar: show badge
        sidebarBadge?.classList.remove('d-none');
        sidebarLink?.classList.add('text-warning', 'fw-bold');

        // Navbar: show button and iOS-style notification dot
        if (navbarBtn) navbarBtn.style.display = '';
        if (navbarBadge) navbarBadge.style.display = '';
      } else {
        // Hide all update indicators
        sidebarBadge?.classList.add('d-none');
        sidebarLink?.classList.remove('text-warning', 'fw-bold');

        // Keep navbar button visible but hide the notification dot
        if (navbarBtn) navbarBtn.style.display = '';
        if (navbarBadge) navbarBadge.style.display = 'none';
      }
    } catch (error) {
      console.error('Failed to check version:', error);
      // Silently fail - version check is non-critical
    }
  },

  /**
   * Show version modal
   */
  showModal(): void {
    if (!versionInfo) {
      showToast?.('Error', 'Version information not available', 'error');
      return;
    }

    // Populate modal content
    const currentEl = document.getElementById('current-version');
    const latestEl = document.getElementById('latest-version');
    const notesEl = document.getElementById('release-notes');
    const linkEl = document.getElementById('update-instructions-link') as HTMLAnchorElement;
    const statusEl = document.getElementById('version-status');

    if (currentEl) currentEl.textContent = versionInfo.current_version;
    if (latestEl) latestEl.textContent = versionInfo.latest_version;

    if (notesEl && versionInfo.release_notes) {
      // Simple markdown rendering (newlines to <br>)
      notesEl.innerHTML = versionInfo.release_notes
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    }

    if (linkEl && versionInfo.release_url) {
      linkEl.href = versionInfo.release_url;
      linkEl.classList.remove('d-none');
    }

    if (statusEl) {
      if (versionInfo.has_update) {
        statusEl.innerHTML = '<i class="bi bi-exclamation-triangle me-2"></i><span>Update available</span>';
        statusEl.className = 'alert alert-warning mb-4 d-flex align-items-center';
      } else {
        statusEl.innerHTML = '<i class="bi bi-check-circle me-2"></i><span>You are running the latest version</span>';
        statusEl.className = 'alert alert-success mb-4 d-flex align-items-center';
      }
    }

    showModal?.('#versionModal');
  },
};

// Register event handlers
AdminEvents.registerHandlers({
  'version:check': async () => {
    await VersionCheckerModule.checkVersion();
    showToast?.('Success', 'Version check completed', 'info');
  },
  'version:show-modal': () => {
    VersionCheckerModule.showModal();
  },
});
