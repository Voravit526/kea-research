/**
 * Unified API Request Utilities
 */

export interface ApiError {
  detail: string;
  status: number;
}

export class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

export interface ApiRequestOptions extends RequestInit {
  /** Skip automatic redirect to login on 401 (useful for admin panel) */
  skipAuthRedirect?: boolean;
}

/**
 * Make an API request with consistent error handling
 * Note: For streaming endpoints (SSE), use fetchStream instead
 */
export async function apiRequest<T>(
  url: string,
  options: ApiRequestOptions = {},
  token?: string | null
): Promise<T> {
  const { skipAuthRedirect, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((fetchOptions.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...fetchOptions, headers });

  if (!response.ok) {
    // Handle auth errors - redirect to login unless skipAuthRedirect is set
    if (response.status === 401 && !skipAuthRedirect) {
      window.UserAuth?.redirectToLogin();
    }
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new ApiRequestError(error.detail || `HTTP ${response.status}`, response.status);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export interface StreamRequestOptions extends RequestInit {
  /** Skip automatic redirect to login on 401 (for consistency with apiRequest) */
  skipAuthRedirect?: boolean;
}

/**
 * Make an API request that returns a streaming response
 */
export async function fetchStream(
  url: string,
  options: StreamRequestOptions = {},
  token?: string | null
): Promise<Response> {
  const { skipAuthRedirect, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((fetchOptions.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...fetchOptions, headers });

  if (!response.ok) {
    // Handle auth errors - redirect to login unless skipAuthRedirect is set
    if (response.status === 401 && !skipAuthRedirect) {
      window.UserAuth?.redirectToLogin();
    }
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new ApiRequestError(error.detail || `HTTP ${response.status}`, response.status);
  }

  return response;
}

/**
 * Verify an authentication token
 * Returns user data if valid, null if invalid
 */
export async function verifyToken<T>(token: string, endpoint = '/api/users/verify'): Promise<T | null> {
  try {
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

// Global window types for UserAuth
declare global {
  interface Window {
    UserAuth?: {
      redirectToLogin: () => void;
      getAuthHeaders: () => Record<string, string>;
      getToken: () => string | null;
    };
  }
}
