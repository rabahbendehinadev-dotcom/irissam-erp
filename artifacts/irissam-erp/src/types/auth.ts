import type { Permission } from '@/config/permissions';

export type UserRole =
  | 'super_admin'
  | 'administrateur'
  | 'directeur'
  | 'medecin'
  | 'infirmier'
  | 'reception'
  | 'laboratoire'
  | 'radiologie'
  | 'pharmacie'
  | 'finance'
  | 'rh'
  // Legacy DB enum values (backward compat during migration)
  | 'administrator'
  | 'director'
  | 'doctor'
  | 'nurse'
  | 'pharmacist'
  | 'laboratory'
  | 'radiology';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  /** Granular permission keys returned by /auth/me from the RBAC tables. */
  permissions: Permission[];
  avatar?: string;
  departmentId?: string;
  siteId?: string;
  isActive: boolean;
  language?: string;
  forcePasswordChange?: boolean;
  mfaEnabled?: boolean;
  lastLogin?: Date;
}

export interface Session {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
