/**
 * /payments routes
 *
 * GET  /payments               — list
 * GET  /payments/:id/receipt-pdf — download receipt PDF
 * POST /payments               — create (FOR UPDATE lock, overpayment guard)
 * POST /payments/:id/refund    — refund
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { auditService } from "../services/audit";
import { requirePermission } from "../middleware/requirePermission";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import type { ActorCtx } from "../repositories/types";
import { generateReceiptPdf } from "../lib/pdfGenerator";

const router = Router();

function actor(req: AuthenticatedRequest): ActorCtx {
  return {
    userId:   req.auth?.userId ?? "system",
    userName: req.auth?.userId ?? "system",
    userRole: req.auth?.role   ?? "guest",
  };
}

function mapPayment(row: Record<string, unknown>) {
  return {
    id:             row.id,
    paymentNumber:  row.payment_number,
    receiptNumber:  row.receipt_number,
    invoiceId:      row.invoice_id,
    invoiceNumber:  row.invoice_number,
    patientId:      row.patient_id,
    patientName:    row.patient_name,
    amount:         Number(row.amount ?? 0),
    method:         row.method,
    reference:      row.reference,
    notes:          row.notes,
    status:         row.status ?? "completed",
    collectorName:  row.collector_name,
    recordedBy:     row.recorded_by,
    paidAt:         row.paid_at,
    createdAt:      row.created_at,
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

// ── GET /payments/:id/receipt-pdf ─────────────────────────────────────────────

router.get("/:id/receipt-pdf", requirePermission("billing.print"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { rows: [pay] } = await pool.query(
      `SELECT pay.*,
              i.invoice_number, i.patient_name, i.currency,
              p.mrn AS patient_mrn,
              u.first_name || ' ' || u.last_name AS collector_name
         FROM payments pay
         JOIN invoices i ON i.id = pay.invoice_id
         JOIN patients p ON p.id = i.patient_id
    LEFT JOIN users u ON u.id = pay.recorded_by
        WHERE pay.id = $1`,
      [req.params.id],
    );
    if (!pay) { res.status(404).json({ error: "Paiement introuvable" }); return; }

    const receiptNumber = String(pay.receipt_number ?? pay.payment_number ?? "REC");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${receiptNumber}.pdf"`);

    generateReceiptPdf(
      {
        receiptNumber,
        paymentNumber:  String(pay.payment_number ?? ""),
        invoiceNumber:  String(pay.invoice_number ?? ""),
        patientName:    String(pay.patient_name ?? ""),
        patientMrn:     pay.patient_mrn as string,
        amount:         Number(pay.amount ?? 0),
        method:         String(pay.method ?? ""),
        reference:      pay.reference as string,
        currency:       String(pay.currency ?? "DZD"),
        paidAt:         pay.paid_at as string,
        collectorName:  pay.collector_name as string,
        notes:          pay.notes as string,
      },
      res,
    );
  } catch (err) { next(err); }
});

// ── POST /payments ────────────────────────────────────────────────────────────

router.post("/", requirePermission("payments.create"), async (req: AuthenticatedRequest, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const a = actor(req);
    const body = req.body as {
      invoiceId:  string;
      amount:     number;
      method:     string;
      reference?: string;
      notes?:     string;
    };

    if (!body.invoiceId) { await client.query("ROLLBACK"); res.status(400).json({ error: "invoiceId requis" }); return; }
    if (!body.amount || body.amount <= 0) { await client.query("ROLLBACK"); res.status(400).json({ error: "amount doit être positif" }); return; }
    if (!body.method) { await client.query("ROLLBACK"); res.status(400).json({ error: "method requis" }); return; }

    // Lock invoice row to prevent concurrent payments
    const { rows: [inv] } = await client.query(
      `SELECT * FROM invoices WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [body.invoiceId],
    );
    if (!inv) { await client.query("ROLLBACK"); res.status(404).json({ error: "Facture introuvable" }); return; }
    if (inv.status === "cancelled") { await client.query("ROLLBACK"); res.status(409).json({ error: "Impossible de payer une facture annulée" }); return; }

    // Calculate remaining from DB (not from client input)
    const remaining = Math.round(Number(inv.remaining_amount ?? 0) * 100) / 100;
    if (remaining <= 0.01) {
      await client.query("ROLLBACK");
      await auditService.log(
        { action: "update", module: "system", resourceId: body.invoiceId, resourceType: "Invoice",
          newValue: { rejectedReason: "OVERPAYMENT_ALREADY_PAID" } },
        a,
      );
      res.status(409).json({
        code: "OVERPAYMENT",
        error: "Cette facture est déjà entièrement payée",
        amountRequested: body.amount,
        remainingAmount: 0,
        entityType: "invoice",
        entityId: body.invoiceId,
      });
      return;
    }
    if (body.amount > remaining + 0.01) {
      await client.query("ROLLBACK");
      await auditService.log(
        { action: "update", module: "system", resourceId: body.invoiceId, resourceType: "Invoice",
          newValue: { rejectedReason: "OVERPAYMENT", entityType: "invoice" } },
        a,
      );
      res.status(409).json({
        code: "OVERPAYMENT",
        error: `Le montant (${body.amount.toFixed(2)}) dépasse le reste à payer (${remaining.toFixed(2)} DZD)`,
        amountRequested: body.amount,
        remainingAmount: remaining,
        entityType: "invoice",
        entityId: body.invoiceId,
      });
      return;
    }

    // Generate payment + receipt numbers
    const { rows: [numRow] } = await client.query(
      `SELECT
         'PAY-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('payment_number_seq')::TEXT, 6, '0') AS pay_num,
         'REC-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('receipt_number_seq')::TEXT, 6, '0') AS rec_num`,
    );

    const { rows: [pay] } = await client.query(
      `INSERT INTO payments (
         payment_number, receipt_number, invoice_id, patient_id,
         amount, method, reference, notes, recorded_by, collected_by, status, paid_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,'completed', NOW()) RETURNING *`,
      [
        numRow.pay_num, numRow.rec_num,
        body.invoiceId, inv.patient_id,
        body.amount, body.method,
        body.reference ?? null, body.notes ?? null,
        a.userId,
      ],
    );

    // Update invoice totals (calculated in DB)
    const newPaid      = Number(inv.paid_amount ?? 0) + body.amount;
    const newRemaining = Math.max(0, remaining - body.amount);

    let newStatus = inv.status as string;
    if (newRemaining <= 0.01)  newStatus = "paid";
    else if (newPaid > 0)      newStatus = "partially_paid";

    await client.query(
      `UPDATE invoices SET paid_amount=$1, remaining_amount=$2, due_amount=$2, status=$3, updated_at=NOW() WHERE id=$4`,
      [newPaid, newRemaining, newStatus, body.invoiceId],
    );

    await client.query("COMMIT");

    await auditService.log(
      { action: "payment", module: "system", resourceId: body.invoiceId, resourceType: "Invoice", patientId: inv.patient_id as string },
      a,
    );

    res.status(201).json({
      ...mapPayment({ ...pay, invoice_number: inv.invoice_number, patient_name: inv.patient_name }),
      invoiceStatus: newStatus,
    });
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
    if (!pay) { await client.query("ROLLBACK"); res.status(404).json({ error: "Paiement introuvable" }); return; }
    if (pay.status === "refunded") { await client.query("ROLLBACK"); res.status(409).json({ error: "Déjà remboursé" }); return; }

    await client.query(
      `UPDATE payments SET status='refunded', notes=COALESCE($1,notes) WHERE id=$2`,
      [reason ?? null, id],
    );

    // Lock and revert invoice amounts
    const { rows: [inv] } = await client.query(
      `SELECT * FROM invoices WHERE id = $1 FOR UPDATE`, [pay.invoice_id],
    );
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
    await auditService.log(
      { action: "refund", module: "system", resourceId: String(pay.invoice_id), resourceType: "Invoice" },
      a,
    );

    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally { client.release(); }
});

export default router;
