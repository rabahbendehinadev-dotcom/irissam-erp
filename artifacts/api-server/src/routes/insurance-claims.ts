/**
 * Insurance Claims routes (full workflow)
 * Prefix: /insurance
 *
 * GET    /claims
 * POST   /claims                        — create (basic, without coverage calc)
 * POST   /claims/from-invoice           — create with full coverage calculation
 * GET    /claims/:id
 * POST   /claims/:id/submit
 * POST   /claims/:id/approve
 * POST   /claims/:id/partial-approve
 * POST   /claims/:id/reject
 * POST   /claims/:id/mark-paid
 * POST   /claims/:id/transfer-rejected
 * GET    /claims/:id/items
 * PATCH  /claims/:id/items/:itemId
 * PATCH  /claims/:id/status             — kept for backward compat
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission, requireAnyPermission } from "../middleware/requirePermission";
import { auditService } from "../services/audit";
import { insuranceService } from "../services/insuranceService";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import type { ActorCtx } from "../repositories/types";

const router = Router();

function actor(req: AuthenticatedRequest): ActorCtx {
  return { userId: req.auth?.userId ?? "system", userName: req.auth?.userId ?? "system", userRole: req.auth?.role ?? "guest" };
}

const VALID_STATUSES = ["draft","submitted","under_review","approved","partially_approved","rejected","paid","partially_paid","cancelled"];

// ── GET /claims ───────────────────────────────────────────────────────────────
router.get("/claims", requirePermission("insurance.claims.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { invoiceId, patientId, organizationId, status, bordereauId, overdue, dateFrom, dateTo, search } = req.query as Record<string, string>;
    const conds = ["c.deleted_at IS NULL"];
    const params: unknown[] = [];
    if (invoiceId)      { params.push(invoiceId);      conds.push(`c.invoice_id = $${params.length}`); }
    if (patientId)      { params.push(patientId);      conds.push(`c.patient_id = $${params.length}`); }
    if (organizationId) { params.push(organizationId); conds.push(`c.organization_id = $${params.length}`); }
    if (bordereauId)    { params.push(bordereauId);    conds.push(`c.bordereau_id = $${params.length}`); }
    if (status && status !== "all") { params.push(status); conds.push(`c.status = $${params.length}`); }
    if (overdue === "true") { conds.push(`c.submitted_at IS NOT NULL AND c.status NOT IN ('paid','rejected') AND c.submitted_at < NOW() - INTERVAL '30 days'`); }
    if (dateFrom) { params.push(dateFrom); conds.push(`c.created_at >= $${params.length}`); }
    if (dateTo)   { params.push(dateTo);   conds.push(`c.created_at <= $${params.length}::timestamptz + INTERVAL '1 day'`); }
    if (search) {
      params.push(`%${search}%`);
      conds.push(`(c.claim_number ILIKE $${params.length} OR c.insurer_name ILIKE $${params.length} OR p.first_name || ' ' || p.last_name ILIKE $${params.length})`);
    }

    const { rows } = await pool.query(
      `SELECT c.*,
              COALESCE(c.amount_requested_num, c.amount_requested::NUMERIC, 0) AS amount_requested_calc,
              COALESCE(c.amount_approved_num,  c.amount_approved::NUMERIC,  0) AS amount_approved_calc,
              c.amount_paid_num,
              i.invoice_number, i.total_amount AS invoice_total,
              p.first_name || ' ' || p.last_name AS patient_name, p.mrn AS patient_mrn,
              io.name  AS organization_name,  io.code AS organization_code,
              io.avg_payment_days,
              b.bordereau_number,
              EXTRACT(DAY FROM NOW() - c.submitted_at) AS days_elapsed,
              CASE WHEN c.submitted_at IS NOT NULL AND c.status NOT IN ('paid','rejected','cancelled')
                        AND c.submitted_at < NOW() - INTERVAL '30 days' THEN TRUE ELSE FALSE END AS is_overdue
         FROM insurance_claims c
         LEFT JOIN invoices               i  ON i.id  = c.invoice_id
         LEFT JOIN patients               p  ON p.id  = c.patient_id
         LEFT JOIN insurance_organizations io ON io.id = c.organization_id
         LEFT JOIN insurance_bordereaux   b  ON b.id  = c.bordereau_id
        WHERE ${conds.join(" AND ")}
        ORDER BY c.created_at DESC`,
      params,
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── POST /claims/from-invoice  (full coverage calculation) ───────────────────
router.post("/claims/from-invoice", requirePermission("insurance.claims.create"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const b = req.body as { invoiceId: string; patientId: string; policyId: string; organizationId: string; notes?: string };
    if (!b.invoiceId || !b.patientId || !b.policyId || !b.organizationId) {
      res.status(400).json({ error: "invoiceId, patientId, policyId, organizationId requis" }); return;
    }
    const result = await insuranceService.createClaimFromInvoice(b, a);
    res.status(201).json(result);
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    if (e.status) { res.status(e.status).json({ error: e.message }); return; }
    next(err);
  }
});

// ── POST /claims  (simple creation, no auto-calc) ────────────────────────────
router.post("/claims", requirePermission("insurance.claims.create"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const b = req.body as {
      invoiceId: string; patientId: string; policyId?: string;
      organizationId?: string; insurerName: string; amountRequested: number; notes?: string;
    };
    if (!b.invoiceId || !b.patientId || !b.insurerName || b.amountRequested == null) {
      res.status(400).json({ error: "invoiceId, patientId, insurerName, amountRequested requis" }); return;
    }
    const { rows: [numRow] } = await pool.query(`SELECT 'CLM-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('claim_number_seq')::TEXT, 6, '0') AS num`);
    const { rows: [claim] } = await pool.query(
      `INSERT INTO insurance_claims (claim_number, invoice_id, patient_id, policy_id, organization_id, insurer_name, amount_requested, amount_requested_num, status, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9,$10) RETURNING *`,
      [numRow.num, b.invoiceId, b.patientId, b.policyId ?? null, b.organizationId ?? null,
       b.insurerName, b.amountRequested, b.amountRequested.toFixed(2), b.notes ?? null, a.userId],
    );
    await auditService.log({ module: "system", action: "create", resourceType: "InsuranceClaim", resourceId: claim.id as string, patientId: b.patientId }, a);
    res.status(201).json(claim);
  } catch (err) { next(err); }
});

// ── GET /claims/:id ───────────────────────────────────────────────────────────
router.get("/claims/:id", requirePermission("insurance.claims.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const [{ rows: [claim] }, { rows: items }] = await Promise.all([
      pool.query(
        `SELECT c.*,
                COALESCE(c.amount_requested_num, c.amount_requested::NUMERIC, 0) AS amount_requested_calc,
                COALESCE(c.amount_approved_num,  c.amount_approved::NUMERIC,  0) AS amount_approved_calc,
                i.invoice_number, i.total_amount AS invoice_total,
                p.first_name || ' ' || p.last_name AS patient_name, p.mrn,
                io.name AS organization_name, io.code AS organization_code,
                ip.policy_number, ip.coverage_percent_num AS policy_coverage_percent,
                ip.ceiling_amount_num AS policy_ceiling,
                b.bordereau_number
           FROM insurance_claims c
           LEFT JOIN invoices               i  ON i.id  = c.invoice_id
           LEFT JOIN patients               p  ON p.id  = c.patient_id
           LEFT JOIN insurance_organizations io ON io.id = c.organization_id
           LEFT JOIN insurance_policies     ip ON ip.id = c.policy_id
           LEFT JOIN insurance_bordereaux   b  ON b.id  = c.bordereau_id
          WHERE c.id = $1 AND c.deleted_at IS NULL`,
        [String(req.params.id)],
      ),
      pool.query(
        `SELECT ci.*, ii.description AS invoice_item_description
           FROM insurance_claim_items ci
           LEFT JOIN invoice_items ii ON ii.id = ci.invoice_item_id
          WHERE ci.claim_id = $1 ORDER BY ci.created_at`,
        [String(req.params.id)],
      ),
    ]);
    if (!claim) { res.status(404).json({ error: "Dossier assurance introuvable" }); return; }
    res.json({ ...claim, items });
    await auditService.logActivity({ module: "system", action: "view", resourceType: "InsuranceClaim", resourceId: String(req.params.id) }, actor(req));
  } catch (err) { next(err); }
});

// ── POST /claims/:id/submit ───────────────────────────────────────────────────
router.post("/claims/:id/submit", requirePermission("insurance.claims.submit"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const { rows: [updated] } = await pool.query(
      `UPDATE insurance_claims SET status='submitted', submitted_at=NOW(), updated_by=$1, updated_at=NOW(), version=version+1 WHERE id=$2 AND status IN ('draft','under_review') AND deleted_at IS NULL RETURNING *`,
      [a.userId, String(req.params.id)],
    );
    if (!updated) { res.status(404).json({ error: "Dossier introuvable ou ne peut pas être soumis" }); return; }
    await auditService.log({ module: "system", action: "update", resourceType: "InsuranceClaim", resourceId: String(req.params.id), newValue: { status: "submitted" } }, a);
    res.json(updated);
  } catch (err) { next(err); }
});

// ── POST /claims/:id/approve ──────────────────────────────────────────────────
router.post("/claims/:id/approve", requirePermission("insurance.claims.approve"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const raw = req.body as { amountApproved: number | string; notes?: string };
    if (raw.amountApproved == null) { res.status(400).json({ error: "amountApproved requis" }); return; }
    const amountApproved = Number(raw.amountApproved);
    if (isNaN(amountApproved) || amountApproved < 0) { res.status(400).json({ error: "amountApproved doit être un nombre positif" }); return; }
    const { notes } = raw;
    const { rows: [claim] } = await pool.query(`SELECT * FROM insurance_claims WHERE id=$1 AND deleted_at IS NULL`, [String(req.params.id)]);
    if (!claim) { res.status(404).json({ error: "Dossier introuvable" }); return; }

    // Approve all items
    await pool.query(
      `UPDATE insurance_claim_items SET amount_approved=amount_requested, amount_rejected=0, status='approved', updated_by=$1, updated_at=NOW() WHERE claim_id=$2`,
      [a.userId, String(req.params.id)],
    );
    const { rows: [updated] } = await pool.query(
      `UPDATE insurance_claims SET status='approved', amount_approved=$1, amount_approved_num=$2, amount_rejected='0.00', decision_date=NOW(), decision_by=$3, notes=COALESCE($4,notes), updated_by=$3, updated_at=NOW(), version=version+1 WHERE id=$5 RETURNING *`,
      [amountApproved, amountApproved.toFixed(2), a.userId, notes ?? null, String(req.params.id)],
    );
    await pool.query(`INSERT INTO insurance_approvals (claim_id, approval_type, approved_amount, approved_by, notes) VALUES ($1,'full',$2,$3,$4)`, [String(req.params.id), amountApproved.toFixed(2), a.userId, notes ?? null]);
    await auditService.log({ module: "system", action: "update", resourceType: "InsuranceClaim", resourceId: String(req.params.id), newValue: { status: "approved", amountApproved } }, a);
    res.json(updated);
  } catch (err) { next(err); }
});

// ── POST /claims/:id/partial-approve ─────────────────────────────────────────
router.post("/claims/:id/partial-approve", requirePermission("insurance.claims.partial_approve"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const { items } = req.body as { items: Array<{ itemId: string; amountApproved: number; notes?: string }> };
    if (!items?.length) { res.status(400).json({ error: "items requis (liste des postes à approuver)" }); return; }
    const updated = await insuranceService.approvePartial(String(req.params.id), items, a);
    res.json(updated);
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    if (e.status) { res.status(e.status).json({ error: e.message }); return; }
    next(err);
  }
});

// ── POST /claims/:id/reject ───────────────────────────────────────────────────
router.post("/claims/:id/reject", requirePermission("insurance.claims.reject"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const { reason } = req.body as { reason: string };
    if (!reason?.trim()) { res.status(400).json({ error: "Le motif de rejet est obligatoire" }); return; }
    const updated = await insuranceService.rejectClaim(String(req.params.id), reason, a);
    res.json(updated);
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    if (e.status) { res.status(e.status).json({ error: e.message }); return; }
    next(err);
  }
});

// ── POST /claims/:id/mark-paid ────────────────────────────────────────────────
router.post("/claims/:id/mark-paid", requirePermission("insurance.claims.mark_paid"), async (req: AuthenticatedRequest, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const a = actor(req);
    const claimId = String(req.params.id);
    const { amountPaid } = req.body as { amountPaid: number };

    if (amountPaid == null || Number(amountPaid) <= 0) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "amountPaid doit être un montant positif" });
      return;
    }

    // Validate UUID format before hitting the DB (prevents "invalid input syntax for type uuid" 500)
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(claimId)) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Dossier introuvable" });
      return;
    }

    // Lock claim row to prevent concurrent payments
    const { rows: [claim] } = await client.query(
      `SELECT id, status, invoice_id,
              COALESCE(amount_approved_num::NUMERIC, amount_approved::NUMERIC, 0) AS approved,
              COALESCE(amount_requested_num::NUMERIC, amount_requested::NUMERIC, 0) AS requested,
              COALESCE(amount_paid_num::NUMERIC, 0) AS already_paid
         FROM insurance_claims
        WHERE id = $1 AND deleted_at IS NULL
          FOR UPDATE`,
      [claimId],
    );
    if (!claim) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Dossier introuvable" });
      return;
    }
    if (claim.status === "paid") {
      await client.query("ROLLBACK");
      res.status(409).json({
        code: "OVERPAYMENT",
        error: "Ce sinistre est déjà entièrement payé",
        amountRequested: amountPaid,
        remainingAmount: 0,
        entityType: "insurance_claim",
        entityId: claimId,
      });
      return;
    }

    // Only approvable/payable states allow mark-paid
    const PAYABLE_STATUSES = ["approved", "partially_approved", "partially_paid", "submitted"];
    if (!PAYABLE_STATUSES.includes(claim.status as string)) {
      await client.query("ROLLBACK");
      res.status(422).json({
        error: `Ce sinistre ne peut pas être payé (statut: ${claim.status}). Il doit être approuvé d'abord.`,
      });
      return;
    }

    // Use amount_requested as ceiling when the claim hasn't been formally approved yet
    // (amount_approved is null for 'submitted' claims)
    const approved    = Math.round(Number(claim.approved)     * 100) / 100 ||
                        Math.round(Number(claim.requested)    * 100) / 100;
    const alreadyPaid = Math.round(Number(claim.already_paid) * 100) / 100;
    const remaining   = Math.round((approved - alreadyPaid)   * 100) / 100;

    if (Number(amountPaid) > remaining + 0.01) {
      await client.query("ROLLBACK");
      await auditService.log({
        module: "system", action: "update", resourceType: "InsuranceClaim", resourceId: claimId,
        newValue: { rejectedReason: "OVERPAYMENT", entityType: "insurance_claim" },
      }, a);
      res.status(409).json({
        code: "OVERPAYMENT",
        error: `Le montant (${Number(amountPaid).toFixed(2)}) dépasse le reste approuvé (${remaining.toFixed(2)} DZD)`,
        amountRequested: amountPaid,
        remainingAmount: remaining,
        entityType: "insurance_claim",
        entityId: claimId,
      });
      return;
    }

    const toApply = Math.min(Number(amountPaid), remaining);
    const newPaid  = Math.round((alreadyPaid + toApply) * 100) / 100;
    const newStatus = newPaid >= approved - 0.01 ? "paid" : "partially_paid";

    const { rows: [updated] } = await client.query(
      `UPDATE insurance_claims
          SET status       = $1,
              amount_paid  = $2, amount_paid_num = $3,
              paid_at      = CASE WHEN $1 = 'paid' THEN NOW() ELSE paid_at END,
              updated_by   = $4, updated_at = NOW(), version = version + 1
        WHERE id = $5 AND deleted_at IS NULL
        RETURNING *`,
      [newStatus, newPaid, newPaid.toFixed(2), a.userId, claimId],
    );

    // Lock invoice row then update insurer share
    if (updated.invoice_id) {
      await client.query(`SELECT id FROM invoices WHERE id = $1 FOR UPDATE`, [updated.invoice_id]);
      await client.query(
        `UPDATE invoices
            SET paid_amount      = paid_amount + $1,
                remaining_amount = GREATEST(0, remaining_amount - $1),
                status           = (CASE WHEN (remaining_amount - $1) <= 0.01 THEN 'paid'
                                         ELSE 'partially_paid' END)::invoice_status,
                updated_at       = NOW()
          WHERE id = $2`,
        [toApply, updated.invoice_id],
      );
    }

    await client.query("COMMIT");
    await auditService.log({
      module: "system", action: "update", resourceType: "InsuranceClaim",
      resourceId: claimId, newValue: { status: newStatus },
    }, a);
    res.json(updated);
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally { client.release(); }
});

// ── POST /claims/:id/transfer-rejected ───────────────────────────────────────
router.post("/claims/:id/transfer-rejected", requirePermission("insurance.claims.approve"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const result = await insuranceService.transferRejectedToPatient(String(req.params.id), a);
    res.json(result);
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    if (e.status) { res.status(e.status).json({ error: e.message }); return; }
    next(err);
  }
});

// ── GET /claims/:id/items ─────────────────────────────────────────────────────
router.get("/claims/:id/items", requirePermission("insurance.claims.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ci.*, ii.description AS invoice_item_description, ii.service_code AS ii_service_code
         FROM insurance_claim_items ci LEFT JOIN invoice_items ii ON ii.id = ci.invoice_item_id
        WHERE ci.claim_id = $1 ORDER BY ci.created_at`,
      [String(req.params.id)],
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── PATCH /claims/:id/items/:itemId ──────────────────────────────────────────
router.patch("/claims/:id/items/:itemId", requireAnyPermission(["insurance.claims.approve","insurance.claims.partial_approve"]), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const { amountApproved, rejectionReason, status } = req.body as { amountApproved?: number; rejectionReason?: string; status?: string };
    const sets: string[] = []; const params: unknown[] = [];
    if (amountApproved != null) {
      params.push(amountApproved.toFixed(2)); sets.push(`amount_approved = $${params.length}`);
      sets.push(`amount_rejected = GREATEST(0, amount_requested - $${params.length})`);
      sets.push(`status = CASE WHEN $${params.length} = 0 THEN 'rejected' WHEN $${params.length} >= amount_requested THEN 'approved' ELSE 'partially_approved' END`);
    }
    if (rejectionReason) { params.push(rejectionReason); sets.push(`rejection_reason = $${params.length}`); }
    if (status)          { params.push(status);          sets.push(`status = $${params.length}`); }
    if (!sets.length)    { res.status(400).json({ error: "Aucun champ à modifier" }); return; }
    params.push(a.userId, String(req.params.itemId), String(req.params.id));
    const { rows: [updated] } = await pool.query(
      `UPDATE insurance_claim_items SET ${sets.join(",")}, updated_by=$${params.length-2}, updated_at=NOW() WHERE id=$${params.length-1} AND claim_id=$${params.length} RETURNING *`,
      params,
    );
    if (!updated) { res.status(404).json({ error: "Item introuvable" }); return; }
    await auditService.log({ module: "system", action: "update", resourceType: "InsuranceClaimItem", resourceId: String(req.params.itemId) }, a);
    res.json(updated);
  } catch (err) { next(err); }
});

// ── PATCH /claims/:id/status  (backward compat) ───────────────────────────────
router.patch("/claims/:id/status", async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const { status, amountApproved, amountPaid, rejectionReason, notes } = req.body as Record<string, unknown>;
    if (!status) { res.status(400).json({ error: "status requis" }); return; }
    if (!VALID_STATUSES.includes(status as string)) { res.status(400).json({ error: `status invalide. Valeurs: ${VALID_STATUSES.join(",")}` }); return; }
    const permMap: Record<string, string> = { approved: "insurance.claims.approve", rejected: "insurance.claims.reject", paid: "insurance.claims.mark_paid" };
    const rp = permMap[status as string];
    if (rp && req.auth?.role !== "super_admin" && !req.auth?.permissions.includes(rp)) {
      res.status(403).json({ message: "Permission insuffisante.", required: rp }); return;
    }
    const { rows: [claim] } = await pool.query(
      `UPDATE insurance_claims SET status=$1, amount_approved=COALESCE($2,amount_approved), amount_paid=COALESCE($3,amount_paid), rejection_reason=COALESCE($4,rejection_reason), notes=COALESCE($5,notes), submitted_at=CASE WHEN $1='submitted' THEN NOW() ELSE submitted_at END, reviewed_at=CASE WHEN $1 IN ('approved','partially_approved','rejected') THEN NOW() ELSE reviewed_at END, paid_at=CASE WHEN $1='paid' THEN NOW() ELSE paid_at END, updated_by=$6, updated_at=NOW() WHERE id=$7 RETURNING *`,
      [status, amountApproved ?? null, amountPaid ?? null, rejectionReason ?? null, notes ?? null, a.userId, String(req.params.id)],
    );
    if (!claim) { res.status(404).json({ error: "Dossier introuvable" }); return; }
    if (status === "paid" && amountPaid) {
      await pool.query(
        `UPDATE invoices SET paid_amount=paid_amount+$1, remaining_amount=GREATEST(0,remaining_amount-$1), status=(CASE WHEN (remaining_amount-$1)<=0.01 THEN 'paid' ELSE 'partially_paid' END)::invoice_status, updated_at=NOW() WHERE id=$2`,
        [amountPaid, claim.invoice_id],
      );
    }
    await auditService.log({ module: "system", action: "update", resourceType: "InsuranceClaim", resourceId: String(req.params.id) }, a);
    res.json(claim);
  } catch (err) { next(err); }
});

export default router;
