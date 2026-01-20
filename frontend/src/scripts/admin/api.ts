/**
 * KEA Admin Panel - API Module
 * Type-safe API wrapper for admin endpoints
 */

import { apiRequest as baseApiRequest, ApiRequestError, type ApiRequestOptions } from '../api';
import { AdminState } from './state';
import type {
  Provider,
  ProviderSet,
  ProviderSetMember,
  User,
  AppSettings,
  DiscoveredModel,
  ProviderCreateData,
  ProviderUpdateData,
  ModelCreateData,
  ProviderSetCreateData,
  ProviderSetUpdateData,
  UserCreateData,
  UserUpdateData,
  SettingsUpdateData,
  LoginResponse,
} from './types';

// Re-export for convenience
export { ApiRequestError };

/**
 * Make an admin API request with auth token from state
 */
async function adminApiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const token = AdminState.authToken;
  return baseApiRequest<T>(
    `/api/admin${endpoint}`,
    { ...options, skipAuthRedirect: true },
    token
  );
}

// ============================================================================
// Authentication API
// ============================================================================

export const AuthApi = {
  /**
   * Login with admin password
   */
  async login(password: string): Promise<LoginResponse> {
    return adminApiRequest<LoginResponse>('/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },

  /**
   * Logout and invalidate token
   */
  async logout(): Promise<void> {
    await adminApiRequest('/logout', { method: 'POST' });
  },

  /**
   * Verify current token is valid
   */
  async verify(): Promise<boolean> {
    try {
      await adminApiRequest('/verify');
      return true;
    } catch {
      return false;
    }
  },
};

// ============================================================================
// Providers API
// ============================================================================

export const ProvidersApi = {
  /**
   * Get all providers with their models
   */
  async list(): Promise<Provider[]> {
    return adminApiRequest<Provider[]>('/providers');
  },

  /**
   * Get a single provider by ID
   */
  async get(id: number): Promise<Provider> {
    return adminApiRequest<Provider>(`/providers/${id}`);
  },

  /**
   * Create a new provider
   */
  async create(data: ProviderCreateData): Promise<Provider> {
    return adminApiRequest<Provider>('/providers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update an existing provider
   */
  async update(id: number, data: ProviderUpdateData): Promise<Provider> {
    return adminApiRequest<Provider>(`/providers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a provider and all its models
   */
  async delete(id: number): Promise<void> {
    await adminApiRequest(`/providers/${id}`, { method: 'DELETE' });
  },

  /**
   * Toggle provider active/inactive
   */
  async toggle(id: number): Promise<Provider> {
    return adminApiRequest<Provider>(`/providers/${id}/toggle`, {
      method: 'PATCH',
    });
  },

  /**
   * Discover available models from provider's API
   */
  async discoverModels(id: number): Promise<DiscoveredModel[]> {
    return adminApiRequest<DiscoveredModel[]>(`/providers/${id}/discover`);
  },

  /**
   * Reload all provider instances (apply changes to chat)
   */
  async reload(): Promise<void> {
    await adminApiRequest('/reload', { method: 'POST' });
  },
};

// ============================================================================
// Models API
// ============================================================================

export const ModelsApi = {
  /**
   * Create a new model for a provider
   */
  async create(data: ModelCreateData): Promise<void> {
    await adminApiRequest('/models', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a model
   */
  async delete(id: number): Promise<void> {
    await adminApiRequest(`/models/${id}`, { method: 'DELETE' });
  },

  /**
   * Toggle model active/inactive
   */
  async toggle(id: number): Promise<void> {
    await adminApiRequest(`/models/${id}/toggle`, { method: 'PATCH' });
  },
};

// ============================================================================
// Provider Sets API
// ============================================================================

export const ProviderSetsApi = {
  /**
   * Get all provider sets with their members
   */
  async list(): Promise<ProviderSet[]> {
    return adminApiRequest<ProviderSet[]>('/provider-sets');
  },

  /**
   * Get a single provider set by ID
   */
  async get(id: number): Promise<ProviderSet> {
    return adminApiRequest<ProviderSet>(`/provider-sets/${id}`);
  },

  /**
   * Create a new custom provider set
   */
  async create(data: ProviderSetCreateData): Promise<ProviderSet> {
    return adminApiRequest<ProviderSet>('/provider-sets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update an existing custom provider set
   */
  async update(id: number, data: ProviderSetUpdateData): Promise<ProviderSet> {
    return adminApiRequest<ProviderSet>(`/provider-sets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a custom provider set
   */
  async delete(id: number): Promise<void> {
    await adminApiRequest(`/provider-sets/${id}`, { method: 'DELETE' });
  },

  /**
   * Toggle provider set active/inactive
   */
  async toggle(id: number): Promise<ProviderSet> {
    return adminApiRequest<ProviderSet>(`/provider-sets/${id}/toggle`, {
      method: 'PATCH',
    });
  },

  /**
   * Toggle a provider's enabled status within a set
   */
  async toggleMember(setId: number, memberId: number): Promise<ProviderSetMember> {
    return adminApiRequest<ProviderSetMember>(
      `/provider-sets/${setId}/members/${memberId}/toggle`,
      { method: 'PATCH' }
    );
  },

  /**
   * Add a provider to a custom set
   */
  async addMember(setId: number, providerId: number): Promise<ProviderSetMember> {
    return adminApiRequest<ProviderSetMember>(`/provider-sets/${setId}/members`, {
      method: 'POST',
      body: JSON.stringify({ provider_id: providerId }),
    });
  },

  /**
   * Remove a provider from a custom set
   */
  async removeMember(setId: number, memberId: number): Promise<void> {
    await adminApiRequest(`/provider-sets/${setId}/members/${memberId}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================================
// Users API
// ============================================================================

export const UsersApi = {
  /**
   * Get all users
   */
  async list(): Promise<User[]> {
    return adminApiRequest<User[]>('/users');
  },

  /**
   * Create a new user
   */
  async create(data: UserCreateData): Promise<User> {
    return adminApiRequest<User>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update an existing user
   */
  async update(id: number, data: UserUpdateData): Promise<User> {
    return adminApiRequest<User>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a user
   */
  async delete(id: number): Promise<void> {
    await adminApiRequest(`/users/${id}`, { method: 'DELETE' });
  },
};

// ============================================================================
// Settings API
// ============================================================================

export const SettingsApi = {
  /**
   * Get app settings
   */
  async get(): Promise<AppSettings> {
    return adminApiRequest<AppSettings>('/settings');
  },

  /**
   * Update app settings
   */
  async update(data: SettingsUpdateData): Promise<AppSettings> {
    return adminApiRequest<AppSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

/**
 * Version Check API
 */
const VersionApi = {
  /**
   * Check for software updates from GitHub
   */
  async check(): Promise<VersionInfo> {
    return adminApiRequest<VersionInfo>('/version-check');
  },
};

// ============================================================================
// Unified Admin API Export
// ============================================================================

/**
 * Unified Admin API object with all endpoints
 */
export const AdminApi = {
  auth: AuthApi,
  providers: ProvidersApi,
  providerSets: ProviderSetsApi,
  models: ModelsApi,
  users: UsersApi,
  settings: SettingsApi,
  version: VersionApi,
};
