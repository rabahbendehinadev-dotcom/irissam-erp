/**
 * Insurance Organisation Payments routes
 * Prefix: /insurance
 *
 * GET  /payments
 * POST /payments
 * GET  /payments/:id
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../middleware/requirePermission";
import { insuranceService } from "../services/insuranceService";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import type { ActorCtx } from "../repositories/types";

const router = Router();

function actor(req: AuthenticatedRequest): ActorCtx {
  return { userId: req.auth?.userId ?? "system", userName: req.auth?.userId ?? "system", userRole: req.auth?.role ?? "guest" };
}

// GET /payments
router.get("/payments", requirePermission("insurance.payments.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { organizationId, bordereauId, claimId, dateFrom, dateTo } = req.query as Record<string, string>;
    const conds = ["op.deleted_at IS NULL"];
    const params: unknown[] = [];
    if (organizationId) { params.push(organizationId); conds.push(`op.organization_id = $${params.length}`); }
    if (bordereauId)    { params.push(bordereauId);    conds.push(`op.bordereau_id = $${params.length}`); }
    if (claimId)        { params.push(claimId);        conds.push(`op.claim_id = $${params.length}`); }
    if (dateFrom)       { params.push(dateFrom);       conds.push(`op.payment_date >= $${params.length}`); }
    if (dateTo)         { params.push(dateTo);         conds.push(`op.payment_date <= $${params.length}`); }
    const { rows } = await pool.query(
      `SELECT op.*, o.name AS organization_name, o.code AS organization_code,
              b.bordereau_number
         FROM insurance_org_payments op
         LEFT JOIN insurance_organizations o ON o.id = op.organization_id
         LEFT JOIN insurance_bordereaux   b ON b.id = op.bordereau_id
        WHERE ${conds.join(" AND ")}
        ORDER BY op.payment_date DESC, op.created_at DESC`,
      params,
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /payments
router.post("/payments", requirePermission("insurance.payments.create"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const b = req.body as {
      organizationId: string;
      bordereauId?: string;
      claimId?: string;
      amount: number;
      paymentDate: string;
      method?: string;
      bankReference?: string;
      notes?: string;
    };
    if (!b.organizationId || b.amount == null || !b.paymentDate) {
      res.status(400).json({ error: "organizationId, amount, paymentDate requis" }); return;
    }
    if (b.amount <= 0) { res.status(400).json({ error: "Le montant doit être positif" }); return; }
    const payment = await insuranceService.registerOrgPayment(
      { ...b, method: b.method ?? "virement" },
      a,
    );
    res.status(201).json(payment);
  } catch (err: unknown) {
    const e = err as {
      status?: number; message: string; code?: string;
      amountRequested?: number; remainingAmount?: number;
      entityType?: string; entityId?: string;
    };
    if (e.status === 409 && e.code === "OVERPAYMENT") {
      res.status(409).json({
        code: "OVERPAYMENT",
        error: e.message,
        amountRequested: e.amountRequested,
        remainingAmount: e.remainingAmount,
        entityType: e.entityType,
        entityId: e.entityId,
      });
      return;
    }
    if (e.status) { res.status(e.status).json({ error: e.message }); return; }
    next(err);
  }
});

// GET /payments/:id
router.get("/payments/:id", requirePermission("insurance.payments.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { rows: [payment] } = await pool.query(
      `SELECT op.*, o.name AS organization_name, b.bordereau_number
         FROM insurance_org_payments op
         LEFT JOIN insurance_organizations o ON o.id = op.organization_id
         LEFT JOIN insurance_bordereaux   b ON b.id = op.bordereau_id
        WHERE op.id = $1 AND op.deleted_at IS NULL`,
      [String(req.params.id)],
    );
    if (!payment) { res.status(404).json({ error: "Paiement introuvable" }); return; }
    res.json(payment);
  } catch (err) { next(err); }
});

export default router;
