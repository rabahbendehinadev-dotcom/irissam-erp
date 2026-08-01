import { useAuth } from '@/store/AuthContext';
import { auditService, type AuditAction } from '@/services/auditService';

export function useAuditLog() {
  const { user } = useAuth();

  const log = async (action: AuditAction, resource: string, resourceId?: string, description?: string) => {
    if (!user) return;
    await auditService.log({
      userId: user.id,
      userRole: user.role,
      action,
      resource,
      resourceId,
      description: description ?? `${action} ${resource}${resourceId ? ' #' + resourceId : ''}`,
      siteId: user.siteId,
    });
  };

  return { log };
}
