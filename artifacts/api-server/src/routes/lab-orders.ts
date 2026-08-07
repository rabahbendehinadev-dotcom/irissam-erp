/**
 * /lab-orders routes — backed by ClinicalOrderService + LabOrderRepository.
 *
 * GET  /lab-orders                       — list (filter by patientId, encounterId, status)
 * GET  /lab-orders/:id                   — single
 * POST /lab-orders                       — create
 * PATCH /lab-orders/:id/status           — update status
 * POST /lab-orders/:id/result            — validate result (sets validee/critique)
 */
import { Router } from "express";
import { clinicalOrderService, ClinicalValidationError } from "../services/clinicalOrder";
import { repos } from "../repositories";
import { safeUuid } from "../repositories/types";
import { auditService } from "../services/audit";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import { requirePermission, hasPermission, denyWithAudit } from "../middleware/requirePermission";
import type { ActorCtx } from "../repositories/types";
import type { DbLabOrder } from "../repositories/labOrder";

const router = Router();

function actor(req: AuthenticatedRequest): ActorCtx {
  const fullName = [req.auth?.firstName, req.auth?.lastName]
    .filter(Boolean).join(" ").trim();
  return {
    userId:   req.auth?.userId ?? "system",
    userName: fullName || req.auth?.userId || "system",
    userRole: req.auth?.role   ?? "guest",
  };
}

function mapLabOrder(o: DbLabOrder) {
  return {
    id:               o.id,
    encounterId:      o.encounterId ?? null,
    patientId:        o.patientId,
    patientName:      o.patientName,
    visitId:          o.visitId ?? null,
    test:             o.test,
    category:         o.category,
    urgency:          o.urgency,
    requestedById:    o.requestedById ?? null,
    requestedByName:  o.requestedByName,
    requestedAt:      o.requestedAt?.toISOString() ?? null,
    status:           o.status,
    result:           o.result ?? null,
    isCritical:       o.isCritical ?? false,
    resultAt:         o.resultAt?.toISOString() ?? null,
    validatedById:    o.validatedById ?? null,
    validatedByName:  o.validatedByName ?? null,
    laboratory:       o.laboratory ?? null,
    sourceModule:     o.sourceModule,
    updatedAt:        o.updatedAt.toISOString(),
  };
}

/** GET /lab-orders */
router.get("/", requirePermission("laboratory.view"), async (req, res, next) => {
  try {
    const { patientId, encounterId, status, limit, offset } = req.query as Record<string, string>;
    const result = await repos.labOrder.list({
      patientId,
      encounterId,
      status,
      limit:  limit  ? parseInt(limit,  10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    res.json(result.data.map(mapLabOrder));
  } catch (err) { next(err); }
});

/** GET /lab-orders/:id */
router.get("/:id", requirePermission("laboratory.view"), async (req, res, next) => {
  try {
    const row = await repos.labOrder.findById(String(req.params.id));
    if (!row) { res.status(404).json({ error: "Lab order not found" }); return; }
    res.json(mapLabOrder(row));
  } catch (err) { next(err); }
});

/** POST /lab-orders */
router.post("/", requirePermission("laboratory.create"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = req.body as {
      patientId?:      string;
      encounterId?:    string;
      patientName?:    string;
      visitId?:        string;
      test?:           string;
      category?:       string;
      urgency?:        string;
      requestedByName?:string;
      laboratory?:     string;
      sourceModule?:   string;
    };
    if (!body.patientId)  { res.status(400).json({ error: "patientId requis" }); return; }
    if (!body.encounterId){ res.status(400).json({ error: "encounterId requis — aucun ordre sans encounter réel" }); return; }
    if (!body.test?.trim()){ res.status(400).json({ error: "test (nom de l'examen) requis" }); return; }

    // Anti-IDOR : patient réel + encounter appartenant à CE patient
    const patient = await repos.patient.findById(body.patientId);
    if (!patient) { res.status(400).json({ error: "Patient introuvable — ordre refusé" }); return; }
    const encounter = await repos.encounter.findById(body.encounterId);
    if (!encounter) { res.status(400).json({ error: "Encounter introuvable — ordre refusé" }); return; }
    if (encounter.patientId !== body.patientId) {
      res.status(400).json({ error: "L'encounter n'appartient pas à ce patient — ordre refusé" }); return;
    }

    const a = actor(req);
    const order = await clinicalOrderService.createLabOrder({
      patientId:       body.patientId,
      encounterId:     body.encounterId,
      patientName:     `${patient.firstName} ${patient.lastName}`.trim(),
      visitId:         body.visitId ?? null,
      test:            body.test.trim(),
      category:        body.category ?? "biologie",
      urgency:         (body.urgency as any) ?? "routine",
      requestedById:   safeUuid(a.userId) ?? null,
      requestedByName: a.userName, // server-authoritative — le demandeur est l'utilisateur authentifié
      laboratory:      body.laboratory ?? null,
      sourceModule:    (body.sourceModule as any) ?? "urgences",
      status:          "demandee",
    }, a);

    res.status(201).json(mapLabOrder(order));
  } catch (err) {
    if (err instanceof ClinicalValidationError) {
      res.status(400).json({ error: err.message }); return;
    }
    next(err);
  }
});

/** PATCH /lab-orders/:id/status — transitions du flux labo (hors validation de résultat) */
const STATUS_PERMS: Record<string, string> = {
  prelevee: "laboratory.collect",   // prélèvement de l'échantillon
  en_cours: "laboratory.validate",  // mise en analyse (personnel laboratoire)
  annulee:  "laboratory.create",    // annulation par le prescripteur / labo
};
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  demandee: ["prelevee", "annulee"],
  prelevee: ["en_cours", "annulee"],
  en_cours: ["annulee"],
  // validee / critique / annulee : états terminaux — aucune transition via PATCH
};

router.patch("/:id/status", async (req: AuthenticatedRequest, res, next) => {
  try {
    const id     = String(req.params.id);
    const { status } = req.body as { status?: string };
    if (!status) { res.status(400).json({ error: "status requis" }); return; }
    if (status === "validee" || status === "critique") {
      res.status(400).json({ error: "Utilisez POST /lab-orders/:id/result pour valider un résultat" }); return;
    }
    const perm = STATUS_PERMS[status];
    if (!perm) { res.status(400).json({ error: `Statut invalide : ${status}` }); return; }
    if (!hasPermission(req, perm)) { await denyWithAudit(req, res, perm); return; }

    const existing = await repos.labOrder.findById(id);
    if (!existing) { res.status(404).json({ error: "Lab order introuvable" }); return; }
    const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(status)) {
      res.status(409).json({ error: `Transition ${existing.status} → ${status} interdite` }); return;
    }

    const order = await clinicalOrderService.updateLabOrderStatus(id, status, actor(req));
    res.json(mapLabOrder(order));
  } catch (err) { next(err); }
});

/** POST /lab-orders/:id/result — validate lab result */
router.post("/:id/result", requirePermission("laboratory.validate"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const body = req.body as {
      result?:          string;
      isCritical?:      boolean;
      validatedByName?: string;
    };
    if (!body.result?.trim()) { res.status(400).json({ error: "result requis" }); return; }

    const existing = await repos.labOrder.findById(id);
    if (!existing) { res.status(404).json({ error: "Lab order introuvable" }); return; }
    if (existing.status === "validee" || existing.status === "critique") {
      res.status(409).json({ error: "Résultat déjà validé — modification interdite" }); return;
    }
    if (existing.status === "annulee") {
      res.status(409).json({ error: "Ordre annulé — validation impossible" }); return;
    }
    if (existing.status !== "en_cours") {
      res.status(409).json({ error: `Validation impossible depuis le statut « ${existing.status} » — l'analyse doit être en cours` }); return;
    }

    const a  = actor(req);
    const isCritical = body.isCritical ?? false;
    const newStatus  = isCritical ? "critique" : "validee";

    const order = await repos.labOrder.update(id, {
      result:          body.result.trim(),
      isCritical,
      resultAt:        new Date(),
      validatedById:   safeUuid(a.userId) ?? null,
      validatedByName: a.userName, // server-authoritative — le validateur est l'utilisateur authentifié
      status:          newStatus as any,
    }, { ...a });

    if (!order) { res.status(404).json({ error: "Lab order introuvable" }); return; }

    await auditService.log({
      module:       "laboratoire",
      action:       isCritical ? "critical_result" : "result_validated",
      resourceType: "lab_order",
      resourceId:   id,
      newValue:     { result: body.result, isCritical, status: newStatus },
      patientId:    order.patientId ?? undefined,
      encounterId:  order.encounterId ?? undefined,
    }, a);

    res.json(mapLabOrder(order));
  } catch (err) { next(err); }
});

export default router;
