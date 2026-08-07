/**
 * /prescriptions routes — backed by ClinicalOrderService + PharmacyService.
 *
 * GET   /prescriptions              — list (filtres patientId / encounterId / status)
 * GET   /prescriptions/:id          — single
 * POST  /prescriptions              — create (consultations.create_prescription | emergencies.prescribe)
 *                                     valide patient + encounter (appartenance) + médicament réel
 * PATCH /prescriptions/:id/status   — prepare (pharmacy.prepare) | annule (prescripteur ou pharmacie)
 *                                     « delivre » est refusé ici : passage obligatoire par /dispense
 * POST  /prescriptions/:id/dispense — délivrance réelle (pharmacy.dispense) :
 *                                     déduction de stock atomique, quantité entière ≥ 1,
 *                                     refus si annulée / déjà délivrée / stock insuffisant / expiré
 */
import { Router } from "express";
import { clinicalOrderService, ClinicalValidationError } from "../services/clinicalOrder";
import { pharmacyService, InsufficientStockError } from "../services/pharmacy";
import { repos } from "../repositories";
import { safeUuid } from "../repositories/types";
import { auditService } from "../services/audit";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import {
  requirePermission, requireAnyPermission, hasPermission, denyWithAudit,
} from "../middleware/requirePermission";
import type { ActorCtx } from "../repositories/types";
import type { DbPrescription } from "../repositories/prescription";

const router = Router();

function actor(req: AuthenticatedRequest): ActorCtx {
  const fullName = [req.auth?.firstName, req.auth?.lastName]
    .filter(Boolean).join(" ").trim();
  return {
    userId:   req.auth?.userId ?? "system",
    userName: fullName || (req.auth?.userId ?? "system"),
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
    medicationId:      p.medicationId ?? null,
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
router.get("/", requirePermission("pharmacy.view"), async (req, res, next) => {
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
router.get("/:id", requirePermission("pharmacy.view"), async (req, res, next) => {
  try {
    const row = await repos.prescription.findById(String(req.params.id));
    if (!row) { res.status(404).json({ error: "Prescription not found" }); return; }
    res.json(mapPrescription(row));
  } catch (err) { next(err); }
});

const RX_SOURCE_MODULES = new Set(["urgences", "consultations", "hospitalisation"]);

/** POST /prescriptions — prescripteurs uniquement */
router.post(
  "/",
  requireAnyPermission(["consultations.create_prescription", "emergencies.prescribe"]),
  async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = req.body as {
      patientId?:       string;
      encounterId?:     string;
      patientName?:     string;
      visitId?:         string;
      medicationId?:    string;
      drug?:            string;
      dosage?:          string;
      route?:           string;
      frequency?:       string;
      duration?:        string;
      notes?:           string;
      sourceModule?:    string;
    };

    const patientId   = body.patientId   ? safeUuid(body.patientId)   : null;
    const encounterId = body.encounterId ? safeUuid(body.encounterId) : null;
    if (!patientId)   { res.status(400).json({ error: "patientId requis (UUID valide)" }); return; }
    if (!encounterId) { res.status(400).json({ error: "encounterId requis — aucune prescription sans encounter réel" }); return; }
    if (!body.dosage?.trim())    { res.status(400).json({ error: "dosage requis" }); return; }
    if (!body.route?.trim())     { res.status(400).json({ error: "route requis" }); return; }
    if (!body.frequency?.trim()) { res.status(400).json({ error: "frequency requis" }); return; }

    // Patient réel obligatoire
    const patient = await repos.patient.findById(patientId);
    if (!patient) { res.status(400).json({ error: "Patient introuvable — prescription refusée" }); return; }

    // Encounter réel ET appartenant à ce patient (anti-IDOR)
    const encounter = await repos.encounter.findById(encounterId);
    if (!encounter) { res.status(400).json({ error: "Encounter introuvable — aucune prescription sans encounter réel" }); return; }
    if (encounter.patientId !== patientId) {
      res.status(400).json({ error: "L'encounter n'appartient pas à ce patient — prescription refusée" }); return;
    }

    // Médicament du stock (optionnel mais recommandé) : s'il est fourni, il doit
    // exister — et son nom devient la désignation officielle de la prescription.
    let medicationId: string | null = null;
    let drug = body.drug?.trim() ?? "";
    if (body.medicationId) {
      medicationId = safeUuid(body.medicationId) ?? null;
      if (!medicationId) { res.status(400).json({ error: "medicationId invalide (UUID attendu)" }); return; }
      const med = await repos.medication.findById(medicationId);
      if (!med) { res.status(400).json({ error: "Médicament introuvable dans le stock pharmacie" }); return; }
      drug = med.name;
    }
    if (!drug) { res.status(400).json({ error: "drug requis (ou medicationId d'un médicament du stock)" }); return; }

    const a = actor(req);
    const sourceModule = RX_SOURCE_MODULES.has(body.sourceModule ?? "")
      ? body.sourceModule as "urgences" | "consultations" | "hospitalisation"
      : "urgences";

    const rx = await clinicalOrderService.createPrescription({
      patientId,
      encounterId,
      patientName:      body.patientName?.trim() || `${patient.firstName} ${patient.lastName}`.trim(),
      visitId:          body.visitId ?? null,
      medicationId,
      drug,
      dosage:           body.dosage.trim(),
      route:            body.route.trim(),
      frequency:        body.frequency.trim(),
      duration:         body.duration ?? null,
      notes:            body.notes ?? null,
      prescribedById:   safeUuid(a.userId) ?? null,
      // Prescripteur = utilisateur authentifié (jamais un nom arbitraire du client)
      prescribedByName: a.userName,
      sourceModule,
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

/**
 * PATCH /prescriptions/:id/status — transitions contrôlées.
 *   prepare : pharmacy.prepare, uniquement depuis « prescrit »
 *   annule  : prescripteur (consultations.create_prescription | emergencies.prescribe)
 *             ou pharmacie (pharmacy.prepare), jamais depuis « delivre »
 *   delivre : REFUSÉ ici — la délivrance passe par POST /:id/dispense (stock)
 */
router.patch("/:id/status", async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const { status } = req.body as { status?: string };
    if (!status) { res.status(400).json({ error: "status requis" }); return; }

    if (status === "delivre") {
      res.status(400).json({
        error: "La délivrance passe obligatoirement par POST /prescriptions/:id/dispense (déduction de stock)",
      });
      return;
    }
    if (status !== "prepare" && status !== "annule") {
      res.status(400).json({ error: "Statut invalide — valeurs autorisées : prepare, annule" });
      return;
    }

    if (status === "prepare") {
      if (!hasPermission(req, "pharmacy.prepare")) {
        denyWithAudit(req, res, "pharmacy.prepare"); return;
      }
    } else {
      const allowed = ["consultations.create_prescription", "emergencies.prescribe", "pharmacy.prepare"];
      if (!allowed.some(p => hasPermission(req, p))) {
        denyWithAudit(req, res, allowed.join("|")); return;
      }
    }

    const existing = await repos.prescription.findById(id);
    if (!existing) { res.status(404).json({ error: "Prescription introuvable" }); return; }

    if (status === "prepare" && existing.status !== "prescrit") {
      res.status(409).json({ error: `Transition impossible : ${existing.status} → prepare` }); return;
    }
    if (status === "annule") {
      if (existing.status === "delivre") { res.status(409).json({ error: "Prescription déjà délivrée — annulation impossible" }); return; }
      if (existing.status === "annule")  { res.status(409).json({ error: "Prescription déjà annulée" }); return; }
    }

    const a   = actor(req);
    const now = new Date();
    const rx = await repos.prescription.update(id, {
      status,
      ...(status === "prepare" ? {
        preparedById:   safeUuid(a.userId),
        preparedByName: a.userName,
        preparedAt:     now,
      } : {}),
    }, { ...a });
    if (!rx) { res.status(404).json({ error: "Prescription introuvable" }); return; }

    await auditService.log({
      module: "pharmacie", action: "status_changed",
      resourceType: "prescription", resourceId: id,
      oldValue: { status: existing.status },
      newValue: { status },
      patientId: rx.patientId ?? undefined,
      encounterId: rx.encounterId ?? undefined,
    }, a);
    res.json(mapPrescription(rx));
  } catch (err) { next(err); }
});

/** POST /prescriptions/:id/dispense — délivrance réelle avec déduction de stock */
router.post("/:id/dispense", requirePermission("pharmacy.dispense"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const id   = String(req.params.id);
    const body = req.body as {
      medicationId?:     string;
      quantity?:         number;
      dispensedByName?:  string;
      dispenserComment?: string;
    };

    const quantity = Number(body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      res.status(400).json({ error: "quantity requise : entier ≥ 1 (unités déduites du stock)" }); return;
    }

    const existing = await repos.prescription.findById(id);
    if (!existing) { res.status(404).json({ error: "Prescription introuvable" }); return; }
    if (existing.status === "annule") {
      res.status(409).json({ error: "Impossible de délivrer une prescription annulée" }); return;
    }
    if (existing.status === "delivre") {
      res.status(409).json({ error: "Prescription déjà délivrée" }); return;
    }

    // Médicament : lien porté par la prescription, sinon fourni à la délivrance
    let medicationId = existing.medicationId ?? null;
    if (!medicationId && body.medicationId) {
      medicationId = safeUuid(body.medicationId) ?? null;
      if (!medicationId) { res.status(400).json({ error: "medicationId invalide (UUID attendu)" }); return; }
    }
    if (!medicationId) {
      res.status(400).json({
        error: "Aucun médicament du stock lié à cette prescription — indiquez medicationId pour délivrer",
      });
      return;
    }

    const med = await repos.medication.findById(medicationId);
    if (!med) { res.status(400).json({ error: "Médicament introuvable dans le stock pharmacie" }); return; }

    // Médicament expiré → refus (aucune délivrance de produit périmé)
    if (med.expiryDate) {
      const exp   = new Date(med.expiryDate as unknown as string).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      if (exp < today) {
        res.status(409).json({ error: `Médicament expiré le ${exp} — délivrance refusée` }); return;
      }
    }

    const a = actor(req);
    const rx = await pharmacyService.dispense(id, medicationId, quantity, a, {
      dispensedByName:  body.dispensedByName ?? null,
      dispenserComment: body.dispenserComment ?? null,
    });

    res.json(mapPrescription(rx));
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      res.status(409).json({ error: err.message }); return;
    }
    if (err instanceof Error && /déjà délivrée|annulée/.test(err.message)) {
      res.status(409).json({ error: err.message }); return;
    }
    next(err);
  }
});

export default router;
