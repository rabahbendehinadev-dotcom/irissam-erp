/**
 * Central API client.
 *
 * Token strategy
 * ──────────────
 *  • Access token (15 min JWT) — stored in memory, sent as Bearer header.
 *  • Refresh token (7 days) — HttpOnly SameSite=Strict cookie, never readable by JS.
 *
 * 401 handling
 * ────────────
 *  On a 401 response, the client calls onUnauthorized() (registered by AuthContext).
 *  If it returns a new access token, the original request is retried once.
 *  If it returns null (refresh also failed), the client emits an "auth:logout" event
 *  so AuthContext can clear the session.
 */

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Skip the 401 auto-refresh retry (used internally for the /auth/refresh call). */
  _skipRefresh?: boolean;
}

class ApiClient {
  private baseUrl: string;
  private authToken: string | null = null;
  /** Registered by AuthContext on mount. Returns the new accessToken or null on failure. */
  private onUnauthorized: (() => Promise<string | null>) | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  registerUnauthorizedHandler(handler: (() => Promise<string | null>) | null) {
    this.onUnauthorized = handler;
  }

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extra,
    };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    return headers;
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers, signal, _skipRefresh } = options;

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: this.buildHeaders(headers),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include',   // send HttpOnly refresh cookie automatically
      signal,
    });

    if (response.status === 401 && !_skipRefresh && this.onUnauthorized) {
      // Try to refresh once
      const newToken = await this.onUnauthorized();
      if (newToken) {
        // Retry with new token
        const retryResponse = await fetch(`${this.baseUrl}${endpoint}`, {
          method,
          headers: this.buildHeaders(headers),
          body: body !== undefined ? JSON.stringify(body) : undefined,
          credentials: 'include',
          signal,
        });
        if (retryResponse.ok) {
          return retryResponse.json() as Promise<T>;
        }
        const errRetry = await retryResponse.json().catch(() => ({ message: retryResponse.statusText }));
        throw Object.assign(new Error(errRetry.message || 'API Error'), {
          status: retryResponse.status,
          data: errRetry,
        });
      }
      // Refresh failed — emit logout event
      window.dispatchEvent(new CustomEvent('auth:logout'));
      const err = await response.json().catch(() => ({ message: 'Session expirée.' }));
      throw Object.assign(new Error(err.message || 'Session expirée.'), {
        status: 401,
        data: err,
      });
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw Object.assign(new Error(error.message || 'API Error'), {
        status: response.status,
        data: error,
      });
    }

    // 204 No Content
    if (response.status === 204) return undefined as unknown as T;

    return response.json() as Promise<T>;
  }

  get<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body: unknown, options?: Omit<RequestOptions, 'method'>) {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  put<T>(endpoint: string, body: unknown, options?: Omit<RequestOptions, 'method'>) {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  patch<T>(endpoint: string, body: unknown, options?: Omit<RequestOptions, 'method'>) {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  delete<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient('/api');
