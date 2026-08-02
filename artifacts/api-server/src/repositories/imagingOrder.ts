/**
 * ImagingOrderRepository — CRUD for the imaging_orders table.
 *
 * Key schema facts (checked against imaging_orders.ts):
 *  - exam: text not null (NOT examName)
 *  - region: text not null
 *  - urgency: urgencyLevelEnum (NOT priority)
 *  - requestedAt: timestamp
 *  - No siteId column
 *  - No deletedBy column
 */
import { eq, and, isNull, desc, count } from "drizzle-orm";
import {
  db as globalDb, imagingOrdersTable, type DbImagingOrder, type InsertImagingOrder,
} from "@workspace/db";
import { type TxContext, type QueryOptions, type PagedResult, paged, qb , safeUuid } from "./types";

export type { DbImagingOrder };

export interface ImagingOrderListOpts extends QueryOptions {
  encounterId?: string;
  patientId?:   string;
  status?:      string;
}

export class ImagingOrderRepository {
  constructor(private readonly db: typeof globalDb = globalDb) {}

  async findById(id: string, ctx?: Pick<TxContext, "tx">): Promise<DbImagingOrder | null> {
    const rows = await qb(this.db, ctx)
      .select().from(imagingOrdersTable)
      .where(and(eq(imagingOrdersTable.id, id), isNull(imagingOrdersTable.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async list(opts: ImagingOrderListOpts = {}): Promise<PagedResult<DbImagingOrder>> {
    const { encounterId, patientId, status, limit = 50, offset = 0, includeDeleted = false } = opts;
    const conditions = [];
    if (!includeDeleted) conditions.push(isNull(imagingOrdersTable.deletedAt));
    if (encounterId) conditions.push(eq(imagingOrdersTable.encounterId, encounterId));
    if (patientId)   conditions.push(eq(imagingOrdersTable.patientId, patientId));
    if (status)      conditions.push(eq(imagingOrdersTable.status, status as any));

    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [{ total }]] = await Promise.all([
      this.db.select().from(imagingOrdersTable).where(where)
        .orderBy(desc(imagingOrdersTable.requestedAt)).limit(limit).offset(offset),
      this.db.select({ total: count() }).from(imagingOrdersTable).where(where),
    ]);
    return paged(rows, Number(total), { limit, offset });
  }

  async create(data: InsertImagingOrder, ctx: TxContext): Promise<DbImagingOrder> {
    const [row] = await qb(this.db, ctx)
      .insert(imagingOrdersTable)
      .values({ ...data, createdBy: safeUuid(ctx.userId), updatedBy: safeUuid(ctx.userId) })
      .returning();
    return row;
  }

  async update(id: string, data: Partial<InsertImagingOrder>, ctx: TxContext): Promise<DbImagingOrder | null> {
    const [row] = await qb(this.db, ctx)
      .update(imagingOrdersTable)
      .set({ ...data, updatedAt: new Date(), updatedBy: safeUuid(ctx.userId) })
      .where(and(eq(imagingOrdersTable.id, id), isNull(imagingOrdersTable.deletedAt)))
      .returning();
    return row ?? null;
  }

  async softDelete(id: string, ctx: TxContext): Promise<boolean> {
    const [row] = await qb(this.db, ctx)
      .update(imagingOrdersTable)
      .set({ deletedAt: new Date(), updatedBy: safeUuid(ctx.userId) })
      .where(and(eq(imagingOrdersTable.id, id), isNull(imagingOrdersTable.deletedAt)))
      .returning({ id: imagingOrdersTable.id });
    return !!row;
  }
}
