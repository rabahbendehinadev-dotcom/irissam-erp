/**
 * Audit log service stub.
 * Will log all create/update/delete actions with user + timestamp.
 */
import type { UserRole } from '@/types';

export type AuditAction =
  | 'create' | 'update' | 'delete' | 'view'
  | 'login' | 'logout'
  | 'export' | 'import' | 'print'
  | 'approve' | 'reject'
  | 'archive' | 'restore'
  | 'view_audit' | 'view_sensitive'
  | 'override_duplicate';

export interface AuditEntry {
  id: string;
  userId: string;
  userRole: UserRole;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  description: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  timestamp: string;
  siteId?: string;
}

export const auditService = {
  /** Log an action (stub) */
  async log(_entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void> {
    // TODO: implement when audit module is built
    // Will POST to /api/audit
  },

  /** Retrieve audit log (stub) */
  async getLog(_filters?: {
    userId?: string;
    action?: AuditAction;
    resource?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<AuditEntry[]> {
    // TODO: implement when audit module is built
    return [];
  },
};
