/**
 * /insurance routes
 *
 * GET  /insurance/policies           — list policies for a patient
 * POST /insurance/policies           — create policy
 * POST /insurance/claims             — create claim
 * PATCH /insurance/claims/:id/status — update claim status
 * GET  /insurance/claims             — list claims
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { auditService } from "../services/audit";
import { requirePermission } from "../middleware/requirePermission";
import type { AuthenticatedRequest } from "../middleware/requireAuth";

const router = Router();

function actor(req: AuthenticatedRequest) {
  return { userId: req.auth?.userId ?? "system", userName: req.auth?.userId ?? "system", userRole: req.auth?.role ?? "guest" };
}

// ── GET /insurance/policies ───────────────────────────────────────────────────

router.get("/policies", requirePermission("insurance.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { patientId } = req.query as { patientId?: string };
    const { rows } = await pool.query(
      `SELECT * FROM insurance_policies ${patientId ? "WHERE patient_id = $1" : ""} ORDER BY created_at DESC`,
      patientId ? [patientId] : [],
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── POST /insurance/policies ──────────────────────────────────────────────────

router.post("/policies", requirePermission("insurance.create_claim"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a    = actor(req);
    const body = req.body as {
      patientId: string; insurerName: string; policyNumber: string; subscriberNumber?: string;
      coverageType: string; coveragePercent?: number; ceilingAmount?: number;
      validFrom?: string; validUntil?: string; notes?: string;
    };
    if (!body.patientId || !body.insurerName || !body.policyNumber || !body.coverageType) {
      res.status(400).json({ error: "patientId, insurerName, policyNumber, coverageType requis" }); return;
    }
    const { rows: [pol] } = await pool.query(
      `INSERT INTO insurance_policies
         (patient_id, insurer_name, policy_number, subscriber_number, coverage_type,
          coverage_percent, ceiling_amount, valid_from, valid_until, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [body.patientId, body.insurerName, body.policyNumber, body.subscriberNumber ?? null,
       body.coverageType, body.coveragePercent ?? 80, body.ceilingAmount ?? null,
       body.validFrom ?? null, body.validUntil ?? null, body.notes ?? null, a.userId],
    );
    await auditService.log({
      userId: a.userId, userName: a.userId, userRole: a.userRole,
      action: "create", module: "billing",
      description: `Police assurance créée: ${pol.policy_number} (${pol.insurer_name})`,
      patientId: body.patientId, resourceId: pol.id, resourceType: "InsurancePolicy",
    });
    res.status(201).json(pol);
  } catch (err) { next(err); }
});

// ── GET /insurance/claims ─────────────────────────────────────────────────────

router.get("/claims", requirePermission("insurance.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { invoiceId, patientId, status } = req.query as Record<string, string>;
    const conds: string[] = ["1=1"];
    const params: unknown[] = [];
    if (invoiceId) { params.push(invoiceId); conds.push(`c.invoice_id = $${params.length}`); }
    if (patientId) { params.push(patientId); conds.push(`c.patient_id = $${params.length}`); }
    if (status && status !== "all") { params.push(status); conds.push(`c.status = $${params.length}`); }

    const { rows } = await pool.query(
      `SELECT c.*, i.invoice_number, p.first_name || ' ' || p.last_name AS patient_name
         FROM insurance_claims c
         JOIN invoices i ON i.id = c.invoice_id
         JOIN patients p ON p.id = c.patient_id
        WHERE ${conds.join(" AND ")}
        ORDER BY c.created_at DESC`,
      params,
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── POST /insurance/claims ────────────────────────────────────────────────────

router.post("/claims", requirePermission("insurance.create_claim"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a    = actor(req);
    const body = req.body as {
      invoiceId: string; patientId: string; policyId?: string;
      insurerName: string; amountRequested: number; notes?: string;
    };
    if (!body.invoiceId || !body.patientId || !body.insurerName || !body.amountRequested) {
      res.status(400).json({ error: "invoiceId, patientId, insurerName, amountRequested requis" }); return;
    }
    const { rows: [numRow] } = await pool.query(
      `SELECT 'CLM-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('claim_number_seq')::TEXT, 6, '0') AS num`
    );
    const { rows: [claim] } = await pool.query(
      `INSERT INTO insurance_claims (claim_number, invoice_id, patient_id, policy_id, insurer_name, amount_requested, notes, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',$8) RETURNING *`,
      [numRow.num, body.invoiceId, body.patientId, body.policyId ?? null,
       body.insurerName, body.amountRequested, body.notes ?? null, a.userId],
    );
    await auditService.log({
      userId: a.userId, userName: a.userId, userRole: a.userRole,
      action: "create", module: "billing",
      description: `Dossier assurance ${numRow.num}: ${body.amountRequested} DZD auprès de ${body.insurerName}`,
      patientId: body.patientId, resourceId: body.invoiceId, resourceType: "InsuranceClaim",
    });
    res.status(201).json(claim);
  } catch (err) { next(err); }
});

// ── PATCH /insurance/claims/:id/status ───────────────────────────────────────

router.patch("/claims/:id/status", async (req: AuthenticatedRequest, res, next) => {
  try {
    const a  = actor(req);
    const id = req.params.id;
    const body = req.body as { status: string; amountApproved?: number; amountPaid?: number; rejectionReason?: string; notes?: string };

    if (!body.status) { res.status(400).json({ error: "status requis" }); return; }

    const VALID = ["draft","submitted","under_review","approved","partially_approved","rejected","paid"];
    if (!VALID.includes(body.status)) { res.status(400).json({ error: `status invalide. Valeurs: ${VALID.join(",")}` }); return; }

    // Permission check based on action
    const permMap: Record<string, string> = { approved: "insurance.approve_claim", rejected: "insurance.reject_claim" };
    const requiredPerm = permMap[body.status];
    if (requiredPerm && req.auth?.role !== "super_admin" && !req.auth?.permissions.includes(requiredPerm)) {
      res.status(403).json({ message: "Permission insuffisante.", required: requiredPerm }); return;
    }

    const { rows: [claim] } = await pool.query(
      `UPDATE insurance_claims SET
         status=$1,
         amount_approved=COALESCE($2, amount_approved),
         amount_paid=COALESCE($3, amount_paid),
         rejection_reason=COALESCE($4, rejection_reason),
         notes=COALESCE($5, notes),
         submitted_at = CASE WHEN $1='submitted' THEN NOW() ELSE submitted_at END,
         reviewed_at  = CASE WHEN $1 IN ('approved','partially_approved','rejected') THEN NOW() ELSE reviewed_at END,
         paid_at      = CASE WHEN $1='paid' THEN NOW() ELSE paid_at END,
         updated_by=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [body.status, body.amountApproved ?? null, body.amountPaid ?? null,
       body.rejectionReason ?? null, body.notes ?? null, a.userId, id],
    );
    if (!claim) { res.status(404).json({ error: "Dossier assurance introuvable" }); return; }

    // If paid: update invoice paid_amount
    if (body.status === "paid" && body.amountPaid) {
      await pool.query(
        `UPDATE invoices SET
           paid_amount = paid_amount + $1,
           remaining_amount = GREATEST(0, remaining_amount - $1),
           due_amount = GREATEST(0, due_amount - $1),
           status = CASE
             WHEN (remaining_amount - $1) <= 0.01 THEN 'paid'
             ELSE 'partially_paid'
           END,
           updated_at=NOW()
         WHERE id=$2`,
        [body.amountPaid, claim.invoice_id],
      );
    }

    await auditService.log({
      userId: a.userId, userName: a.userId, userRole: a.userRole,
      action: "update", module: "billing",
      description: `Dossier assurance ${claim.claim_number} → ${body.status}`,
      resourceId: claim.invoice_id as string, resourceType: "InsuranceClaim",
    });

    res.json(claim);
  } catch (err) { next(err); }
});

export default router;
