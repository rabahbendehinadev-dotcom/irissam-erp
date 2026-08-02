/**
 * /encounters routes — backed by EncounterService.
 *
 * Used by:
 *  - EmergencyDossierProvider on mount → POST /encounters (creates real DB encounter)
 *  - AdmissionService.admit() internally (no HTTP call needed, handled in service)
 *  - Frontend to verify encounter continuity across modules
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { encounterService } from "../services/encounter";
import { repos } from "../repositories";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import type { ActorCtx } from "../repositories/types";
import type { DbEncounter } from "../repositories/encounter";
import timelineRouter from "./timeline";

const router = Router();

function actor(req: AuthenticatedRequest): ActorCtx {
  return {
    userId:   req.auth?.userId ?? "system",
    userName: req.auth?.userId ?? "system",
    userRole: req.auth?.role   ?? "guest",
  };
}

function mapEncounter(e: DbEncounter) {
  return {
    id:                e.id,
    encounterNumber:   e.encounterNumber,
    patientId:         e.patientId,
    patientName:       e.patientName,
    patientMrn:        e.patientMrn ?? null,
    type:              e.type,
    status:            e.status,
    chiefComplaint:    e.chiefComplaint ?? null,
    sourceModule:      e.sourceModule,
    primaryDoctorId:   e.primaryDoctorId ?? null,
    primaryDoctorName: e.primaryDoctorName ?? null,
    siteId:            e.siteId ?? null,
    openedAt:          e.openedAt?.toISOString() ?? e.updatedAt.toISOString(),
    closedAt:          e.closedAt?.toISOString() ?? null,
    closeReason:       e.closeReason ?? null,
    linkedRecords:     e.linkedRecords ?? [],
    updatedAt:         e.updatedAt.toISOString(),
  };
}

/** GET /encounters?patientId=&status=&type= */
router.get("/", async (req, res, next) => {
  try {
    const { patientId, status, type } = req.query as Record<string, string | undefined>;
    const result = await encounterService.list({
      patientId,
      status,
      type,
      limit: 200,
    });
    res.json(result.data.map(mapEncounter));
  } catch (err) {
    next(err);
  }
});

/** GET /encounters/:id */
router.get("/:id", async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const row = await encounterService.findById(id);
    if (!row) { res.status(404).json({ error: "Encounter not found" }); return; }
    res.json(mapEncounter(row));
  } catch (err) {
    next(err);
  }
});

/** POST /encounters — create an encounter (called by Emergency module on visit start) */
router.post("/", async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = req.body as {
      patientId?:        string;
      patientName?:      string;
      patientMrn?:       string;
      type?:             string;
      chiefComplaint?:   string;
      sourceModule?:     string;
      primaryDoctorId?:  string;
      primaryDoctorName?:string;
      siteId?:           string;
      existingEncounterId?: string;
    };

    if (!body.patientId) {
      res.status(400).json({ error: "patientId is required" });
      return;
    }

    // If an existing real encounter UUID is provided, return it (idempotent)
    if (body.existingEncounterId) {
      const existing = await encounterService.findById(body.existingEncounterId);
      if (existing) {
        res.json(mapEncounter(existing));
        return;
      }
    }

    // Map frontend module names → DB enum values
    const TYPE_MAP: Record<string, string> = {
      urgences:       "urgence",
      consultation:   "consultation",
      hospitalisation:"admission",
      externe:        "externe",
    };
    const dbType = TYPE_MAP[body.type ?? ""] ?? body.type ?? "urgence";

    const encounter = await encounterService.create({
      patientId:         body.patientId,
      patientName:       body.patientName ?? "",
      patientMrn:        body.patientMrn   ?? undefined,
      type:              dbType as any,
      status:            "open",
      chiefComplaint:    body.chiefComplaint ?? "",
      sourceModule:      (body.sourceModule as any) ?? "urgences",
      primaryDoctorId:   body.primaryDoctorId  ?? undefined,
      primaryDoctorName: body.primaryDoctorName ?? undefined,
      siteId:            body.siteId            ?? undefined,
    }, actor(req));

    res.status(201).json(mapEncounter(encounter));
  } catch (err) {
    next(err);
  }
});

/** PATCH /encounters/:id/status */
router.patch("/:id/status", async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const { status, reason } = req.body as { status?: string; reason?: string };

    if (status === "closed") {
      const closed = await encounterService.close(id, reason ?? "closed", actor(req));
      res.json(mapEncounter(closed));
    } else {
      res.status(400).json({ error: "Only status=closed is supported via this endpoint" });
    }
  } catch (err) {
    next(err);
  }
});

// ── Nested routes ─────────────────────────────────────────────────────────────

/** GET /encounters/:encounterId/timeline */
router.use("/:encounterId/timeline", timelineRouter);

/** GET /encounters/:encounterId/lab-orders */
router.get("/:encounterId/lab-orders", async (req, res, next) => {
  try {
    const { encounterId } = req.params;
    const result = await repos.labOrder.list({ encounterId, limit: 200 });
    res.json(result.data.map(o => ({
      id: o.id, encounterId: o.encounterId, patientId: o.patientId,
      test: o.test, category: o.category, urgency: o.urgency,
      status: o.status, result: o.result ?? null, isCritical: o.isCritical,
      requestedByName: o.requestedByName,
      requestedAt: o.requestedAt?.toISOString() ?? null,
      resultAt: o.resultAt?.toISOString() ?? null,
    })));
  } catch (err) { next(err); }
});

/** GET /encounters/:encounterId/imaging-orders */
router.get("/:encounterId/imaging-orders", async (req, res, next) => {
  try {
    const { encounterId } = req.params;
    const result = await repos.imagingOrder.list({ encounterId, limit: 200 });
    res.json(result.data.map(o => ({
      id: o.id, encounterId: o.encounterId, patientId: o.patientId,
      exam: o.exam, region: o.region, urgency: o.urgency,
      status: o.status, report: o.report ?? null,
      requestedByName: o.requestedByName,
      requestedAt: o.requestedAt?.toISOString() ?? null,
      interpretedAt: o.interpretedAt?.toISOString() ?? null,
    })));
  } catch (err) { next(err); }
});

/** GET /encounters/:encounterId/prescriptions */
router.get("/:encounterId/prescriptions", async (req, res, next) => {
  try {
    const { encounterId } = req.params;
    const result = await repos.prescription.list({ encounterId, limit: 200 });
    res.json(result.data.map(p => ({
      id: p.id, encounterId: p.encounterId, patientId: p.patientId,
      drug: p.drug, dosage: p.dosage, route: p.route, frequency: p.frequency,
      status: p.status, prescribedByName: p.prescribedByName,
      prescribedAt: p.prescribedAt?.toISOString() ?? null,
      dispensedAt: p.dispensedAt?.toISOString() ?? null,
    })));
  } catch (err) { next(err); }
});

/** GET /encounters/:encounterId/billable-events */
router.get("/:encounterId/billable-events", async (req, res, next) => {
  try {
    const { encounterId } = req.params;
    const { rows } = await pool.query(
      `SELECT * FROM billable_events WHERE encounter_id = $1 ORDER BY performed_at DESC`,
      [encounterId],
    );
    res.json(rows);
  } catch (err) { next(err); }
});

export default router;
