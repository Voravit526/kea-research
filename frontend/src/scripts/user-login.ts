/**
 * User Login Handler
 */

import { STORAGE_KEYS } from './constants';
import { apiRequest, ApiRequestError } from './api';

const loginForm = document.getElementById('login-form') as HTMLFormElement;
const loginBtn = document.getElementById('login-btn') as HTMLButtonElement;
const loginSpinner = document.getElementById('login-spinner') as HTMLElement;
const loginError = document.getElementById('login-error') as HTMLDivElement;

interface LoginResponse {
  token: string;
  user: {
    id: number;
    username: string;
    display_name?: string;
  };
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = (document.getElementById('username') as HTMLInputElement).value;
  const password = (document.getElementById('password') as HTMLInputElement).value;

  loginBtn.disabled = true;
  loginSpinner.classList.remove('d-none');
  loginError.classList.add('d-none');

  try {
    const data = await apiRequest<LoginResponse>(
      '/api/users/login',
      {
        method: 'POST',
        body: JSON.stringify({ username, password }),
        skipAuthRedirect: true,
      }
    );

    // Store token and user info
    localStorage.setItem(STORAGE_KEYS.USER_TOKEN, data.token);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));

    // Redirect to chat
    window.location.href = '/';
  } catch (error) {
    if (error instanceof ApiRequestError) {
      loginError.textContent = error.message;
    } else {
      loginError.textContent = error instanceof Error ? error.message : 'Login failed';
    }
    loginError.classList.remove('d-none');
  } finally {
    loginBtn.disabled = false;
    loginSpinner.classList.add('d-none');
  }
});

// Check if already logged in
async function checkAuth() {
  const token = localStorage.getItem(STORAGE_KEYS.USER_TOKEN);
  if (token) {
    try {
      await apiRequest('/api/users/verify', { skipAuthRedirect: true }, token);
      // Token valid, redirect to chat
      window.location.href = '/';
      return;
    } catch {
      // Token invalid, clear it and continue to show login
      localStorage.removeItem(STORAGE_KEYS.USER_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  }
}

// Initialize auth check
void checkAuth();
