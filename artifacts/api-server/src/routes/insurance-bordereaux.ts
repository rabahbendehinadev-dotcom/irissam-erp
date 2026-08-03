/**
 * Insurance Bordereaux routes
 * Prefix: /insurance
 *
 * GET    /bordereaux
 * POST   /bordereaux
 * GET    /bordereaux/:id
 * PATCH  /bordereaux/:id
 * POST   /bordereaux/:id/add-claims
 * DELETE /bordereaux/:id/claims/:claimId
 * POST   /bordereaux/:id/submit
 * POST   /bordereaux/:id/mark-received
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../middleware/requirePermission";
import { auditService } from "../services/audit";
import { insuranceService } from "../services/insuranceService";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import type { ActorCtx } from "../repositories/types";

const router = Router();

function actor(req: AuthenticatedRequest): ActorCtx {
  return { userId: req.auth?.userId ?? "system", userName: req.auth?.userId ?? "system", userRole: req.auth?.role ?? "guest" };
}

// GET /bordereaux
router.get("/bordereaux", requirePermission("insurance.bordereaux.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { organizationId, status, dateFrom, dateTo } = req.query as Record<string, string>;
    const conds = ["b.deleted_at IS NULL"];
    const params: unknown[] = [];
    if (organizationId) { params.push(organizationId); conds.push(`b.organization_id = $${params.length}`); }
    if (status)         { params.push(status);         conds.push(`b.status = $${params.length}`); }
    if (dateFrom)       { params.push(dateFrom);       conds.push(`b.created_at >= $${params.length}`); }
    if (dateTo)         { params.push(dateTo);         conds.push(`b.created_at <= $${params.length}::timestamptz + INTERVAL '1 day'`); }
    const { rows } = await pool.query(
      `SELECT b.*, o.name AS organization_name, o.code AS organization_code, o.avg_payment_days
         FROM insurance_bordereaux b
         LEFT JOIN insurance_organizations o ON o.id = b.organization_id
        WHERE ${conds.join(" AND ")}
        ORDER BY b.created_at DESC`,
      params,
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /bordereaux
router.post("/bordereaux", requirePermission("insurance.bordereaux.create"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const b = req.body as { organizationId: string; periodFrom?: string; periodTo?: string; notes?: string };
    if (!b.organizationId) { res.status(400).json({ error: "organizationId requis" }); return; }
    const { rows: [numRow] } = await pool.query(
      `SELECT 'BRD-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('bordereau_number_seq')::TEXT, 6, '0') AS num`,
    );
    const { rows: [brd] } = await pool.query(
      `INSERT INTO insurance_bordereaux (bordereau_number, organization_id, period_from, period_to, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [numRow.num, b.organizationId, b.periodFrom ?? null, b.periodTo ?? null, b.notes ?? null, a.userId],
    );
    await auditService.log({ module: "system", action: "create", resourceType: "InsuranceBordereau", resourceId: brd.id as string, newValue: { bordereauNumber: numRow.num } }, a);
    res.status(201).json(brd);
  } catch (err) { next(err); }
});

// GET /bordereaux/:id
router.get("/bordereaux/:id", requirePermission("insurance.bordereaux.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const [{ rows: [brd] }, { rows: items }] = await Promise.all([
      pool.query(
        `SELECT b.*, o.name AS organization_name, o.code AS organization_code
           FROM insurance_bordereaux b LEFT JOIN insurance_organizations o ON o.id=b.organization_id
          WHERE b.id=$1 AND b.deleted_at IS NULL`,
        [String(req.params.id)],
      ),
      pool.query(
        `SELECT bi.*, c.claim_number, c.status AS claim_status,
                COALESCE(c.amount_requested_num, c.amount_requested::NUMERIC) AS amount_requested,
                COALESCE(c.amount_approved_num,  c.amount_approved::NUMERIC)  AS amount_approved,
                c.amount_paid_num,
                p.first_name || ' ' || p.last_name AS patient_name, p.mrn
           FROM insurance_bordereau_items bi
           JOIN insurance_claims c ON c.id = bi.claim_id
           LEFT JOIN patients p ON p.id = c.patient_id
          WHERE bi.bordereau_id = $1
          ORDER BY bi.added_at`,
        [String(req.params.id)],
      ),
    ]);
    if (!brd) { res.status(404).json({ error: "Bordereau introuvable" }); return; }
    res.json({ ...brd, items });
  } catch (err) { next(err); }
});

// PATCH /bordereaux/:id
router.patch("/bordereaux/:id", requirePermission("insurance.bordereaux.create"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const b = req.body as { periodFrom?: string; periodTo?: string; notes?: string; referenceExternal?: string };
    const sets: string[] = []; const params: unknown[] = [];
    if (b.periodFrom)         { params.push(b.periodFrom);         sets.push(`period_from = $${params.length}`); }
    if (b.periodTo)           { params.push(b.periodTo);           sets.push(`period_to = $${params.length}`); }
    if (b.notes !== undefined) { params.push(b.notes);             sets.push(`notes = $${params.length}`); }
    if (b.referenceExternal)  { params.push(b.referenceExternal);  sets.push(`reference_external = $${params.length}`); }
    if (!sets.length) { res.status(400).json({ error: "Aucun champ à modifier" }); return; }
    params.push(a.userId, String(req.params.id));
    const { rows: [updated] } = await pool.query(
      `UPDATE insurance_bordereaux SET ${sets.join(",")}, updated_by=$${params.length-1}, updated_at=NOW(), version=version+1 WHERE id=$${params.length} AND deleted_at IS NULL RETURNING *`,
      params,
    );
    if (!updated) { res.status(404).json({ error: "Bordereau introuvable" }); return; }
    res.json(updated);
  } catch (err) { next(err); }
});

// POST /bordereaux/:id/add-claims
router.post("/bordereaux/:id/add-claims", requirePermission("insurance.bordereaux.create"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const { claimIds } = req.body as { claimIds: string[] };
    if (!claimIds?.length) { res.status(400).json({ error: "claimIds requis" }); return; }
    const result = await insuranceService.addClaimsToBordereau(String(req.params.id), claimIds, a);
    res.json(result);
  } catch (err: unknown) {
    const e = err as { status?: number; message: string; duplicates?: string[] };
    if (e.status) { res.status(e.status).json({ error: e.message, duplicates: e.duplicates }); return; }
    next(err);
  }
});

// DELETE /bordereaux/:id/claims/:claimId
router.delete("/bordereaux/:id/claims/:claimId", requirePermission("insurance.bordereaux.create"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const { rowCount } = await pool.query(
      `DELETE FROM insurance_bordereau_items WHERE bordereau_id=$1 AND claim_id=$2`,
      [String(req.params.id), String(req.params.claimId)],
    );
    if (!rowCount) { res.status(404).json({ error: "Item introuvable dans ce bordereau" }); return; }
    // Unlink claim from bordereau
    await pool.query(`UPDATE insurance_claims SET bordereau_id=NULL WHERE id=$1 AND bordereau_id=$2`, [String(req.params.claimId), String(req.params.id)]);
    // Recalculate bordereau totals
    await pool.query(
      `UPDATE insurance_bordereaux SET claim_count=(SELECT COUNT(*) FROM insurance_bordereau_items WHERE bordereau_id=$1), total_requested=(SELECT COALESCE(SUM(COALESCE(c.amount_requested_num,c.amount_requested::NUMERIC)),0) FROM insurance_bordereau_items bi JOIN insurance_claims c ON c.id=bi.claim_id WHERE bi.bordereau_id=$1), updated_by=$2, updated_at=NOW() WHERE id=$1`,
      [String(req.params.id), a.userId],
    );
    await auditService.log({ module: "system", action: "update", resourceType: "InsuranceBordereau", resourceId: String(req.params.id), newValue: { removedClaim: String(req.params.claimId) } }, a);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /bordereaux/:id/submit
router.post("/bordereaux/:id/submit", requirePermission("insurance.bordereaux.submit"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const { referenceExternal } = req.body as { referenceExternal?: string };
    const { rows: [brd] } = await pool.query(`SELECT * FROM insurance_bordereaux WHERE id=$1 AND deleted_at IS NULL`, [String(req.params.id)]);
    if (!brd) { res.status(404).json({ error: "Bordereau introuvable" }); return; }
    if (brd.claim_count === 0) { res.status(422).json({ error: "Le bordereau est vide. Ajoutez des dossiers avant de soumettre." }); return; }
    if (["soumis","paye"].includes(brd.status as string)) { res.status(422).json({ error: "Ce bordereau est déjà soumis" }); return; }
    const { rows: [updated] } = await pool.query(
      `UPDATE insurance_bordereaux SET status='soumis', submitted_at=NOW(), submitted_by=$1, reference_external=COALESCE($2,reference_external), updated_by=$1, updated_at=NOW(), version=version+1 WHERE id=$3 RETURNING *`,
      [a.userId, referenceExternal ?? null, String(req.params.id)],
    );
    await auditService.log({ module: "system", action: "update", resourceType: "InsuranceBordereau", resourceId: String(req.params.id), newValue: { status: "soumis", referenceExternal } }, a);
    res.json(updated);
  } catch (err) { next(err); }
});

// POST /bordereaux/:id/mark-received
router.post("/bordereaux/:id/mark-received", requirePermission("insurance.bordereaux.submit"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const { rows: [updated] } = await pool.query(
      `UPDATE insurance_bordereaux SET status='recu', updated_by=$1, updated_at=NOW(), version=version+1 WHERE id=$2 AND status='soumis' AND deleted_at IS NULL RETURNING *`,
      [a.userId, String(req.params.id)],
    );
    if (!updated) { res.status(404).json({ error: "Bordereau introuvable ou non soumis" }); return; }
    await auditService.log({ module: "system", action: "update", resourceType: "InsuranceBordereau", resourceId: String(req.params.id), newValue: { status: "recu" } }, a);
    res.json(updated);
  } catch (err) { next(err); }
});

export default router;
