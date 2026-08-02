/**
 * AttachmentRepository — generic/polymorphic file attachments.
 */
import { eq, and, isNull, desc, count } from "drizzle-orm";
import {
  db as globalDb, attachmentsTable, type DbAttachment, type InsertAttachment,
} from "@workspace/db";
import { type TxContext, type QueryOptions, type PagedResult, paged, qb } from "./types";

export type { DbAttachment };

export interface AttachmentListOpts extends QueryOptions {
  entityType?: string;
  entityId?:   string;
  module?:     string;
  category?:   string;
  siteId?:     string;
}

export class AttachmentRepository {
  constructor(private readonly db: typeof globalDb = globalDb) {}

  async findById(id: string, ctx?: Pick<TxContext, "tx">): Promise<DbAttachment | null> {
    const rows = await qb(this.db, ctx)
      .select().from(attachmentsTable)
      .where(and(eq(attachmentsTable.id, id), isNull(attachmentsTable.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async listForEntity(
    entityType: string, entityId: string, opts: QueryOptions = {},
  ): Promise<DbAttachment[]> {
    return qb(this.db)
      .select().from(attachmentsTable)
      .where(and(
        eq(attachmentsTable.entityType, entityType as any),
        eq(attachmentsTable.entityId, entityId),
        isNull(attachmentsTable.deletedAt),
      ))
      .orderBy(desc(attachmentsTable.createdAt))
      .limit(opts.limit ?? 50).offset(opts.offset ?? 0);
  }

  async list(opts: AttachmentListOpts = {}): Promise<PagedResult<DbAttachment>> {
    const { entityType, entityId, module, category, siteId, limit = 50, offset = 0 } = opts;
    const conditions = [isNull(attachmentsTable.deletedAt)];
    if (entityType) conditions.push(eq(attachmentsTable.entityType, entityType as any));
    if (entityId)   conditions.push(eq(attachmentsTable.entityId, entityId));
    if (module)     conditions.push(eq(attachmentsTable.module, module as any));
    if (category)   conditions.push(eq(attachmentsTable.category, category as any));
    if (siteId)     conditions.push(eq(attachmentsTable.siteId, siteId));

    const where = and(...conditions);
    const [rows, [{ total }]] = await Promise.all([
      this.db.select().from(attachmentsTable).where(where)
        .orderBy(desc(attachmentsTable.createdAt)).limit(limit).offset(offset),
      this.db.select({ total: count() }).from(attachmentsTable).where(where),
    ]);
    return paged(rows, Number(total), { limit, offset });
  }

  async create(data: InsertAttachment, ctx: TxContext): Promise<DbAttachment> {
    const [row] = await qb(this.db, ctx)
      .insert(attachmentsTable)
      .values({ ...data, createdBy: ctx.userId, createdByName: ctx.userName })
      .returning();
    return row;
  }

  async softDelete(id: string, ctx: TxContext): Promise<boolean> {
    const [row] = await qb(this.db, ctx)
      .update(attachmentsTable)
      .set({ deletedAt: new Date(), deletedBy: ctx.userId })
      .where(and(eq(attachmentsTable.id, id), isNull(attachmentsTable.deletedAt)))
      .returning({ id: attachmentsTable.id });
    return !!row;
  }
}
