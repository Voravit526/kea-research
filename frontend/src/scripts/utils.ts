/**
 * Shared Utility Functions
 */

// ============================================================================
// DOM Utilities
// ============================================================================

/**
 * Get element by ID with type casting (reduces boilerplate)
 */
export function getEl<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/**
 * Toggle element classes with optional auto-revert
 */
export function toggleClasses(
  el: HTMLElement,
  remove: string[],
  add: string[],
  revertMs?: number
): void {
  el.classList.remove(...remove);
  el.classList.add(...add);
  if (revertMs) {
    setTimeout(() => {
      el.classList.remove(...add);
      el.classList.add(...remove);
    }, revertMs);
  }
}

/**
 * Show temporary status feedback on an element
 * @param el - The status element to update
 * @param message - Message to display
 * @param hideAfterMs - Time in ms before hiding (0 = don't hide)
 */
export function showStatusFeedback(
  el: HTMLElement,
  message: string,
  hideAfterMs: number = 2000
): void {
  el.textContent = message;
  el.classList.remove('d-none');
  if (hideAfterMs > 0) {
    setTimeout(() => el.classList.add('d-none'), hideAfterMs);
  }
}

/**
 * Update button with icon feedback and optional auto-revert
 * @param button - The button element
 * @param icon - The icon element inside the button
 * @param iconFrom - Icon class to remove
 * @param iconTo - Icon class to add
 * @param buttonClassAdd - Classes to add to button
 * @param buttonClassRemove - Classes to remove from button
 * @param revertMs - Time in ms before reverting (0 = don't revert)
 */
export function updateButtonFeedback(
  button: HTMLElement,
  icon: HTMLElement,
  iconFrom: string,
  iconTo: string,
  buttonClassAdd: string[] = [],
  buttonClassRemove: string[] = [],
  revertMs: number = 2000
): void {
  icon.classList.remove(iconFrom);
  icon.classList.add(iconTo);
  button.classList.add(...buttonClassAdd);
  button.classList.remove(...buttonClassRemove);

  if (revertMs > 0) {
    setTimeout(() => {
      icon.classList.remove(iconTo);
      icon.classList.add(iconFrom);
      button.classList.remove(...buttonClassAdd);
      button.classList.add(...buttonClassRemove);
    }, revertMs);
  }
}

// ============================================================================
// DOM Type Guards
// ============================================================================

/**
 * Type guard for HTMLInputElement
 */
export function isInputElement(el: Element | null): el is HTMLInputElement {
  return el instanceof HTMLInputElement;
}

/**
 * Type guard for HTMLTextAreaElement
 */
export function isTextAreaElement(el: Element | null): el is HTMLTextAreaElement {
  return el instanceof HTMLTextAreaElement;
}

/**
 * Detect if running on macOS
 */
export function isMacOS(): boolean {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
}

// ============================================================================
// HTML Utilities
// ============================================================================

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format date for display in chat history
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

// ============================================================================
// File Utilities
// ============================================================================

/**
 * Download content as a file
 * @param content - String content or Blob to download
 * @param filename - Name of the file to download
 * @param mimeType - MIME type of the file
 */
export function downloadFile(content: string | Blob, filename: string, mimeType: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate a timestamp string for file names (YYYYMMDDTHHMMSS format)
 */
export function getFileTimestamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
}

// ============================================================================
// Text Processing Utilities
// ============================================================================

/**
 * Strip markdown formatting from text
 * Useful for TTS and plain text exports
 */
export function stripMarkdown(text: string): string {
  return text
    // Remove code blocks (including language specifier)
    .replace(/```[\w]*\n?[\s\S]*?```/g, '')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove bold
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // Remove italic (single asterisk)
    .replace(/\*([^*]+)\*/g, '$1')
    // Remove italic (underscore)
    .replace(/_([^_]+)_/g, '$1')
    // Remove headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    // Remove unordered list markers
    .replace(/^\s*[-*+]\s+/gm, '')
    // Remove ordered list markers
    .replace(/^\s*\d+\.\s+/gm, '')
    // Remove blockquotes
    .replace(/^\s*>\s+/gm, '')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // Collapse multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ============================================================================
// Element Visibility Utilities
// ============================================================================

/**
 * Show an element by removing d-none class
 */
export function showElement(el: HTMLElement | null): void {
  el?.classList.remove('d-none');
}

/**
 * Hide an element by adding d-none class
 */
export function hideElement(el: HTMLElement | null): void {
  el?.classList.add('d-none');
}

// ============================================================================
// Data Validation Utilities (for SSE and API responses)
// ============================================================================

/**
 * Safely get a string from an unknown value
 */
export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/**
 * Safely get a number from an unknown value
 */
export function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  return fallback;
}

/**
 * Safely get a boolean from an unknown value
 */
export function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Check if value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
