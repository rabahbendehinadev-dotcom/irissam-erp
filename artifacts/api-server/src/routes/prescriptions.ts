/**
 * /prescriptions routes — backed by ClinicalOrderService + PrescriptionRepository.
 *
 * GET  /prescriptions                    — list
 * GET  /prescriptions/:id               — single
 * POST /prescriptions                   — create
 * PATCH /prescriptions/:id/status       — update status
 * POST /prescriptions/:id/dispense      — dispense (sets delivre + dispensedBy/At)
 */
import { Router } from "express";
import { clinicalOrderService, ClinicalValidationError } from "../services/clinicalOrder";
import { repos } from "../repositories";
import { safeUuid } from "../repositories/types";
import { auditService } from "../services/audit";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requirePermission";
import type { ActorCtx } from "../repositories/types";
import type { DbPrescription } from "../repositories/prescription";

const router = Router();

function actor(req: AuthenticatedRequest): ActorCtx {
  return {
    userId:   req.auth?.userId ?? "system",
    userName: req.auth?.userId ?? "system",
    userRole: req.auth?.role   ?? "guest",
  };
}

function mapPrescription(p: DbPrescription) {
  return {
    id:                p.id,
    encounterId:       p.encounterId ?? null,
    patientId:         p.patientId,
    patientName:       p.patientName,
    visitId:           p.visitId ?? null,
    drug:              p.drug,
    dosage:            p.dosage,
    route:             p.route,
    frequency:         p.frequency,
    duration:          p.duration ?? null,
    notes:             p.notes ?? null,
    prescribedById:    p.prescribedById ?? null,
    prescribedByName:  p.prescribedByName,
    prescribedAt:      p.prescribedAt?.toISOString() ?? null,
    status:            p.status,
    preparedById:      p.preparedById ?? null,
    preparedByName:    p.preparedByName ?? null,
    preparedAt:        p.preparedAt?.toISOString() ?? null,
    dispensedById:     p.dispensedById ?? null,
    dispensedByName:   p.dispensedByName ?? null,
    dispensedAt:       p.dispensedAt?.toISOString() ?? null,
    dispenserComment:  p.dispenserComment ?? null,
    sourceModule:      p.sourceModule,
    updatedAt:         p.updatedAt.toISOString(),
  };
}

/** GET /prescriptions */
router.get("/", async (req, res, next) => {
  try {
    const { patientId, encounterId, status, limit, offset } = req.query as Record<string, string>;
    const result = await repos.prescription.list({
      patientId,
      encounterId,
      status,
      limit:  limit  ? parseInt(limit,  10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    res.json(result.data.map(mapPrescription));
  } catch (err) { next(err); }
});

/** GET /prescriptions/:id */
router.get("/:id", async (req, res, next) => {
  try {
    const row = await repos.prescription.findById(String(req.params.id));
    if (!row) { res.status(404).json({ error: "Prescription not found" }); return; }
    res.json(mapPrescription(row));
  } catch (err) { next(err); }
});

/** POST /prescriptions */
router.post("/", async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = req.body as {
      patientId?:       string;
      encounterId?:     string;
      patientName?:     string;
      visitId?:         string;
      drug?:            string;
      dosage?:          string;
      route?:           string;
      frequency?:       string;
      duration?:        string;
      notes?:           string;
      prescribedByName?:string;
      sourceModule?:    string;
    };
    if (!body.patientId)    { res.status(400).json({ error: "patientId requis" }); return; }
    if (!body.encounterId)  { res.status(400).json({ error: "encounterId requis — aucune prescription sans encounter réel" }); return; }
    if (!body.drug?.trim()) { res.status(400).json({ error: "drug requis" }); return; }
    if (!body.dosage?.trim()){ res.status(400).json({ error: "dosage requis" }); return; }
    if (!body.route?.trim()){ res.status(400).json({ error: "route requis" }); return; }
    if (!body.frequency?.trim()){ res.status(400).json({ error: "frequency requis" }); return; }

    const a = actor(req);
    const rx = await clinicalOrderService.createPrescription({
      patientId:        body.patientId,
      encounterId:      body.encounterId,
      patientName:      body.patientName ?? "",
      visitId:          body.visitId ?? null,
      drug:             body.drug.trim(),
      dosage:           body.dosage.trim(),
      route:            body.route.trim(),
      frequency:        body.frequency.trim(),
      duration:         body.duration ?? null,
      notes:            body.notes ?? null,
      prescribedById:   safeUuid(a.userId) ?? null,
      prescribedByName: body.prescribedByName ?? a.userName,
      sourceModule:     (body.sourceModule as any) ?? "urgences",
      status:           "prescrit",
    }, a);

    res.status(201).json(mapPrescription(rx));
  } catch (err) {
    if (err instanceof ClinicalValidationError) {
      res.status(400).json({ error: err.message }); return;
    }
    next(err);
  }
});

/** PATCH /prescriptions/:id/status */
router.patch("/:id/status", async (req: AuthenticatedRequest, res, next) => {
  try {
    const id       = String(req.params.id);
    const { status } = req.body as { status?: string };
    if (!status) { res.status(400).json({ error: "status requis" }); return; }
    const a = actor(req);
    const rx = await repos.prescription.update(id, {
      status: status as any,
      updatedAt: new Date(),
    }, { ...a });
    if (!rx) { res.status(404).json({ error: "Prescription introuvable" }); return; }
    await auditService.log({
      module: "pharmacie", action: "status_changed",
      resourceType: "prescription", resourceId: id,
      newValue: { status },
      patientId: rx.patientId ?? undefined,
      encounterId: rx.encounterId ?? undefined,
    }, a);
    res.json(mapPrescription(rx));
  } catch (err) { next(err); }
});

/** POST /prescriptions/:id/dispense (requires pharmacy.dispense) */
router.post("/:id/dispense", requirePermission("pharmacy.dispense"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const id   = String(req.params.id);
    const body = req.body as { dispensedByName?: string; dispenserComment?: string };

    const a   = actor(req);
    const now = new Date();

    // Check existing
    const existing = await repos.prescription.findById(id);
    if (!existing) { res.status(404).json({ error: "Prescription introuvable" }); return; }
    if (existing.status === "annule") {
      res.status(409).json({ error: "Impossible de délivrer une prescription annulée" }); return;
    }
    if (existing.status === "delivre") {
      res.status(409).json({ error: "Prescription déjà délivrée" }); return;
    }

    const rx = await repos.prescription.update(id, {
      status:           "delivre" as any,
      dispensedById:    safeUuid(a.userId) ?? null,
      dispensedByName:  body.dispensedByName ?? a.userName,
      dispensedAt:      now,
      dispenserComment: body.dispenserComment ?? null,
      updatedAt:        now,
    }, { ...a });

    if (!rx) { res.status(404).json({ error: "Prescription introuvable après update" }); return; }

    await auditService.log({
      module:       "pharmacie",
      action:       "dispensed",
      resourceType: "prescription",
      resourceId:   id,
      newValue:     { status: "delivre", dispensedBy: body.dispensedByName ?? a.userName },
      patientId:    rx.patientId ?? undefined,
      encounterId:  rx.encounterId ?? undefined,
    }, a);

    res.json(mapPrescription(rx));
  } catch (err) { next(err); }
});

export default router;
