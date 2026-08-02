/**
 * ConsultationRepository — CRUD for the consultations table.
 *
 * Key schema facts (checked against consultations.ts):
 *  - number: text not null (CONS-2026-001) — generated externally
 *  - startedAt / endedAt / scheduledAt: timestamps
 *  - siteId: present ✓
 *  - No deletedBy column
 */
import { eq, and, isNull, desc, count } from "drizzle-orm";
import {
  db as globalDb, consultationsTable, type DbConsultation, type InsertConsultation,
} from "@workspace/db";
import { type TxContext, type QueryOptions, type PagedResult, paged, qb } from "./types";

export type { DbConsultation };

export interface ConsultationListOpts extends QueryOptions {
  encounterId?: string;
  patientId?:   string;
  doctorId?:    string;
  status?:      string;
  siteId?:      string;
}

export class ConsultationRepository {
  constructor(private readonly db: typeof globalDb = globalDb) {}

  async findById(id: string, ctx?: Pick<TxContext, "tx">): Promise<DbConsultation | null> {
    const rows = await qb(this.db, ctx)
      .select().from(consultationsTable)
      .where(and(eq(consultationsTable.id, id), isNull(consultationsTable.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async list(opts: ConsultationListOpts = {}): Promise<PagedResult<DbConsultation>> {
    const { encounterId, patientId, doctorId, status, siteId, limit = 50, offset = 0, includeDeleted = false } = opts;
    const conditions = [];
    if (!includeDeleted) conditions.push(isNull(consultationsTable.deletedAt));
    if (encounterId) conditions.push(eq(consultationsTable.encounterId, encounterId));
    if (patientId)   conditions.push(eq(consultationsTable.patientId, patientId));
    if (doctorId)    conditions.push(eq(consultationsTable.doctorId, doctorId));
    if (status)      conditions.push(eq(consultationsTable.status, status as any));
    if (siteId)      conditions.push(eq(consultationsTable.siteId, siteId));

    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [{ total }]] = await Promise.all([
      this.db.select().from(consultationsTable).where(where)
        .orderBy(desc(consultationsTable.startedAt)).limit(limit).offset(offset),
      this.db.select({ total: count() }).from(consultationsTable).where(where),
    ]);
    return paged(rows, Number(total), { limit, offset });
  }

  async create(data: InsertConsultation, ctx: TxContext): Promise<DbConsultation> {
    const [row] = await qb(this.db, ctx)
      .insert(consultationsTable)
      .values({ ...data, createdBy: ctx.userId, updatedBy: ctx.userId })
      .returning();
    return row;
  }

  async update(id: string, data: Partial<InsertConsultation>, ctx: TxContext): Promise<DbConsultation | null> {
    const [row] = await qb(this.db, ctx)
      .update(consultationsTable)
      .set({ ...data, updatedAt: new Date(), updatedBy: ctx.userId })
      .where(and(eq(consultationsTable.id, id), isNull(consultationsTable.deletedAt)))
      .returning();
    return row ?? null;
  }

  async softDelete(id: string, ctx: TxContext): Promise<boolean> {
    const [row] = await qb(this.db, ctx)
      .update(consultationsTable)
      .set({ deletedAt: new Date(), updatedBy: ctx.userId })
      .where(and(eq(consultationsTable.id, id), isNull(consultationsTable.deletedAt)))
      .returning({ id: consultationsTable.id });
    return !!row;
  }
}
