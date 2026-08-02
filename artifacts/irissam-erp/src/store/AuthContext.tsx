import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Session, User } from '@/types';
import { authService } from '@/services/authService';
import { apiClient } from '@/services/api/client';
import { setAuthTokenGetter } from '@workspace/api-client-react';

interface AuthContextType extends Session {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'irissam_auth_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Guard against concurrent refresh attempts
  const refreshingRef = useRef<Promise<string | null> | null>(null);

  /** Sync an access token into both the local apiClient and generated API hooks. */
  const applyToken = useCallback((token: string | null) => {
    localStorage.setItem(TOKEN_KEY, token ?? '');
    apiClient.setAuthToken(token);
    setAuthTokenGetter(token ? () => token : null);
  }, []);

  /**
   * Called by apiClient when it receives a 401.
   * Attempts one silent refresh; returns the new access token or null.
   * Concurrent callers all share the same in-flight promise.
   */
  const handleUnauthorized = useCallback(async (): Promise<string | null> => {
    if (refreshingRef.current) return refreshingRef.current;

    const p = (async () => {
      const result = await authService.refresh();
      if (result?.accessToken) {
        applyToken(result.accessToken);
        setSession({ user: result.user, token: result.accessToken, isAuthenticated: true, isLoading: false });
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

  // Listen for forced logout from the API client (refresh also failed)
  useEffect(() => {
    const handler = () => {
      applyToken(null);
      setSession({ user: null, token: null, isAuthenticated: false, isLoading: false });
    };
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, [applyToken]);

  // On mount: restore token from localStorage and validate via /auth/me
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      applyToken(null);
      setSession({ user: null, token: null, isAuthenticated: false, isLoading: false });
      return;
    }

    applyToken(stored);
    authService
      .getMe()
      .then((user: User | null) => {
        if (user) {
          setSession({ user, token: stored, isAuthenticated: true, isLoading: false });
        } else {
          // Token stale — try a silent refresh
          authService.refresh().then((result) => {
            if (result?.accessToken) {
              applyToken(result.accessToken);
              setSession({ user: result.user, token: result.accessToken, isAuthenticated: true, isLoading: false });
            } else {
              applyToken(null);
              setSession({ user: null, token: null, isAuthenticated: false, isLoading: false });
            }
          });
        }
      })
      .catch(() => {
        // /auth/me failed — try refresh before giving up
        authService.refresh().then((result) => {
          if (result?.accessToken) {
            applyToken(result.accessToken);
            setSession({ user: result.user, token: result.accessToken, isAuthenticated: true, isLoading: false });
          } else {
            applyToken(null);
            setSession({ user: null, token: null, isAuthenticated: false, isLoading: false });
          }
        });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <AuthContext.Provider value={{ ...session, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
