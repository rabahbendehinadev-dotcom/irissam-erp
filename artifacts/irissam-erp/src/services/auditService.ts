/**
 * Audit log service — sends entries to the API server.
 *
 * Security contract:
 *  - The API server extracts userId and IP from the JWT session + HTTP headers.
 *  - The frontend only sends action, module, and clinical context.
 *  - If the audit POST fails, it logs the error silently without breaking the caller.
 */
import type { UserRole } from '@/types';
import { apiClient } from '@/services/api/client';

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

export interface AuditLogPayload {
  action: string;
  module: string;
  patientId?: string;
  encounterId?: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
}

export const auditService = {
  /**
   * Log an action — POSTs to /api/audit-logs.
   * userId and IP are taken server-side from the JWT session + request headers.
   * Never throws — failures are logged to console only.
   */
  async log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void> {
    try {
      await apiClient.post<{ ok: boolean }>('/audit-logs', {
        action:     entry.action,
        module:     entry.resource,
        entityId:   entry.resourceId,
        metadata:   entry.metadata,
        newValue:   { description: entry.description, siteId: entry.siteId },
      } satisfies AuditLogPayload);
    } catch (err) {
      console.warn('[auditService] log failed (non-blocking):', err);
    }
  },

  /**
   * Log a structured clinical audit entry with encounterId and patientId.
   * Preferred over `log()` for clinical operations.
   */
  async logClinical(payload: AuditLogPayload): Promise<void> {
    try {
      await apiClient.post<{ ok: boolean }>('/audit-logs', payload);
    } catch (err) {
      console.warn('[auditService] logClinical failed (non-blocking):', err);
    }
  },

  /** Retrieve audit log entries from the API. */
  async getLog(filters?: {
    patientId?: string;
    action?: string;
    module?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<AuditEntry[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.patientId) params.set('patientId', filters.patientId);
      if (filters?.action)    params.set('action',    filters.action);
      if (filters?.module)    params.set('module',    filters.module);
      if (filters?.dateFrom)  params.set('dateFrom',  filters.dateFrom);
      if (filters?.dateTo)    params.set('dateTo',    filters.dateTo);
      const qs = params.toString() ? `?${params.toString()}` : '';
      return await apiClient.get<AuditEntry[]>(`/audit-logs${qs}`);
    } catch (err) {
      console.warn('[auditService] getLog failed:', err);
      return [];
    }
  },
};
