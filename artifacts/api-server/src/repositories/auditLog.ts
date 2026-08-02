/**
 * AuditLogRepository — append-only audit trail.
 * No updates, no soft-delete. Logs are immutable.
 */
import { eq, and, desc, count, gte, lte } from "drizzle-orm";
import {
  db as globalDb, auditLogsTable, type DbAuditLog, type InsertAuditLog,
} from "@workspace/db";
import { type TxContext, type QueryOptions, type PagedResult, paged, qb } from "./types";

export type { DbAuditLog };

export interface AuditLogListOpts extends QueryOptions {
  patientId?:   string;
  encounterId?: string;
  userId?:      string;
  module?:      string;
  severity?:    string;
  fromDate?:    Date;
  toDate?:      Date;
  siteId?:      string;
}

export class AuditLogRepository {
  constructor(private readonly db: typeof globalDb = globalDb) {}

  async list(opts: AuditLogListOpts = {}): Promise<PagedResult<DbAuditLog>> {
    const { patientId, encounterId, userId, module, severity, fromDate, toDate, siteId,
            limit = 100, offset = 0 } = opts;
    const conditions = [];
    if (patientId)   conditions.push(eq(auditLogsTable.patientId, patientId));
    if (encounterId) conditions.push(eq(auditLogsTable.encounterId, encounterId));
    if (userId)      conditions.push(eq(auditLogsTable.userId, userId));
    if (module)      conditions.push(eq(auditLogsTable.module, module as any));
    if (severity)    conditions.push(eq(auditLogsTable.severity, severity as any));
    if (siteId)      conditions.push(eq(auditLogsTable.siteId, siteId));
    if (fromDate)    conditions.push(gte(auditLogsTable.timestamp, fromDate));
    if (toDate)      conditions.push(lte(auditLogsTable.timestamp, toDate));

    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [{ total }]] = await Promise.all([
      this.db.select().from(auditLogsTable).where(where)
        .orderBy(desc(auditLogsTable.timestamp)).limit(limit).offset(offset),
      this.db.select({ total: count() }).from(auditLogsTable).where(where),
    ]);
    return paged(rows, Number(total), { limit, offset });
  }

  /** Append a single audit entry. Always runs in its own implicit transaction. */
  async append(data: InsertAuditLog, ctx?: Pick<TxContext, "tx">): Promise<DbAuditLog> {
    const [row] = await qb(this.db, ctx)
      .insert(auditLogsTable)
      .values(data)
      .returning();
    return row;
  }
}
