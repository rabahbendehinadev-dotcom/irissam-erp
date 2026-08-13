/**
 * OccupancyBedRepository — bed lifecycle.
 *
 * Key schema facts (checked against occupancy.ts):
 *  - status enum: disponible | occupe | reserve | nettoyage | hors_service | maintenance
 *    ("libre" does NOT exist — use "disponible")
 *  - No freedAt column — clear patientId/encounterId on free
 *  - No deletedBy column
 *  - createdBy / updatedBy present
 */
import { eq, and, isNull, count } from "drizzle-orm";
import {
  db as globalDb, occupancyBedsTable, type DbOccupancyBed, type InsertOccupancyBed,
} from "@workspace/db";
import { type TxContext, type QueryOptions, qb , safeUuid } from "./types";

export type { DbOccupancyBed };

export class OccupancyBedRepository {
  constructor(private readonly db: typeof globalDb = globalDb) {}

  async findById(id: string, ctx?: Pick<TxContext, "tx">): Promise<DbOccupancyBed | null> {
    const rows = await qb(this.db, ctx)
      .select().from(occupancyBedsTable)
      .where(eq(occupancyBedsTable.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findAvailable(siteId: string, type?: string, ctx?: Pick<TxContext, "tx">): Promise<DbOccupancyBed[]> {
    const conditions: any[] = [
      eq(occupancyBedsTable.status, "disponible"),
      eq(occupancyBedsTable.siteId, siteId),
    ];
    if (type) conditions.push(eq(occupancyBedsTable.type, type as any));
    return qb(this.db, ctx)
      .select().from(occupancyBedsTable)
      .where(and(...conditions));
  }

  async listBySite(siteId: string, opts: QueryOptions = {}): Promise<DbOccupancyBed[]> {
    return this.db.select().from(occupancyBedsTable)
      .where(eq(occupancyBedsTable.siteId, siteId))
      .orderBy(occupancyBedsTable.number)
      .limit(opts.limit ?? 200).offset(opts.offset ?? 0);
  }

  async create(data: InsertOccupancyBed, ctx: TxContext): Promise<DbOccupancyBed> {
    const [row] = await qb(this.db, ctx)
      .insert(occupancyBedsTable)
      .values({ ...data, createdBy: safeUuid(ctx.userId), updatedBy: safeUuid(ctx.userId) })
      .returning();
    return row;
  }

  /** Mark a bed as occupied. Fails (returns null) if bed is not "disponible". */
  async occupy(
    id: string,
    payload: { patientId?: string; patientName: string; encounterId?: string; admissionId?: string },
    ctx: TxContext,
  ): Promise<DbOccupancyBed | null> {
    const [row] = await qb(this.db, ctx)
      .update(occupancyBedsTable)
      .set({
        status:      "occupe",
        patientId:   payload.patientId ?? null,
        patientName: payload.patientName,
        encounterId: payload.encounterId ?? null,
        admissionId: payload.admissionId ?? null,
        occupiedAt:  new Date(),
        updatedBy:   safeUuid(ctx.userId),
        updatedAt:   new Date(),
      })
      .where(and(eq(occupancyBedsTable.id, id), eq(occupancyBedsTable.status, "disponible")))
      .returning();
    return row ?? null;
  }

  /**
   * Free a bed — clears occupant fields (incl. admissionId).
   * Par défaut le lit redevient "disponible" ; passer nextStatus:"nettoyage"
   * pour le mouvement ADT (sortie/transfert → nettoyage avant remise à dispo).
   */
  async free(
    id: string,
    ctx: TxContext,
    opts?: { nextStatus?: "disponible" | "nettoyage" },
  ): Promise<DbOccupancyBed | null> {
    const nextStatus = opts?.nextStatus ?? "disponible";
    const [row] = await qb(this.db, ctx)
      .update(occupancyBedsTable)
      .set({
        status:      nextStatus,
        patientId:   null,
        patientName: null,
        encounterId: null,
        admissionId: null,
        occupiedAt:  null,
        ...(nextStatus === "nettoyage" ? { cleaningStartedAt: new Date() } : {}),
        updatedBy:   safeUuid(ctx.userId),
        updatedAt:   new Date(),
      })
      .where(eq(occupancyBedsTable.id, id))
      .returning();
    return row ?? null;
  }
}
