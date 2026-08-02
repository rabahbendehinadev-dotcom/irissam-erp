/**
 * /icu routes — ICU beds + ICU admissions.
 *
 * GET  /icu/beds                         — list all ICU beds
 * GET  /icu/admissions                   — list ICU admissions
 * GET  /icu/admissions/:id               — single ICU admission
 * POST /icu/admissions                   — create (reserve bed atomically, or 409 if full)
 * POST /icu/admissions/:id/transfer      — transfer to another bed
 * POST /icu/admissions/:id/discharge     — discharge + free bed
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { IcuAdmissionRepository } from "../repositories/icuAdmission";
import { repos } from "../repositories";
import { safeUuid } from "../repositories/types";
import { auditService } from "../services/audit";
import { encounterService } from "../services/encounter";
import { broadcast } from "./notifications";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import type { ActorCtx, TxContext } from "../repositories/types";
import type { DbIcuAdmission, DbIcuBed } from "../repositories/icuAdmission";

const router = Router();
const icuRepo = new IcuAdmissionRepository();

function actor(req: AuthenticatedRequest): ActorCtx {
  return {
    userId:   req.auth?.userId ?? "system",
    userName: req.auth?.userId ?? "system",
    userRole: req.auth?.role   ?? "guest",
  };
}

function mapBed(b: DbIcuBed) {
  return {
    id:           b.id,
    number:       b.number,
    unitName:     b.unitName,
    type:         b.type,
    status:       b.status,
    patientId:    b.patientId ?? null,
    patientName:  b.patientName ?? null,
    encounterId:  b.encounterId ?? null,
    icuAdmissionId: b.icuAdmissionId ?? null,
    priority:     b.priority ?? null,
    occupiedAt:   b.occupiedAt?.toISOString() ?? null,
    updatedAt:    b.updatedAt.toISOString(),
  };
}

function mapAdmission(a: DbIcuAdmission) {
  return {
    id:              a.id,
    encounterId:     a.encounterId ?? null,
    patientId:       a.patientId,
    patientName:     a.patientName,
    motif:           a.motif,
    priority:        a.priority,
    icuBedId:        a.icuBedId ?? null,
    teamNotified:    a.teamNotified,
    status:          a.status,
    requestedById:   a.requestedById ?? null,
    requestedByName: a.requestedByName ?? null,
    notes:           a.notes ?? null,
    createdAt:       a.createdAt.toISOString(),
    updatedAt:       a.updatedAt.toISOString(),
  };
}

/** GET /icu/beds */
router.get("/beds", async (_req, res, next) => {
  try {
    const beds = await icuRepo.listBeds();
    res.json(beds.map(mapBed));
  } catch (err) { next(err); }
});

/** GET /icu/admissions */
router.get("/admissions", async (req, res, next) => {
  try {
    const { patientId, encounterId, status } = req.query as Record<string, string>;
    const result = await icuRepo.list({ patientId, encounterId, status, limit: 200 });
    res.json(result.data.map(mapAdmission));
  } catch (err) { next(err); }
});

/** GET /icu/admissions/:id */
router.get("/admissions/:id", async (req, res, next) => {
  try {
    const row = await icuRepo.findById(String(req.params.id));
    if (!row) { res.status(404).json({ error: "ICU admission introuvable" }); return; }
    res.json(mapAdmission(row));
  } catch (err) { next(err); }
});

/**
 * POST /icu/admissions — create ICU admission + reserve bed atomically.
 * Returns 409 if no ICU bed is available.
 */
router.post("/admissions", async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = req.body as {
      patientId?:       string;
      encounterId?:     string;
      patientName?:     string;
      motif?:           string;
      priority?:        string;
      icuBedId?:        string;   // optional — auto-select if omitted
      teamNotified?:    boolean;
      requestedByName?: string;
      notes?:           string;
    };

    if (!body.patientId)  { res.status(400).json({ error: "patientId requis" }); return; }
    if (!body.encounterId){ res.status(400).json({ error: "encounterId requis" }); return; }
    if (!body.motif?.trim()){ res.status(400).json({ error: "motif requis" }); return; }

    const a = actor(req);

    const result = await db.transaction(async (tx) => {
      const ctx: TxContext = { ...a, tx };

      // 1. Find available bed
      let bedId = body.icuBedId;
      if (bedId) {
        const requestedBed = await icuRepo.findBedById(bedId, ctx);
        if (!requestedBed || requestedBed.status !== "disponible") {
          throw Object.assign(new Error("Le lit ICU demandé n'est pas disponible"), { status: 409 });
        }
      } else {
        const available = await icuRepo.findAvailableBed(ctx);
        if (!available) {
          throw Object.assign(new Error("Aucun lit ICU disponible en ce moment"), { status: 409 });
        }
        bedId = available.id;
      }

      // 2. Create ICU admission (get real ID first)
      const admission = await icuRepo.create({
        patientId:       body.patientId!,
        encounterId:     body.encounterId ?? null,
        patientName:     body.patientName ?? "",
        motif:           body.motif!.trim(),
        priority:        body.priority ?? "P2",
        icuBedId:        bedId,
        teamNotified:    body.teamNotified ? "true" : "false",
        requestedById:   safeUuid(a.userId) ?? null,
        requestedByName: body.requestedByName ?? a.userName,
        status:          "demande",
        notes:           body.notes ?? null,
      }, ctx);

      // 3. Occupy the bed
      const bed = await icuRepo.occupyBed(bedId!, {
        patientId:      body.patientId!,
        patientName:    body.patientName ?? "",
        encounterId:    body.encounterId!,
        icuAdmissionId: admission.id,
        priority:       body.priority ?? "P2",
      }, ctx);

      if (!bed) {
        throw Object.assign(new Error("Impossible de réserver le lit ICU (concurrence détectée)"), { status: 409 });
      }

      // 4. Link to encounter
      if (body.encounterId) {
        try {
          await encounterService.linkRecord(
            body.encounterId,
            { recordType: "icu_admission", recordId: admission.id, summary: `ICU — ${body.motif}` },
            a, ctx,
          );
        } catch { /* non-blocking */ }
      }

      // 5. Audit
      await auditService.log({
        module:       "reanimation",
        action:       "created",
        resourceType: "icu_admission",
        resourceId:   admission.id,
        newValue:     { bedId, motif: body.motif, priority: body.priority },
        patientId:    body.patientId,
        encounterId:  body.encounterId,
      }, a, ctx);

      return { admission, bed };
    });

    // Notify
    broadcast(null, "icu_bed_reserved", {
      icuAdmissionId: result.admission.id,
      patientName:    body.patientName,
      bedId:          result.bed?.id,
      bedNumber:      result.bed?.number,
    });

    res.status(201).json(mapAdmission(result.admission));
  } catch (err: any) {
    if (err.status === 409) { res.status(409).json({ error: err.message }); return; }
    next(err);
  }
});

/** POST /icu/admissions/:id/transfer — move to another ICU bed. */
router.post("/admissions/:id/transfer", async (req: AuthenticatedRequest, res, next) => {
  try {
    const id   = String(req.params.id);
    const body = req.body as { newBedId?: string; notes?: string };
    if (!body.newBedId) { res.status(400).json({ error: "newBedId requis" }); return; }

    const a = actor(req);

    const result = await db.transaction(async (tx) => {
      const ctx: TxContext = { ...a, tx };
      const admission = await icuRepo.findById(id, ctx);
      if (!admission) throw Object.assign(new Error("ICU admission introuvable"), { status: 404 });

      // Free old bed
      if (admission.icuBedId) {
        await icuRepo.freeBed(admission.icuBedId, ctx);
      }

      // Occupy new bed
      const newBed = await icuRepo.occupyBed(body.newBedId!, {
        patientId:      admission.patientId,
        patientName:    admission.patientName,
        encounterId:    admission.encounterId ?? "",
        icuAdmissionId: id,
        priority:       admission.priority ?? undefined,
      }, ctx);
      if (!newBed) {
        throw Object.assign(new Error("Nouveau lit ICU non disponible"), { status: 409 });
      }

      // Update admission
      const updated = await icuRepo.update(id, {
        icuBedId: body.newBedId!,
        status:   "en_cours",
        notes:    body.notes ?? admission.notes,
      }, ctx);

      await auditService.log({
        module: "reanimation", action: "transferred",
        resourceType: "icu_admission", resourceId: id,
        oldValue: { bedId: admission.icuBedId },
        newValue:  { bedId: body.newBedId },
        patientId:   admission.patientId,
        encounterId: admission.encounterId ?? undefined,
      }, a, ctx);

      return updated;
    });

    res.json(result ? mapAdmission(result) : { error: "Mise à jour échouée" });
  } catch (err: any) {
    if (err.status === 404) { res.status(404).json({ error: err.message }); return; }
    if (err.status === 409) { res.status(409).json({ error: err.message }); return; }
    next(err);
  }
});

/** POST /icu/admissions/:id/discharge */
router.post("/admissions/:id/discharge", async (req: AuthenticatedRequest, res, next) => {
  try {
    const id   = String(req.params.id);
    const body = req.body as { notes?: string };
    const a    = actor(req);

    const result = await db.transaction(async (tx) => {
      const ctx: TxContext = { ...a, tx };
      const admission = await icuRepo.findById(id, ctx);
      if (!admission) throw Object.assign(new Error("ICU admission introuvable"), { status: 404 });

      if (admission.icuBedId) {
        await icuRepo.freeBed(admission.icuBedId, ctx);
      }

      const updated = await icuRepo.update(id, {
        status: "sorti",
        notes:  body.notes ?? admission.notes,
      }, ctx);

      await auditService.log({
        module: "reanimation", action: "discharged",
        resourceType: "icu_admission", resourceId: id,
        oldValue: { status: admission.status },
        newValue:  { status: "sorti" },
        patientId:   admission.patientId,
        encounterId: admission.encounterId ?? undefined,
      }, a, ctx);

      return updated;
    });

    res.json(result ? mapAdmission(result) : { error: "Sortie échouée" });
  } catch (err: any) {
    if (err.status === 404) { res.status(404).json({ error: err.message }); return; }
    next(err);
  }
});

export default router;
