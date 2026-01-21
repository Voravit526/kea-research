/**
 * Provider Set Selector
 * Handles the navbar dropdown for selecting provider sets
 */

import { apiRequest } from './api';

// Local storage key for selected set
const STORAGE_KEY = 'kea_active_provider_set';

interface ProviderSetInfo {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  is_system: boolean;
  provider_count: number;
}

interface ProviderSetsResponse {
  provider_sets: ProviderSetInfo[];
}

// Current state
let providerSets: ProviderSetInfo[] = [];
let activeSetId: number | null = null;
let isLocked: boolean = false;

/**
 * Get the currently active provider set ID
 */
export function getActiveSetId(): number | null {
  return activeSetId;
}

/**
 * Get the currently active provider set name (display name)
 */
export function getActiveSetName(): string | null {
  const set = providerSets.find(s => s.id === activeSetId);
  return set?.display_name ?? null;
}

/**
 * Lock the selector (disable during active chat)
 */
export function lockSelector(): void {
  isLocked = true;
  const dropdownBtn = document.getElementById('providerSetDropdown') as HTMLButtonElement | null;
  if (dropdownBtn) {
    dropdownBtn.disabled = true;
    dropdownBtn.classList.add('disabled');
    dropdownBtn.title = 'Cannot change during active chat';
  }
}

/**
 * Unlock the selector (enable for new chat)
 */
export function unlockSelector(): void {
  isLocked = false;
  const dropdownBtn = document.getElementById('providerSetDropdown') as HTMLButtonElement | null;
  if (dropdownBtn) {
    dropdownBtn.disabled = false;
    dropdownBtn.classList.remove('disabled');
    dropdownBtn.title = '';
  }
}

/**
 * Load provider sets from the API
 */
async function loadProviderSets(): Promise<void> {
  try {
    const response = await apiRequest<ProviderSetsResponse>('/api/provider-sets');
    providerSets = response.provider_sets;

    // Restore saved selection or default to first set
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (savedId) {
      const savedSet = providerSets.find(s => s.id === parseInt(savedId, 10));
      if (savedSet) {
        activeSetId = savedSet.id;
      } else {
        // Saved set no longer exists, clear and use default
        localStorage.removeItem(STORAGE_KEY);
        activeSetId = providerSets[0]?.id ?? null;
      }
    } else {
      // No saved selection, use first set (usually Cloud AI)
      activeSetId = providerSets[0]?.id ?? null;
    }

    renderDropdown();
  } catch (error) {
    console.error('[ProviderSetSelector] Failed to load provider sets:', error);
    // Hide the selector on error
    const selector = document.getElementById('providerSetSelector');
    selector?.classList.add('d-none');
  }
}

/**
 * Render the dropdown menu
 */
function renderDropdown(): void {
  const menu = document.getElementById('providerSetMenu');
  const activeNameEl = document.getElementById('activeSetName');

  if (!menu) return;

  // Find active set
  const activeSet = providerSets.find(s => s.id === activeSetId);
  if (activeNameEl && activeSet) {
    activeNameEl.textContent = activeSet.display_name;
  }

  // Render menu items
  menu.innerHTML = providerSets
    .map(set => {
      const isActive = set.id === activeSetId;
      const systemBadge = set.is_system ? '<span class="badge text-bg-secondary ms-2">System</span>' : '';
      const countBadge = `<span class="badge text-bg-secondary ms-1">${set.provider_count}</span>`;

      return `
        <li>
          <button class="dropdown-item d-flex align-items-center justify-content-between ${isActive ? 'active' : ''}"
                  data-set-id="${set.id}"
                  type="button">
            <span>${set.display_name}${systemBadge}${countBadge}</span>
            ${isActive ? '<i class="bi bi-check2 ms-2 text-success"></i>' : ''}
          </button>
        </li>
      `;
    })
    .join('');

  // Add click handlers
  menu.querySelectorAll('button[data-set-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const setId = parseInt(target.dataset.setId!, 10);
      selectSet(setId);
    });
  });
}

/**
 * Select a provider set
 */
function selectSet(setId: number): void {
  if (isLocked) return; // Don't allow changes during active chat

  const set = providerSets.find(s => s.id === setId);
  if (!set) return;

  activeSetId = setId;
  localStorage.setItem(STORAGE_KEY, setId.toString());

  // Update UI
  renderDropdown();

  // Dispatch event for other components to react
  const event = new CustomEvent('provider-set-changed', {
    detail: { setId, set },
  });
  document.dispatchEvent(event);
}

/**
 * Initialize the provider set selector
 */
export function initProviderSetSelector(): void {
  // Only initialize if the selector element exists
  const selector = document.getElementById('providerSetSelector');
  if (!selector) return;

  // Load provider sets
  loadProviderSets();
}

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProviderSetSelector);
  } else {
    initProviderSetSelector();
  }
}
