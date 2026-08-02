/**
 * SurgicalRequestRepository — CRUD for surgical_requests + operating_rooms.
 * surgical_status: demande | planifie | en_cours | termine | annule
 * or_status:       libre | reserve | en_preparation | en_intervention | nettoyage | hors_service | maintenance
 */
import { eq, and, isNull, desc, count, gte, lte, ne } from "drizzle-orm";
import {
  db as globalDb,
  surgicalRequestsTable, operatingRoomsTable,
  type DbSurgicalRequest, type InsertSurgicalRequest,
  type DbOperatingRoom,
} from "@workspace/db";
import { type TxContext, type QueryOptions, type PagedResult, paged, qb, safeUuid } from "./types";

export type { DbSurgicalRequest, DbOperatingRoom };

export interface SurgicalRequestListOpts extends QueryOptions {
  patientId?:  string;
  encounterId?: string;
  status?:     string;
  orRoomId?:   string;
}

export class SurgicalRequestRepository {
  constructor(private readonly db: typeof globalDb = globalDb) {}

  // ── Operating Rooms ───────────────────────────────────────────────────────────

  async listRooms(ctx?: Pick<TxContext, "tx">): Promise<DbOperatingRoom[]> {
    return qb(this.db, ctx).select().from(operatingRoomsTable)
      .where(isNull(operatingRoomsTable.deletedAt))
      .orderBy(operatingRoomsTable.name);
  }

  async findRoomById(id: string, ctx?: Pick<TxContext, "tx">): Promise<DbOperatingRoom | null> {
    const rows = await qb(this.db, ctx)
      .select().from(operatingRoomsTable)
      .where(and(eq(operatingRoomsTable.id, id), isNull(operatingRoomsTable.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async updateRoomStatus(id: string, status: string, currentSurgicalRequestId?: string | null, ctx?: TxContext): Promise<DbOperatingRoom | null> {
    const set: any = { status: status as any, updatedAt: new Date() };
    if (currentSurgicalRequestId !== undefined) set.currentSurgicalRequestId = currentSurgicalRequestId;
    const db = ctx ? qb(this.db, ctx) : this.db;
    const [row] = await (db as any)
      .update(operatingRoomsTable)
      .set(set)
      .where(eq(operatingRoomsTable.id, id))
      .returning();
    return row ?? null;
  }

  /** Check if an OR is free during [startAt, endAt] — no active surgical request overlaps. */
  async isRoomAvailable(orRoomId: string, startAt: Date, endAt: Date, excludeRequestId?: string): Promise<boolean> {
    const conditions: any[] = [
      eq(surgicalRequestsTable.orRoomId, orRoomId),
      ne(surgicalRequestsTable.status, "annule" as any),
      isNull(surgicalRequestsTable.deletedAt),
      lte(surgicalRequestsTable.scheduledAt, endAt),
    ];
    if (excludeRequestId) conditions.push(ne(surgicalRequestsTable.id, excludeRequestId));
    const rows = await this.db.select({ id: surgicalRequestsTable.id })
      .from(surgicalRequestsTable)
      .where(and(...conditions))
      .limit(1);
    return rows.length === 0;
  }

  // ── Surgical Requests ─────────────────────────────────────────────────────────

  async findById(id: string, ctx?: Pick<TxContext, "tx">): Promise<DbSurgicalRequest | null> {
    const rows = await qb(this.db, ctx)
      .select().from(surgicalRequestsTable)
      .where(and(eq(surgicalRequestsTable.id, id), isNull(surgicalRequestsTable.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async list(opts: SurgicalRequestListOpts = {}): Promise<PagedResult<DbSurgicalRequest>> {
    const { patientId, encounterId, status, orRoomId, limit = 100, offset = 0, includeDeleted = false } = opts;
    const conditions: any[] = [];
    if (!includeDeleted) conditions.push(isNull(surgicalRequestsTable.deletedAt));
    if (patientId)   conditions.push(eq(surgicalRequestsTable.patientId, patientId));
    if (encounterId) conditions.push(eq(surgicalRequestsTable.encounterId, encounterId));
    if (status)      conditions.push(eq(surgicalRequestsTable.status, status as any));
    if (orRoomId)    conditions.push(eq(surgicalRequestsTable.orRoomId, orRoomId));
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [{ total }]] = await Promise.all([
      this.db.select().from(surgicalRequestsTable).where(where)
        .orderBy(desc(surgicalRequestsTable.createdAt)).limit(limit).offset(offset),
      this.db.select({ total: count() }).from(surgicalRequestsTable).where(where),
    ]);
    return paged(rows, Number(total), { limit, offset });
  }

  async create(data: Omit<InsertSurgicalRequest, "createdBy" | "updatedBy">, ctx: TxContext): Promise<DbSurgicalRequest> {
    const [row] = await qb(this.db, ctx)
      .insert(surgicalRequestsTable)
      .values({ ...data, createdBy: safeUuid(ctx.userId), updatedBy: safeUuid(ctx.userId) })
      .returning();
    return row;
  }

  async update(id: string, data: Partial<InsertSurgicalRequest>, ctx: TxContext): Promise<DbSurgicalRequest | null> {
    const [row] = await qb(this.db, ctx)
      .update(surgicalRequestsTable)
      .set({ ...data, updatedAt: new Date(), updatedBy: safeUuid(ctx.userId) })
      .where(and(eq(surgicalRequestsTable.id, id), isNull(surgicalRequestsTable.deletedAt)))
      .returning();
    return row ?? null;
  }

  async updateStatus(id: string, status: string, ctx: TxContext): Promise<DbSurgicalRequest | null> {
    return this.update(id, { status: status as any }, ctx);
  }
}
