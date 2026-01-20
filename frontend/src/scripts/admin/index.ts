/**
 * KEA Admin Panel - Entry Point
 * Initializes all admin modules and orchestrates the application
 */

// Core modules
import { AdminState } from './state';
import { AdminEvents } from './events';
import { AdminAuth } from './auth';

// Feature modules
import { ProvidersModule, setProvidersUIDeps } from './features/providers';
import { ProviderSetsModule, setProviderSetsUIDeps } from './features/provider-sets';
import { ModelsModule, setModelsUIDeps } from './features/models';
import { UsersModule, setUsersUIDeps } from './features/users';
import { SettingsModule, setSettingsUIDeps } from './features/settings';
import { VersionCheckerModule, setVersionCheckerUIDeps } from './features/version-checker';

// UI modules
import { Toast, showToast } from './ui/toast';
import { showConfirm } from './ui/confirm';
import { setButtonLoading, resetModalForm, showModal, hideModal } from './ui/modal';
import { validatePassword, clearValidation } from './ui/forms';
import { initRenderSubscriptions } from './ui/render';

// Re-export for external use
export { AdminState } from './state';
export { AdminEvents } from './events';
export { AdminAuth } from './auth';
export { ProvidersModule } from './features/providers';
export { ProviderSetsModule } from './features/provider-sets';
export { ModelsModule } from './features/models';
export { UsersModule } from './features/users';
export { SettingsModule } from './features/settings';
export { Toast, showToast } from './ui/toast';
export { showConfirm, confirmDelete, confirmAction } from './ui/confirm';
export * from './ui/modal';
export * from './ui/forms';
export * from './types';

// ============================================================================
// View Management
// ============================================================================

const loginView = document.getElementById('login-view');
const adminView = document.getElementById('admin-view');

function showLoginView(): void {
  loginView?.classList.remove('d-none');
  adminView?.classList.add('d-none');
}

function showAdminView(): void {
  loginView?.classList.add('d-none');
  adminView?.classList.remove('d-none');
}

// ============================================================================
// UI Dependencies Injection
// ============================================================================

/**
 * Inject UI dependencies into feature modules
 * This breaks the circular dependency between features and UI
 */
function injectUIDependencies(): void {
  const deps = {
    toast: showToast,
    confirm: showConfirm,
  };

  setProvidersUIDeps(deps);
  setProviderSetsUIDeps(deps);
  setModelsUIDeps(deps);
  setUsersUIDeps(deps);
  setSettingsUIDeps({ toast: showToast });
  setVersionCheckerUIDeps({ toast: showToast, modal: showModal });
}

// ============================================================================
// Form Handlers
// ============================================================================

/**
 * Setup login form handler
 */
function setupLoginForm(): void {
  const loginForm = document.getElementById('login-form') as HTMLFormElement | null;
  const loginBtn = document.getElementById('login-btn') as HTMLButtonElement | null;
  const loginError = document.getElementById('login-error') as HTMLElement | null;

  if (!loginForm || !loginBtn) return;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = (document.getElementById('password') as HTMLInputElement)?.value;

    setButtonLoading(loginBtn, true);
    loginError?.classList.add('d-none');

    const success = await AdminAuth.login(password);

    setButtonLoading(loginBtn, false);

    if (success) {
      showAdminView();
      await loadAdminData();
    } else {
      if (loginError) {
        loginError.textContent = 'Invalid password';
        loginError.classList.remove('d-none');
      }
    }
  });
}

/**
 * Setup logout button
 */
function setupLogoutButton(): void {
  const logoutBtn = document.getElementById('logout-btn');
  logoutBtn?.addEventListener('click', async () => {
    await AdminAuth.logout();
    showLoginView();
  });
}

/**
 * Setup reload button
 */
function setupReloadButton(): void {
  const reloadBtn = document.getElementById('reload-btn');
  reloadBtn?.addEventListener('click', async () => {
    await ProvidersModule.reload();
  });
}

// ============================================================================
// Data Loading
// ============================================================================

/**
 * Load all admin data in parallel
 */
async function loadAdminData(): Promise<void> {
  await Promise.all([
    ProvidersModule.load(),
    ProviderSetsModule.load(),
    UsersModule.load(),
    SettingsModule.load(),
    VersionCheckerModule.checkVersion(),
  ]);
}

// ============================================================================
// Provider Form Handlers
// ============================================================================

/**
 * Setup provider form handlers
 */
function setupProviderForms(): void {
  const addForm = document.getElementById('add-provider-form') as HTMLFormElement | null;
  const editForm = document.getElementById('edit-provider-form') as HTMLFormElement | null;
  const addBtn = document.getElementById('add-provider-btn') as HTMLButtonElement | null;
  const editBtn = document.getElementById('edit-provider-btn') as HTMLButtonElement | null;

  // Provider type change handler - show/hide base URL field
  const providerType = document.getElementById('provider-type') as HTMLSelectElement | null;
  const baseUrlGroup = document.getElementById('base-url-group');

  providerType?.addEventListener('change', () => {
    if (providerType.value === 'openai-compatible') {
      baseUrlGroup?.classList.remove('d-none');
    } else {
      baseUrlGroup?.classList.add('d-none');
    }
  });

  // Icon preview
  const iconInput = document.getElementById('provider-icon') as HTMLTextAreaElement | null;
  const iconPreview = document.getElementById('provider-icon-preview');
  iconInput?.addEventListener('input', () => {
    if (iconPreview) {
      iconPreview.innerHTML = iconInput.value || '<i class="bi bi-robot"></i>';
    }
  });

  const editIconInput = document.getElementById('edit-provider-icon') as HTMLTextAreaElement | null;
  const editIconPreview = document.getElementById('edit-provider-icon-preview');
  editIconInput?.addEventListener('input', () => {
    if (editIconPreview) {
      editIconPreview.innerHTML = editIconInput.value || '<i class="bi bi-robot"></i>';
    }
  });

  // Generate unique provider name from type + random suffix
  function generateUniqueName(providerType: string): string {
    const suffix = Math.random().toString(36).substring(2, 8);
    return `${providerType}-${suffix}`;
  }

  // Track which set to add the provider to (if any)
  let addToSetId: number | null = null;

  // Listen for modal open to capture the target set
  const addProviderModal = document.getElementById('addProviderModal');
  addProviderModal?.addEventListener('show.bs.modal', (e) => {
    const triggerBtn = (e as any).relatedTarget as HTMLElement | null;
    const setIdAttr = triggerBtn?.getAttribute('data-add-to-set');
    addToSetId = setIdAttr ? parseInt(setIdAttr, 10) : null;
  });

  // Add provider form
  addForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!addBtn) return;

    setButtonLoading(addBtn, true);

    const providerType = (document.getElementById('provider-type') as HTMLSelectElement).value as import('./types').ProviderType;

    const data = {
      name: generateUniqueName(providerType),
      provider_type: providerType,
      display_name: (document.getElementById('provider-display-name') as HTMLInputElement).value,
      icon: (document.getElementById('provider-icon') as HTMLTextAreaElement).value || undefined,
      api_key: (document.getElementById('provider-api-key') as HTMLInputElement).value || undefined,
      base_url: (document.getElementById('provider-base-url') as HTMLInputElement).value || undefined,
    };

    const newProvider = await ProvidersModule.create(data);
    setButtonLoading(addBtn, false);

    if (newProvider) {
      // If we have a target set, add the new provider to it
      if (addToSetId && typeof newProvider === 'object' && newProvider.id) {
        await ProviderSetsModule.addMember(addToSetId, newProvider.id);
      }
      hideModal('addProviderModal');
      resetModalForm('#addProviderModal');
      addToSetId = null; // Reset
    }
  });

  // Edit provider form
  editForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!editBtn) return;

    const providerId = parseInt((document.getElementById('edit-provider-id') as HTMLInputElement).value);
    setButtonLoading(editBtn, true);

    const data = {
      display_name: (document.getElementById('edit-provider-display-name') as HTMLInputElement).value,
      icon: (document.getElementById('edit-provider-icon') as HTMLTextAreaElement).value || undefined,
      api_key: (document.getElementById('edit-provider-api-key') as HTMLInputElement).value || undefined,
      base_url: (document.getElementById('edit-provider-base-url') as HTMLInputElement).value || undefined,
    };

    const success = await ProvidersModule.update(providerId, data);
    setButtonLoading(editBtn, false);

    if (success) {
      hideModal('editProviderModal');
    }
  });

  // Listen for open edit modal event
  document.addEventListener('admin:open-provider-modal', ((e: CustomEvent) => {
    const { mode, provider } = e.detail;
    if (mode === 'edit' && provider) {
      (document.getElementById('edit-provider-id') as HTMLInputElement).value = provider.id;
      (document.getElementById('edit-provider-display-name') as HTMLInputElement).value = provider.display_name;
      (document.getElementById('edit-provider-icon') as HTMLTextAreaElement).value = provider.icon || '';
      (document.getElementById('edit-provider-base-url') as HTMLInputElement).value = provider.base_url || '';
      if (editIconPreview) {
        editIconPreview.innerHTML = provider.icon || '<i class="bi bi-robot"></i>';
      }
      // Show Base URL field only for openai-compatible providers
      const editBaseUrlGroup = document.getElementById('edit-base-url-group');
      if (editBaseUrlGroup) {
        if (provider.provider_type === 'openai-compatible') {
          editBaseUrlGroup.classList.remove('d-none');
        } else {
          editBaseUrlGroup.classList.add('d-none');
        }
      }
      showModal('editProviderModal');
    }
  }) as EventListener);
}

// ============================================================================
// Provider Set Form Handlers
// ============================================================================

/**
 * Setup provider set form handlers
 */
function setupProviderSetForms(): void {
  const createForm = document.getElementById('create-set-form') as HTMLFormElement | null;
  const editForm = document.getElementById('edit-set-form') as HTMLFormElement | null;
  const createBtn = document.getElementById('create-set-btn') as HTMLButtonElement | null;
  const editBtn = document.getElementById('edit-set-btn') as HTMLButtonElement | null;
  const addMemberBtn = document.getElementById('add-member-btn') as HTMLButtonElement | null;

  // Helper to render provider checkboxes
  function renderProviderCheckboxes(containerId: string, excludeIds: number[] = []): void {
    const container = document.getElementById(containerId);
    if (!container) return;

    const providers = AdminState.providers.filter(p => !excludeIds.includes(p.id));

    if (providers.length === 0) {
      container.innerHTML = '<p class="text-muted mb-0">No providers available</p>';
      return;
    }

    container.innerHTML = providers.map(p => `
      <div class="form-check">
        <input class="form-check-input" type="checkbox" value="${p.id}" id="provider-check-${containerId}-${p.id}">
        <label class="form-check-label" for="provider-check-${containerId}-${p.id}">
          ${p.display_name}
          <small class="text-muted">(${p.provider_type})</small>
        </label>
      </div>
    `).join('');
  }

  // Create set form
  createForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!createBtn) return;

    const displayName = (document.getElementById('set-display-name') as HTMLInputElement).value;
    const description = (document.getElementById('set-description') as HTMLTextAreaElement).value || undefined;

    setButtonLoading(createBtn, true);

    const success = await ProviderSetsModule.create({
      display_name: displayName,
      description,
    });

    setButtonLoading(createBtn, false);

    if (success) {
      hideModal('createSetModal');
      resetModalForm('#createSetModal');
      // Switch to the newly created tab
      const sets = ProviderSetsModule.getAll();
      const newSet = sets.find(s => s.display_name === displayName);
      if (newSet) {
        ProviderSetsModule.setActiveTab(newSet.name);
      }
    }
  });

  // Edit set form
  editForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!editBtn) return;

    const setId = parseInt((document.getElementById('edit-set-id') as HTMLInputElement).value);
    const displayName = (document.getElementById('edit-set-display-name') as HTMLInputElement).value;
    const description = (document.getElementById('edit-set-description') as HTMLTextAreaElement).value || undefined;

    setButtonLoading(editBtn, true);

    const success = await ProviderSetsModule.update(setId, {
      display_name: displayName,
      description,
    });

    setButtonLoading(editBtn, false);

    if (success) {
      hideModal('editSetModal');
    }
  });

  // Add member button
  addMemberBtn?.addEventListener('click', async () => {
    const setId = parseInt((document.getElementById('add-member-set-id') as HTMLInputElement).value);

    // Get selected provider IDs
    const checkboxes = document.querySelectorAll('#add-member-checkboxes input[type="checkbox"]:checked');
    const providerIds = Array.from(checkboxes).map(cb => parseInt((cb as HTMLInputElement).value, 10));

    if (providerIds.length === 0) {
      showToast('Warning', 'Please select at least one provider', 'info');
      return;
    }

    setButtonLoading(addMemberBtn, true);

    // Add each provider one at a time
    let allSuccess = true;
    for (const providerId of providerIds) {
      const success = await ProviderSetsModule.addMember(setId, providerId);
      if (!success) allSuccess = false;
    }

    setButtonLoading(addMemberBtn, false);

    if (allSuccess) {
      hideModal('addMemberModal');
    }
  });

  // Listen for open create set modal event (from "Create Custom Set" button)
  document.addEventListener('admin:open-create-set-modal', (() => {
    showModal('createSetModal');
  }) as EventListener);

  // Listen for open edit set modal event
  document.addEventListener('admin:open-provider-set-modal', ((e: CustomEvent) => {
    const { mode, providerSet } = e.detail;
    if (mode === 'edit' && providerSet) {
      (document.getElementById('edit-set-id') as HTMLInputElement).value = providerSet.id;
      (document.getElementById('edit-set-display-name') as HTMLInputElement).value = providerSet.display_name;
      (document.getElementById('edit-set-description') as HTMLTextAreaElement).value = providerSet.description || '';
      showModal('editSetModal');
    } else if (mode === 'create') {
      showModal('createSetModal');
    }
  }) as EventListener);

  // Listen for open add member modal event
  document.addEventListener('admin:open-add-member-modal', ((e: CustomEvent) => {
    const { providerSet } = e.detail;
    if (!providerSet) return;

    (document.getElementById('add-member-set-id') as HTMLInputElement).value = providerSet.id;
    const nameEl = document.querySelector('#add-member-set-name strong');
    if (nameEl) nameEl.textContent = providerSet.display_name;

    // Get existing member provider IDs to exclude
    const existingIds = providerSet.members.map((m: { provider_id: number }) => m.provider_id);
    renderProviderCheckboxes('add-member-checkboxes', existingIds);

    showModal('addMemberModal');
  }) as EventListener);
}

// ============================================================================
// User Form Handlers
// ============================================================================

/**
 * Setup user form handlers
 */
function setupUserForms(): void {
  const addForm = document.getElementById('add-user-form') as HTMLFormElement | null;
  const editForm = document.getElementById('edit-user-form') as HTMLFormElement | null;
  const addBtn = document.getElementById('add-user-btn') as HTMLButtonElement | null;
  const editBtn = document.getElementById('edit-user-btn') as HTMLButtonElement | null;

  // Add user form
  addForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!addBtn) return;

    const passwordInput = document.getElementById('user-password') as HTMLInputElement;
    const passwordError = document.getElementById('user-password-error');

    // Validate password
    const validation = validatePassword(passwordInput.value);
    if (!validation.valid) {
      passwordInput.classList.add('is-invalid');
      if (passwordError) {
        passwordError.textContent = validation.message || 'Invalid password';
      }
      return;
    }

    clearValidation(passwordInput);
    setButtonLoading(addBtn, true);

    const data = {
      username: (document.getElementById('user-username') as HTMLInputElement).value,
      password: passwordInput.value,
      display_name: (document.getElementById('user-display-name') as HTMLInputElement).value,
    };

    const success = await UsersModule.create(data);
    setButtonLoading(addBtn, false);

    if (success) {
      hideModal('addUserModal');
      resetModalForm('add-user-form');
    }
  });

  // Edit user form
  editForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!editBtn) return;

    const userId = parseInt((document.getElementById('edit-user-id') as HTMLInputElement).value);
    const passwordInput = document.getElementById('edit-user-password') as HTMLInputElement;
    const passwordError = document.getElementById('edit-user-password-error');

    // Validate password if provided
    if (passwordInput.value) {
      const validation = validatePassword(passwordInput.value);
      if (!validation.valid) {
        passwordInput.classList.add('is-invalid');
        if (passwordError) {
          passwordError.textContent = validation.message || 'Invalid password';
        }
        return;
      }
    }

    clearValidation(passwordInput);
    setButtonLoading(editBtn, true);

    const data = {
      display_name: (document.getElementById('edit-user-display-name') as HTMLInputElement).value,
      password: passwordInput.value || undefined,
      is_active: (document.getElementById('edit-user-active') as HTMLInputElement).checked,
    };

    const success = await UsersModule.update(userId, data);
    setButtonLoading(editBtn, false);

    if (success) {
      hideModal('editUserModal');
    }
  });

  // Listen for open edit modal event
  document.addEventListener('admin:open-user-modal', ((e: CustomEvent) => {
    const { mode, user } = e.detail;
    if (mode === 'edit' && user) {
      (document.getElementById('edit-user-id') as HTMLInputElement).value = user.id;
      (document.getElementById('edit-user-display-name') as HTMLInputElement).value = user.display_name || '';
      (document.getElementById('edit-user-active') as HTMLInputElement).checked = user.is_active;
      (document.getElementById('edit-user-password') as HTMLInputElement).value = '';
      showModal('editUserModal');
    }
  }) as EventListener);
}

// ============================================================================
// Settings Handlers
// ============================================================================

/**
 * Setup settings toggle handlers
 */
function setupSettingsHandlers(): void {
  const guestToggle = document.getElementById('guestAccessToggle') as HTMLInputElement | null;
  const ttsToggle = document.getElementById('ttsEnabledToggle') as HTMLInputElement | null;

  guestToggle?.addEventListener('change', async () => {
    await SettingsModule.toggleGuestAccess(guestToggle.checked);
  });

  ttsToggle?.addEventListener('change', async () => {
    await SettingsModule.toggleTTS(ttsToggle.checked);
  });
}

// ============================================================================
// Model Discovery Handler
// ============================================================================

/**
 * Setup discover models modal handler
 */
function setupDiscoverModal(): void {
  const discoverLoading = document.getElementById('discover-loading');
  const discoverError = document.getElementById('discover-error');
  const discoverResults = document.getElementById('discover-results');
  const discoverModelsList = document.getElementById('discover-models-list');
  const discoverFilter = document.getElementById('discover-filter') as HTMLInputElement | null;
  const addSelectedBtn = document.getElementById('add-selected-models-btn') as HTMLButtonElement | null;

  // Listen for open discover modal event
  document.addEventListener('admin:open-discover-modal', (async (e: CustomEvent) => {
    const { providerId } = e.detail;

    // Reset modal state
    if (discoverLoading) discoverLoading.classList.remove('d-none');
    if (discoverError) discoverError.classList.add('d-none');
    if (discoverResults) discoverResults.classList.add('d-none');
    if (addSelectedBtn) addSelectedBtn.classList.add('d-none');
    if (discoverFilter) discoverFilter.value = '';

    showModal('discoverModelsModal');

    try {
      const models = await ModelsModule.discoverModels(providerId);
      const existingIds = ModelsModule.getExistingModelIds(providerId);

      if (discoverLoading) discoverLoading.classList.add('d-none');
      if (discoverResults) discoverResults.classList.remove('d-none');
      if (addSelectedBtn) addSelectedBtn.classList.remove('d-none');

      // Render discovered models
      renderDiscoveredModels(models, existingIds);
    } catch (error) {
      if (discoverLoading) discoverLoading.classList.add('d-none');
      if (discoverError) {
        discoverError.classList.remove('d-none');
        discoverError.textContent = error instanceof Error ? error.message : 'Failed to discover models';
      }
    }
  }) as EventListener);

  // Setup filter - search by both model ID and display name
  // Note: Using d-none class instead of inline style because Bootstrap's d-flex uses !important
  discoverFilter?.addEventListener('input', () => {
    const filterValue = discoverFilter.value.toLowerCase();
    const items = discoverModelsList?.querySelectorAll('.list-group-item') || [];
    items.forEach((item) => {
      const modelId = item.getAttribute('data-model-id')?.toLowerCase() || '';
      const displayName = item.textContent?.toLowerCase() || '';
      if (modelId.includes(filterValue) || displayName.includes(filterValue)) {
        item.classList.remove('d-none');
      } else {
        item.classList.add('d-none');
      }
    });
  });

  // Helper to render discovered models
  function renderDiscoveredModels(
    models: Array<{ model_id: string; display_name: string; description: string | null }>,
    existingIds: Set<string>
  ): void {
    if (!discoverModelsList) return;

    discoverModelsList.innerHTML = models
      .map((model) => {
        const isExisting = existingIds.has(model.model_id);
        return `
          <label class="list-group-item list-group-item-action d-flex gap-3" data-model-id="${model.model_id}">
            <input class="form-check-input flex-shrink-0" type="radio" name="selectedModel" value="${model.model_id}" ${isExisting ? 'disabled' : ''}>
            <span class="flex-grow-1">
              ${model.display_name || model.model_id}
              ${isExisting ? '<span class="badge bg-secondary ms-2">Already added</span>' : ''}
            </span>
          </label>
        `;
      })
      .join('');
  }

  // Add selected models button
  addSelectedBtn?.addEventListener('click', async () => {
    const selectedRadio = discoverModelsList?.querySelector('input[name="selectedModel"]:checked') as HTMLInputElement | null;
    if (!selectedRadio) {
      showToast('Warning', 'Please select a model', 'info');
      return;
    }

    const providerId = ModelsModule.getCurrentProviderId();
    if (!providerId) return;

    setButtonLoading(addSelectedBtn, true);

    const modelId = selectedRadio.value;
    const label = selectedRadio.closest('label');
    const displayName = label?.querySelector('span.flex-grow-1')?.textContent?.trim().replace(/Already added$/, '').trim() || modelId;

    const success = await ModelsModule.addSelectedModel(providerId, modelId, displayName);
    setButtonLoading(addSelectedBtn, false);

    if (success) {
      hideModal('discoverModelsModal');
    }
  });
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the admin panel
 */
async function init(): Promise<void> {
  // Initialize UI modules
  Toast.init();

  // Inject UI dependencies into feature modules
  injectUIDependencies();

  // Initialize event delegation
  AdminEvents.init();

  // Initialize render subscriptions (connects state changes to UI)
  initRenderSubscriptions();

  // Setup form handlers
  setupLoginForm();
  setupLogoutButton();
  setupReloadButton();
  setupProviderForms();
  setupProviderSetForms();
  setupUserForms();
  setupSettingsHandlers();
  setupDiscoverModal();

  // Check for stored auth token
  const isAuthenticated = await AdminAuth.checkStoredToken();

  if (isAuthenticated) {
    showAdminView();
    await loadAdminData();
  } else {
    showLoginView();
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Expose to window for debugging (optional)
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).AdminState = AdminState;
  (window as unknown as Record<string, unknown>).AdminEvents = AdminEvents;
}
