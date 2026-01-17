#!/usr/bin/env node
/**
 * Translation Key Extraction & Validation Script
 *
 * Scans frontend templates for translation keys and compares against .po files.
 * Reports missing and unused translations.
 *
 * Usage: node scripts/extract-translations.mjs
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_SRC = join(__dirname, '../frontend/src');
const LOCALES_DIR = join(__dirname, '../frontend/src/i18n/locales');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

/**
 * Recursively get all files with given extensions
 */
function getFiles(dir, extensions, files = []) {
  if (!existsSync(dir)) return files;

  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    if (entry.startsWith('.')) continue;

    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      getFiles(fullPath, extensions, files);
    } else if (extensions.some(ext => entry.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Extract translation keys from source code
 */
function extractKeysFromCode(content, filePath) {
  const keys = new Map(); // key -> { file, line }

  // Pattern for t('key') or t("key") - captures the key
  // Must be:
  // - Preceded by word boundary, { or ( to avoid matching createElement('div') etc.
  // - Key must contain a dot (namespace.key format)
  // Matches: t('chat.send'), {t('settings.title')}, t("js.error", { vars })
  const pattern = /(?:^|[{\s(,])t\(\s*['"]([a-zA-Z0-9]+\.[a-zA-Z0-9._]+)['"]/g;

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    // Reset lastIndex for each line
    pattern.lastIndex = 0;
    while ((match = pattern.exec(line)) !== null) {
      const key = match[1];
      if (!keys.has(key)) {
        keys.set(key, { file: filePath, line: i + 1 });
      }
    }
  }

  return keys;
}

/**
 * Parse .po file and extract all msgctxt keys
 */
function extractKeysFromPO(content) {
  const keys = new Set();
  const entries = content.split(/\n\n+/);

  for (const entry of entries) {
    const lines = entry.split('\n');
    let msgctxt = null;
    let currentField = null;

    for (const line of lines) {
      if (line.startsWith('#') || line.trim() === '') continue;

      if (line.startsWith('msgctxt ')) {
        msgctxt = extractQuotedString(line.substring(8));
        currentField = 'msgctxt';
      } else if (line.startsWith('"') && currentField === 'msgctxt') {
        msgctxt += extractQuotedString(line);
      } else if (line.startsWith('msgid ')) {
        currentField = 'msgid';
      }
    }

    if (msgctxt && msgctxt !== '') {
      keys.add(msgctxt);
    }
  }

  return keys;
}

/**
 * Extract string from quoted PO field
 */
function extractQuotedString(quoted) {
  const match = quoted.match(/^"(.*)"$/);
  return match ? match[1] : '';
}

/**
 * Get all keys from all .po files in a locale
 */
function getLocaleKeys(locale) {
  const localeDir = join(LOCALES_DIR, locale);
  const keys = new Set();

  if (!existsSync(localeDir)) return keys;

  const files = readdirSync(localeDir).filter(f => f.endsWith('.po'));
  for (const file of files) {
    const content = readFileSync(join(localeDir, file), 'utf-8');
    const fileKeys = extractKeysFromPO(content);
    fileKeys.forEach(k => keys.add(k));
  }

  return keys;
}

/**
 * Get all available locales
 */
function getLocales() {
  if (!existsSync(LOCALES_DIR)) return [];

  return readdirSync(LOCALES_DIR).filter(f => {
    if (f.startsWith('.')) return false;
    const dir = join(LOCALES_DIR, f);
    return statSync(dir).isDirectory();
  });
}

/**
 * Main execution
 */
function main() {
  console.log(`\n${colors.cyan}=== Translation Key Extraction ===${colors.reset}\n`);

  // 1. Scan source files for translation keys
  console.log(`${colors.blue}Scanning frontend templates...${colors.reset}`);

  const sourceFiles = [
    ...getFiles(join(FRONTEND_SRC, 'components'), ['.astro']),
    ...getFiles(join(FRONTEND_SRC, 'pages'), ['.astro']),
    ...getFiles(join(FRONTEND_SRC, 'layouts'), ['.astro']),
    ...getFiles(join(FRONTEND_SRC, 'scripts'), ['.ts']),
  ];

  const codeKeys = new Map(); // key -> { file, line }

  for (const file of sourceFiles) {
    const content = readFileSync(file, 'utf-8');
    const fileKeys = extractKeysFromCode(content, file);
    fileKeys.forEach((info, key) => {
      if (!codeKeys.has(key)) {
        codeKeys.set(key, info);
      }
    });
  }

  console.log(`Found ${colors.green}${codeKeys.size}${colors.reset} translation keys in code.\n`);

  // 2. Get keys from English .po files (reference)
  const poKeys = getLocaleKeys('en');
  console.log(`Found ${colors.green}${poKeys.size}${colors.reset} keys in English .po files.\n`);

  // 3. Find missing translations (in code but not in .po)
  const missingInPO = [];
  for (const [key, info] of codeKeys) {
    if (!poKeys.has(key)) {
      missingInPO.push({ key, ...info });
    }
  }

  // 4. Find unused translations (in .po but not in code)
  const unusedInCode = [];
  for (const key of poKeys) {
    if (!codeKeys.has(key)) {
      unusedInCode.push(key);
    }
  }

  // 5. Report results
  if (missingInPO.length > 0) {
    console.log(`${colors.red}Missing in .po files (${missingInPO.length}):${colors.reset}`);
    for (const item of missingInPO) {
      const relPath = relative(FRONTEND_SRC, item.file);
      console.log(`  ${colors.yellow}- ${item.key}${colors.reset} ${colors.dim}(${relPath}:${item.line})${colors.reset}`);
    }
    console.log();
  }

  if (unusedInCode.length > 0) {
    console.log(`${colors.yellow}Unused in code (${unusedInCode.length}):${colors.reset}`);
    for (const key of unusedInCode.sort()) {
      console.log(`  ${colors.dim}- ${key}${colors.reset}`);
    }
    console.log();
  }

  // 6. Coverage stats per locale
  const locales = getLocales();
  if (locales.length > 0) {
    console.log(`${colors.cyan}Coverage by locale:${colors.reset}`);
    for (const locale of locales.sort()) {
      const localeKeys = getLocaleKeys(locale);
      const coverage = codeKeys.size > 0
        ? Math.round((localeKeys.size / codeKeys.size) * 100)
        : 0;
      const color = coverage >= 100 ? colors.green : coverage >= 80 ? colors.yellow : colors.red;
      console.log(`  ${locale}: ${color}${coverage}%${colors.reset} (${localeKeys.size}/${codeKeys.size})`);
    }
    console.log();
  }

  // 7. Summary
  if (missingInPO.length === 0 && unusedInCode.length === 0) {
    console.log(`${colors.green}All translations are in sync!${colors.reset}\n`);
  } else {
    console.log(`${colors.yellow}Summary:${colors.reset}`);
    console.log(`  - Missing: ${missingInPO.length}`);
    console.log(`  - Unused: ${unusedInCode.length}`);
    console.log();
  }

  // Exit with error code if there are missing translations
  if (missingInPO.length > 0) {
    process.exit(1);
  }
}

main();
