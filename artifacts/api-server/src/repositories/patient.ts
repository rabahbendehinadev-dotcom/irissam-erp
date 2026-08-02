/**
 * PatientRepository — CRUD + search for the patients table.
 * Does NOT generate MRNs — that is PatientService's responsibility.
 */
import { eq, ilike, or, and, isNull, isNotNull, desc, sql, count } from "drizzle-orm";
import { db as globalDb, patientsTable, type DbPatient, type InsertPatient } from "@workspace/db";
import { type TxContext, type QueryOptions, type PagedResult, paged, qb } from "./types";

export type { DbPatient };

export interface PatientSearchOpts extends QueryOptions {
  query?:   string;   // searches firstName, lastName, mrn, phone
  status?:  string;
  siteId?:  string;
  potentialDuplicate?: boolean;
}

export class PatientRepository {
  constructor(private readonly db: typeof globalDb = globalDb) {}

  // ── Read ─────────────────────────────────────────────────────────────────────

  async findById(id: string, ctx?: Pick<TxContext, "tx">): Promise<DbPatient | null> {
    const rows = await qb(this.db, ctx)
      .select()
      .from(patientsTable)
      .where(and(eq(patientsTable.id, id), isNull(patientsTable.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async findByMrn(mrn: string, ctx?: Pick<TxContext, "tx">): Promise<DbPatient | null> {
    const rows = await qb(this.db, ctx)
      .select()
      .from(patientsTable)
      .where(and(eq(patientsTable.mrn, mrn), isNull(patientsTable.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async findByMpiId(mpiId: string, ctx?: Pick<TxContext, "tx">): Promise<DbPatient | null> {
    const rows = await qb(this.db, ctx)
      .select()
      .from(patientsTable)
      .where(and(eq(patientsTable.mpiId, mpiId), isNull(patientsTable.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async search(opts: PatientSearchOpts = {}): Promise<PagedResult<DbPatient>> {
    const {
      query, status, siteId, potentialDuplicate,
      limit = 50, offset = 0, includeDeleted = false,
    } = opts;

    const conditions = [];

    if (!includeDeleted) conditions.push(isNull(patientsTable.deletedAt));
    if (status)          conditions.push(eq(patientsTable.status, status as any));
    if (siteId)          conditions.push(eq(patientsTable.siteId, siteId));
    if (potentialDuplicate !== undefined) {
      conditions.push(eq(patientsTable.potentialDuplicate, potentialDuplicate));
    }
    if (query) {
      const like = `%${query}%`;
      conditions.push(or(
        ilike(patientsTable.lastName,  like),
        ilike(patientsTable.firstName, like),
        ilike(patientsTable.mrn,       like),
        ilike(patientsTable.phone,     like),
      )!);
    }

    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      this.db.select().from(patientsTable).where(where)
        .orderBy(desc(patientsTable.updatedAt))
        .limit(limit).offset(offset),
      this.db.select({ total: count() }).from(patientsTable).where(where),
    ]);

    return paged(rows, Number(total), { limit, offset });
  }

  /** Find patients with same lastName + firstName + dateOfBirth (duplicate detection) */
  async findPotentialDuplicates(
    lastName: string, firstName: string, dateOfBirth: string,
  ): Promise<DbPatient[]> {
    return this.db.select().from(patientsTable)
      .where(and(
        isNull(patientsTable.deletedAt),
        eq(patientsTable.lastName,    lastName),
        eq(patientsTable.firstName,   firstName),
        eq(patientsTable.dateOfBirth, dateOfBirth),
      ));
  }

  /** Count all non-deleted patients — used by PatientService to generate next MRN */
  async countAll(): Promise<number> {
    const [{ total }] = await this.db.select({ total: count() }).from(patientsTable)
      .where(isNull(patientsTable.deletedAt));
    return Number(total);
  }

  // ── Write ────────────────────────────────────────────────────────────────────

  async create(data: InsertPatient, ctx: TxContext): Promise<DbPatient> {
    const [row] = await qb(this.db, ctx)
      .insert(patientsTable)
      .values({ ...data, createdBy: ctx.userId, updatedBy: ctx.userId })
      .returning();
    return row;
  }

  async update(id: string, data: Partial<InsertPatient>, ctx: TxContext): Promise<DbPatient | null> {
    const [row] = await qb(this.db, ctx)
      .update(patientsTable)
      .set({ ...data, updatedAt: new Date(), updatedBy: ctx.userId })
      .where(and(eq(patientsTable.id, id), isNull(patientsTable.deletedAt)))
      .returning();
    return row ?? null;
  }

  async softDelete(id: string, ctx: TxContext): Promise<boolean> {
    const [row] = await qb(this.db, ctx)
      .update(patientsTable)
      .set({ deletedAt: new Date(), deletedBy: ctx.userId })
      .where(and(eq(patientsTable.id, id), isNull(patientsTable.deletedAt)))
      .returning({ id: patientsTable.id });
    return !!row;
  }

  async markPotentialDuplicate(id: string, flag: boolean, ctx: TxContext): Promise<void> {
    await qb(this.db, ctx)
      .update(patientsTable)
      .set({ potentialDuplicate: flag, updatedBy: ctx.userId })
      .where(eq(patientsTable.id, id));
  }
}
