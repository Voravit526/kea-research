/**
 * User Authentication Module for Chat Interface
 * Handles auth state, token management, and access control
 */

import { STORAGE_KEYS } from './constants';
import { apiRequest, ApiRequestError } from './api';

interface UserInfo {
  id: number;
  username: string;
  display_name?: string;
  is_active: boolean;
  created_at: string;
}

interface AuthStatus {
  guest_access_allowed: boolean;
  login_required: boolean;
  tts_enabled?: boolean;
}

// Global app settings from server
export const AppSettings = {
  ttsEnabled: true, // Default to true until server response
};

export const UserAuth = {
  token: null as string | null,
  user: null as UserInfo | null,
  isGuest: false,

  /**
   * Initialize auth - check if user is authenticated or guest access is allowed
   * Returns true if user can access the chat, false if redirect to login is needed
   */
  async init(): Promise<boolean> {
    // Check auth status from server
    const authStatus = await this.getAuthStatus();

    // Store app settings from server
    AppSettings.ttsEnabled = authStatus.tts_enabled !== false;

    if (authStatus.guest_access_allowed) {
      // Guest access enabled, check if user wants to use stored credentials
      const storedToken = localStorage.getItem(STORAGE_KEYS.USER_TOKEN);
      if (storedToken) {
        const verified = await this.verifyToken(storedToken);
        if (verified) {
          return true;
        }
      }
      // No valid token but guest access allowed
      this.isGuest = true;
      return true;
    }

    // Login required - check for stored token
    const storedToken = localStorage.getItem(STORAGE_KEYS.USER_TOKEN);
    if (!storedToken) {
      this.redirectToLogin();
      return false;
    }

    // Verify token
    const verified = await this.verifyToken(storedToken);
    if (!verified) {
      this.clearAuth();
      this.redirectToLogin();
      return false;
    }

    return true;
  },

  /**
   * Verify a token with the server and update local state
   */
  async verifyToken(token: string): Promise<boolean> {
    try {
      const data = await apiRequest<{ user: UserInfo }>(
        '/api/users/verify',
        { skipAuthRedirect: true },
        token
      );
      this.token = token;
      this.user = data.user;
      this.isGuest = false;
      return true;
    } catch {
      // Token invalid, expired, or network error
      return false;
    }
  },

  /**
   * Get auth status from server
   */
  async getAuthStatus(): Promise<AuthStatus> {
    try {
      return await apiRequest<AuthStatus>('/api/auth-status', { skipAuthRedirect: true });
    } catch {
      return { guest_access_allowed: false, login_required: true };
    }
  },

  /**
   * Get the current auth token
   */
  getToken(): string | null {
    return this.token || localStorage.getItem(STORAGE_KEYS.USER_TOKEN);
  },

  /**
   * Get auth headers for API requests
   */
  getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  /**
   * Clear auth state and localStorage
   */
  clearAuth(): void {
    this.token = null;
    this.user = null;
    this.isGuest = false;
    localStorage.removeItem(STORAGE_KEYS.USER_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
  },

  /**
   * Logout and redirect to login page
   */
  logout(): void {
    const token = this.getToken();
    if (token) {
      fetch('/api/users/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    this.clearAuth();
    window.location.href = '/login';
  },

  /**
   * Redirect to login page
   */
  redirectToLogin(): void {
    window.location.href = '/login';
  },

  /**
   * Check if user is authenticated (not a guest)
   */
  isAuthenticated(): boolean {
    return this.token !== null && this.user !== null;
  },

  /**
   * Get display name (username or display_name if set)
   */
  getDisplayName(): string {
    if (!this.user) return 'Guest';
    return this.user.display_name || this.user.username;
  },
};

// Make globally available for other scripts
declare global {
  interface Window {
    UserAuth: typeof UserAuth;
    AppSettings: typeof AppSettings;
  }
}

window.UserAuth = UserAuth;
window.AppSettings = AppSettings;
