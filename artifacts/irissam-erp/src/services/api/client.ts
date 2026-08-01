/**
 * Base API client — no backend yet.
 * This will be wired to the real API server when modules are built.
 * All methods are stubs that return typed mock data.
 */

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

class ApiClient {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
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
    const { method = 'GET', body, headers, signal } = options;
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: this.buildHeaders(headers),
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw Object.assign(new Error(error.message || 'API Error'), {
        status: response.status,
        data: error,
      });
    }

    return response.json() as Promise<T>;
  }

  get<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body: unknown, options?: Omit<RequestOptions, 'method'>) {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  patch<T>(endpoint: string, body: unknown, options?: Omit<RequestOptions, 'method'>) {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  delete<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient('/api');
