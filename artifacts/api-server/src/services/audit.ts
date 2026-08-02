/**
 * AuditService — centralized audit and user activity logging.
 *
 * Two distinct logs:
 *   - audit_logs       → data mutations (created / updated / deleted / status_changed)
 *   - user_activity_logs → UI interactions (login, print, export, view, search…)
 *
 * Services call AuditService.log() / AuditService.logActivity() — they never
 * insert into the log tables directly.
 */
import type { InsertAuditLog, InsertUserActivityLog } from "@workspace/db";
import { repos } from "../repositories";
import type { TxContext, ActorCtx } from "../repositories/types";
import { safeUuid } from "../repositories/types";

// ─── Audit log helper types ───────────────────────────────────────────────────

export interface AuditEntry {
  module:       InsertAuditLog["module"];
  action:       string;                       // "created" | "updated" | "deleted" | custom
  resourceType: string;
  resourceId:   string;
  oldValue?:    Record<string, unknown>;
  newValue?:    Record<string, unknown>;
  patientId?:   string;
  encounterId?: string;
  severity?:    InsertAuditLog["severity"];
  siteId?:      string;
}

export interface ActivityEntry {
  module:          InsertUserActivityLog["module"];
  action:          InsertUserActivityLog["action"];
  resourceType?:   string;
  resourceId?:     string;
  resourceLabel?:  string;
  description?:    string;
  searchQuery?:    string;
  metadata?:       Record<string, unknown>;
  ip?:             string;
  userAgent?:      string;
  sessionId?:      string;
  siteId?:         string;
}

// ─── AuditService ─────────────────────────────────────────────────────────────

export class AuditService {
  /**
   * Append a data-mutation audit entry.
   * Fire-and-forget safe — errors are swallowed so they never crash a request.
   * Pass ctx.tx to include the log in the same transaction as the mutation.
   */
  async log(entry: AuditEntry, actor: ActorCtx, ctx?: Pick<TxContext, "tx">): Promise<void> {
    try {
      await repos.auditLog.append({
        module:       entry.module,
        action:       entry.action,
        resourceType: entry.resourceType,
        resourceId:   entry.resourceId,
        oldValue:     entry.oldValue ?? null,
        newValue:     entry.newValue ?? null,
        patientId:    entry.patientId ?? null,
        encounterId:  entry.encounterId ?? null,
        userId:       safeUuid(actor.userId) ?? null,
        userName:     actor.userName,
        userRole:     actor.userRole,
        severity:     entry.severity ?? "info",
        siteId:       entry.siteId ?? actor.siteId ?? null,
        ip:           null,
      }, ctx);
    } catch (err) {
      // Never crash on audit failure — log to console for observability
      console.error("[AuditService] Failed to write audit log", err);
    }
  }

  /**
   * Append a user-activity log entry (Login, Print, Export, View, Search…).
   * Always fire-and-forget (no transaction — activity logs are independent).
   */
  async logActivity(entry: ActivityEntry, actor: ActorCtx): Promise<void> {
    try {
      await repos.userActivityLog.append({
        module:        entry.module,
        action:        entry.action,
        resourceType:  entry.resourceType ?? null,
        resourceId:    entry.resourceId ?? null,
        resourceLabel: entry.resourceLabel ?? null,
        description:   entry.description ?? null,
        searchQuery:   entry.searchQuery ?? null,
        metadata:      entry.metadata ?? null,
        ip:            entry.ip ?? null,
        userAgent:     entry.userAgent ?? null,
        sessionId:     entry.sessionId ?? null,
        siteId:        entry.siteId ?? actor.siteId ?? null,
        userId:        actor.userId,
        userName:      actor.userName,
        userRole:      actor.userRole,
      });
    } catch (err) {
      console.error("[AuditService] Failed to write activity log", err);
    }
  }
}

export const auditService = new AuditService();
