/**
 * IcuAdmissionRepository — CRUD for icu_admissions + icu_beds lifecycle.
 * Status enum: demande | accepte | en_cours | transfere | sorti
 * ICU bed status: disponible | occupe | reserve | nettoyage | hors_service
 */
import { eq, and, isNull, desc, count } from "drizzle-orm";
import {
  db as globalDb,
  icuAdmissionsTable, icuBedsTable,
  type DbIcuAdmission, type InsertIcuAdmission,
  type DbIcuBed,
} from "@workspace/db";
import { type TxContext, type QueryOptions, type PagedResult, paged, qb, safeUuid } from "./types";

export type { DbIcuAdmission, DbIcuBed };

export interface IcuAdmissionListOpts extends QueryOptions {
  patientId?:  string;
  encounterId?: string;
  status?:     string;
}

export class IcuAdmissionRepository {
  constructor(private readonly db: typeof globalDb = globalDb) {}

  // ── ICU Beds ──────────────────────────────────────────────────────────────────

  async listBeds(ctx?: Pick<TxContext, "tx">): Promise<DbIcuBed[]> {
    return qb(this.db, ctx).select().from(icuBedsTable)
      .where(isNull(icuBedsTable.deletedAt))
      .orderBy(icuBedsTable.number);
  }

  async findAvailableBed(ctx?: Pick<TxContext, "tx">): Promise<DbIcuBed | null> {
    const rows = await qb(this.db, ctx)
      .select().from(icuBedsTable)
      .where(and(eq(icuBedsTable.status, "disponible"), isNull(icuBedsTable.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async findBedById(bedId: string, ctx?: Pick<TxContext, "tx">): Promise<DbIcuBed | null> {
    const rows = await qb(this.db, ctx)
      .select().from(icuBedsTable)
      .where(and(eq(icuBedsTable.id, bedId), isNull(icuBedsTable.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Occupy an ICU bed — only succeeds if status === 'disponible'. */
  async occupyBed(
    bedId: string,
    payload: { patientId: string; patientName: string; encounterId: string; icuAdmissionId: string; priority?: string },
    ctx: TxContext,
  ): Promise<DbIcuBed | null> {
    const [row] = await qb(this.db, ctx)
      .update(icuBedsTable)
      .set({
        status:         "occupe",
        patientId:      payload.patientId,
        patientName:    payload.patientName,
        encounterId:    payload.encounterId,
        icuAdmissionId: payload.icuAdmissionId,
        priority:       payload.priority ?? null,
        occupiedAt:     new Date(),
        updatedAt:      new Date(),
        updatedBy:      safeUuid(ctx.userId),
      })
      .where(and(eq(icuBedsTable.id, bedId), eq(icuBedsTable.status, "disponible")))
      .returning();
    return row ?? null;
  }

  /** Free an ICU bed on discharge/transfer. */
  async freeBed(bedId: string, ctx: TxContext): Promise<void> {
    await qb(this.db, ctx)
      .update(icuBedsTable)
      .set({
        status:         "disponible",
        patientId:      null,
        patientName:    null,
        encounterId:    null,
        icuAdmissionId: null,
        priority:       null,
        occupiedAt:     null,
        updatedAt:      new Date(),
        updatedBy:      safeUuid(ctx.userId),
      })
      .where(eq(icuBedsTable.id, bedId));
  }

  // ── ICU Admissions ────────────────────────────────────────────────────────────

  async findById(id: string, ctx?: Pick<TxContext, "tx">): Promise<DbIcuAdmission | null> {
    const rows = await qb(this.db, ctx)
      .select().from(icuAdmissionsTable)
      .where(and(eq(icuAdmissionsTable.id, id), isNull(icuAdmissionsTable.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async list(opts: IcuAdmissionListOpts = {}): Promise<PagedResult<DbIcuAdmission>> {
    const { patientId, encounterId, status, limit = 100, offset = 0, includeDeleted = false } = opts;
    const conditions: any[] = [];
    if (!includeDeleted) conditions.push(isNull(icuAdmissionsTable.deletedAt));
    if (patientId)   conditions.push(eq(icuAdmissionsTable.patientId, patientId));
    if (encounterId) conditions.push(eq(icuAdmissionsTable.encounterId, encounterId));
    if (status)      conditions.push(eq(icuAdmissionsTable.status, status as any));
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [{ total }]] = await Promise.all([
      this.db.select().from(icuAdmissionsTable).where(where)
        .orderBy(desc(icuAdmissionsTable.createdAt)).limit(limit).offset(offset),
      this.db.select({ total: count() }).from(icuAdmissionsTable).where(where),
    ]);
    return paged(rows, Number(total), { limit, offset });
  }

  async create(data: Omit<InsertIcuAdmission, "createdBy" | "updatedBy">, ctx: TxContext): Promise<DbIcuAdmission> {
    const [row] = await qb(this.db, ctx)
      .insert(icuAdmissionsTable)
      .values({ ...data, createdBy: safeUuid(ctx.userId), updatedBy: safeUuid(ctx.userId) })
      .returning();
    return row;
  }

  async updateStatus(id: string, status: string, ctx: TxContext): Promise<DbIcuAdmission | null> {
    const [row] = await qb(this.db, ctx)
      .update(icuAdmissionsTable)
      .set({ status: status as any, updatedAt: new Date(), updatedBy: safeUuid(ctx.userId) })
      .where(and(eq(icuAdmissionsTable.id, id), isNull(icuAdmissionsTable.deletedAt)))
      .returning();
    return row ?? null;
  }

  async update(id: string, data: Partial<InsertIcuAdmission>, ctx: TxContext): Promise<DbIcuAdmission | null> {
    const [row] = await qb(this.db, ctx)
      .update(icuAdmissionsTable)
      .set({ ...data, updatedAt: new Date(), updatedBy: safeUuid(ctx.userId) })
      .where(and(eq(icuAdmissionsTable.id, id), isNull(icuAdmissionsTable.deletedAt)))
      .returning();
    return row ?? null;
  }
}
