import type { User } from '@/types';
import { apiClient } from '@/services/api/client';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthServiceInterface {
  login(credentials: LoginCredentials): Promise<{ user: User; token: string }>;
  logout(): Promise<void>;
  getMe(): Promise<User | null>;
}

export const authService: AuthServiceInterface = {
  async login(credentials: LoginCredentials) {
    const data = await apiClient.post<{ user: User; token: string }>(
      '/auth/login',
      credentials,
    );
    return data;
  },

  async logout() {
    // Stateless JWT — nothing to call server-side
  },

  async getMe() {
    try {
      const data = await apiClient.get<{ user: User }>('/auth/me');
      return data.user ?? null;
    } catch {
      return null;
    }
  },
};
