import { useAuth } from '@/store/AuthContext';
import { hasPermission, hasAllPermissions, hasAnyPermission } from '@/utils/permissions';
import type { Permission } from '@/config/permissions';

export function usePermission() {
  const { user } = useAuth();
  const role = user?.role ?? null;

  return {
    can: (permission: Permission) => hasPermission(role, permission),
    canAll: (permissions: Permission[]) => hasAllPermissions(role, permissions),
    canAny: (permissions: Permission[]) => hasAnyPermission(role, permissions),
    role,
  };
}
