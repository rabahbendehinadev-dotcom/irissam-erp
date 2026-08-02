import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import type { Session, User } from '@/types';
import { authService } from '@/services/authService';
import { apiClient } from '@/services/api/client';
import { setAuthTokenGetter } from '@workspace/api-client-react';

interface AuthContextType extends Session {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** true when the API was unreachable during auth bootstrap */
  networkError: boolean;
  retryInit: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'irissam_auth_token';
/** Maximum ms to wait for the full auth bootstrap sequence */
const AUTH_INIT_TIMEOUT_MS = 10_000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });
  const [networkError, setNetworkError] = useState(false);

  // Guard against concurrent refresh attempts triggered by 401 interceptor
  const refreshingRef = useRef<Promise<string | null> | null>(null);
  // Increment to re-trigger init (for the Réessayer button)
  const [initKey, setInitKey] = useState(0);

  /** Sync an access token into both the local apiClient and generated API hooks. */
  const applyToken = useCallback((token: string | null) => {
    localStorage.setItem(TOKEN_KEY, token ?? '');
    apiClient.setAuthToken(token);
    setAuthTokenGetter(token ? () => token : null);
  }, []);

  /**
   * Called by apiClient when it receives a 401 from ANY endpoint (except /auth/refresh
   * which uses _skipRefresh:true to avoid this handler).
   * Attempts one silent refresh; returns the new access token or null.
   * Concurrent callers all share the same in-flight promise.
   */
  const handleUnauthorized = useCallback(async (): Promise<string | null> => {
    if (refreshingRef.current) return refreshingRef.current;

    const p = (async () => {
      // authService.refresh() uses _skipRefresh:true — will NOT re-enter this handler
      const result = await authService.refresh();
      if (result?.accessToken) {
        applyToken(result.accessToken);
        setSession({
          user: result.user,
          token: result.accessToken,
          isAuthenticated: true,
          isLoading: false,
        });
        return result.accessToken;
      }
      // Refresh failed — clear session
      applyToken(null);
      setSession({ user: null, token: null, isAuthenticated: false, isLoading: false });
      return null;
    })();

    refreshingRef.current = p;
    p.finally(() => { refreshingRef.current = null; });
    return p;
  }, [applyToken]);

  // Register the refresh handler with the API client on mount
  useEffect(() => {
    apiClient.registerUnauthorizedHandler(handleUnauthorized);
    return () => { apiClient.registerUnauthorizedHandler(null); };
  }, [handleUnauthorized]);

  // Listen for forced logout from the API client (refresh also failed after a 401 retry)
  useEffect(() => {
    const handler = () => {
      applyToken(null);
      setSession({ user: null, token: null, isAuthenticated: false, isLoading: false });
    };
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, [applyToken]);

  // ── Auth bootstrap ──────────────────────────────────────────────────────────
  // On mount (or retry): restore token from localStorage and validate via /auth/me.
  // Guarantees isLoading → false regardless of what happens.
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      console.debug('[AUTH] AUTH_INIT_START');
      setNetworkError(false);

      const stored = localStorage.getItem(TOKEN_KEY)?.trim() || null;
      if (!stored) {
        console.debug('[AUTH] AUTH_INIT_FINISHED: no stored token → login');
        if (!cancelled) {
          applyToken(null);
          setSession({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
        return;
      }

      // Apply the stored token so requests include the Bearer header
      applyToken(stored);

      // Race the entire bootstrap against a 10-second hard timeout
      const timer = new Promise<'timeout'>((resolve) =>
        setTimeout(() => resolve('timeout'), AUTH_INIT_TIMEOUT_MS),
      );

      const bootstrap = (async (): Promise<'ok' | 'unauthenticated' | 'network_error'> => {
        // Step 1 — validate with /auth/me
        const user: User | null = await authService.getMe();
        if (user) {
          console.debug('[AUTH] AUTH_ME_SUCCESS');
          if (!cancelled) {
            setSession({ user, token: stored, isAuthenticated: true, isLoading: false });
          }
          return 'ok';
        }

        // Step 2 — /auth/me failed (401 or 500) → attempt one silent refresh
        console.debug('[AUTH] AUTH_ME_401 → AUTH_REFRESH_START');
        const result = await authService.refresh();
        if (result?.accessToken) {
          console.debug('[AUTH] AUTH_REFRESH_SUCCESS');
          applyToken(result.accessToken);
          if (!cancelled) {
            setSession({
              user: result.user,
              token: result.accessToken,
              isAuthenticated: true,
              isLoading: false,
            });
          }
          return 'ok';
        }

        console.debug('[AUTH] AUTH_REFRESH_FAILED');
        return 'unauthenticated';
      })();

      try {
        const outcome = await Promise.race([bootstrap, timer]);

        if (cancelled) return;

        if (outcome === 'timeout') {
          console.debug('[AUTH] AUTH_INIT_TIMEOUT');
          applyToken(null);
          setNetworkError(true);
          setSession({ user: null, token: null, isAuthenticated: false, isLoading: false });
        } else if (outcome === 'unauthenticated') {
          applyToken(null);
          setSession({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
        // 'ok' was already handled inside bootstrap
      } catch {
        // Unexpected error — fail safe to login
        console.debug('[AUTH] AUTH_INIT_ERROR: unexpected exception');
        if (!cancelled) {
          applyToken(null);
          setNetworkError(true);
          setSession({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
      } finally {
        console.debug('[AUTH] AUTH_INIT_FINISHED');
      }
    };

    // Show loading state while re-initialising (for retry)
    setSession(s => ({ ...s, isLoading: true }));
    run();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initKey]);

  const retryInit = useCallback(() => {
    setNetworkError(false);
    setInitKey(k => k + 1);
  }, []);

  // ── Login / Logout ──────────────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string) => {
    setSession(s => ({ ...s, isLoading: true }));
    try {
      const { user, accessToken } = await authService.login({ email, password });
      applyToken(accessToken);
      setSession({ user, token: accessToken, isAuthenticated: true, isLoading: false });
    } catch (err: unknown) {
      setSession(s => ({ ...s, isLoading: false }));
      const msg = err instanceof Error ? err.message : 'Identifiants invalides.';
      throw new Error(msg);
    }
  }, [applyToken]);

  const logout = useCallback(async () => {
    await authService.logout();
    applyToken(null);
    setSession({ user: null, token: null, isAuthenticated: false, isLoading: false });
  }, [applyToken]);

  return (
    <AuthContext.Provider value={{ ...session, login, logout, networkError, retryInit }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
