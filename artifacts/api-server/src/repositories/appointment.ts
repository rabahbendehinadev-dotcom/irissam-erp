/**
 * AppointmentRepository — CRUD for the appointments table.
 *
 * Key schema facts (checked against appointments.ts):
 *  - doctorId / doctorName / departmentId / departmentName
 *  - scheduledAt: timestamp
 *  - siteId: present ✓
 *  - No deletedBy column
 */
import { eq, and, isNull, gte, lte, desc, count } from "drizzle-orm";
import {
  db as globalDb, appointmentsTable, type DbAppointment, type InsertAppointment,
} from "@workspace/db";
import { type TxContext, type QueryOptions, type PagedResult, paged, qb , safeUuid } from "./types";

export type { DbAppointment };

export interface AppointmentListOpts extends QueryOptions {
  patientId?: string;
  doctorId?:  string;
  status?:    string;
  siteId?:    string;
  fromDate?:  Date;
  toDate?:    Date;
}

export class AppointmentRepository {
  constructor(private readonly db: typeof globalDb = globalDb) {}

  async findById(id: string, ctx?: Pick<TxContext, "tx">): Promise<DbAppointment | null> {
    const rows = await qb(this.db, ctx)
      .select().from(appointmentsTable)
      .where(and(eq(appointmentsTable.id, id), isNull(appointmentsTable.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async list(opts: AppointmentListOpts = {}): Promise<PagedResult<DbAppointment>> {
    const { patientId, doctorId, status, siteId, fromDate, toDate, limit = 50, offset = 0, includeDeleted = false } = opts;
    const conditions = [];
    if (!includeDeleted) conditions.push(isNull(appointmentsTable.deletedAt));
    if (patientId) conditions.push(eq(appointmentsTable.patientId, patientId));
    if (doctorId)  conditions.push(eq(appointmentsTable.doctorId, doctorId));
    if (status)    conditions.push(eq(appointmentsTable.status, status as any));
    if (siteId)    conditions.push(eq(appointmentsTable.siteId, siteId));
    if (fromDate)  conditions.push(gte(appointmentsTable.scheduledAt, fromDate));
    if (toDate)    conditions.push(lte(appointmentsTable.scheduledAt, toDate));

    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [{ total }]] = await Promise.all([
      this.db.select().from(appointmentsTable).where(where)
        .orderBy(appointmentsTable.scheduledAt).limit(limit).offset(offset),
      this.db.select({ total: count() }).from(appointmentsTable).where(where),
    ]);
    return paged(rows, Number(total), { limit, offset });
  }

  async create(data: InsertAppointment, ctx: TxContext): Promise<DbAppointment> {
    const [row] = await qb(this.db, ctx)
      .insert(appointmentsTable)
      .values({ ...data, createdBy: safeUuid(ctx.userId), updatedBy: safeUuid(ctx.userId) })
      .returning();
    return row;
  }

  async update(id: string, data: Partial<InsertAppointment>, ctx: TxContext): Promise<DbAppointment | null> {
    const [row] = await qb(this.db, ctx)
      .update(appointmentsTable)
      .set({ ...data, updatedAt: new Date(), updatedBy: safeUuid(ctx.userId) })
      .where(and(eq(appointmentsTable.id, id), isNull(appointmentsTable.deletedAt)))
      .returning();
    return row ?? null;
  }

  async updateStatus(id: string, status: string, ctx: TxContext): Promise<DbAppointment | null> {
    const [row] = await qb(this.db, ctx)
      .update(appointmentsTable)
      .set({ status: status as any, updatedAt: new Date(), updatedBy: safeUuid(ctx.userId) })
      .where(and(eq(appointmentsTable.id, id), isNull(appointmentsTable.deletedAt)))
      .returning();
    return row ?? null;
  }

  async softDelete(id: string, ctx: TxContext): Promise<boolean> {
    const [row] = await qb(this.db, ctx)
      .update(appointmentsTable)
      .set({ deletedAt: new Date(), updatedBy: safeUuid(ctx.userId) })
      .where(and(eq(appointmentsTable.id, id), isNull(appointmentsTable.deletedAt)))
      .returning({ id: appointmentsTable.id });
    return !!row;
  }
}
