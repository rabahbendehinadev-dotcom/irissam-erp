/**
 * Authentication service stub.
 * Wire to real backend when auth module is built.
 */
import type { User, Session } from '@/types';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthServiceInterface {
  login(credentials: LoginCredentials): Promise<{ user: User; token: string }>;
  logout(): Promise<void>;
  getMe(): Promise<User | null>;
  refreshToken(): Promise<string | null>;
}

// Mock admin user for development
export const MOCK_ADMIN_USER: User = {
  id: 'user-1',
  firstName: 'Hachichi',
  lastName: 'Admin',
  email: 'admin@irissam.dz',
  role: 'administrateur',
  siteId: 'site-1',
  isActive: true,
  lastLogin: new Date(),
};

export const authService: AuthServiceInterface = {
  async login(_credentials: LoginCredentials) {
    // Stub — replace with real API call
    return { user: MOCK_ADMIN_USER, token: 'mock-token' };
  },

  async logout() {
    // Stub — replace with real API call
  },

  async getMe() {
    // Stub — returns mock admin user
    return MOCK_ADMIN_USER;
  },

  async refreshToken() {
    // Stub
    return 'mock-token';
  },
};
