/**
 * Response Renderer for KEA Pipeline Steps 1-4
 *
 * Provides dual-view display:
 * - Formatted View: Beautiful card-based display with parsed JSON fields
 * - Code View: Syntax-highlighted JSON with proper styling
 */

import { highlightJson, stripCodeFences, parseJsonSafe, formatJson } from './json-highlighter';
import { escapeHtml } from './utils';
import { getProviderIconHtml, getProviderCache } from './constants';
import { PROVIDER_CONFIG } from './pipeline-types';

// Type definitions for step responses
interface AtomicFact {
  fact?: string;
  statement?: string;
  verification?: string;
  confidence?: number;
}

interface Step1Data {
  answer?: string;
  confidence?: number;
  atomic_facts?: (string | AtomicFact)[];
}

interface Improvement {
  improvement?: string;
  description?: string;
}

interface Step2Data {
  improved_answer?: string;
  confidence?: number;
  improvements?: (string | Improvement)[];
}

interface RankingItem {
  provider?: string;
  label?: string;
  score?: number;
  reason?: string;
}

interface FactItem {
  fact?: string;
  text?: string;
  confidence?: number;
}

interface Step3Data {
  ranking?: RankingItem[];
  predicted_winner?: string;
  evaluations?: Record<string, unknown>;
  consensus_facts?: (string | FactItem)[];
  flagged_facts?: (string | FactItem)[];
}

interface Step4Data {
  final_answer?: string;
  confidence?: number;
  synthesizer?: string;
}

export type ViewMode = 'formatted' | 'code';

/**
 * Response Renderer - handles parsing and rendering step responses
 */
export const ResponseRenderer = {
  /**
   * Render response container with both views
   */
  renderContainer(
    step: number,
    provider: string,
    rawContent: string,
    pipelineId: number,
    defaultView: ViewMode = 'formatted'
  ): string {
    const containerId = `response-${step}-${provider}-${pipelineId}`;
    const formattedId = `formatted-${step}-${provider}-${pipelineId}`;
    const codeId = `code-${step}-${provider}-${pipelineId}`;

    // Generate both views
    const formattedHtml = this.renderFormattedView(step, rawContent);
    const codeHtml = this.renderCodeView(rawContent);

    const isFormatted = defaultView === 'formatted';

    return `
      <div class="response-container" id="${containerId}" data-raw-content="${escapeHtml(rawContent)}">
        <!-- View Toggle Buttons -->
        <div class="d-flex justify-content-end mb-2 gap-1">
          <div class="btn-group btn-group-sm" role="group" aria-label="View toggle">
            <button type="button" class="btn btn-outline-secondary view-toggle-btn ${isFormatted ? 'active' : ''}"
                    data-view="formatted" data-container="${containerId}" title="Formatted view">
              <i class="bi bi-card-text"></i>
            </button>
            <button type="button" class="btn btn-outline-secondary view-toggle-btn ${!isFormatted ? 'active' : ''}"
                    data-view="code" data-container="${containerId}" title="Source code view">
              <i class="bi bi-code-slash"></i>
            </button>
          </div>
          <button type="button" class="btn btn-outline-secondary btn-sm copy-response-btn"
                  data-container="${containerId}" title="Copy to clipboard">
            <i class="bi bi-clipboard"></i>
          </button>
        </div>

        <!-- Formatted View -->
        <div class="view-formatted ${!isFormatted ? 'd-none' : ''}" id="${formattedId}">
          ${formattedHtml}
        </div>

        <!-- Code View -->
        <div class="view-code ${isFormatted ? 'd-none' : ''}" id="${codeId}">
          ${codeHtml}
        </div>
      </div>
    `;
  },

  /**
   * Render formatted view based on step number
   */
  renderFormattedView(step: number, rawContent: string): string {
    const cleaned = stripCodeFences(rawContent);

    switch (step) {
      case 1:
        return this.renderStep1Formatted(cleaned);
      case 2:
        return this.renderStep2Formatted(cleaned);
      case 3:
        return this.renderStep3Formatted(cleaned);
      case 4:
        return this.renderStep4Formatted(cleaned);
      default:
        return this.renderFallbackFormatted(cleaned);
    }
  },

  /**
   * Render code view with syntax highlighting
   */
  renderCodeView(rawContent: string): string {
    const cleaned = stripCodeFences(rawContent);
    const formatted = formatJson(cleaned);
    const highlighted = highlightJson(formatted);

    return `
      <pre class="json-highlight mb-0"><code>${highlighted}</code></pre>
    `;
  },

  /**
   * Step 1: Initial Responses - Answer, Confidence, Atomic Facts
   */
  renderStep1Formatted(content: string): string {
    const data = parseJsonSafe<Step1Data>(content);

    if (!data) {
      return this.renderFallbackFormatted(content);
    }

    const answer = data.answer || 'No answer provided';
    const confidence = data.confidence ?? 0.5;
    const atomicFacts = data.atomic_facts || [];

    // Render markdown in answer if available
    let answerHtml = escapeHtml(answer);
    if (window.marked && typeof window.marked.parse === 'function') {
      try {
        answerHtml = window.marked.parse(answer);
      } catch {
        // Keep escaped version
      }
    }

    return `
      <div class="response-card">
        <!-- Answer Section -->
        <div class="response-card-section">
          <div class="response-card-header">
            <i class="bi bi-chat-square-text"></i>
            Answer
          </div>
          <div class="response-card-content markdown-content">${answerHtml}</div>
        </div>

        <!-- Confidence Section -->
        <div class="response-card-section">
          <div class="confidence-display">
            <i class="bi bi-bar-chart"></i>
            <span>Confidence:</span>
            <div class="confidence-bar">
              <div class="confidence-bar-fill" style="width: ${confidence * 100}%"></div>
            </div>
            <span class="confidence-value">${(confidence * 100).toFixed(0)}%</span>
          </div>
        </div>

        <!-- Atomic Facts Section -->
        ${atomicFacts.length > 0 ? `
        <div class="response-card-section">
          <div class="response-card-header">
            <i class="bi bi-list-check"></i>
            Atomic Facts
          </div>
          <ul class="facts-list">
            ${atomicFacts.map((fact) => {
              // Handle both string facts and object facts {fact: "...", statement: "...", verification: "..."}
              const factText = typeof fact === 'string' ? fact : (fact.fact || fact.statement || JSON.stringify(fact));
              return `<li>${escapeHtml(factText)}</li>`;
            }).join('')}
          </ul>
        </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * Step 2: MoA Refinement - Improved Answer, Confidence, Improvements
   */
  renderStep2Formatted(content: string): string {
    const data = parseJsonSafe<Step2Data>(content);

    if (!data) {
      return this.renderFallbackFormatted(content);
    }

    const answer = data.improved_answer || 'No improved answer provided';
    const confidence = data.confidence ?? 0.5;
    const improvements = data.improvements || [];

    // Render markdown in answer if available
    let answerHtml = escapeHtml(answer);
    if (window.marked && typeof window.marked.parse === 'function') {
      try {
        answerHtml = window.marked.parse(answer);
      } catch {
        // Keep escaped version
      }
    }

    return `
      <div class="response-card">
        <!-- Improved Answer Section -->
        <div class="response-card-section">
          <div class="response-card-header">
            <i class="bi bi-arrow-up-circle"></i>
            Improved Answer
          </div>
          <div class="response-card-content markdown-content">${answerHtml}</div>
        </div>

        <!-- Confidence Section -->
        <div class="response-card-section">
          <div class="confidence-display">
            <i class="bi bi-bar-chart"></i>
            <span>Confidence:</span>
            <div class="confidence-bar">
              <div class="confidence-bar-fill" style="width: ${confidence * 100}%"></div>
            </div>
            <span class="confidence-value">${(confidence * 100).toFixed(0)}%</span>
          </div>
        </div>

        <!-- Improvements Section -->
        ${improvements.length > 0 ? `
        <div class="response-card-section">
          <div class="response-card-header">
            <i class="bi bi-arrow-repeat"></i>
            Improvements Made
          </div>
          <ul class="improvements-list">
            ${improvements.map((imp) => {
              // Handle both string and object improvements
              const impText = typeof imp === 'string' ? imp : (imp.improvement || imp.description || JSON.stringify(imp));
              return `<li>${escapeHtml(impText)}</li>`;
            }).join('')}
          </ul>
        </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * Step 3: Peer Evaluation - Rankings with Medal Badges, Consensus/Flagged Facts
   */
  renderStep3Formatted(content: string): string {
    const data = parseJsonSafe<Step3Data>(content);

    if (!data) {
      return this.renderFallbackFormatted(content);
    }

    const ranking = data.ranking || [];
    const consensusFacts = data.consensus_facts || [];
    const flaggedFacts = data.flagged_facts || [];

    // Medal classes for top 3
    const medalClasses = ['gold', 'silver', 'bronze'];

    return `
      <div class="response-card">
        <!-- Rankings Section -->
        ${ranking.length > 0 ? `
        <div class="response-card-section">
          <div class="response-card-header">
            <i class="bi bi-trophy"></i>
            Rankings
          </div>
          <ul class="rankings-list">
            ${ranking.map((item: RankingItem | string, index: number) => {
              // Handle both string labels (backend) and RankingItem objects
              const isString = typeof item === 'string';
              const providerName = isString ? item : (item.provider || item.label || `Response ${index + 1}`);
              const score = isString ? null : (item.score ?? null);
              const reason = isString ? '' : (item.reason || '');
              const medalClass = index < 3 ? medalClasses[index] : '';

              // Try to get provider display info
              const cached = getProviderCache()[providerName];
              const config = PROVIDER_CONFIG[providerName];
              const displayName = cached?.display_name || config?.name || providerName;
              const iconHtml = getProviderIconHtml(providerName);

              return `
                <li>
                  <span class="rank-badge ${medalClass}">${index + 1}</span>
                  <span class="rank-provider">${iconHtml} ${escapeHtml(displayName)}</span>
                  ${score !== null ? `<span class="badge bg-info">${score.toFixed(1)}</span>` : ''}
                  ${reason ? `<small class="text-muted ms-2">${escapeHtml(reason)}</small>` : ''}
                </li>
              `;
            }).join('')}
          </ul>
        </div>
        ` : ''}

        <!-- Consensus Facts Section -->
        ${consensusFacts.length > 0 ? `
        <div class="response-card-section">
          <div class="response-card-header text-success">
            <i class="bi bi-check-circle"></i>
            Consensus Facts
            <small class="text-muted ms-2">(agreed by majority)</small>
          </div>
          <ul class="consensus-list">
            ${consensusFacts.map((fact) => {
              const factText = typeof fact === 'string' ? fact : (fact.fact || fact.text || JSON.stringify(fact));
              return `<li>${escapeHtml(factText)}</li>`;
            }).join('')}
          </ul>
        </div>
        ` : ''}

        <!-- Flagged Facts Section -->
        ${flaggedFacts.length > 0 ? `
        <div class="response-card-section">
          <div class="response-card-header text-warning">
            <i class="bi bi-exclamation-triangle"></i>
            Flagged Facts
            <small class="text-muted ms-2">(disputed)</small>
          </div>
          <ul class="flagged-list">
            ${flaggedFacts.map((fact) => {
              const factText = typeof fact === 'string' ? fact : (fact.fact || fact.text || JSON.stringify(fact));
              return `<li>${escapeHtml(factText)}</li>`;
            }).join('')}
          </ul>
        </div>
        ` : ''}

        <!-- Fallback if no structured data -->
        ${ranking.length === 0 && consensusFacts.length === 0 && flaggedFacts.length === 0 ? `
        <div class="response-card-section">
          <div class="response-card-header text-muted">
            <i class="bi bi-file-text"></i>
            Raw Evaluation
          </div>
          <pre class="mb-0 small" style="white-space: pre-wrap;">${escapeHtml(content)}</pre>
        </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * Step 4: KEA Synthesis - Final Answer with Confidence
   */
  renderStep4Formatted(content: string): string {
    const data = parseJsonSafe<Step4Data>(content);

    if (!data) {
      return this.renderFallbackFormatted(content);
    }

    const answer = data.final_answer || 'No final answer provided';
    const confidence = data.confidence ?? 0.5;

    // Render markdown in answer if available
    let answerHtml = escapeHtml(answer);
    if (window.marked && typeof window.marked.parse === 'function') {
      try {
        answerHtml = window.marked.parse(answer);
      } catch {
        // Keep escaped version
      }
    }

    return `
      <div class="response-card">
        <!-- Final Answer Section -->
        <div class="response-card-section">
          <div class="response-card-header">
            <i class="bi bi-stars"></i>
            Final Synthesis
          </div>
          <div class="response-card-content markdown-content">${answerHtml}</div>
        </div>

        <!-- Confidence Section -->
        <div class="response-card-section">
          <div class="confidence-display">
            <i class="bi bi-bar-chart"></i>
            <span>Confidence:</span>
            <div class="confidence-bar">
              <div class="confidence-bar-fill" style="width: ${confidence * 100}%"></div>
            </div>
            <span class="confidence-value">${(confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Fallback for unparseable content
   */
  renderFallbackFormatted(content: string): string {
    return `
      <div class="response-card">
        <div class="response-card-section">
          <pre class="mb-0 small" style="white-space: pre-wrap;">${escapeHtml(content)}</pre>
        </div>
      </div>
    `;
  },

  /**
   * Toggle between formatted and code view
   */
  toggleView(containerId: string, view: ViewMode): void {
    const container = document.getElementById(containerId);
    if (!container) return;

    const formattedView = container.querySelector('.view-formatted');
    const codeView = container.querySelector('.view-code');
    const buttons = container.querySelectorAll('.view-toggle-btn');

    if (!formattedView || !codeView) return;

    if (view === 'formatted') {
      formattedView.classList.remove('d-none');
      codeView.classList.add('d-none');
    } else {
      formattedView.classList.add('d-none');
      codeView.classList.remove('d-none');
    }

    // Update button states
    buttons.forEach((btn) => {
      const btnView = btn.getAttribute('data-view');
      if (btnView === view) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  },

  /**
   * Initialize event handlers for view toggle and copy buttons
   */
  initEventHandlers(): void {
    // Use event delegation on document
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Handle view toggle buttons
      const toggleBtn = target.closest('.view-toggle-btn') as HTMLElement;
      if (toggleBtn) {
        e.preventDefault();
        e.stopPropagation();
        const view = toggleBtn.getAttribute('data-view') as ViewMode;
        const containerId = toggleBtn.getAttribute('data-container');
        if (view && containerId) {
          this.toggleView(containerId, view);
          // Save preference to IndexedDB
          this.saveViewPreference(view);
        }
        return;
      }

      // Handle copy buttons
      const copyBtn = target.closest('.copy-response-btn') as HTMLElement;
      if (copyBtn) {
        e.preventDefault();
        e.stopPropagation();
        const containerId = copyBtn.getAttribute('data-container');
        if (containerId) {
          const container = document.getElementById(containerId);
          const rawContent = container?.getAttribute('data-raw-content') || '';
          if (window.MessageActions) {
            const cleaned = stripCodeFences(rawContent);
            window.MessageActions.copyToClipboard(formatJson(cleaned), copyBtn);
          }
        }
        return;
      }
    });
  },

  /**
   * Save view preference to IndexedDB
   */
  async saveViewPreference(view: ViewMode): Promise<void> {
    try {
      if (window.StorageUtils) {
        const settings = await window.StorageUtils.getSettings();
        settings.pipelineViewMode = view;
        await window.StorageUtils.saveSettings(settings);
      }
    } catch (err) {
      console.warn('Failed to save view preference:', err);
    }
  },

  /**
   * Get saved view preference from IndexedDB
   */
  async getViewPreference(): Promise<ViewMode> {
    try {
      if (window.StorageUtils) {
        const settings = await window.StorageUtils.getSettings();
        return (settings.pipelineViewMode as ViewMode) || 'formatted';
      }
    } catch {
      // Fallback to default
    }
    return 'formatted';
  },
};

// Initialize event handlers when module loads
if (typeof document !== 'undefined') {
  // Defer initialization to avoid issues during SSR
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ResponseRenderer.initEventHandlers());
  } else {
    ResponseRenderer.initEventHandlers();
  }
}

// Type declarations for global window objects
declare global {
  interface Window {
    marked?: {
      parse(text: string): string;
    };
    MessageActions?: {
      copyToClipboard(text: string, button: HTMLElement): void;
    };
    StorageUtils?: {
      getSettings(): Promise<{ pipelineViewMode?: ViewMode; [key: string]: unknown }>;
      saveSettings(settings: { pipelineViewMode?: ViewMode; [key: string]: unknown }): Promise<void>;
    };
  }
}

export default ResponseRenderer;
