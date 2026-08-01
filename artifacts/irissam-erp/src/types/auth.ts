export type UserRole =
  | 'administrateur'
  | 'directeur'
  | 'medecin'
  | 'infirmier'
  | 'reception'
  | 'laboratoire'
  | 'radiologie'
  | 'pharmacie'
  | 'finance'
  | 'rh';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  avatar?: string;
  departmentId?: string;
  siteId?: string;
  isActive: boolean;
  lastLogin?: Date;
}

export interface Session {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
