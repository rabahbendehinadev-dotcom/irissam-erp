/**
 * MedicationRepository — CRUD + stock management for medications.
 *
 * Key schema facts (checked against medications.ts):
 *  - quantity: integer (NOT stock)
 *  - lowStockThreshold: integer (NOT reorderLevel)
 *  - deletedBy: present ✓
 */
import { eq, and, isNull, desc, count, sql } from "drizzle-orm";
import {
  db as globalDb, medicationsTable, type DbMedication, type InsertMedication,
} from "@workspace/db";
import { type TxContext, type QueryOptions, type PagedResult, paged, qb } from "./types";

export type { DbMedication };

export interface MedicationListOpts extends QueryOptions {
  siteId?:    string;
  category?:  string;
  lowStock?:  boolean;  // quantity <= lowStockThreshold
}

export class MedicationRepository {
  constructor(private readonly db: typeof globalDb = globalDb) {}

  async findById(id: string, ctx?: Pick<TxContext, "tx">): Promise<DbMedication | null> {
    const rows = await qb(this.db, ctx)
      .select().from(medicationsTable)
      .where(and(eq(medicationsTable.id, id), isNull(medicationsTable.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async list(opts: MedicationListOpts = {}): Promise<PagedResult<DbMedication>> {
    const { siteId, category, lowStock, limit = 50, offset = 0, includeDeleted = false } = opts;
    const conditions = [];
    if (!includeDeleted) conditions.push(isNull(medicationsTable.deletedAt));
    if (siteId)   conditions.push(eq(medicationsTable.siteId, siteId));
    if (category) conditions.push(eq(medicationsTable.category, category as any));
    if (lowStock) conditions.push(
      sql`${medicationsTable.quantity} <= ${medicationsTable.lowStockThreshold}`,
    );

    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [{ total }]] = await Promise.all([
      this.db.select().from(medicationsTable).where(where)
        .orderBy(medicationsTable.name).limit(limit).offset(offset),
      this.db.select({ total: count() }).from(medicationsTable).where(where),
    ]);
    return paged(rows, Number(total), { limit, offset });
  }

  async create(data: InsertMedication, ctx: TxContext): Promise<DbMedication> {
    const [row] = await qb(this.db, ctx)
      .insert(medicationsTable)
      .values({ ...data, createdBy: ctx.userId, updatedBy: ctx.userId })
      .returning();
    return row;
  }

  async update(id: string, data: Partial<InsertMedication>, ctx: TxContext): Promise<DbMedication | null> {
    const [row] = await qb(this.db, ctx)
      .update(medicationsTable)
      .set({ ...data, updatedAt: new Date(), updatedBy: ctx.userId })
      .where(and(eq(medicationsTable.id, id), isNull(medicationsTable.deletedAt)))
      .returning();
    return row ?? null;
  }

  /**
   * Atomically decrement quantity. Returns null if insufficient stock.
   * Uses a WHERE clause to ensure quantity >= requested before decrementing.
   */
  async deductStock(id: string, quantity: number, ctx: TxContext): Promise<DbMedication | null> {
    const [row] = await qb(this.db, ctx)
      .update(medicationsTable)
      .set({
        quantity:  sql`${medicationsTable.quantity} - ${quantity}`,
        updatedAt: new Date(),
        updatedBy: ctx.userId,
      })
      .where(and(
        eq(medicationsTable.id, id),
        isNull(medicationsTable.deletedAt),
        sql`${medicationsTable.quantity} >= ${quantity}`,
      ))
      .returning();
    return row ?? null;
  }

  async softDelete(id: string, ctx: TxContext): Promise<boolean> {
    const [row] = await qb(this.db, ctx)
      .update(medicationsTable)
      .set({ deletedAt: new Date(), deletedBy: ctx.userId })
      .where(and(eq(medicationsTable.id, id), isNull(medicationsTable.deletedAt)))
      .returning({ id: medicationsTable.id });
    return !!row;
  }
}
