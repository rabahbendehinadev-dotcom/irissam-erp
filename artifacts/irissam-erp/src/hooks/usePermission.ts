import { useAuth } from '@/store/AuthContext';
import { hasPermission, hasAllPermissions, hasAnyPermission } from '@/utils/permissions';
import type { Permission } from '@/config/permissions';

/**
 * Returns helpers to check the current user's granular permissions.
 *
 * Priority: user.permissions[] from the RBAC API (embedded in JWT + refreshed by /auth/me).
 * Fallback: static ROLE_PERMISSIONS map (for users whose token predates the RBAC migration).
 */
export function usePermission() {
  const { user } = useAuth();
  const role = user?.role ?? null;

  // Prefer real permissions from the API; fall back to the static role map
  const hasApiPermissions = Array.isArray(user?.permissions) && user.permissions.length > 0;

  return {
    can: (permission: Permission): boolean => {
      if (hasApiPermissions) return user!.permissions.includes(permission);
      return hasPermission(role, permission);
    },
    canAll: (permissions: Permission[]): boolean => {
      if (hasApiPermissions) return permissions.every(p => user!.permissions.includes(p));
      return hasAllPermissions(role, permissions);
    },
    canAny: (permissions: Permission[]): boolean => {
      if (hasApiPermissions) return permissions.some(p => user!.permissions.includes(p));
      return hasAnyPermission(role, permissions);
    },
    role,
    permissions: user?.permissions ?? [],
  };
}
