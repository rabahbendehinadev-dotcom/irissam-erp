/**
 * UserActivityLogRepository — append-only user interaction log.
 * Covers Login, Logout, Print, Export, Download, Search, View, etc.
 * No updates, no deletes. Immutable.
 */
import { eq, and, desc, count, gte, lte } from "drizzle-orm";
import {
  db as globalDb, userActivityLogsTable, type DbUserActivityLog, type InsertUserActivityLog,
} from "@workspace/db";
import { type TxContext, type QueryOptions, type PagedResult, paged, qb } from "./types";

export type { DbUserActivityLog };

export interface ActivityLogListOpts extends QueryOptions {
  userId?:      string;
  action?:      string;
  module?:      string;
  resourceType?: string;
  resourceId?:  string;
  sessionId?:   string;
  siteId?:      string;
  fromDate?:    Date;
  toDate?:      Date;
}

export class UserActivityLogRepository {
  constructor(private readonly db: typeof globalDb = globalDb) {}

  async list(opts: ActivityLogListOpts = {}): Promise<PagedResult<DbUserActivityLog>> {
    const { userId, action, module, resourceType, resourceId, sessionId, siteId,
            fromDate, toDate, limit = 100, offset = 0 } = opts;
    const conditions = [];
    if (userId)       conditions.push(eq(userActivityLogsTable.userId, userId));
    if (action)       conditions.push(eq(userActivityLogsTable.action, action as any));
    if (module)       conditions.push(eq(userActivityLogsTable.module, module as any));
    if (resourceType) conditions.push(eq(userActivityLogsTable.resourceType, resourceType));
    if (resourceId)   conditions.push(eq(userActivityLogsTable.resourceId, resourceId));
    if (sessionId)    conditions.push(eq(userActivityLogsTable.sessionId, sessionId));
    if (siteId)       conditions.push(eq(userActivityLogsTable.siteId, siteId));
    if (fromDate)     conditions.push(gte(userActivityLogsTable.timestamp, fromDate));
    if (toDate)       conditions.push(lte(userActivityLogsTable.timestamp, toDate));

    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [{ total }]] = await Promise.all([
      this.db.select().from(userActivityLogsTable).where(where)
        .orderBy(desc(userActivityLogsTable.timestamp)).limit(limit).offset(offset),
      this.db.select({ total: count() }).from(userActivityLogsTable).where(where),
    ]);
    return paged(rows, Number(total), { limit, offset });
  }

  async append(data: InsertUserActivityLog, ctx?: Pick<TxContext, "tx">): Promise<DbUserActivityLog> {
    const [row] = await qb(this.db, ctx)
      .insert(userActivityLogsTable)
      .values(data)
      .returning();
    return row;
  }
}
