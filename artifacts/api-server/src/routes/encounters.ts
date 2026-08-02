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
import { requirePermission } from "../middleware/requirePermission";
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

/**
 * GET /encounters/:encounterId/billable-events
 *
 * Aggregates billable clinical events from multiple source modules:
 *   - Consultations terminées
 *   - Lab orders validées / critiques
 *   - Imaging orders interpretées / réalisées
 *   - Prescriptions délivrées
 *   - Admissions (hospitalisation)
 *
 * Each event carries:
 *   billingStatus: 'unbilled' | 'reserved' | 'billed' | 'cancelled'
 *   billedInvoiceId / billedInvoiceNumber  (if already billed)
 *   unitPrice from service_catalog (0 if not configured = "Tarif non configuré")
 */
router.get("/:encounterId/billable-events", requirePermission("billing.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { encounterId } = req.params;

    // ── Price lookup helper: get default price for a source_module ────────────
    // Returns first active catalog entry per source_module (site-global, site_id IS NULL)
    // We join via a subquery so we get one consistent price per module.

    const { rows } = await pool.query(`
      WITH catalog AS (
        SELECT DISTINCT ON (source_module) source_module, service_code, default_price, name AS catalog_name
          FROM service_catalog
         WHERE active = TRUE AND site_id IS NULL
         ORDER BY source_module, service_code
      ),

      -- ── 1. Consultations terminées ─────────────────────────────────────────
      consultations_events AS (
        SELECT
          c.id                          AS source_entity_id,
          'consultations'::TEXT         AS source_module,
          COALESCE(cat.service_code, 'CONS-GEN')         AS service_code,
          'Consultation: ' || c.specialty || ' — ' || LEFT(c.reason, 80) AS description,
          'consultation'::TEXT          AS category,
          1::NUMERIC                    AS quantity,
          COALESCE(cat.default_price, 0)AS unit_price,
          c.started_at                  AS performed_at,
          c.doctor_name                 AS performed_by
        FROM consultations c
        LEFT JOIN catalog cat ON cat.source_module = 'consultations'
        WHERE c.encounter_id = $1
          AND c.status = 'terminee'
          AND (c.deleted_at IS NULL OR c.deleted_at > NOW())
      ),

      -- ── 2. Lab orders validées / critiques ─────────────────────────────────
      lab_events AS (
        SELECT
          lo.id                         AS source_entity_id,
          'laboratoire'::TEXT           AS source_module,
          COALESCE(cat.service_code, 'LAB-GEN') AS service_code,
          'Analyse: ' || lo.test        AS description,
          'laboratoire'::TEXT           AS category,
          1::NUMERIC                    AS quantity,
          COALESCE(cat.default_price, 0)AS unit_price,
          lo.requested_at               AS performed_at,
          lo.validated_by_name          AS performed_by
        FROM lab_orders lo
        LEFT JOIN catalog cat ON cat.source_module = 'laboratoire'
        WHERE lo.encounter_id = $1
          AND lo.status IN ('validee','critique')
          AND (lo.deleted_at IS NULL OR lo.deleted_at > NOW())
      ),

      -- ── 3. Imaging orders interpretées / réalisées ─────────────────────────
      imaging_events AS (
        SELECT
          io.id                         AS source_entity_id,
          'imagerie'::TEXT              AS source_module,
          COALESCE(cat.service_code, 'IMG-RX') AS service_code,
          'Imagerie: ' || io.exam || ' — ' || io.region AS description,
          'imagerie'::TEXT              AS category,
          1::NUMERIC                    AS quantity,
          COALESCE(cat.default_price, 0)AS unit_price,
          io.requested_at               AS performed_at,
          io.reported_by_name           AS performed_by
        FROM imaging_orders io
        LEFT JOIN catalog cat ON cat.source_module = 'imagerie'
        WHERE io.encounter_id = $1
          AND io.status IN ('interpretee','realisee')
          AND (io.deleted_at IS NULL OR io.deleted_at > NOW())
      ),

      -- ── 4. Prescriptions délivrées ─────────────────────────────────────────
      prescription_events AS (
        SELECT
          pr.id                         AS source_entity_id,
          'pharmacie'::TEXT             AS source_module,
          COALESCE(cat.service_code, 'RX-DRUG') AS service_code,
          'Médicament: ' || pr.drug || ' ' || pr.dosage AS description,
          'medicament'::TEXT            AS category,
          1::NUMERIC                    AS quantity,
          COALESCE(cat.default_price, 0)AS unit_price,
          pr.prescribed_at              AS performed_at,
          pr.dispensed_by_name          AS performed_by
        FROM prescriptions pr
        LEFT JOIN catalog cat ON cat.source_module = 'pharmacie'
        WHERE pr.encounter_id = $1
          AND pr.status = 'delivre'
          AND (pr.deleted_at IS NULL OR pr.deleted_at > NOW())
      ),

      -- ── 5. Admissions (hospitalisation) ────────────────────────────────────
      admission_events AS (
        SELECT
          ad.id                         AS source_entity_id,
          'hospitalisation'::TEXT       AS source_module,
          COALESCE(cat.service_code, 'HOSP-DAY') AS service_code,
          'Hospitalisation: ' || ad.service_name || ' — ' || ad.motif AS description,
          'chambre'::TEXT               AS category,
          GREATEST(1,
            CASE
              WHEN ad.actual_discharge_date IS NOT NULL
              THEN (ad.actual_discharge_date - ad.admission_date)
              ELSE 1
            END
          )::NUMERIC                    AS quantity,
          COALESCE(cat.default_price, 0)AS unit_price,
          ad.admission_date::TIMESTAMPTZ AS performed_at,
          ad.doctor_name                AS performed_by
        FROM admissions ad
        LEFT JOIN catalog cat ON cat.source_module = 'hospitalisation'
        WHERE ad.encounter_id = $1
          AND ad.status NOT IN ('cancelled')
          AND (ad.deleted_at IS NULL OR ad.deleted_at > NOW())
      ),

      -- ── Union all events ────────────────────────────────────────────────────
      all_events AS (
        SELECT * FROM consultations_events
        UNION ALL SELECT * FROM lab_events
        UNION ALL SELECT * FROM imaging_events
        UNION ALL SELECT * FROM prescription_events
        UNION ALL SELECT * FROM admission_events
      )

      SELECT
        ev.*,
        ev.quantity * ev.unit_price                              AS total,
        COALESCE(be.status, 'unbilled')                          AS billing_status,
        be.id                                                    AS billable_event_id,
        be.billed_invoice_item_id,
        inv.id                                                   AS billed_invoice_id,
        inv.invoice_number                                       AS billed_invoice_number
      FROM all_events ev
      LEFT JOIN billable_events be
        ON  be.source_module    = ev.source_module
        AND be.source_entity_id = ev.source_entity_id
      LEFT JOIN invoice_items ii   ON ii.id  = be.billed_invoice_item_id
      LEFT JOIN invoices inv        ON inv.id = ii.invoice_id
                                   AND inv.status NOT IN ('cancelled','refunded')
                                   AND inv.deleted_at IS NULL
      ORDER BY ev.performed_at DESC
    `, [encounterId]);

    res.json(rows.map(r => ({
      sourceEntityId:    r.source_entity_id,
      sourceModule:      r.source_module,
      serviceCode:       r.service_code,
      description:       r.description,
      category:          r.category,
      quantity:          Number(r.quantity),
      unitPrice:         Number(r.unit_price),
      total:             Number(r.total),
      performedAt:       r.performed_at,
      performedBy:       r.performed_by,
      billingStatus:     r.billing_status,       // unbilled | reserved | billed | cancelled
      billableEventId:   r.billable_event_id,
      billedInvoiceId:   r.billed_invoice_id,
      billedInvoiceNumber: r.billed_invoice_number,
    })));
  } catch (err) { next(err); }
});

export default router;
