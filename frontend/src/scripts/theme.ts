/**
 * Theme Manager
 */

import { StorageUtils } from './storage';

// Debounce timeout for theme changes
let themeDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export const ThemeManager = {
  apply(theme: 'light' | 'dark' | 'auto'): void {
    const html = document.documentElement;
    let effectiveTheme: 'light' | 'dark';
    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      effectiveTheme = prefersDark ? 'dark' : 'light';
    } else {
      effectiveTheme = theme;
    }
    html.setAttribute('data-bs-theme', effectiveTheme);
    this.updateLogo(effectiveTheme);
  },

  // Initialize theme from localStorage (fast, sync)
  init(): void {
    const theme = (localStorage.getItem('theme') || 'auto') as 'light' | 'dark' | 'auto';
    this.apply(theme);
  },

  updateLogo(theme: 'light' | 'dark'): void {
    const logo = document.getElementById('navbarLogo') as HTMLImageElement | null;
    if (logo) {
      const logoUrl = theme === 'dark'
        ? 'https://cdn.jsdelivr.net/gh/keabase/web@main/dist/img/logo/KEA-research-logo-dark.svg'
        : 'https://cdn.jsdelivr.net/gh/keabase/web@main/dist/img/logo/KEA-research-logo-light.svg';
      logo.src = logoUrl;
    }
  },

  listen(): void {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      // Debounce rapid theme changes to avoid race conditions
      if (themeDebounceTimer) {
        clearTimeout(themeDebounceTimer);
      }
      themeDebounceTimer = setTimeout(async () => {
        try {
          const settings = await StorageUtils.getSettings();
          if (settings.theme === 'auto') {
            this.apply('auto');
          }
        } catch (error) {
          console.warn('Failed to apply theme on system change:', error);
        }
      }, 100);
    });
  }
};

// Make it globally available
declare global {
  interface Window {
    ThemeManager: typeof ThemeManager;
  }
}

window.ThemeManager = ThemeManager;
