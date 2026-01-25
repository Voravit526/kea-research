/**
 * Text Selection Tooltip for Research Layers
 * Shows "Create research layer" tooltip when user selects text in final answers
 */

declare function t(key: string): string;

export const TextSelectionTooltip = {
  tooltipEl: null as HTMLElement | null,
  currentMessageId: null as number | null,
  currentSelectedText: '',
  isInitialized: false,

  /**
   * Initialize tooltip element and attach to document
   */
  init(): void {
    if (this.isInitialized) return;

    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.id = 'textSelectionTooltip';
    tooltip.className = 'text-selection-tooltip d-none';
    tooltip.innerHTML = `
      <button class="btn btn-sm btn-kea">
        <i class="bi bi-stack me-1"></i>
        <span>${t('layers.createLayer') || 'Create research layer'}</span>
      </button>
    `;

    // Attach to body
    document.body.appendChild(tooltip);
    this.tooltipEl = tooltip;

    // Add click handler
    const button = tooltip.querySelector('button');
    if (button) {
      button.addEventListener('click', () => this.onCreateLayer());
    }

    // Hide tooltip when clicking outside
    document.addEventListener('click', (e) => {
      if (this.tooltipEl && !this.tooltipEl.contains(e.target as Node)) {
        this.hideTooltip();
      }
    });

    // Hide tooltip on scroll
    document.addEventListener('scroll', () => this.hideTooltip(), true);

    this.isInitialized = true;
  },

  /**
   * Attach mouseup listener to a final answer content element
   */
  attachToElement(finalAnswerContentEl: HTMLElement, messageId: number): void {
    if (!finalAnswerContentEl) return;

    finalAnswerContentEl.addEventListener('mouseup', (e: MouseEvent) => {
      // Small delay to ensure selection is complete
      setTimeout(() => {
        this.handleTextSelection(e, messageId);
      }, 10);
    });
  },

  /**
   * Handle text selection and show tooltip if selection is valid
   */
  handleTextSelection(e: MouseEvent, messageId: number): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      this.hideTooltip();
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      this.hideTooltip();
      return;
    }

    // Check if LayerManager exists and we're not already in a layer
    if (window.LayerManager && window.LayerManager.isInLayer()) {
      // Prevent creating layers within layers
      this.hideTooltip();
      return;
    }

    // Get selection bounding rect
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Show tooltip near the end of selection
    this.showTooltip(rect.left + rect.width / 2, rect.top, selectedText, messageId);
  },

  /**
   * Show tooltip at specified position
   */
  showTooltip(x: number, y: number, selectedText: string, messageId: number): void {
    if (!this.tooltipEl) return;

    this.currentSelectedText = selectedText;
    this.currentMessageId = messageId;

    // Position tooltip 10px above selection
    const tooltipWidth = 200; // Approximate width
    const tooltipHeight = 40;  // Approximate height

    // Center horizontally on selection
    let left = x - tooltipWidth / 2;
    // Position above selection
    let top = y - tooltipHeight - 10;

    // Adjust if near viewport edges
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Keep within horizontal bounds
    if (left < 10) left = 10;
    if (left + tooltipWidth > viewportWidth - 10) {
      left = viewportWidth - tooltipWidth - 10;
    }

    // If too close to top, show below selection instead
    if (top < 10) {
      top = y + 30;
    }

    // Apply position
    this.tooltipEl.style.left = `${left}px`;
    this.tooltipEl.style.top = `${top + window.scrollY}px`;

    // Show tooltip
    this.tooltipEl.classList.remove('d-none');
  },

  /**
   * Hide tooltip
   */
  hideTooltip(): void {
    if (this.tooltipEl) {
      this.tooltipEl.classList.add('d-none');
    }
    this.currentSelectedText = '';
    this.currentMessageId = null;
  },

  /**
   * Handle create layer click
   */
  async onCreateLayer(): Promise<void> {
    if (!this.currentMessageId || !this.currentSelectedText) {
      console.warn('No message ID or selected text for layer creation');
      return;
    }

    // Store values BEFORE clearing (hideTooltip clears these)
    const messageId = this.currentMessageId;
    const selectedText = this.currentSelectedText;

    // Clear selection
    window.getSelection()?.removeAllRanges();

    // Hide tooltip
    this.hideTooltip();

    // Always create a new layer with the selected text as title (truncated for breadcrumb)
    const title = selectedText.substring(0, 200);
    const chatId = await window.StorageUtils.createChat(title, undefined, messageId, selectedText);

    // Load the new layer chat
    if (window.ChatManager) {
      await window.ChatManager.loadChat(chatId);
    }
  },
};

// Global type declarations
declare global {
  interface Window {
    TextSelectionTooltip: typeof TextSelectionTooltip;
  }
}

window.TextSelectionTooltip = TextSelectionTooltip;
