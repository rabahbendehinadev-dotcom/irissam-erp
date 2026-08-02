/**
 * PrescriptionRepository — CRUD for the prescriptions table.
 *
 * Key schema facts (checked against prescriptions.ts):
 *  - drug / dosage / route / frequency: text not null (single drug per record)
 *  - prescribedAt: timestamp (NOT orderedAt)
 *  - prescribedById / prescribedByName
 *  - dispensedById / dispensedByName / dispensedAt
 *  - status enum: prescrit | prepare | delivre | annule
 *    ("dispensée" does NOT exist — use "delivre")
 *  - No siteId column
 *  - No deletedBy column
 */
import { eq, and, isNull, desc, count } from "drizzle-orm";
import {
  db as globalDb, prescriptionsTable, type DbPrescription, type InsertPrescription,
} from "@workspace/db";
import { type TxContext, type QueryOptions, type PagedResult, paged, qb } from "./types";

export type { DbPrescription };

export interface PrescriptionListOpts extends QueryOptions {
  encounterId?: string;
  patientId?:   string;
  status?:      string;
}

export class PrescriptionRepository {
  constructor(private readonly db: typeof globalDb = globalDb) {}

  async findById(id: string, ctx?: Pick<TxContext, "tx">): Promise<DbPrescription | null> {
    const rows = await qb(this.db, ctx)
      .select().from(prescriptionsTable)
      .where(and(eq(prescriptionsTable.id, id), isNull(prescriptionsTable.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async list(opts: PrescriptionListOpts = {}): Promise<PagedResult<DbPrescription>> {
    const { encounterId, patientId, status, limit = 50, offset = 0, includeDeleted = false } = opts;
    const conditions = [];
    if (!includeDeleted) conditions.push(isNull(prescriptionsTable.deletedAt));
    if (encounterId) conditions.push(eq(prescriptionsTable.encounterId, encounterId));
    if (patientId)   conditions.push(eq(prescriptionsTable.patientId, patientId));
    if (status)      conditions.push(eq(prescriptionsTable.status, status as any));

    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [{ total }]] = await Promise.all([
      this.db.select().from(prescriptionsTable).where(where)
        .orderBy(desc(prescriptionsTable.prescribedAt)).limit(limit).offset(offset),
      this.db.select({ total: count() }).from(prescriptionsTable).where(where),
    ]);
    return paged(rows, Number(total), { limit, offset });
  }

  async create(data: InsertPrescription, ctx: TxContext): Promise<DbPrescription> {
    const [row] = await qb(this.db, ctx)
      .insert(prescriptionsTable)
      .values({ ...data, createdBy: ctx.userId, updatedBy: ctx.userId })
      .returning();
    return row;
  }

  async update(id: string, data: Partial<InsertPrescription>, ctx: TxContext): Promise<DbPrescription | null> {
    const [row] = await qb(this.db, ctx)
      .update(prescriptionsTable)
      .set({ ...data, updatedAt: new Date(), updatedBy: ctx.userId })
      .where(and(eq(prescriptionsTable.id, id), isNull(prescriptionsTable.deletedAt)))
      .returning();
    return row ?? null;
  }

  /** Mark a prescription as dispensed ("delivre" in the enum). */
  async markDispensed(id: string, ctx: TxContext): Promise<DbPrescription | null> {
    const [row] = await qb(this.db, ctx)
      .update(prescriptionsTable)
      .set({
        status:          "delivre",
        dispensedAt:     new Date(),
        dispensedById:   ctx.userId,
        updatedAt:       new Date(),
        updatedBy:       ctx.userId,
      })
      .where(and(eq(prescriptionsTable.id, id), isNull(prescriptionsTable.deletedAt)))
      .returning();
    return row ?? null;
  }

  async softDelete(id: string, ctx: TxContext): Promise<boolean> {
    const [row] = await qb(this.db, ctx)
      .update(prescriptionsTable)
      .set({ deletedAt: new Date(), updatedBy: ctx.userId })
      .where(and(eq(prescriptionsTable.id, id), isNull(prescriptionsTable.deletedAt)))
      .returning({ id: prescriptionsTable.id });
    return !!row;
  }
}
