/**
 * LabOrderRepository — CRUD for the lab_orders table.
 *
 * Key schema facts (checked against lab_orders.ts):
 *  - test: text not null (NOT testName)
 *  - category: text not null
 *  - urgency: urgencyLevelEnum (NOT priority)
 *  - requestedAt: timestamp (NOT orderedAt)
 *  - requestedById / requestedByName: who ordered
 *  - No siteId column
 *  - No deletedBy column
 *
 * Business rule (Task #64): test name emptiness is enforced in ClinicalOrderService.
 */
import { eq, and, isNull, desc, count } from "drizzle-orm";
import {
  db as globalDb, labOrdersTable, type DbLabOrder, type InsertLabOrder,
} from "@workspace/db";
import { type TxContext, type QueryOptions, type PagedResult, paged, qb } from "./types";

export type { DbLabOrder };

export interface LabOrderListOpts extends QueryOptions {
  encounterId?: string;
  patientId?:   string;
  status?:      string;
}

export class LabOrderRepository {
  constructor(private readonly db: typeof globalDb = globalDb) {}

  async findById(id: string, ctx?: Pick<TxContext, "tx">): Promise<DbLabOrder | null> {
    const rows = await qb(this.db, ctx)
      .select().from(labOrdersTable)
      .where(and(eq(labOrdersTable.id, id), isNull(labOrdersTable.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async list(opts: LabOrderListOpts = {}): Promise<PagedResult<DbLabOrder>> {
    const { encounterId, patientId, status, limit = 50, offset = 0, includeDeleted = false } = opts;
    const conditions = [];
    if (!includeDeleted) conditions.push(isNull(labOrdersTable.deletedAt));
    if (encounterId) conditions.push(eq(labOrdersTable.encounterId, encounterId));
    if (patientId)   conditions.push(eq(labOrdersTable.patientId, patientId));
    if (status)      conditions.push(eq(labOrdersTable.status, status as any));

    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [{ total }]] = await Promise.all([
      this.db.select().from(labOrdersTable).where(where)
        .orderBy(desc(labOrdersTable.requestedAt)).limit(limit).offset(offset),
      this.db.select({ total: count() }).from(labOrdersTable).where(where),
    ]);
    return paged(rows, Number(total), { limit, offset });
  }

  async create(data: InsertLabOrder, ctx: TxContext): Promise<DbLabOrder> {
    const [row] = await qb(this.db, ctx)
      .insert(labOrdersTable)
      .values({ ...data, createdBy: ctx.userId, updatedBy: ctx.userId })
      .returning();
    return row;
  }

  async update(id: string, data: Partial<InsertLabOrder>, ctx: TxContext): Promise<DbLabOrder | null> {
    const [row] = await qb(this.db, ctx)
      .update(labOrdersTable)
      .set({ ...data, updatedAt: new Date(), updatedBy: ctx.userId })
      .where(and(eq(labOrdersTable.id, id), isNull(labOrdersTable.deletedAt)))
      .returning();
    return row ?? null;
  }

  async updateStatus(id: string, status: string, ctx: TxContext): Promise<DbLabOrder | null> {
    const [row] = await qb(this.db, ctx)
      .update(labOrdersTable)
      .set({ status: status as any, updatedAt: new Date(), updatedBy: ctx.userId })
      .where(and(eq(labOrdersTable.id, id), isNull(labOrdersTable.deletedAt)))
      .returning();
    return row ?? null;
  }

  async softDelete(id: string, ctx: TxContext): Promise<boolean> {
    const [row] = await qb(this.db, ctx)
      .update(labOrdersTable)
      .set({ deletedAt: new Date(), updatedBy: ctx.userId })
      .where(and(eq(labOrdersTable.id, id), isNull(labOrdersTable.deletedAt)))
      .returning({ id: labOrdersTable.id });
    return !!row;
  }
}
