/**
 * KEA Admin Panel - State Management
 * Centralized state with reactive updates via subscription pattern
 */

import type {
  AdminStateData,
  Provider,
  ProviderSet,
  User,
  AppSettings,
  SectionState,
  LoadingState,
} from './types';

type StateChangeCallback = (state: AdminStateData) => void;
type SectionChangeCallback<T> = (section: SectionState<T>) => void;
type SettingsChangeCallback = (settings: AppSettings | null) => void;

/**
 * AdminState - Centralized state management for admin panel
 *
 * Features:
 * - Reactive updates via subscription pattern
 * - Section-specific loading/error states
 * - Immutable state updates
 * - Type-safe getters and setters
 */
class AdminStateManager {
  private state: AdminStateData = {
    isAuthenticated: false,
    authToken: null,
    providers: { data: [], loadingState: 'idle', error: null },
    providerSets: { data: [], loadingState: 'idle', error: null },
    activeSetTab: null,
    users: { data: [], loadingState: 'idle', error: null },
    settings: null,
  };

  // Listener sets for subscriptions
  private listeners: Set<StateChangeCallback> = new Set();
  private providerListeners: Set<SectionChangeCallback<Provider>> = new Set();
  private providerSetListeners: Set<SectionChangeCallback<ProviderSet>> = new Set();
  private userListeners: Set<SectionChangeCallback<User>> = new Set();
  private settingsListeners: Set<SettingsChangeCallback> = new Set();

  // ========== Getters ==========

  get isAuthenticated(): boolean {
    return this.state.isAuthenticated;
  }

  get authToken(): string | null {
    return this.state.authToken;
  }

  get providers(): Provider[] {
    return this.state.providers.data;
  }

  get providersLoadingState(): LoadingState {
    return this.state.providers.loadingState;
  }

  get providersError(): string | null {
    return this.state.providers.error;
  }

  get providerSets(): ProviderSet[] {
    return this.state.providerSets.data;
  }

  get providerSetsLoadingState(): LoadingState {
    return this.state.providerSets.loadingState;
  }

  get providerSetsError(): string | null {
    return this.state.providerSets.error;
  }

  get activeSetTab(): string | null {
    return this.state.activeSetTab;
  }

  get users(): User[] {
    return this.state.users.data;
  }

  get usersLoadingState(): LoadingState {
    return this.state.users.loadingState;
  }

  get usersError(): string | null {
    return this.state.users.error;
  }

  get settings(): AppSettings | null {
    return this.state.settings;
  }

  /**
   * Get a provider by ID
   */
  getProviderById(id: number): Provider | undefined {
    return this.state.providers.data.find((p) => p.id === id);
  }

  /**
   * Get a provider set by ID
   */
  getProviderSetById(id: number): ProviderSet | undefined {
    return this.state.providerSets.data.find((ps) => ps.id === id);
  }

  /**
   * Get a provider set by name
   */
  getProviderSetByName(name: string): ProviderSet | undefined {
    return this.state.providerSets.data.find((ps) => ps.name === name);
  }

  /**
   * Get a user by ID
   */
  getUserById(id: number): User | undefined {
    return this.state.users.data.find((u) => u.id === id);
  }

  // ========== Auth Setters ==========

  /**
   * Set authentication state
   */
  setAuth(token: string | null): void {
    this.state = {
      ...this.state,
      isAuthenticated: !!token,
      authToken: token,
    };
    this.notify();
  }

  // ========== Provider Setters ==========

  /**
   * Set providers data (success state)
   */
  setProviders(providers: Provider[]): void {
    this.state = {
      ...this.state,
      providers: {
        data: providers,
        loadingState: 'success',
        error: null,
      },
    };
    this.notifyProviderListeners();
    this.notify();
  }

  /**
   * Set providers loading state
   */
  setProvidersLoading(): void {
    this.state = {
      ...this.state,
      providers: {
        ...this.state.providers,
        loadingState: 'loading',
        error: null,
      },
    };
    this.notifyProviderListeners();
  }

  /**
   * Set providers error state
   */
  setProvidersError(error: string): void {
    this.state = {
      ...this.state,
      providers: {
        ...this.state.providers,
        loadingState: 'error',
        error,
      },
    };
    this.notifyProviderListeners();
    this.notify();
  }

  /**
   * Update a single provider in state (optimistic update)
   */
  updateProvider(id: number, updates: Partial<Provider>): void {
    const providers = this.state.providers.data.map((p) =>
      p.id === id ? { ...p, ...updates } : p
    );
    this.state = {
      ...this.state,
      providers: {
        ...this.state.providers,
        data: providers,
      },
    };
    this.notifyProviderListeners();
    this.notify();
  }

  /**
   * Remove a provider from state
   */
  removeProvider(id: number): void {
    const providers = this.state.providers.data.filter((p) => p.id !== id);
    this.state = {
      ...this.state,
      providers: {
        ...this.state.providers,
        data: providers,
      },
    };
    this.notifyProviderListeners();
    this.notify();
  }

  // ========== Provider Set Setters ==========

  /**
   * Set provider sets data (success state)
   */
  setProviderSets(providerSets: ProviderSet[]): void {
    this.state = {
      ...this.state,
      providerSets: {
        data: providerSets,
        loadingState: 'success',
        error: null,
      },
    };
    this.notifyProviderSetListeners();
    this.notify();
  }

  /**
   * Set provider sets loading state
   */
  setProviderSetsLoading(): void {
    this.state = {
      ...this.state,
      providerSets: {
        ...this.state.providerSets,
        loadingState: 'loading',
        error: null,
      },
    };
    this.notifyProviderSetListeners();
  }

  /**
   * Set provider sets error state
   */
  setProviderSetsError(error: string): void {
    this.state = {
      ...this.state,
      providerSets: {
        ...this.state.providerSets,
        loadingState: 'error',
        error,
      },
    };
    this.notifyProviderSetListeners();
    this.notify();
  }

  /**
   * Set the active tab for provider sets
   */
  setActiveSetTab(name: string | null): void {
    this.state = {
      ...this.state,
      activeSetTab: name,
    };
    this.notify();
  }

  /**
   * Update a single provider set in state (optimistic update)
   */
  updateProviderSet(id: number, updates: Partial<ProviderSet>): void {
    const providerSets = this.state.providerSets.data.map((ps) =>
      ps.id === id ? { ...ps, ...updates } : ps
    );
    this.state = {
      ...this.state,
      providerSets: {
        ...this.state.providerSets,
        data: providerSets,
      },
    };
    this.notifyProviderSetListeners();
    this.notify();
  }

  /**
   * Remove a provider set from state
   */
  removeProviderSet(id: number): void {
    const providerSets = this.state.providerSets.data.filter((ps) => ps.id !== id);
    this.state = {
      ...this.state,
      providerSets: {
        ...this.state.providerSets,
        data: providerSets,
      },
    };
    this.notifyProviderSetListeners();
    this.notify();
  }

  // ========== User Setters ==========

  /**
   * Set users data (success state)
   */
  setUsers(users: User[]): void {
    this.state = {
      ...this.state,
      users: {
        data: users,
        loadingState: 'success',
        error: null,
      },
    };
    this.notifyUserListeners();
    this.notify();
  }

  /**
   * Set users loading state
   */
  setUsersLoading(): void {
    this.state = {
      ...this.state,
      users: {
        ...this.state.users,
        loadingState: 'loading',
        error: null,
      },
    };
    this.notifyUserListeners();
  }

  /**
   * Set users error state
   */
  setUsersError(error: string): void {
    this.state = {
      ...this.state,
      users: {
        ...this.state.users,
        loadingState: 'error',
        error,
      },
    };
    this.notifyUserListeners();
    this.notify();
  }

  /**
   * Update a single user in state (optimistic update)
   */
  updateUser(id: number, updates: Partial<User>): void {
    const users = this.state.users.data.map((u) =>
      u.id === id ? { ...u, ...updates } : u
    );
    this.state = {
      ...this.state,
      users: {
        ...this.state.users,
        data: users,
      },
    };
    this.notifyUserListeners();
    this.notify();
  }

  /**
   * Remove a user from state
   */
  removeUser(id: number): void {
    const users = this.state.users.data.filter((u) => u.id !== id);
    this.state = {
      ...this.state,
      users: {
        ...this.state.users,
        data: users,
      },
    };
    this.notifyUserListeners();
    this.notify();
  }

  // ========== Settings Setters ==========

  /**
   * Set app settings
   */
  setSettings(settings: AppSettings): void {
    this.state = {
      ...this.state,
      settings,
    };
    this.notifySettingsListeners();
    this.notify();
  }

  /**
   * Update a single setting (optimistic update)
   */
  updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    if (!this.state.settings) return;

    this.state = {
      ...this.state,
      settings: {
        ...this.state.settings,
        [key]: value,
      },
    };
    this.notifySettingsListeners();
    this.notify();
  }

  // ========== Subscriptions ==========

  /**
   * Subscribe to all state changes
   */
  subscribe(callback: StateChangeCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Subscribe to provider state changes
   * Immediately calls with current state
   */
  subscribeProviders(callback: SectionChangeCallback<Provider>): () => void {
    this.providerListeners.add(callback);
    callback(this.state.providers);
    return () => this.providerListeners.delete(callback);
  }

  /**
   * Subscribe to provider set state changes
   * Immediately calls with current state
   */
  subscribeProviderSets(callback: SectionChangeCallback<ProviderSet>): () => void {
    this.providerSetListeners.add(callback);
    callback(this.state.providerSets);
    return () => this.providerSetListeners.delete(callback);
  }

  /**
   * Subscribe to user state changes
   * Immediately calls with current state
   */
  subscribeUsers(callback: SectionChangeCallback<User>): () => void {
    this.userListeners.add(callback);
    callback(this.state.users);
    return () => this.userListeners.delete(callback);
  }

  /**
   * Subscribe to settings changes
   * Immediately calls with current state
   */
  subscribeSettings(callback: SettingsChangeCallback): () => void {
    this.settingsListeners.add(callback);
    callback(this.state.settings);
    return () => this.settingsListeners.delete(callback);
  }

  // ========== Notifications ==========

  private notify(): void {
    this.listeners.forEach((cb) => cb(this.state));
  }

  private notifyProviderListeners(): void {
    this.providerListeners.forEach((cb) => cb(this.state.providers));
  }

  private notifyProviderSetListeners(): void {
    this.providerSetListeners.forEach((cb) => cb(this.state.providerSets));
  }

  private notifyUserListeners(): void {
    this.userListeners.forEach((cb) => cb(this.state.users));
  }

  private notifySettingsListeners(): void {
    this.settingsListeners.forEach((cb) => cb(this.state.settings));
  }

  // ========== Reset ==========

  /**
   * Reset state to initial values (on logout)
   */
  reset(): void {
    this.state = {
      isAuthenticated: false,
      authToken: null,
      providers: { data: [], loadingState: 'idle', error: null },
      providerSets: { data: [], loadingState: 'idle', error: null },
      activeSetTab: null,
      users: { data: [], loadingState: 'idle', error: null },
      settings: null,
    };
    this.notify();
    this.notifyProviderListeners();
    this.notifyProviderSetListeners();
    this.notifyUserListeners();
    this.notifySettingsListeners();
  }

  /**
   * Get full state snapshot (for debugging)
   */
  getSnapshot(): AdminStateData {
    return { ...this.state };
  }
}

// Export singleton instance
export const AdminState = new AdminStateManager();
