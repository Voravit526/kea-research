/**
 * KEA Admin Panel - UI Rendering
 * Subscribes to state changes and renders UI elements
 */

import { AdminState } from '../state';
import type { Provider, ProviderSet, ProviderSetMember, User, AppSettings, SectionState, Model } from '../types';
import { getProviderIconHtml } from '../../constants';

// ============================================================================
// Provider Rendering
// ============================================================================

/**
 * Render a single provider card HTML
 */
function renderProviderCard(provider: Provider): string {
  // Use custom icon if set, otherwise fall back to default icon from PROVIDER_CONFIG
  const iconHtml = getProviderIconHtml(provider.name, provider.icon);
  const iconContent = `<div class="provider-icon bg-primary-subtle rounded-3">${iconHtml}</div>`;

  const modelsList = provider.models?.length
    ? provider.models
        .map((model: Model) => {
          const defaultBadge = model.is_default
            ? '<span class="badge bg-success ms-1">default</span>'
            : '';
          const inactiveClass = !model.is_active ? 'text-muted text-decoration-line-through' : '';
          return `
            <div class="d-flex align-items-center justify-content-between py-1 ${inactiveClass}">
              <span class="small">${model.display_name || model.model_id}${defaultBadge}</span>
              <div class="btn-group btn-group-sm">
                <button class="btn ${model.is_active ? 'btn-success' : 'btn-outline-secondary'} btn-icon" data-action="model:toggle" data-id="${model.id}" title="${model.is_active ? 'Disable' : 'Enable'}">
                  <i class="bi bi-${model.is_active ? 'toggle-on' : 'toggle-off'}"></i>
                </button>
                <button class="btn btn-outline-danger btn-icon" data-action="model:delete" data-id="${model.id}" title="Delete">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          `;
        })
        .join('')
    : '<p class="text-muted small mb-0">No models configured</p>';

  return `
    <div class="col-12 col-md-6 col-xl-4">
      <div class="card h-100 provider-card ${!provider.is_active ? 'opacity-50' : ''}">
        <div class="card-body">
          <div class="d-flex align-items-start gap-3 mb-3">
            ${iconContent}
            <div class="flex-grow-1">
              <h6 class="mb-0">${provider.display_name}</h6>
              <small class="text-muted">${provider.name} • ${provider.provider_type}</small>
            </div>
            <div class="d-flex gap-1">
              <button class="btn ${provider.is_active ? 'btn-success' : 'btn-outline-secondary'} btn-sm btn-icon" data-action="provider:toggle" data-id="${provider.id}" title="${provider.is_active ? 'Disable' : 'Enable'}">
                <i class="bi bi-${provider.is_active ? 'toggle-on' : 'toggle-off'}"></i>
              </button>
              <button class="btn btn-outline-secondary btn-sm btn-icon" data-action="provider:edit" data-id="${provider.id}" title="Edit">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-outline-danger btn-sm btn-icon" data-action="provider:delete" data-id="${provider.id}" title="Delete">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>

          <div class="mb-3">
            <small class="text-muted d-block mb-1">
              <i class="bi bi-key me-1"></i>API Key: ${provider.has_api_key ? 'Configured' : 'Not set'}
              <button class="btn btn-link btn-sm p-0 ms-1 text-muted" data-action="provider:edit-api-key" data-id="${provider.id}" title="Edit API Key" style="vertical-align: baseline; font-size: inherit;">
                <i class="bi bi-pencil-square"></i>
              </button>
              ${provider.base_url ? `<br><i class="bi bi-link-45deg me-1"></i>${provider.base_url}` : ''}
            </small>
          </div>

          <div class="border-top pt-2">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <small class="text-muted fw-semibold">Models</small>
              <button class="btn btn-sm btn-outline-primary" data-action="provider:discover" data-id="${provider.id}">
                <i class="bi bi-search me-1"></i>Models
              </button>
            </div>
            ${modelsList}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render providers grid based on state
 */
function renderProviders(state: SectionState<Provider>): void {
  const loadingEl = document.getElementById('providers-loading');
  const emptyEl = document.getElementById('providers-empty');
  const gridEl = document.getElementById('providers-grid');

  if (!loadingEl || !emptyEl || !gridEl) return;

  // Handle loading state
  if (state.loadingState === 'loading') {
    loadingEl.classList.remove('d-none');
    emptyEl.classList.add('d-none');
    gridEl.classList.add('d-none');
    return;
  }

  loadingEl.classList.add('d-none');

  // Handle empty state
  if (state.data.length === 0) {
    emptyEl.classList.remove('d-none');
    gridEl.classList.add('d-none');
    return;
  }

  // Render providers
  emptyEl.classList.add('d-none');
  gridEl.classList.remove('d-none');
  gridEl.innerHTML = state.data.map(renderProviderCard).join('');
}

// ============================================================================
// Provider Set Rendering
// ============================================================================

/**
 * Render a provider card within a set (shows enable/disable toggle for member)
 */
function renderSetMemberCard(member: ProviderSetMember, isSystemSet: boolean): string {
  const provider = member.provider;
  const iconHtml = getProviderIconHtml(provider.name, provider.icon);
  const iconContent = `<div class="provider-icon bg-primary-subtle rounded-3">${iconHtml}</div>`;

  // For system sets, only show toggle button for models (no delete)
  const modelsList = provider.models?.length
    ? provider.models
        .map((model: Model) => {
          const defaultBadge = model.is_default
            ? '<span class="badge bg-success ms-1">default</span>'
            : '';
          const inactiveClass = !model.is_active ? 'text-muted text-decoration-line-through' : '';
          const deleteButton = isSystemSet
            ? ''
            : `<button class="btn btn-outline-danger btn-icon" data-action="model:delete" data-id="${model.id}" title="Delete">
                  <i class="bi bi-trash"></i>
                </button>`;
          return `
            <div class="d-flex align-items-center justify-content-between py-1 ${inactiveClass}">
              <span class="small">${model.display_name || model.model_id}${defaultBadge}</span>
              <div class="btn-group btn-group-sm">
                <button class="btn ${model.is_active ? 'btn-success' : 'btn-outline-secondary'} btn-icon" data-action="model:toggle" data-id="${model.id}" title="${model.is_active ? 'Disable' : 'Enable'}">
                  <i class="bi bi-${model.is_active ? 'toggle-on' : 'toggle-off'}"></i>
                </button>
                ${deleteButton}
              </div>
            </div>
          `;
        })
        .join('')
    : '<p class="text-muted small mb-0">No models configured</p>';

  // For system sets, show enable/disable toggle for the member
  // For custom sets, also show remove button
  const memberActions = isSystemSet
    ? `
        <button class="btn ${member.is_enabled ? 'btn-success' : 'btn-outline-secondary'} btn-sm btn-icon"
                data-action="provider-set:member-toggle" data-set-id="${member.set_id}" data-member-id="${member.id}"
                title="${member.is_enabled ? 'Disable in set' : 'Enable in set'}">
          <i class="bi bi-${member.is_enabled ? 'toggle-on' : 'toggle-off'}"></i>
        </button>
      `
    : `
        <button class="btn ${member.is_enabled ? 'btn-success' : 'btn-outline-secondary'} btn-sm btn-icon"
                data-action="provider-set:member-toggle" data-set-id="${member.set_id}" data-member-id="${member.id}"
                title="${member.is_enabled ? 'Disable in set' : 'Enable in set'}">
          <i class="bi bi-${member.is_enabled ? 'toggle-on' : 'toggle-off'}"></i>
        </button>
        <button class="btn btn-outline-danger btn-sm btn-icon"
                data-action="provider-set:remove-member" data-set-id="${member.set_id}" data-member-id="${member.id}"
                title="Remove from set">
          <i class="bi bi-x-lg"></i>
        </button>
      `;

  const opacity = !member.is_enabled ? 'opacity-50' : '';

  return `
    <div class="col-12 col-md-6 col-xl-4">
      <div class="card h-100 provider-card ${opacity}">
        <div class="card-body">
          <div class="d-flex align-items-start gap-3 mb-3">
            ${iconContent}
            <div class="flex-grow-1">
              <h6 class="mb-0">${provider.display_name}</h6>
              <small class="text-muted">${provider.name} • ${provider.provider_type}</small>
            </div>
            <div class="d-flex gap-1">
              ${memberActions}
            </div>
          </div>

          <div class="mb-3">
            <small class="text-muted d-block mb-1">
              <i class="bi bi-key me-1"></i>API Key: ${provider.has_api_key ? 'Configured' : 'Not set'}
              <button class="btn btn-link btn-sm p-0 ms-1 text-muted" data-action="provider:edit-api-key" data-id="${provider.id}" title="Edit API Key" style="vertical-align: baseline; font-size: inherit;">
                <i class="bi bi-pencil-square"></i>
              </button>
              ${provider.base_url ? `<br><i class="bi bi-link-45deg me-1"></i>${provider.base_url}` : ''}
            </small>
          </div>

          <div class="border-top pt-2">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <small class="text-muted fw-semibold">Models</small>
              ${isSystemSet ? '' : `
              <button class="btn btn-sm btn-outline-primary" data-action="provider:discover" data-id="${provider.id}">
                <i class="bi bi-search me-1"></i>Models
              </button>
              `}
            </div>
            ${modelsList}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render tab navigation for provider sets
 */
function renderProviderSetTabs(sets: ProviderSet[], activeTab: string | null): string {
  return sets
    .map((set, index) => {
      const isActive = activeTab === set.name || (!activeTab && index === 0);
      const systemBadge = set.is_system ? '<span class="badge bg-secondary ms-1">System</span>' : '';
      const countBadge = `<span class="badge bg-primary ms-1">${set.members.filter(m => m.is_enabled).length}</span>`;

      return `
        <li class="nav-item" role="presentation">
          <button class="nav-link ${isActive ? 'active' : ''}"
                  data-bs-toggle="tab" data-bs-target="#set-${set.name}"
                  type="button" role="tab"
                  data-action="provider-set:select-tab" data-name="${set.name}">
            ${set.display_name}${systemBadge}${countBadge}
          </button>
        </li>
      `;
    })
    .join('');
}

/**
 * Render tab content for a provider set
 */
function renderProviderSetContent(set: ProviderSet, isActive: boolean): string {
  const setActions = set.is_system
    ? '' // No edit/delete for system sets
    : `
        <div class="d-flex gap-2 mb-3">
          <button class="btn btn-outline-secondary btn-sm" data-action="provider-set:edit" data-id="${set.id}">
            <i class="bi bi-pencil me-1"></i>Edit Set
          </button>
          <button class="btn btn-outline-danger btn-sm" data-action="provider-set:delete" data-id="${set.id}">
            <i class="bi bi-trash me-1"></i>Delete Set
          </button>
          <button class="btn btn-outline-primary btn-sm" data-bs-toggle="modal" data-bs-target="#addProviderModal" data-add-to-set="${set.id}">
            <i class="bi bi-plus-lg me-1"></i>Add Provider
          </button>
          <button class="btn btn-outline-secondary btn-sm" data-action="provider-set:add-member" data-id="${set.id}">
            <i class="bi bi-link-45deg me-1"></i>Link Existing
          </button>
        </div>
      `;

  const description = set.description
    ? `<p class="text-muted small mb-3">${set.description}</p>`
    : '';

  const membersHtml = set.members.length
    ? `<div class="row g-4">${set.members.map(m => renderSetMemberCard(m, set.is_system)).join('')}</div>`
    : '<p class="text-muted text-center py-4">No providers in this set</p>';

  return `
    <div class="tab-pane fade ${isActive ? 'show active' : ''}" id="set-${set.name}" role="tabpanel">
      ${description}
      ${setActions}
      ${membersHtml}
    </div>
  `;
}

/**
 * Render provider sets UI based on state
 */
function renderProviderSets(state: SectionState<ProviderSet>): void {
  const loadingEl = document.getElementById('provider-sets-loading');
  const emptyEl = document.getElementById('provider-sets-empty');
  const tabsEl = document.getElementById('providerSetTabs');
  const contentEl = document.getElementById('providerSetContent');

  if (!loadingEl || !emptyEl || !tabsEl || !contentEl) return;

  // Handle loading state
  if (state.loadingState === 'loading') {
    loadingEl.classList.remove('d-none');
    emptyEl.classList.add('d-none');
    tabsEl.classList.add('d-none');
    contentEl.classList.add('d-none');
    return;
  }

  loadingEl.classList.add('d-none');

  // Handle empty state
  if (state.data.length === 0) {
    emptyEl.classList.remove('d-none');
    tabsEl.classList.add('d-none');
    contentEl.classList.add('d-none');
    return;
  }

  // Render tabs and content
  emptyEl.classList.add('d-none');
  tabsEl.classList.remove('d-none');
  contentEl.classList.remove('d-none');

  const activeTab = AdminState.activeSetTab;
  tabsEl.innerHTML = renderProviderSetTabs(state.data, activeTab);

  contentEl.innerHTML = state.data
    .map((set, index) => {
      const isActive = activeTab === set.name || (!activeTab && index === 0);
      return renderProviderSetContent(set, isActive);
    })
    .join('');
}

// ============================================================================
// User Rendering
// ============================================================================

/**
 * Render a single user list item HTML
 */
function renderUserItem(user: User): string {
  return `
    <div class="list-group-item d-flex justify-content-between align-items-center ${!user.is_active ? 'opacity-50' : ''}">
      <div>
        <div class="fw-semibold">${user.display_name || user.username}</div>
        <small class="text-muted">@${user.username}</small>
        ${!user.is_active ? '<span class="badge bg-secondary ms-2">Inactive</span>' : ''}
      </div>
      <div class="btn-group btn-group-sm">
        <button class="btn btn-outline-secondary btn-icon" data-action="user:edit" data-id="${user.id}" title="Edit">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-outline-danger btn-icon" data-action="user:delete" data-id="${user.id}" title="Delete">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    </div>
  `;
}

/**
 * Render users list based on state
 */
function renderUsers(state: SectionState<User>): void {
  const loadingEl = document.getElementById('users-loading');
  const emptyEl = document.getElementById('users-empty');
  const listEl = document.getElementById('users-list');

  if (!loadingEl || !emptyEl || !listEl) return;

  // Handle loading state
  if (state.loadingState === 'loading') {
    loadingEl.classList.remove('d-none');
    emptyEl.classList.add('d-none');
    listEl.innerHTML = '';
    return;
  }

  loadingEl.classList.add('d-none');

  // Handle empty state
  if (state.data.length === 0) {
    emptyEl.classList.remove('d-none');
    listEl.innerHTML = '';
    return;
  }

  // Render users
  emptyEl.classList.add('d-none');
  listEl.innerHTML = state.data.map(renderUserItem).join('');
}

// ============================================================================
// Settings Rendering
// ============================================================================

/**
 * Render settings toggles based on state
 */
function renderSettings(settings: AppSettings | null): void {
  const guestToggle = document.getElementById('guestAccessToggle') as HTMLInputElement | null;
  const ttsToggle = document.getElementById('ttsEnabledToggle') as HTMLInputElement | null;

  if (!settings) return;

  if (guestToggle) {
    guestToggle.checked = settings.allow_guest_access;
  }
  if (ttsToggle) {
    ttsToggle.checked = settings.tts_enabled;
  }
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize all render subscriptions
 */
export function initRenderSubscriptions(): void {
  AdminState.subscribeProviders(renderProviders);
  AdminState.subscribeProviderSets(renderProviderSets);
  AdminState.subscribeUsers(renderUsers);
  AdminState.subscribeSettings(renderSettings);
}

/**
 * Export individual render functions for manual triggering if needed
 */
export { renderProviders, renderProviderSets, renderUsers, renderSettings };
