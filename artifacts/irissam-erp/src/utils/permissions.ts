import { ROLE_PERMISSIONS, type Permission } from '@/config/permissions';
import type { UserRole } from '@/types';

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Check if a role has ALL of the given permissions
 */
export function hasAllPermissions(role: UserRole | null | undefined, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(role, p));
}

/**
 * Check if a role has ANY of the given permissions
 */
export function hasAnyPermission(role: UserRole | null | undefined, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p));
}
