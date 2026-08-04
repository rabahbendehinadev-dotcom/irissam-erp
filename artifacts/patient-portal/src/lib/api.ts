/**
 * Patient Portal API client.
 * Uses /api/patient-portal/* endpoints with Bearer token auth.
 * Access token is kept in memory (React context); refresh token is HttpOnly cookie.
 */

const BASE = "/api/patient-portal";

export type ApiError = {
  status: number;
  message: string;
};

// --------------------------------------------------------------------------
// Low-level fetch wrapper
// --------------------------------------------------------------------------

let _accessToken: string | null = null;
let _refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

async function _doRefresh(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include", // send irissam_pt cookie
    });
    if (!res.ok) return null;
    const data = await res.json();
    _accessToken = data.accessToken ?? null;
    return _accessToken;
  } catch {
    return null;
  }
}

async function refreshToken(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = _doRefresh().finally(() => {
    _refreshPromise = null;
  });
  return _refreshPromise;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (_accessToken) headers["Authorization"] = `Bearer ${_accessToken}`;

  let res = await fetch(url, { ...options, headers, credentials: "include" });

  // Auto-refresh on 401
  if (res.status === 401 && _accessToken) {
    const newToken = await refreshToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(url, { ...options, headers, credentials: "include" });
    }
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body.message ?? body.error ?? message;
    } catch {}
    const err: ApiError & { status: number } = Object.assign(new Error(message), { status: res.status });
    throw err;
  }

  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

export const api = {
  get: <T>(path: string) => apiFetch<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};
