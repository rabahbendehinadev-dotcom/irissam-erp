/**
 * PatientRepository — CRUD + search for the patients table.
 * Does NOT generate MRNs — that is PatientService's responsibility.
 */
import { eq, ilike, or, and, isNull, isNotNull, desc, sql, count } from "drizzle-orm";
import { db as globalDb, patientsTable, type DbPatient, type InsertPatient } from "@workspace/db";
import { type TxContext, type QueryOptions, type PagedResult, paged, qb , safeUuid } from "./types";

export type { DbPatient };

export interface PatientSearchOpts extends QueryOptions {
  query?:   string;   // searches firstName, lastName, mrn, phone
  status?:  string;
  siteId?:  string;
  potentialDuplicate?: boolean;
}

/** Match-strength tier for duplicate detection (strongest first). */
export type DuplicateTier = "very_strong" | "strong_phone" | "strong_name_dob" | "possible_name";

export interface DuplicateCandidateRow {
  patient: DbPatient;
  tier: DuplicateTier;
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

  /**
   * Find patients with same normalized lastName + firstName + dateOfBirth.
   * Normalization: trim, lowercase, collapse repeated whitespace — so
   * "BENALI " and "benali" match.  Used by create() to flag potentialDuplicate.
   */
  async findPotentialDuplicates(
    lastName: string, firstName: string, dateOfBirth: string,
  ): Promise<DbPatient[]> {
    const candidates = await this.findDuplicateCandidates({ lastName, firstName, dateOfBirth });
    return candidates
      .filter((c) => c.tier === "strong_name_dob")
      .map((c) => c.patient);
  }

  /**
   * Tiered duplicate search with normalized comparison.
   *
   * Tiers (strongest first):
   *   very_strong      — same ID document number (trimmed, case-insensitive)
   *   strong_phone     — same phone (digits-only comparison)
   *   strong_name_dob  — same normalized name + date of birth
   *   possible_name    — same normalized name only (do NOT auto-block saves)
   *
   * Name normalization: lower(trim + collapse whitespace) on both sides.
   */
  async findDuplicateCandidates(opts: {
    lastName: string;
    firstName: string;
    dateOfBirth?: string;
    phone?: string;
    idDocumentNumber?: string;
  }): Promise<DuplicateCandidateRow[]> {
    const normalize = (s: string | null | undefined) =>
      (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    const digitsOnly = (s: string | null | undefined) =>
      (s ?? "").replace(/[^0-9]/g, "");

    const normLast  = normalize(opts.lastName);
    const normFirst = normalize(opts.firstName);
    const normPhone = digitsOnly(opts.phone);
    const normIdDoc = normalize(opts.idDocumentNumber);
    const dob       = (opts.dateOfBirth ?? "").trim();

    if (!normLast || !normFirst) return [];

    // SQL-side pre-filter: normalized name match OR phone match OR ID-doc match
    const conds = [
      sql`(lower(regexp_replace(btrim(${patientsTable.lastName}), '[[:space:]]+', ' ', 'g')) = ${normLast}
        AND lower(regexp_replace(btrim(${patientsTable.firstName}), '[[:space:]]+', ' ', 'g')) = ${normFirst})`,
    ];
    if (normIdDoc) {
      conds.push(sql`lower(btrim(coalesce(${patientsTable.idDocumentNumber}, ''))) = ${normIdDoc}`);
    }
    if (normPhone) {
      conds.push(sql`regexp_replace(coalesce(${patientsTable.phone}, ''), '[^0-9]', '', 'g') = ${normPhone}`);
    }

    const rows = await this.db.select().from(patientsTable)
      .where(and(isNull(patientsTable.deletedAt), or(...conds)))
      .limit(20);

    // Assign the strongest tier per row (same normalization in TS)
    const TIER_ORDER: Record<DuplicateTier, number> = {
      very_strong: 0, strong_phone: 1, strong_name_dob: 2, possible_name: 3,
    };

    return rows
      .map((p): DuplicateCandidateRow | null => {
        const nameMatches =
          normalize(p.lastName) === normLast && normalize(p.firstName) === normFirst;
        let tier: DuplicateTier | null = null;
        if (normIdDoc && normalize(p.idDocumentNumber) === normIdDoc)       tier = "very_strong";
        else if (normPhone && digitsOnly(p.phone) === normPhone)            tier = "strong_phone";
        else if (nameMatches && dob && String(p.dateOfBirth) === dob)       tier = "strong_name_dob";
        else if (nameMatches)                                               tier = "possible_name";
        return tier ? { patient: p, tier } : null;
      })
      .filter((x): x is DuplicateCandidateRow => x !== null)
      .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);
  }

  /** Count all non-deleted patients (stats/pagination — NOT used for MRN generation). */
  async countAll(): Promise<number> {
    const [{ total }] = await this.db.select({ total: count() }).from(patientsTable)
      .where(isNull(patientsTable.deletedAt));
    return Number(total);
  }

  // ── Write ────────────────────────────────────────────────────────────────────

  async create(data: InsertPatient, ctx: TxContext): Promise<DbPatient> {
    const [row] = await qb(this.db, ctx)
      .insert(patientsTable)
      .values({ ...data, createdBy: safeUuid(ctx.userId), updatedBy: safeUuid(ctx.userId) })
      .returning();
    return row;
  }

  async update(id: string, data: Partial<InsertPatient>, ctx: TxContext): Promise<DbPatient | null> {
    const [row] = await qb(this.db, ctx)
      .update(patientsTable)
      .set({ ...data, updatedAt: new Date(), updatedBy: safeUuid(ctx.userId) })
      .where(and(eq(patientsTable.id, id), isNull(patientsTable.deletedAt)))
      .returning();
    return row ?? null;
  }

  async softDelete(id: string, ctx: TxContext): Promise<boolean> {
    const [row] = await qb(this.db, ctx)
      .update(patientsTable)
      .set({ deletedAt: new Date(), deletedBy: safeUuid(ctx.userId) })
      .where(and(eq(patientsTable.id, id), isNull(patientsTable.deletedAt)))
      .returning({ id: patientsTable.id });
    return !!row;
  }

  async markPotentialDuplicate(id: string, flag: boolean, ctx: TxContext): Promise<void> {
    await qb(this.db, ctx)
      .update(patientsTable)
      .set({ potentialDuplicate: flag, updatedBy: safeUuid(ctx.userId) })
      .where(eq(patientsTable.id, id));
  }
}
