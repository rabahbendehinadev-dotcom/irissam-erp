import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Session, User } from '@/types';
import { authService } from '@/services/authService';
import { apiClient } from '@/services/api/client';
import { setAuthTokenGetter } from '@workspace/api-client-react';

interface AuthContextType extends Session {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
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

  /** Sync a token into both fetch pipelines (local apiClient + generated hooks). */
  const applyToken = useCallback((token: string | null) => {
    apiClient.setAuthToken(token);
    setAuthTokenGetter(token ? () => token : null);
  }, []);

  // On mount: restore token from localStorage and validate it
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
          localStorage.removeItem(TOKEN_KEY);
          applyToken(null);
          setSession({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        applyToken(null);
        setSession({ user: null, token: null, isAuthenticated: false, isLoading: false });
      });
  }, [applyToken]);

  const login = useCallback(async (email: string, password: string) => {
    setSession(s => ({ ...s, isLoading: true }));
    try {
      const { user, token } = await authService.login({ email, password });
      localStorage.setItem(TOKEN_KEY, token);
      applyToken(token);
      setSession({ user, token, isAuthenticated: true, isLoading: false });
    } catch (err: unknown) {
      setSession(s => ({ ...s, isLoading: false }));
      const msg = err instanceof Error ? err.message : 'Identifiants invalides.';
      throw new Error(msg);
    }
  }, [applyToken]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
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
