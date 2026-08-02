import type { User } from '@/types';
import { apiClient } from '@/services/api/client';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthServiceInterface {
  login(credentials: LoginCredentials): Promise<{ user: User; accessToken: string }>;
  logout(): Promise<void>;
  refresh(): Promise<{ user: User; accessToken: string } | null>;
  getMe(): Promise<User | null>;
  changePassword(current: string, next: string): Promise<void>;
}

export const authService: AuthServiceInterface = {
  async login(credentials) {
    const data = await apiClient.post<{ user: User; accessToken: string }>(
      '/auth/login',
      credentials,
    );
    return data;
  },

  async logout() {
    try {
      // Server revokes the HttpOnly refresh-token cookie
      await apiClient.post('/auth/logout', {});
    } catch {
      // Best-effort — still clear the client-side session
    }
  },

  async refresh() {
    try {
      // _skipRefresh:true prevents the 401 interceptor from calling refresh recursively
      // (which would deadlock: the in-flight promise waiting on itself)
      const data = await apiClient.post<{ user: User; accessToken: string }>(
        '/auth/refresh',
        {},
        { _skipRefresh: true },
      );
      return data;
    } catch {
      return null;
    }
  },

  async getMe() {
    try {
      const data = await apiClient.get<{ user: User }>('/auth/me');
      return data.user ?? null;
    } catch {
      return null;
    }
  },

  async changePassword(currentPassword, newPassword) {
    await apiClient.post('/auth/change-password', { currentPassword, newPassword });
  },
};
