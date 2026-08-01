import { createContext, useContext, useState, useEffect } from 'react';
import type { Session } from '@/types';
import { authService, MOCK_ADMIN_USER } from '@/services/authService';

interface AuthContextType extends Session {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>({
    user: MOCK_ADMIN_USER, // Use mock user until auth module is built
    token: 'mock-token',
    isAuthenticated: true,
    isLoading: false,
  });

  useEffect(() => {
    // TODO: check stored token and fetch user when auth is implemented
  }, []);

  const login = async (email: string, password: string) => {
    setSession(s => ({ ...s, isLoading: true }));
    try {
      const { user, token } = await authService.login({ email, password });
      setSession({ user, token, isAuthenticated: true, isLoading: false });
    } catch {
      setSession(s => ({ ...s, isLoading: false }));
      throw new Error('Login failed');
    }
  };

  const logout = () => {
    setSession({ user: null, token: null, isAuthenticated: false, isLoading: false });
  };

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
