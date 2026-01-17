#!/usr/bin/env node
/**
 * PO Files Generator - Generates messages.po for all locales from English source
 *
 * - English: msgstr = msgid (source language)
 * - Other locales: empty msgstr (to be translated) OR preserves existing translations
 *
 * Preserves:
 * - Existing translations (msgstr) from current files
 * - Fuzzy flags (#, fuzzy)
 * - Comments (#. description)
 * - Poedit-compatible format
 *
 * Usage: node scripts/merge-po-files.mjs
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, '../frontend/src/i18n/locales');
const SETTINGS_MODAL_PATH = join(__dirname, '../frontend/src/components/SettingsModal.astro');

/**
 * Parse supported locales from SettingsModal.astro language dropdown
 * Single source of truth - no need to maintain separate list
 */
function getSupportedLocales() {
  const content = readFileSync(SETTINGS_MODAL_PATH, 'utf-8');

  // Find the languageOptions container and extract all option values
  const optionsMatch = content.match(/<div[^>]*id="languageOptions"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/);
  if (!optionsMatch) {
    console.error('Could not find languageOptions in SettingsModal.astro');
    process.exit(1);
  }

  const optionsHtml = optionsMatch[1];
  const locales = [];
  const optionRegex = /data-value="([^"]+)"/g;
  let match;

  while ((match = optionRegex.exec(optionsHtml)) !== null) {
    locales.push(match[1]);
  }

  if (locales.length === 0) {
    console.error('No locales found in languageOptions');
    process.exit(1);
  }

  return locales;
}

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

/**
 * Parse a .po file and extract all entries with full metadata
 */
function parsePOFile(content) {
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
      // Translator comment
      if (line.startsWith('#. ')) {
        comment = line.substring(3);
      }
      // Fuzzy flag
      else if (line.startsWith('#, fuzzy')) {
        fuzzy = true;
      }
      // Skip other comments
      else if (line.startsWith('#')) {
        continue;
      }
      // msgctxt
      else if (line.startsWith('msgctxt ')) {
        msgctxt = extractQuoted(line.substring(8));
        currentField = 'msgctxt';
      }
      // msgid
      else if (line.startsWith('msgid ')) {
        msgid = extractQuoted(line.substring(6));
        currentField = 'msgid';
        // Header block has empty msgid
        if (msgid === '' && msgctxt === '') {
          isHeader = true;
        }
      }
      // msgstr
      else if (line.startsWith('msgstr ')) {
        msgstr = extractQuoted(line.substring(7));
        currentField = 'msgstr';
      }
      // Continuation line
      else if (line.startsWith('"')) {
        const continuation = extractQuoted(line);
        if (currentField === 'msgctxt') msgctxt += continuation;
        else if (currentField === 'msgid') msgid += continuation;
        else if (currentField === 'msgstr') msgstr += continuation;
      }
    }

    // Skip header block and empty entries
    if (isHeader || !msgctxt) continue;

    entries.push({
      comment,
      fuzzy,
      msgctxt,
      msgid,
      msgstr,
    });
  }

  return entries;
}

/**
 * Extract string content from quoted PO field
 */
function extractQuoted(str) {
  const match = str.match(/^"(.*)"$/);
  return match ? match[1] : '';
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
function formatEntry(entry) {
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
 * Generate PO file header
 */
function generateHeader(locale) {
  return `# KEA Frontend Translations
# Language: ${locale}
#
msgid ""
msgstr ""
"Project-Id-Version: KEA Frontend\\n"
"POT-Creation-Date: \\n"
"PO-Revision-Date: \\n"
"Last-Translator: \\n"
"Language-Team: \\n"
"Language: ${locale}\\n"
"MIME-Version: 1.0\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Content-Transfer-Encoding: 8bit\\n"
"X-Generator: KEA po-merge\\n"
`;
}

/**
 * Get existing translations from a locale's .po files
 */
function getExistingTranslations(locale) {
  const localeDir = join(LOCALES_DIR, locale);
  const translations = new Map(); // msgctxt -> { msgstr, fuzzy }

  if (!existsSync(localeDir)) return translations;

  const poFiles = readdirSync(localeDir).filter(f => f.endsWith('.po'));

  for (const file of poFiles) {
    const content = readFileSync(join(localeDir, file), 'utf-8');
    const entries = parsePOFile(content);

    for (const entry of entries) {
      // Only store if there's an actual translation
      if (entry.msgstr && entry.msgstr !== entry.msgid) {
        translations.set(entry.msgctxt, {
          msgstr: entry.msgstr,
          fuzzy: entry.fuzzy,
        });
      }
    }
  }

  return translations;
}

/**
 * Get all source entries from English .po files
 */
function getEnglishSourceEntries() {
  const enDir = join(LOCALES_DIR, 'en');
  const entries = new Map(); // msgctxt -> entry

  if (!existsSync(enDir)) {
    console.log(`${colors.yellow}English locale not found!${colors.reset}`);
    return entries;
  }

  const poFiles = readdirSync(enDir).filter(f => f.endsWith('.po'));

  for (const file of poFiles) {
    const content = readFileSync(join(enDir, file), 'utf-8');
    const fileEntries = parsePOFile(content);

    for (const entry of fileEntries) {
      entries.set(entry.msgctxt, entry);
    }
  }

  return entries;
}

/**
 * Generate messages.po for a locale
 */
function generateLocaleFile(locale, sourceEntries, existingTranslations) {
  const isEnglish = locale === 'en';

  // Build entries for this locale
  const localeEntries = [];

  for (const [msgctxt, sourceEntry] of sourceEntries) {
    const existing = existingTranslations.get(msgctxt);

    let msgstr;
    let fuzzy = false;

    if (isEnglish) {
      // English: msgstr = msgid
      msgstr = sourceEntry.msgid;
    } else if (existing) {
      // Has existing translation - preserve it
      msgstr = existing.msgstr;
      fuzzy = existing.fuzzy;
    } else {
      // No translation - empty string
      msgstr = '';
    }

    localeEntries.push({
      comment: sourceEntry.comment,
      fuzzy,
      msgctxt: sourceEntry.msgctxt,
      msgid: sourceEntry.msgid,
      msgstr,
    });
  }

  // Sort alphabetically by msgctxt
  localeEntries.sort((a, b) => a.msgctxt.localeCompare(b.msgctxt));

  // Generate file content
  const header = generateHeader(locale);
  const body = localeEntries.map(formatEntry).join('\n\n');

  return {
    content: header + '\n' + body + '\n',
    count: localeEntries.length,
    translated: localeEntries.filter(e => e.msgstr !== '').length,
  };
}

/**
 * Main execution
 */
function main() {
  console.log(`\n${colors.cyan}=== PO Files Generator ===${colors.reset}\n`);

  // 1. Parse supported locales from SettingsModal.astro
  console.log(`${colors.blue}Parsing locales from SettingsModal.astro...${colors.reset}`);
  const supportedLocales = getSupportedLocales();
  console.log(`Found ${supportedLocales.length} locales\n`);

  // 2. Get source entries from English
  console.log(`${colors.blue}Reading English source entries...${colors.reset}`);
  const sourceEntries = getEnglishSourceEntries();
  console.log(`Found ${sourceEntries.size} source entries\n`);

  if (sourceEntries.size === 0) {
    console.log(`${colors.yellow}No source entries found in English .po files${colors.reset}`);
    process.exit(1);
  }

  const results = [];

  // 3. Generate messages.po for each locale
  for (const locale of supportedLocales) {
    console.log(`${colors.blue}Processing: ${locale}${colors.reset}`);

    // Ensure locale directory exists
    const localeDir = join(LOCALES_DIR, locale);
    if (!existsSync(localeDir)) {
      mkdirSync(localeDir, { recursive: true });
    }

    // Get existing translations for this locale
    const existingTranslations = locale === 'en' ? new Map() : getExistingTranslations(locale);

    // Generate the file
    const result = generateLocaleFile(locale, sourceEntries, existingTranslations);

    // Write the file
    const outputPath = join(localeDir, 'messages.po');
    writeFileSync(outputPath, result.content, 'utf-8');

    const translatedPct = Math.round((result.translated / result.count) * 100);
    const color = translatedPct === 100 ? colors.green : translatedPct >= 50 ? colors.yellow : colors.dim;
    console.log(`  ${colors.green}Created messages.po${colors.reset} (${result.count} entries, ${color}${translatedPct}% translated${colors.reset})`);

    results.push({ locale, count: result.count, translated: result.translated });
  }

  console.log(`\n${colors.cyan}=== Summary ===${colors.reset}`);
  console.log(`Generated ${results.length} locale files`);
  console.log(`Source entries: ${sourceEntries.size}`);

  const totalTranslated = results.filter(r => r.locale !== 'en').reduce((sum, r) => sum + r.translated, 0);
  const totalPossible = results.filter(r => r.locale !== 'en').reduce((sum, r) => sum + r.count, 0);
  console.log(`Overall translation progress: ${Math.round((totalTranslated / totalPossible) * 100)}%`);

  console.log(`\n${colors.green}Done!${colors.reset}`);
  console.log(`${colors.dim}Note: Old .po files are preserved. Delete them manually after verification.${colors.reset}\n`);
}

main();
