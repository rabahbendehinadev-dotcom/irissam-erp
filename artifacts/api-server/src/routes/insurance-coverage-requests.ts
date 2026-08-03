/**
 * Coverage Requests (Prise en charge) routes
 * Prefix: /insurance
 *
 * GET    /coverage-requests
 * POST   /coverage-requests
 * GET    /coverage-requests/:id
 * PATCH  /coverage-requests/:id
 * POST   /coverage-requests/:id/submit
 * POST   /coverage-requests/:id/approve
 * POST   /coverage-requests/:id/reject
 * POST   /coverage-requests/:id/cancel
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../middleware/requirePermission";
import { auditService } from "../services/audit";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import type { ActorCtx } from "../repositories/types";

const router = Router();

function actor(req: AuthenticatedRequest): ActorCtx {
  return { userId: req.auth?.userId ?? "system", userName: req.auth?.userId ?? "system", userRole: req.auth?.role ?? "guest" };
}

const VALID_STATUSES = ["brouillon","soumise","en_cours","infos_requises","approuvee","partiellement_approuvee","refusee","expiree","annulee"];

// GET /coverage-requests
router.get("/coverage-requests", requirePermission("insurance.coverage_requests.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { patientId, organizationId, status, encounterId } = req.query as Record<string, string>;
    const conds = ["cr.deleted_at IS NULL"];
    const params: unknown[] = [];
    if (patientId)      { params.push(patientId);      conds.push(`cr.patient_id = $${params.length}`); }
    if (organizationId) { params.push(organizationId); conds.push(`cr.organization_id = $${params.length}`); }
    if (status)         { params.push(status);         conds.push(`cr.status = $${params.length}`); }
    if (encounterId)    { params.push(encounterId);    conds.push(`cr.encounter_id = $${params.length}`); }
    const { rows } = await pool.query(
      `SELECT cr.*,
              p.first_name || ' ' || p.last_name AS patient_name, p.mrn AS patient_mrn,
              io.name AS organization_name, io.code AS organization_code,
              ip.policy_number
         FROM coverage_requests cr
         LEFT JOIN patients              p  ON p.id  = cr.patient_id
         LEFT JOIN insurance_organizations io ON io.id = cr.organization_id
         LEFT JOIN insurance_policies    ip  ON ip.id = cr.policy_id
        WHERE ${conds.join(" AND ")}
        ORDER BY cr.created_at DESC`,
      params,
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /coverage-requests
router.post("/coverage-requests", requirePermission("insurance.coverage_requests.create"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const b = req.body as {
      patientId: string; encounterId?: string; admissionId?: string;
      policyId?: string; organizationId?: string;
      requestedAmount?: number; requestedServices?: unknown[];
      expectedResponseDate?: string; notes?: string;
    };
    if (!b.patientId) { res.status(400).json({ error: "patientId requis" }); return; }
    const { rows: [numRow] } = await pool.query(
      `SELECT 'PEC-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('coverage_request_seq')::TEXT, 6, '0') AS num`,
    );
    const { rows: [cr] } = await pool.query(
      `INSERT INTO coverage_requests
         (request_number, patient_id, encounter_id, admission_id, policy_id, organization_id,
          requested_amount, requested_services, expected_response_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [numRow.num, b.patientId, b.encounterId ?? null, b.admissionId ?? null, b.policyId ?? null, b.organizationId ?? null,
       b.requestedAmount != null ? b.requestedAmount.toFixed(2) : null,
       b.requestedServices ? JSON.stringify(b.requestedServices) : null,
       b.expectedResponseDate ?? null, b.notes ?? null, a.userId],
    );
    await auditService.log({ module: "system", action: "create", resourceType: "CoverageRequest", resourceId: cr.id as string, patientId: b.patientId }, a);
    res.status(201).json(cr);
  } catch (err) { next(err); }
});

// GET /coverage-requests/:id
router.get("/coverage-requests/:id", requirePermission("insurance.coverage_requests.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { rows: [cr] } = await pool.query(
      `SELECT cr.*,
              p.first_name || ' ' || p.last_name AS patient_name, p.mrn,
              io.name AS organization_name, io.code AS organization_code
         FROM coverage_requests cr
         LEFT JOIN patients              p  ON p.id  = cr.patient_id
         LEFT JOIN insurance_organizations io ON io.id = cr.organization_id
        WHERE cr.id = $1 AND cr.deleted_at IS NULL`,
      [String(req.params.id)],
    );
    if (!cr) { res.status(404).json({ error: "Prise en charge introuvable" }); return; }
    res.json(cr);
  } catch (err) { next(err); }
});

// PATCH /coverage-requests/:id
router.patch("/coverage-requests/:id", requirePermission("insurance.coverage_requests.update"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const b = req.body as { requestedAmount?: number; requestedServices?: unknown[]; expectedResponseDate?: string; notes?: string };
    const sets: string[] = []; const params: unknown[] = [];
    if (b.requestedAmount  != null) { params.push(b.requestedAmount.toFixed(2)); sets.push(`requested_amount = $${params.length}`); }
    if (b.requestedServices)        { params.push(JSON.stringify(b.requestedServices)); sets.push(`requested_services = $${params.length}`); }
    if (b.expectedResponseDate)     { params.push(b.expectedResponseDate); sets.push(`expected_response_date = $${params.length}`); }
    if (b.notes !== undefined)      { params.push(b.notes); sets.push(`notes = $${params.length}`); }
    if (!sets.length) { res.status(400).json({ error: "Aucun champ à modifier" }); return; }
    params.push(a.userId, String(req.params.id));
    const { rows: [updated] } = await pool.query(
      `UPDATE coverage_requests SET ${sets.join(",")}, updated_by=$${params.length-1}, updated_at=NOW(), version=version+1 WHERE id=$${params.length} AND deleted_at IS NULL RETURNING *`,
      params,
    );
    if (!updated) { res.status(404).json({ error: "Prise en charge introuvable" }); return; }
    await auditService.log({ module: "system", action: "update", resourceType: "CoverageRequest", resourceId: String(req.params.id) }, a);
    res.json(updated);
  } catch (err) { next(err); }
});

// POST /coverage-requests/:id/submit
router.post("/coverage-requests/:id/submit", requirePermission("insurance.coverage_requests.update"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const { rows: [updated] } = await pool.query(
      `UPDATE coverage_requests SET status='soumise', updated_by=$1, updated_at=NOW(), version=version+1 WHERE id=$2 AND status='brouillon' AND deleted_at IS NULL RETURNING *`,
      [a.userId, String(req.params.id)],
    );
    if (!updated) { res.status(404).json({ error: "Demande introuvable ou déjà soumise" }); return; }
    await auditService.log({ module: "system", action: "update", resourceType: "CoverageRequest", resourceId: String(req.params.id), newValue: { status: "soumise" } }, a);
    res.json(updated);
  } catch (err) { next(err); }
});

// POST /coverage-requests/:id/approve
router.post("/coverage-requests/:id/approve", requirePermission("insurance.claims.approve"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const { approvedAmount, patientShare, organizationShare, notes } = req.body as { approvedAmount: number; patientShare?: number; organizationShare?: number; notes?: string };
    if (approvedAmount == null) { res.status(400).json({ error: "approvedAmount requis" }); return; }
    const { rows: [updated] } = await pool.query(
      `UPDATE coverage_requests
         SET status = CASE WHEN $1 < requested_amount THEN 'partiellement_approuvee' ELSE 'approuvee' END,
             approved_amount = $1, patient_share = $2, organization_share = $3,
             decision_date = NOW(), decision_by = $4,
             notes = COALESCE($5, notes),
             updated_by = $4, updated_at = NOW(), version = version + 1
       WHERE id = $6 AND deleted_at IS NULL RETURNING *`,
      [approvedAmount.toFixed(2), (patientShare ?? 0).toFixed(2), (organizationShare ?? approvedAmount).toFixed(2), a.userId, notes ?? null, String(req.params.id)],
    );
    if (!updated) { res.status(404).json({ error: "Demande introuvable" }); return; }
    await auditService.log({ module: "system", action: "update", resourceType: "CoverageRequest", resourceId: String(req.params.id), newValue: { status: updated.status, approvedAmount } }, a);
    res.json(updated);
  } catch (err) { next(err); }
});

// POST /coverage-requests/:id/reject
router.post("/coverage-requests/:id/reject", requirePermission("insurance.claims.reject"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const { reason } = req.body as { reason: string };
    if (!reason?.trim()) { res.status(400).json({ error: "Le motif de refus est obligatoire" }); return; }
    const { rows: [updated] } = await pool.query(
      `UPDATE coverage_requests SET status='refusee', rejection_reason=$1, decision_date=NOW(), decision_by=$2, updated_by=$2, updated_at=NOW(), version=version+1 WHERE id=$3 AND deleted_at IS NULL RETURNING *`,
      [reason, a.userId, String(req.params.id)],
    );
    if (!updated) { res.status(404).json({ error: "Demande introuvable" }); return; }
    await auditService.log({ module: "system", action: "update", resourceType: "CoverageRequest", resourceId: String(req.params.id), newValue: { status: "refusee", reason } }, a);
    res.json(updated);
  } catch (err) { next(err); }
});

// POST /coverage-requests/:id/cancel
router.post("/coverage-requests/:id/cancel", requirePermission("insurance.coverage_requests.update"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const { rows: [updated] } = await pool.query(
      `UPDATE coverage_requests SET status='annulee', updated_by=$1, updated_at=NOW(), version=version+1 WHERE id=$2 AND status NOT IN ('approuvee','refusee') AND deleted_at IS NULL RETURNING *`,
      [a.userId, String(req.params.id)],
    );
    if (!updated) { res.status(404).json({ error: "Demande introuvable ou ne peut pas être annulée" }); return; }
    await auditService.log({ module: "system", action: "update", resourceType: "CoverageRequest", resourceId: String(req.params.id), newValue: { status: "annulee" } }, a);
    res.json(updated);
  } catch (err) { next(err); }
});

export default router;
