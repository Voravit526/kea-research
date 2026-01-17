/**
 * KEA Admin Panel - Authentication Module
 * Handles login, logout, and token management
 */

import { STORAGE_KEYS } from '../constants';
import { AdminState } from './state';
import { AuthApi } from './api';

/**
 * Authentication module for admin panel
 */
export const AdminAuth = {
  /**
   * Attempt to login with password
   * @returns true if login successful
   */
  async login(password: string): Promise<boolean> {
    try {
      const data = await AuthApi.login(password);
      AdminState.setAuth(data.token);
      localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, data.token);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Logout and clear session
   */
  async logout(): Promise<void> {
    try {
      await AuthApi.logout();
    } catch {
      // Ignore errors on logout
    }
    AdminState.reset();
    localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
  },

  /**
   * Verify if current token is valid
   * @returns true if token is valid
   */
  async verifyToken(): Promise<boolean> {
    return AuthApi.verify();
  },

  /**
   * Check for stored token and verify it
   * Called on app initialization
   * @returns true if user is authenticated
   */
  async checkStoredToken(): Promise<boolean> {
    const storedToken = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);

    if (!storedToken) {
      return false;
    }

    // Set token in state so API calls include it
    AdminState.setAuth(storedToken);

    // Verify token is still valid
    const isValid = await this.verifyToken();

    if (!isValid) {
      // Token invalid, clear it
      AdminState.setAuth(null);
      localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
      return false;
    }

    return true;
  },

  /**
   * Get current auth token
   */
  getToken(): string | null {
    return AdminState.authToken;
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return AdminState.isAuthenticated;
  },
};
