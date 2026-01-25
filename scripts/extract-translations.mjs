#!/usr/bin/env node
/**
 * Translation Key Extraction & Validation Script
 *
 * Scans frontend templates for translation keys and compares against .po files.
 * Reports missing and unused translations.
 *
 * Usage: node scripts/extract-translations.mjs
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'fs';
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
 * Extract translation keys and fallback values from source code
 */
function extractKeysFromCode(content, filePath) {
  const keys = new Map(); // key -> { file, line, fallback }

  // Pattern for t('key') || 'fallback text'
  const fallbackPattern = /t\(\s*['"]([a-zA-Z0-9]+\.[a-zA-Z0-9._]+)['"]\s*[^)]*\)\s*\|\|\s*['"]([^'"]+)['"]/g;

  // Pattern for t('key') without fallback
  const noFallbackPattern = /(?:^|[{\s(,])t\(\s*['"]([a-zA-Z0-9]+\.[a-zA-Z0-9._]+)['"]/g;

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // First, extract keys with fallbacks
    fallbackPattern.lastIndex = 0;
    let match;
    while ((match = fallbackPattern.exec(line)) !== null) {
      const key = match[1];
      const fallback = match[2];
      if (!keys.has(key)) {
        keys.set(key, { file: filePath, line: i + 1, fallback });
      }
    }

    // Then, extract keys without fallbacks (if not already found)
    noFallbackPattern.lastIndex = 0;
    while ((match = noFallbackPattern.exec(line)) !== null) {
      const key = match[1];
      if (!keys.has(key)) {
        keys.set(key, { file: filePath, line: i + 1, fallback: null });
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
 * Parse PO file and extract all entries with metadata
 */
function parsePOFileEntries(content) {
  const entries = [];
  const blocks = content.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split('\n');
    let comment = '';
    let fuzzy = false;
    let msgctxt = '';
    let msgid = '';
    let msgstr = '';
    let currentField = null;
    let isHeader = false;

    for (const line of lines) {
      if (line.startsWith('#. ')) {
        comment = line.substring(3);
      }
      else if (line.startsWith('#,') && line.includes('fuzzy')) {
        fuzzy = true;
      }
      else if (line.startsWith('#')) {
        continue;
      }
      else if (line.startsWith('msgctxt ')) {
        msgctxt = extractQuotedString(line.substring(8));
        currentField = 'msgctxt';
      }
      else if (line.startsWith('msgid ')) {
        msgid = extractQuotedString(line.substring(6));
        currentField = 'msgid';
        if (msgid === '' && msgctxt === '') {
          isHeader = true;
        }
      }
      else if (line.startsWith('msgstr ')) {
        msgstr = extractQuotedString(line.substring(7));
        currentField = 'msgstr';
      }
      else if (line.startsWith('"')) {
        const continuation = extractQuotedString(line);
        if (currentField === 'msgctxt') msgctxt += continuation;
        else if (currentField === 'msgid') msgid += continuation;
        else if (currentField === 'msgstr') msgstr += continuation;
      }
    }

    if (isHeader) continue;

    if (msgctxt) {
      entries.push({ comment, fuzzy, msgctxt, msgid, msgstr });
    }
  }

  return entries;
}

/**
 * Escape string for PO format
 */
function escapeForPO(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
}

/**
 * Format a single PO entry
 */
function formatPOEntry(entry) {
  const lines = [];
  if (entry.comment) {
    lines.push(`#. ${entry.comment}`);
  }
  if (entry.fuzzy) {
    lines.push('#, fuzzy');
  }
  lines.push(`msgctxt "${escapeForPO(entry.msgctxt)}"`);
  lines.push(`msgid "${escapeForPO(entry.msgid)}"`);
  lines.push(`msgstr "${escapeForPO(entry.msgstr)}"`);
  return lines.join('\n');
}

/**
 * Add missing translations with fallback values to English .po file
 */
function addMissingTranslations(missingWithFallback) {
  if (missingWithFallback.length === 0) return 0;

  const enFile = join(LOCALES_DIR, 'en', 'messages.po');
  if (!existsSync(enFile)) {
    console.log(`${colors.red}English messages.po not found!${colors.reset}`);
    return 0;
  }

  const content = readFileSync(enFile, 'utf-8');
  const headerMatch = content.match(/([\s\S]*?)(#\. |msgctxt )/);
  const header = headerMatch ? headerMatch[1].trimEnd() : '';

  const existingEntries = parsePOFileEntries(content);

  // Create new entries from fallback values
  const newEntries = missingWithFallback.map(item => ({
    comment: item.key,
    fuzzy: false,
    msgctxt: item.key,
    msgid: item.fallback,
    msgstr: item.fallback,
  }));

  // Combine and sort all entries alphabetically
  const allEntries = [...existingEntries, ...newEntries];
  allEntries.sort((a, b) => a.msgctxt.localeCompare(b.msgctxt));

  // Generate new file content
  const body = allEntries.map(formatPOEntry).join('\n\n');
  const newContent = header + '\n\n' + body + '\n';

  writeFileSync(enFile, newContent, 'utf-8');
  return newEntries.length;
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
  const missingWithFallback = [];
  const missingWithoutFallback = [];

  for (const [key, info] of codeKeys) {
    if (!poKeys.has(key)) {
      if (info.fallback) {
        missingWithFallback.push({ key, ...info });
      } else {
        missingWithoutFallback.push({ key, ...info });
      }
    }
  }

  // 4. Find unused translations (in .po but not in code)
  const unusedInCode = [];
  for (const key of poKeys) {
    if (!codeKeys.has(key)) {
      unusedInCode.push(key);
    }
  }

  // 5. Auto-add translations with fallback values
  if (missingWithFallback.length > 0) {
    console.log(`${colors.blue}Auto-adding translations with fallback values (${missingWithFallback.length}):${colors.reset}`);
    for (const item of missingWithFallback) {
      const relPath = relative(FRONTEND_SRC, item.file);
      console.log(`  ${colors.green}+ ${item.key}${colors.reset} = "${item.fallback}" ${colors.dim}(${relPath}:${item.line})${colors.reset}`);
    }

    const added = addMissingTranslations(missingWithFallback);
    console.log(`${colors.green}✓ Added ${added} entries to English messages.po${colors.reset}\n`);
  }

  // 6. Report missing translations without fallbacks
  if (missingWithoutFallback.length > 0) {
    console.log(`${colors.red}Missing translations (no fallback) (${missingWithoutFallback.length}):${colors.reset}`);
    for (const item of missingWithoutFallback) {
      const relPath = relative(FRONTEND_SRC, item.file);
      console.log(`  ${colors.yellow}- ${item.key}${colors.reset} ${colors.dim}(${relPath}:${item.line})${colors.reset}`);
    }
    console.log(`${colors.yellow}→ Add fallback values: t('key') || 'Fallback text'${colors.reset}\n`);
  }

  // 7. Report unused translations
  if (unusedInCode.length > 0) {
    console.log(`${colors.yellow}Unused in code (${unusedInCode.length}):${colors.reset}`);
    for (const key of unusedInCode.sort()) {
      console.log(`  ${colors.dim}- ${key}${colors.reset}`);
    }
    console.log();
  }

  // 8. Coverage stats per locale
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

  // 9. Summary
  const totalMissing = missingWithFallback.length + missingWithoutFallback.length;

  if (totalMissing === 0 && unusedInCode.length === 0) {
    console.log(`${colors.green}✓ All translations are in sync!${colors.reset}\n`);
  } else {
    console.log(`${colors.cyan}Summary:${colors.reset}`);
    if (missingWithFallback.length > 0) {
      console.log(`  ${colors.green}✓ Auto-added: ${missingWithFallback.length}${colors.reset}`);
      console.log(`    ${colors.dim}→ Run merge-po-files.mjs to propagate to other locales${colors.reset}`);
    }
    if (missingWithoutFallback.length > 0) {
      console.log(`  ${colors.red}✗ Needs fallback: ${missingWithoutFallback.length}${colors.reset}`);
    }
    if (unusedInCode.length > 0) {
      console.log(`  ${colors.yellow}! Unused: ${unusedInCode.length}${colors.reset}`);
    }
    console.log();
  }

  // Exit with error code if there are missing translations without fallbacks
  if (missingWithoutFallback.length > 0) {
    process.exit(1);
  }
}

main();
