/**
 * Server-side i18n utilities for Astro
 */

export const DEFAULT_LOCALE = 'en';
export const SUPPORTED_LOCALES = [
  // Latin script - Western European
  'en', 'en-AU', 'en-GB', 'en-IE', 'de', 'fr', 'es', 'it', 'pt', 'pt-BR', 'nl',
  'da', 'no', 'sv', 'fi', 'is', 'lb', 'mt',
  // Latin script - Central/Eastern European
  'pl', 'cs', 'sk', 'hu', 'ro', 'hr', 'sl', 'bs', 'sq', 'lv', 'lt', 'et',
  // Latin script - Celtic
  'ga', 'gd', 'cy',
  // Latin script - Other European
  'ca', 'eu', 'gl',
  // Latin script - Southeast Asian
  'id', 'ms', 'fil', 'vi', 'jv',
  // Latin script - African
  'sw', 'ha', 'yo',
  // Latin script - Turkic
  'tr', 'az',
  // Cyrillic script
  'uk', 'be', 'bg', 'mk', 'sr', 'kk',
  // Greek script
  'el',
  // Georgian/Armenian
  'ka', 'hy',
  // Hebrew/Arabic script (RTL)
  'he', 'ar', 'fa', 'ur',
  // Indic scripts
  'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'pa', 'kn',
  // Other scripts
  'am', 'my', 'th',
  // CJK
  'zh', 'zh-TW', 'zh-HK', 'ja', 'ko'
] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

export function isValidLocale(code: string): code is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).indexOf(code) !== -1;
}

/**
 * Parse cookie string and get a specific cookie value
 */
function getCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const cookie of cookies) {
    const [key, value] = cookie.split('=');
    if (key === name) return value;
  }
  return null;
}

/**
 * Detect locale from cookie first, then Accept-Language header
 */
export function detectLocale(request: Request): SupportedLocale {
  // 1. Check for language cookie (user preference)
  const cookieHeader = request.headers.get('cookie');
  const cookieLang = getCookie(cookieHeader, 'kea_lang');

  if (cookieLang && isValidLocale(cookieLang)) {
    return cookieLang;
  }

  // 2. Fall back to Accept-Language header
  const acceptLanguage = request.headers.get('accept-language');

  if (!acceptLanguage) {
    return DEFAULT_LOCALE;
  }

  // Parse Accept-Language header
  // Format: "en-US,en;q=0.9,es;q=0.8"
  const languages = acceptLanguage
    .split(',')
    .map(lang => {
      const [code, qValue] = lang.trim().split(';q=');
      return {
        code: code.split('-')[0].toLowerCase(), // Extract primary language
        quality: qValue ? parseFloat(qValue) : 1.0
      };
    })
    .sort((a, b) => b.quality - a.quality);

  // Find first matching supported locale
  for (const { code } of languages) {
    if (isValidLocale(code)) {
      return code;
    }
  }

  return DEFAULT_LOCALE;
}
