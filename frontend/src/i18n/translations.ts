/**
 * Translation loading and caching for server-side rendering
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { DEFAULT_LOCALE, type SupportedLocale } from './index';

// Cache for loaded translations
const translationCache = new Map<string, Record<string, string>>();

/**
 * Load translations for a locale (with caching)
 */
export function loadTranslations(locale: SupportedLocale): Record<string, string> {
  if (translationCache.has(locale)) {
    return translationCache.get(locale)!;
  }

  const filePath = join(process.cwd(), 'public', 'locales', `${locale}.json`);

  if (!existsSync(filePath)) {
    console.warn(`Translation file not found: ${filePath}, falling back to ${DEFAULT_LOCALE}`);
    if (locale !== DEFAULT_LOCALE) {
      return loadTranslations(DEFAULT_LOCALE);
    }
    return {};
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const translations = JSON.parse(content);
    translationCache.set(locale, translations);
    return translations;
  } catch (error) {
    console.error(`Error loading translations for ${locale}:`, error);
    return {};
  }
}

/**
 * Create a translation function for a specific locale
 */
export function createTranslator(locale: SupportedLocale) {
  const translations = loadTranslations(locale);

  return function t(key: string, vars?: Record<string, string | number>): string {
    const template = translations[key] || key;

    if (vars) {
      return template.replace(/\{(\w+)\}/g, (match, varKey) => {
        return vars[varKey]?.toString() ?? match;
      });
    }

    return template;
  };
}

/**
 * Get all translations for client-side use (filtered by prefixes)
 */
export function getClientTranslations(locale: SupportedLocale, prefixes: string | string[] = 'js.'): Record<string, string> {
  const all = loadTranslations(locale);
  const filtered: Record<string, string> = {};
  const prefixList = Array.isArray(prefixes) ? prefixes : [prefixes];

  for (const [key, value] of Object.entries(all)) {
    if (prefixList.some(prefix => key.startsWith(prefix))) {
      filtered[key] = value;
    }
  }

  return filtered;
}
