#!/usr/bin/env node
/**
 * PO to JSON Converter for Astro i18n
 *
 * Converts .po files to a single JSON file per locale.
 * Supports msgctxt for namespacing (e.g., "settings.username")
 *
 * Usage: node scripts/po2json.mjs
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, '../src/i18n/locales');
const OUTPUT_DIR = join(__dirname, '../public/locales');

/**
 * Parse a .po file and extract translations
 * @param {string} content - Raw .po file content
 * @returns {Object} - Key-value pairs of translations
 */
function parsePO(content) {
  const translations = {};
  const entries = content.split(/\n\n+/);

  for (const entry of entries) {
    const lines = entry.split('\n');
    let msgctxt = null;
    let msgid = null;
    let msgstr = null;
    let currentField = null;

    for (const line of lines) {
      // Skip comments and empty lines
      if (line.startsWith('#') || line.trim() === '') continue;

      if (line.startsWith('msgctxt ')) {
        msgctxt = extractQuotedString(line.substring(8));
        currentField = 'msgctxt';
      } else if (line.startsWith('msgid ')) {
        msgid = extractQuotedString(line.substring(6));
        currentField = 'msgid';
      } else if (line.startsWith('msgstr ')) {
        msgstr = extractQuotedString(line.substring(7));
        currentField = 'msgstr';
      } else if (line.startsWith('"')) {
        // Continuation of previous field
        const continuation = extractQuotedString(line);
        if (currentField === 'msgctxt') msgctxt += continuation;
        else if (currentField === 'msgid') msgid += continuation;
        else if (currentField === 'msgstr') msgstr += continuation;
      }
    }

    // Use msgctxt as key, fallback to msgid
    const key = msgctxt || msgid;
    if (key && msgstr !== null && key !== '') {
      translations[key] = msgstr || msgid; // Fallback to msgid if msgstr is empty
    }
  }

  return translations;
}

/**
 * Extract string content from quoted PO field
 * @param {string} quoted - Quoted string like "text here"
 * @returns {string} - Unquoted content
 */
function extractQuotedString(quoted) {
  const match = quoted.match(/^"(.*)"$/);
  if (!match) return '';
  return match[1]
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

/**
 * Process messages.po file for a locale
 * @param {string} locale - Locale code (e.g., 'en')
 * @returns {Object} - Translations object
 */
function processLocale(locale) {
  const localeDir = join(LOCALES_DIR, locale);
  const messagesFile = join(localeDir, 'messages.po');

  if (!existsSync(messagesFile)) {
    console.warn(`Warning: messages.po not found for ${locale}`);
    return {};
  }

  const content = readFileSync(messagesFile, 'utf-8');
  return parsePO(content);
}

/**
 * Main execution
 */
function main() {
  console.log('Converting .po files to JSON...');

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Check if locales directory exists
  if (!existsSync(LOCALES_DIR)) {
    console.warn(`Warning: Locales directory not found: ${LOCALES_DIR}`);
    console.log('Creating empty locales structure...');
    mkdirSync(join(LOCALES_DIR, 'en'), { recursive: true });
    writeFileSync(join(OUTPUT_DIR, 'en.json'), '{}');
    console.log('Done! (no translations found)');
    return;
  }

  // Process each locale (filter out .DS_Store and other non-directories)
  const locales = readdirSync(LOCALES_DIR).filter(f => {
    // Skip hidden files like .DS_Store
    if (f.startsWith('.')) return false;
    const localeDir = join(LOCALES_DIR, f);
    // Check if it's actually a directory
    if (!statSync(localeDir).isDirectory()) return false;
    return readdirSync(localeDir).some(file => file.endsWith('.po'));
  });

  if (locales.length === 0) {
    console.warn('No .po files found in any locale directory');
    writeFileSync(join(OUTPUT_DIR, 'en.json'), '{}');
    console.log('Done! (no translations found)');
    return;
  }

  for (const locale of locales) {
    console.log(`  Processing: ${locale}`);
    const translations = processLocale(locale);
    const outputPath = join(OUTPUT_DIR, `${locale}.json`);
    writeFileSync(outputPath, JSON.stringify(translations, null, 2));
    console.log(`  -> ${Object.keys(translations).length} translations written to ${locale}.json`);
  }

  console.log('Done!');
}

main();
