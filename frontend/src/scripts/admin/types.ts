/**
 * KEA Admin Panel - Type Definitions
 * Centralized types for admin functionality
 */

// ============================================================================
// Domain Types
// ============================================================================

/**
 * Provider type identifiers supported by the system
 */
export type ProviderType =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'mistral'
  | 'xai'
  | 'openrouter'
  | 'openai-compatible';

/**
 * AI Provider configuration from database
 */
export interface Provider {
  id: number;
  name: string;
  provider_type: ProviderType;
  display_name: string;
  has_api_key: boolean;
  base_url: string | null;
  icon: string | null;
  is_active: boolean;
  models: Model[];
}

/**
 * Model configuration associated with a provider
 */
export interface Model {
  id: number;
  provider_id: number;
  model_id: string;
  display_name: string;
  is_active: boolean;
  is_default: boolean;
  parameters: string | null;
}

/**
 * Model discovered from provider's API
 */
export interface DiscoveredModel {
  model_id: string;
  display_name: string;
  description: string | null;
}

/**
 * Provider set member (provider within a set)
 */
export interface ProviderSetMember {
  id: number;
  set_id: number;
  provider_id: number;
  is_enabled: boolean;
  sort_order: number;
  provider: Provider;
}

/**
 * Provider set (collection of providers)
 */
export interface ProviderSet {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
  members: ProviderSetMember[];
}

/**
 * User account
 */
export interface User {
  id: number;
  username: string;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
}

/**
 * Application-wide settings
 */
export interface AppSettings {
  allow_guest_access: boolean;
  tts_enabled: boolean;
}

// ============================================================================
// Form Data Types (for create/update operations)
// ============================================================================

/**
 * Data for creating a new provider
 */
export interface ProviderCreateData {
  name: string;
  provider_type: ProviderType;
  display_name: string;
  api_key?: string | null;
  base_url?: string | null;
  icon?: string | null;
}

/**
 * Data for updating an existing provider
 */
export interface ProviderUpdateData {
  display_name?: string;
  api_key?: string | null;
  base_url?: string | null;
  icon?: string | null;
}

/**
 * Data for creating a new model
 */
export interface ModelCreateData {
  provider_id: number;
  model_id: string;
  display_name: string;
  is_active?: boolean;
  is_default?: boolean;
}

/**
 * Data for creating a new user
 */
export interface UserCreateData {
  username: string;
  password: string;
  display_name: string;
}

/**
 * Data for updating an existing user
 */
export interface UserUpdateData {
  display_name?: string | null;
  password?: string;
  is_active?: boolean;
}

/**
 * Data for updating app settings
 */
export interface SettingsUpdateData {
  allow_guest_access?: boolean;
  tts_enabled?: boolean;
}

/**
 * Data for creating a new provider set
 */
export interface ProviderSetCreateData {
  display_name: string;
  description?: string | null;
  provider_ids?: number[];
}

/**
 * Data for updating a provider set
 */
export interface ProviderSetUpdateData {
  display_name?: string;
  description?: string | null;
}

// ============================================================================
// State Types
// ============================================================================

/**
 * Loading state for async operations
 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Section state with data, loading status, and error
 */
export interface SectionState<T> {
  data: T[];
  loadingState: LoadingState;
  error: string | null;
}

/**
 * Complete admin panel state
 */
export interface AdminStateData {
  isAuthenticated: boolean;
  authToken: string | null;
  providers: SectionState<Provider>;
  providerSets: SectionState<ProviderSet>;
  activeSetTab: string | null;
  users: SectionState<User>;
  settings: AppSettings | null;
}

// ============================================================================
// Event Action Types (for event delegation system)
// ============================================================================

/**
 * All possible admin actions for event delegation
 */
export type AdminAction =
  // Provider actions
  | { type: 'provider:toggle'; id: number }
  | { type: 'provider:edit'; id: number }
  | { type: 'provider:edit-api-key'; id: number }
  | { type: 'provider:delete'; id: number }
  | { type: 'provider:discover'; id: number }
  // Model actions
  | { type: 'model:toggle'; id: number }
  | { type: 'model:delete'; id: number }
  // Provider set actions
  | { type: 'provider-set:select-tab'; name: string }
  | { type: 'provider-set:toggle'; id: number }
  | { type: 'provider-set:edit'; id: number }
  | { type: 'provider-set:delete'; id: number }
  | { type: 'provider-set:member-toggle'; setId: number; memberId: number }
  | { type: 'provider-set:add-member'; setId: number }
  | { type: 'provider-set:remove-member'; setId: number; memberId: number }
  // User actions
  | { type: 'user:edit'; id: number }
  | { type: 'user:delete'; id: number }
  // Settings actions
  | { type: 'settings:toggle-guest'; enabled: boolean }
  | { type: 'settings:toggle-tts'; enabled: boolean };

/**
 * Action handler function signature
 */
export type ActionHandler = (action: AdminAction) => Promise<void>;

// ============================================================================
// UI Types
// ============================================================================

/**
 * Toast notification types
 */
export type ToastType = 'success' | 'error' | 'info' | 'warning';

/**
 * Toast notification options
 */
export interface ToastOptions {
  title: string;
  message: string;
  type: ToastType;
  duration?: number;
}

/**
 * Confirmation dialog options
 */
export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Login response from /api/admin/login
 */
export interface LoginResponse {
  token: string;
  expires_in: number;
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  detail: string;
}
