/**
 * /occupancy-beds routes — individual ward bed lifecycle.
 *
 * GET  /occupancy-beds                   — list all (optional ?siteId=)
 * GET  /occupancy-beds/available         — only disponible beds
 * GET  /occupancy-beds/:id               — single bed
 * POST /occupancy-beds/:id/assign        — occupy (marks occupe + links patient)
 * POST /occupancy-beds/:id/release       — free (marks disponible, clears patient)
 * POST /occupancy-beds/:id/start-cleaning  — marks nettoyage
 * POST /occupancy-beds/:id/complete-cleaning — marks disponible after cleaning
 */
import { Router } from "express";
import { db, occupancyBedsTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { repos } from "../repositories";
import { safeUuid } from "../repositories/types";
import { auditService } from "../services/audit";
import { broadcast } from "./notifications";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import type { ActorCtx, TxContext } from "../repositories/types";
import type { DbOccupancyBed } from "../repositories/occupancyBed";

const router = Router();

const DEFAULT_SITE = "9747c84b-cedd-428a-b8ba-cf5f0b3b31ee";

function actor(req: AuthenticatedRequest): ActorCtx {
  return {
    userId:   req.auth?.userId ?? "system",
    userName: req.auth?.userId ?? "system",
    userRole: req.auth?.role   ?? "guest",
  };
}

function mapBed(b: DbOccupancyBed) {
  return {
    id:           b.id,
    number:       b.number,
    roomNumber:   b.roomNumber ?? null,
    floorLabel:   b.floorLabel ?? null,
    buildingName: b.buildingName ?? null,
    type:         b.type,
    status:       b.status,
    patientId:    b.patientId ?? null,
    patientName:  b.patientName ?? null,
    encounterId:  b.encounterId ?? null,
    admissionId:  b.admissionId ?? null,
    occupiedAt:   b.occupiedAt?.toISOString() ?? null,
    cleaningStartedAt:   b.cleaningStartedAt?.toISOString() ?? null,
    cleaningCompletedAt: b.cleaningCompletedAt?.toISOString() ?? null,
    siteId:       b.siteId,
    updatedAt:    b.updatedAt.toISOString(),
  };
}

/** GET /occupancy-beds */
router.get("/", async (req, res, next) => {
  try {
    const { siteId } = req.query as { siteId?: string };
    const targetSite = siteId ?? DEFAULT_SITE;
    const beds = await repos.occupancyBed.listBySite(targetSite, { limit: 200 });
    res.json(beds.map(mapBed));
  } catch (err) { next(err); }
});

/** GET /occupancy-beds/available — must be before /:id */
router.get("/available", async (req, res, next) => {
  try {
    const { siteId, type } = req.query as { siteId?: string; type?: string };
    const beds = await repos.occupancyBed.findAvailable(siteId ?? DEFAULT_SITE, type);
    res.json(beds.map(mapBed));
  } catch (err) { next(err); }
});

/** GET /occupancy-beds/:id */
router.get("/:id", async (req, res, next) => {
  try {
    const bed = await repos.occupancyBed.findById(String(req.params.id));
    if (!bed) { res.status(404).json({ error: "Lit introuvable" }); return; }
    res.json(mapBed(bed));
  } catch (err) { next(err); }
});

/** POST /occupancy-beds/:id/assign */
router.post("/:id/assign", async (req: AuthenticatedRequest, res, next) => {
  try {
    const id   = String(req.params.id);
    const body = req.body as { patientId?: string; patientName?: string; encounterId?: string; admissionId?: string };
    if (!body.patientId)   { res.status(400).json({ error: "patientId requis" }); return; }
    if (!body.encounterId) { res.status(400).json({ error: "encounterId requis" }); return; }

    const a = actor(req);
    const result = await db.transaction(async (tx) => {
      const ctx: TxContext = { ...a, tx };
      const bed = await repos.occupancyBed.occupy(id, {
        patientId:   body.patientId!,
        patientName: body.patientName ?? "",
        encounterId: body.encounterId!,
      }, ctx);
      if (!bed) throw Object.assign(new Error("Lit non disponible (déjà occupé ou introuvable)"), { status: 409 });

      if (body.admissionId) {
        await tx.update(occupancyBedsTable)
          .set({ admissionId: body.admissionId })
          .where(eq(occupancyBedsTable.id, id));
      }

      await auditService.log({
        module: "hospitalisation", action: "bed_assigned",
        resourceType: "occupancy_bed", resourceId: id,
        newValue: { patientId: body.patientId, encounterId: body.encounterId },
        patientId: body.patientId, encounterId: body.encounterId,
      }, a, ctx);

      return bed;
    });

    res.json(mapBed(result));
  } catch (err: any) {
    if (err.status === 409) { res.status(409).json({ error: err.message }); return; }
    next(err);
  }
});

/** POST /occupancy-beds/:id/release */
router.post("/:id/release", async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const a  = actor(req);
    const ctx: TxContext = { ...a };
    const bed = await repos.occupancyBed.free(id, ctx);
    if (!bed) { res.status(404).json({ error: "Lit introuvable" }); return; }
    await auditService.log({
      module: "hospitalisation", action: "bed_released",
      resourceType: "occupancy_bed", resourceId: id,
      newValue: { status: "disponible" },
    }, a);
    broadcast(null, "bed_available", { bedId: id, bedNumber: bed.number });
    res.json(mapBed(bed));
  } catch (err) { next(err); }
});

/** POST /occupancy-beds/:id/start-cleaning */
router.post("/:id/start-cleaning", async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const a  = actor(req);
    const [bed] = await db.update(occupancyBedsTable)
      .set({
        status:          "nettoyage",
        cleaningStartedAt: new Date(),
        patientId:       null,
        patientName:     null,
        encounterId:     null,
        admissionId:     null,
        updatedAt:       new Date(),
        updatedBy:       safeUuid(a.userId),
      })
      .where(and(eq(occupancyBedsTable.id, id), isNull(occupancyBedsTable.deletedAt)))
      .returning();
    if (!bed) { res.status(404).json({ error: "Lit introuvable" }); return; }
    await auditService.log({ module: "hospitalisation", action: "cleaning_started", resourceType: "occupancy_bed", resourceId: id }, a);
    res.json(mapBed(bed));
  } catch (err) { next(err); }
});

/** POST /occupancy-beds/:id/complete-cleaning */
router.post("/:id/complete-cleaning", async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const a  = actor(req);
    const [bed] = await db.update(occupancyBedsTable)
      .set({
        status:              "disponible",
        cleaningCompletedAt: new Date(),
        updatedAt:           new Date(),
        updatedBy:           safeUuid(a.userId),
      })
      .where(and(eq(occupancyBedsTable.id, id), isNull(occupancyBedsTable.deletedAt)))
      .returning();
    if (!bed) { res.status(404).json({ error: "Lit introuvable" }); return; }
    await auditService.log({
      module: "hospitalisation", action: "cleaning_completed",
      resourceType: "occupancy_bed", resourceId: id,
      newValue: { status: "disponible" },
    }, a);
    broadcast(null, "bed_available", { bedId: id, bedNumber: bed.number });
    res.json(mapBed(bed));
  } catch (err) { next(err); }
});

export default router;
