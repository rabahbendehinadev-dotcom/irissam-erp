/**
 * NotificationRepository — CRUD for the notifications table.
 * Read-tracking uses the readBy UUID[] column (append user UUID on read).
 */
import { eq, and, isNull, desc, count, sql } from "drizzle-orm";
import {
  db as globalDb, notificationsTable,
  type DbNotification, type InsertNotification,
} from "@workspace/db";
import { type TxContext, type QueryOptions, type PagedResult, paged, qb, safeUuid } from "./types";

export type { DbNotification };

export interface NotificationListOpts extends QueryOptions {
  userId?:  string;   // filter: not yet read by this user
  role?:    string;   // filter: forRoles contains this role
  siteId?:  string;
  unreadOnly?: boolean;
}

export class NotificationRepository {
  constructor(private readonly db: typeof globalDb = globalDb) {}

  async findById(id: string): Promise<DbNotification | null> {
    const rows = await this.db.select().from(notificationsTable)
      .where(eq(notificationsTable.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async list(opts: NotificationListOpts = {}): Promise<PagedResult<DbNotification>> {
    const { siteId, limit = 50, offset = 0 } = opts;
    const conditions: any[] = [eq(notificationsTable.isDismissed, false)];
    if (siteId) conditions.push(eq(notificationsTable.siteId, siteId));
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [{ total }]] = await Promise.all([
      this.db.select().from(notificationsTable).where(where)
        .orderBy(desc(notificationsTable.createdAt)).limit(limit).offset(offset),
      this.db.select({ total: count() }).from(notificationsTable).where(where),
    ]);
    return paged(rows, Number(total), { limit, offset });
  }

  async create(data: Omit<InsertNotification, "createdBy">, ctx?: TxContext): Promise<DbNotification> {
    const db = ctx ? qb(this.db, ctx) : this.db;
    const [row] = await (db as any)
      .insert(notificationsTable)
      .values({ ...data, createdBy: ctx ? safeUuid(ctx.userId) : null })
      .returning();
    return row;
  }

  /** Mark a notification as read by a user (append userId to readBy array). */
  async markRead(id: string, userId: string): Promise<DbNotification | null> {
    const safeId = safeUuid(userId);
    if (!safeId) return null;
    const [row] = await this.db
      .update(notificationsTable)
      .set({
        readBy: sql`array_append(COALESCE(read_by, ARRAY[]::uuid[]), ${safeId}::uuid)`,
      })
      .where(eq(notificationsTable.id, id))
      .returning();
    return row ?? null;
  }

  /** Mark all notifications as read by a user. */
  async markAllRead(userId: string): Promise<number> {
    const safeId = safeUuid(userId);
    if (!safeId) return 0;
    const rows = await this.db
      .update(notificationsTable)
      .set({
        readBy: sql`array_append(COALESCE(read_by, ARRAY[]::uuid[]), ${safeId}::uuid)`,
      })
      .where(eq(notificationsTable.isDismissed, false))
      .returning({ id: notificationsTable.id });
    return rows.length;
  }

  async dismiss(id: string): Promise<void> {
    await this.db.update(notificationsTable)
      .set({ isDismissed: true })
      .where(eq(notificationsTable.id, id));
  }
}
