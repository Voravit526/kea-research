/**
 * Lightweight JSON syntax highlighter
 * No external dependencies - uses simple regex-based highlighting
 */

/**
 * Escape HTML entities to prevent XSS when displaying JSON
 */
function escapeForHighlight(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Highlight JSON string with syntax coloring
 * Returns HTML string with span elements for each token type
 */
export function highlightJson(jsonString: string): string {
  // First try to parse and format the JSON for consistent display
  let formatted: string;
  try {
    const parsed = JSON.parse(jsonString);
    formatted = JSON.stringify(parsed, null, 2);
  } catch {
    // If not valid JSON, use as-is (might be partial or malformed)
    formatted = jsonString;
  }

  // Escape HTML first
  const escaped = escapeForHighlight(formatted);

  // Apply syntax highlighting with regex
  // Order matters - apply more specific patterns first

  let highlighted = escaped
    // Keys (property names)
    .replace(/&quot;([^&]+)&quot;(?=\s*:)/g, '<span class="json-key">&quot;$1&quot;</span>')
    // String values (after colon)
    .replace(/:\s*&quot;([^&]*)&quot;/g, ': <span class="json-string">&quot;$1&quot;</span>')
    // Numbers
    .replace(/:\s*(-?\d+\.?\d*(?:e[+-]?\d+)?)/gi, ': <span class="json-number">$1</span>')
    // Booleans
    .replace(/:\s*(true|false)/g, ': <span class="json-boolean">$1</span>')
    // Null
    .replace(/:\s*(null)/g, ': <span class="json-null">$1</span>')
    // Array string values (not after colon)
    .replace(/(?<=[[\s,])&quot;([^&]*)&quot;(?=[\s,\]])/g, '<span class="json-string">&quot;$1&quot;</span>');

  return highlighted;
}

/**
 * Strip markdown code fences from JSON response
 * Backend sometimes wraps JSON in ```json ... ``` markers
 */
export function stripCodeFences(content: string): string {
  // Remove leading ```json or ``` and trailing ```
  let cleaned = content.trim();

  // Remove leading code fence with optional language
  if (cleaned.startsWith('```')) {
    const firstNewline = cleaned.indexOf('\n');
    if (firstNewline !== -1) {
      cleaned = cleaned.substring(firstNewline + 1);
    }
  }

  // Remove trailing code fence
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3).trimEnd();
  }

  return cleaned;
}

/**
 * Parse JSON safely, stripping code fences first
 */
export function parseJsonSafe<T>(content: string): T | null {
  const cleaned = stripCodeFences(content);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

/**
 * Format JSON for display (pretty print with 2-space indent)
 */
export function formatJson(content: string): string {
  const cleaned = stripCodeFences(content);
  try {
    const parsed = JSON.parse(cleaned);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return cleaned;
  }
}
