/**
 * /payments routes
 *
 * GET  /payments         — list
 * POST /payments         — create (supports partial payment)
 * POST /payments/:id/refund — refund
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { auditService } from "../services/audit";
import { requirePermission } from "../middleware/requirePermission";
import type { AuthenticatedRequest } from "../middleware/requireAuth";

const router = Router();

function actor(req: AuthenticatedRequest) {
  return {
    userId:   req.auth?.userId ?? "system",
    userName: req.auth?.userId ?? "system",
    userRole: req.auth?.role   ?? "guest",
  };
}

function mapPayment(row: Record<string, unknown>) {
  return {
    id:            row.id,
    paymentNumber: row.payment_number,
    invoiceId:     row.invoice_id,
    invoiceNumber: row.invoice_number,
    patientId:     row.patient_id,
    patientName:   row.patient_name,
    amount:        Number(row.amount ?? 0),
    method:        row.method,
    reference:     row.reference,
    notes:         row.notes,
    status:        row.status ?? "completed",
    collectorName: row.collector_name,
    recordedBy:    row.recorded_by,
    paidAt:        row.paid_at,
    createdAt:     row.created_at,
  };
}

// ── GET /payments ─────────────────────────────────────────────────────────────

router.get("/", requirePermission("payments.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { invoiceId, patientId, limit = "100", offset = "0" } = req.query as Record<string, string>;
    const conds: string[] = ["pay.status != 'refunded'"];
    const params: unknown[] = [];

    if (invoiceId)  { params.push(invoiceId);  conds.push(`pay.invoice_id = $${params.length}`); }
    if (patientId)  { params.push(patientId);  conds.push(`pay.patient_id = $${params.length}`); }

    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const { rows } = await pool.query(
      `SELECT pay.*,
              i.invoice_number,
              i.patient_name,
              u.first_name || ' ' || u.last_name AS collector_name
         FROM payments pay
         JOIN invoices i ON i.id = pay.invoice_id
    LEFT JOIN users u ON u.id = pay.recorded_by
        WHERE ${conds.join(" AND ")}
        ORDER BY pay.paid_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    res.json(rows.map(mapPayment));
  } catch (err) { next(err); }
});

// ── POST /payments ────────────────────────────────────────────────────────────

router.post("/", requirePermission("payments.create"), async (req: AuthenticatedRequest, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const a = actor(req);
    const body = req.body as {
      invoiceId: string;
      amount: number;
      method: string;
      reference?: string;
      notes?: string;
    };

    if (!body.invoiceId) { res.status(400).json({ error: "invoiceId requis" }); await client.query("ROLLBACK"); return; }
    if (!body.amount || body.amount <= 0) { res.status(400).json({ error: "amount doit être positif" }); await client.query("ROLLBACK"); return; }
    if (!body.method) { res.status(400).json({ error: "method requis" }); await client.query("ROLLBACK"); return; }

    // Lock invoice row
    const { rows: [inv] } = await client.query(
      `SELECT * FROM invoices WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`, [body.invoiceId]
    );
    if (!inv) { res.status(404).json({ error: "Facture introuvable" }); await client.query("ROLLBACK"); return; }
    if (inv.status === "cancelled") { res.status(409).json({ error: "Impossible de payer une facture annulée" }); await client.query("ROLLBACK"); return; }

    const remaining = Number(inv.remaining_amount ?? 0);
    if (body.amount > remaining + 0.01) {
      res.status(409).json({ error: `Le montant (${body.amount}) dépasse le reste à payer (${remaining.toFixed(2)})` });
      await client.query("ROLLBACK"); return;
    }

    // Generate payment number
    const { rows: [numRow] } = await client.query(
      `SELECT 'PAY-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('payment_number_seq')::TEXT, 6, '0') AS num`
    );

    const { rows: [pay] } = await client.query(
      `INSERT INTO payments (payment_number, invoice_id, patient_id, amount, method, reference, notes, recorded_by, collected_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,'completed') RETURNING *`,
      [numRow.num, body.invoiceId, inv.patient_id, body.amount, body.method,
       body.reference ?? null, body.notes ?? null, a.userId],
    );

    // Update invoice totals
    const newPaid      = Number(inv.paid_amount ?? 0) + body.amount;
    const newRemaining = Math.max(0, Number(inv.remaining_amount ?? 0) - body.amount);
    const total        = Number(inv.total_amount ?? 0);

    let newStatus = inv.status as string;
    if (newRemaining <= 0.01)         newStatus = "paid";
    else if (newPaid > 0)             newStatus = "partially_paid";

    await client.query(
      `UPDATE invoices SET paid_amount=$1, remaining_amount=$2, due_amount=$2, status=$3, updated_at=NOW() WHERE id=$4`,
      [newPaid, newRemaining, newStatus, body.invoiceId],
    );

    await client.query("COMMIT");

    await auditService.log({
      userId: a.userId, userName: a.userId, userRole: a.userRole,
      action: "payment", module: "billing",
      description: `Paiement ${numRow.num}: ${body.amount} DZD (${body.method}) sur facture ${inv.invoice_number}`,
      patientId: inv.patient_id as string, resourceId: body.invoiceId, resourceType: "Invoice",
    });

    res.status(201).json({ ...mapPayment({ ...pay, invoice_number: inv.invoice_number, patient_name: inv.patient_name }), invoiceStatus: newStatus });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally { client.release(); }
});

// ── POST /payments/:id/refund ─────────────────────────────────────────────────

router.post("/:id/refund", requirePermission("payments.refund"), async (req: AuthenticatedRequest, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const a  = actor(req);
    const id = req.params.id;
    const { reason } = req.body as { reason?: string };

    const { rows: [pay] } = await client.query(`SELECT * FROM payments WHERE id = $1`, [id]);
    if (!pay) { res.status(404).json({ error: "Paiement introuvable" }); await client.query("ROLLBACK"); return; }
    if (pay.status === "refunded") { res.status(409).json({ error: "Déjà remboursé" }); await client.query("ROLLBACK"); return; }

    await client.query(`UPDATE payments SET status='refunded', notes=COALESCE($1,notes) WHERE id=$2`, [reason ?? null, id]);

    // Revert invoice amounts
    const { rows: [inv] } = await client.query(`SELECT * FROM invoices WHERE id = $1`, [pay.invoice_id]);
    if (inv) {
      const newPaid      = Math.max(0, Number(inv.paid_amount ?? 0) - Number(pay.amount));
      const newRemaining = Number(inv.remaining_amount ?? 0) + Number(pay.amount);
      const newStatus    = newPaid <= 0.01 ? "issued" : "partially_paid";
      await client.query(
        `UPDATE invoices SET paid_amount=$1, remaining_amount=$2, due_amount=$2, status=$3, updated_at=NOW() WHERE id=$4`,
        [newPaid, newRemaining, newStatus, pay.invoice_id],
      );
    }

    await client.query("COMMIT");

    await auditService.log({
      userId: a.userId, userName: a.userId, userRole: a.userRole,
      action: "refund", module: "billing",
      description: `Remboursement paiement ${pay.payment_number}: ${pay.amount} DZD. ${reason ?? ""}`,
      resourceId: pay.invoice_id as string, resourceType: "Invoice",
    });

    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally { client.release(); }
});

export default router;
