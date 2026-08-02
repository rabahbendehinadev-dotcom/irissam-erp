/**
 * /invoices routes
 *
 * GET  /invoices                — list with filters
 * GET  /invoices/stats          — financial stats (dashboard)
 * GET  /invoices/:id            — single invoice + items + payments
 * POST /invoices                — create draft
 * PATCH /invoices/:id           — update draft
 * POST /invoices/:id/issue      — issue (draft → issued)
 * POST /invoices/:id/cancel     — cancel (requires credit note if paid)
 * POST /invoices/:id/credit-note— create credit note
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { auditService } from "../services/audit";
import { requirePermission } from "../middleware/requirePermission";
import type { AuthenticatedRequest } from "../middleware/requireAuth";

const router = Router();

function actor(req: AuthenticatedRequest) {
  return {
    userId:   req.auth?.userId   ?? "system",
    userName: req.auth?.userId   ?? "system",
    userRole: req.auth?.role     ?? "guest",
  };
}

function nextInvoiceNumber(): string {
  return `FACT-${new Date().getFullYear()}-`;
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function fetchInvoice(id: string) {
  const { rows } = await pool.query(
    `SELECT i.*,
            p.first_name || ' ' || p.last_name AS patient_full_name,
            p.mrn AS patient_mrn,
            e.encounter_number
       FROM invoices i
       JOIN patients p ON p.id = i.patient_id
  LEFT JOIN encounters e ON e.id = i.encounter_id
      WHERE i.id = $1 AND i.deleted_at IS NULL`,
    [id],
  );
  return rows[0] ?? null;
}

async function fetchItems(invoiceId: string) {
  const { rows } = await pool.query(
    `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY created_at`,
    [invoiceId],
  );
  return rows;
}

async function fetchPayments(invoiceId: string) {
  const { rows } = await pool.query(
    `SELECT pay.*,
            u.first_name || ' ' || u.last_name AS collector_name
       FROM payments pay
  LEFT JOIN users u ON u.id = pay.recorded_by
      WHERE pay.invoice_id = $1
      ORDER BY pay.paid_at`,
    [invoiceId],
  );
  return rows;
}

function mapInvoice(row: Record<string, unknown>) {
  return {
    id:              row.id,
    invoiceNumber:   row.invoice_number,
    patientId:       row.patient_id,
    patientName:     row.patient_full_name ?? row.patient_name,
    patientMrn:      row.patient_mrn,
    encounterId:     row.encounter_id,
    encounterNumber: row.encounter_number,
    admissionId:     row.admission_id,
    consultationId:  row.consultation_id,
    siteId:          row.site_id,
    invoiceDate:     row.invoice_date,
    dueDate:         row.due_date,
    status:          row.status,
    type:            row.type,
    insuranceType:   row.insurance_type,
    insuranceCoveragePercent: row.insurance_coverage_percent,
    subtotal:         Number(row.subtotal        ?? 0),
    discountAmount:   Number(row.discount_amount ?? 0),
    taxAmount:        Number(row.tax_amount      ?? 0),
    totalAmount:      Number(row.total_amount    ?? 0),
    patientShare:     Number(row.patient_share   ?? 0),
    insurerShare:     Number(row.insurer_share   ?? 0),
    paidAmount:       Number(row.paid_amount     ?? 0),
    remainingAmount:  Number(row.remaining_amount ?? 0),
    dueAmount:        Number(row.due_amount      ?? 0),
    currency:         row.currency ?? "DZD",
    notes:            row.notes,
    version:          row.version,
    issuedBy:         row.issued_by,
    issuedAt:         row.issued_at,
    createdBy:        row.created_by,
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
  };
}

function mapItem(row: Record<string, unknown>) {
  return {
    id:             row.id,
    invoiceId:      row.invoice_id,
    sourceModule:   row.source_module,
    sourceEntityId: row.source_entity_id,
    serviceCode:    row.service_code,
    description:    row.description,
    category:       row.category,
    quantity:       Number(row.quantity   ?? 1),
    unitPrice:      Number(row.unit_price ?? 0),
    discount:       Number(row.discount   ?? 0),
    tax:            Number(row.tax        ?? 0),
    totalPrice:     Number(row.total_price ?? 0),
    performedAt:    row.performed_at,
    performedBy:    row.performed_by,
  };
}

function mapPayment(row: Record<string, unknown>) {
  return {
    id:            row.id,
    paymentNumber: row.payment_number,
    invoiceId:     row.invoice_id,
    patientId:     row.patient_id,
    amount:        Number(row.amount ?? 0),
    method:        row.method,
    reference:     row.reference,
    notes:         row.notes,
    status:        row.status ?? "completed",
    collectorName: row.collector_name,
    collectedBy:   row.collected_by,
    recordedBy:    row.recorded_by,
    paidAt:        row.paid_at,
    createdAt:     row.created_at,
  };
}

// ── GET /invoices/stats ───────────────────────────────────────────────────────

router.get("/stats", requirePermission("billing.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COALESCE(SUM(total_amount) FILTER (WHERE invoice_date::date = CURRENT_DATE AND deleted_at IS NULL), 0)        AS ca_today,
        COALESCE(SUM(total_amount) FILTER (WHERE DATE_TRUNC('month', invoice_date) = DATE_TRUNC('month', NOW()) AND deleted_at IS NULL), 0) AS ca_month,
        COUNT(*) FILTER (WHERE status IN ('issued','partially_paid','overdue') AND deleted_at IS NULL)                 AS unpaid_count,
        COALESCE(SUM(paid_amount)  FILTER (WHERE DATE_TRUNC('month', invoice_date) = DATE_TRUNC('month', NOW()) AND deleted_at IS NULL), 0) AS payments_month,
        COALESCE(SUM(remaining_amount) FILTER (WHERE status NOT IN ('paid','cancelled','refunded') AND deleted_at IS NULL), 0) AS total_remaining,
        (SELECT COUNT(*) FROM insurance_claims WHERE status IN ('draft','submitted','under_review'))                   AS insurance_pending
      FROM invoices
    `);
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ── GET /invoices ─────────────────────────────────────────────────────────────

router.get("/", requirePermission("billing.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { search, status, patientId, encounterId, dateFrom, dateTo, limit = "100", offset = "0" } =
      req.query as Record<string, string>;

    const conditions: string[] = ["i.deleted_at IS NULL"];
    const params: unknown[]    = [];

    if (status    && status    !== "all") { params.push(status);    conditions.push(`i.status = $${params.length}`); }
    if (patientId)                         { params.push(patientId);  conditions.push(`i.patient_id = $${params.length}`); }
    if (encounterId)                       { params.push(encounterId); conditions.push(`i.encounter_id = $${params.length}`); }
    if (dateFrom)                          { params.push(dateFrom);   conditions.push(`i.invoice_date::date >= $${params.length}::date`); }
    if (dateTo)                            { params.push(dateTo);     conditions.push(`i.invoice_date::date <= $${params.length}::date`); }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(
        i.invoice_number ILIKE $${params.length} OR
        i.patient_name   ILIKE $${params.length} OR
        p.mrn            ILIKE $${params.length} OR
        e.encounter_number ILIKE $${params.length}
      )`);
    }

    params.push(parseInt(limit, 10), parseInt(offset, 10));
    const where = conditions.join(" AND ");

    const { rows } = await pool.query(
      `SELECT i.*,
              p.first_name || ' ' || p.last_name AS patient_full_name,
              p.mrn AS patient_mrn,
              e.encounter_number
         FROM invoices i
         JOIN patients p ON p.id = i.patient_id
    LEFT JOIN encounters e ON e.id = i.encounter_id
        WHERE ${where}
        ORDER BY i.invoice_date DESC, i.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    res.json(rows.map(mapInvoice));
  } catch (err) { next(err); }
});

// ── GET /invoices/:id ─────────────────────────────────────────────────────────

router.get("/:id", requirePermission("billing.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const row = await fetchInvoice(req.params.id);
    if (!row) { res.status(404).json({ error: "Facture introuvable" }); return; }

    const [items, payments, claimRows] = await Promise.all([
      fetchItems(req.params.id),
      fetchPayments(req.params.id),
      pool.query(`SELECT * FROM insurance_claims WHERE invoice_id = $1 ORDER BY created_at`, [req.params.id]),
    ]);

    res.json({
      ...mapInvoice(row),
      items:    items.map(mapItem),
      payments: payments.map(mapPayment),
      claims:   claimRows.rows,
    });
  } catch (err) { next(err); }
});

// ── POST /invoices ────────────────────────────────────────────────────────────

router.post("/", requirePermission("billing.create"), async (req: AuthenticatedRequest, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const a = actor(req);
    const body = req.body as {
      patientId:       string;
      encounterId?:    string;
      admissionId?:    string;
      consultationId?: string;
      siteId?:         string;
      insuranceType?:  string;
      insuranceCoveragePercent?: number;
      dueDate?:        string;
      notes?:          string;
      items?:          Array<{
        description: string; category?: string; quantity?: number;
        unitPrice: number; discount?: number; tax?: number;
        sourceModule?: string; sourceEntityId?: string; serviceCode?: string;
        performedAt?: string; performedBy?: string;
      }>;
    };

    if (!body.patientId) { res.status(400).json({ error: "patientId requis" }); await client.query("ROLLBACK"); return; }

    // Generate invoice number
    const { rows: [numRow] } = await client.query(
      `SELECT 'FACT-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('invoice_number_seq')::TEXT, 6, '0') AS num`
    );
    const invoiceNumber = numRow.num as string;

    // Compute totals from items
    const items = body.items ?? [];
    let subtotal = 0;
    let discountAmount = 0;
    let taxAmount = 0;
    for (const it of items) {
      const qty  = it.quantity  ?? 1;
      const disc = it.discount  ?? 0;
      const tax  = it.tax       ?? 0;
      const line = qty * it.unitPrice;
      subtotal       += line;
      discountAmount += disc;
      taxAmount      += tax;
    }
    const totalAmount   = subtotal - discountAmount + taxAmount;
    const coverPct      = body.insuranceCoveragePercent ?? 0;
    const insurerShare  = Math.round(totalAmount * (coverPct / 100) * 100) / 100;
    const patientShare  = Math.round((totalAmount - insurerShare) * 100) / 100;
    const remainingAmount = patientShare; // nothing paid yet

    // Get patient name
    const { rows: [pat] } = await client.query(
      `SELECT first_name || ' ' || last_name AS name FROM patients WHERE id = $1`, [body.patientId]
    );

    const { rows: [inv] } = await client.query(
      `INSERT INTO invoices (
         invoice_number, patient_id, patient_name, encounter_id, admission_id, consultation_id,
         site_id, insurance_type, insurance_coverage_percent,
         status, type, subtotal, discount_amount, tax_amount,
         total_amount, patient_share, insurer_share, paid_amount, remaining_amount,
         due_amount, currency, due_date, notes, created_by, invoice_date
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,
         'draft','facture',$10,$11,$12,
         $13,$14,$15,0,$16,
         $16,'DZD',$17,$18,$19,NOW()
       ) RETURNING *`,
      [
        invoiceNumber, body.patientId, pat?.name ?? "", body.encounterId ?? null,
        body.admissionId ?? null, body.consultationId ?? null, body.siteId ?? null,
        body.insuranceType ?? null, body.insuranceCoveragePercent ?? 0,
        subtotal, discountAmount, taxAmount,
        totalAmount, patientShare, insurerShare, remainingAmount,
        body.dueDate ?? null, body.notes ?? null, a.userId,
      ],
    );

    // Insert items
    for (const it of items) {
      const qty  = it.quantity ?? 1;
      const disc = it.discount ?? 0;
      const tax  = it.tax      ?? 0;
      const total = qty * it.unitPrice - disc + tax;
      await client.query(
        `INSERT INTO invoice_items (
           invoice_id, description, category, quantity, unit_price, discount, tax, total_price,
           source_module, source_entity_id, service_code, performed_at, performed_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          inv.id, it.description, it.category ?? null, qty, it.unitPrice,
          disc, tax, total,
          it.sourceModule ?? null, it.sourceEntityId ?? null, it.serviceCode ?? null,
          it.performedAt ? new Date(it.performedAt) : null, it.performedBy ?? null,
        ],
      );
    }

    await client.query("COMMIT");

    // Audit
    await auditService.log({
      userId: a.userId, userName: a.userId, userRole: a.userRole,
      action: "create", module: "billing",
      description: `Facture créée: ${invoiceNumber}`,
      patientId: body.patientId, resourceId: inv.id, resourceType: "Invoice",
    });

    const full = await fetchInvoice(inv.id);
    const its  = await fetchItems(inv.id);
    res.status(201).json({ ...mapInvoice(full), items: its.map(mapItem), payments: [] });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally { client.release(); }
});

// ── PATCH /invoices/:id ───────────────────────────────────────────────────────

router.patch("/:id", requirePermission("billing.update"), async (req: AuthenticatedRequest, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const a = actor(req);
    const id = req.params.id;

    const existing = await fetchInvoice(id);
    if (!existing) { res.status(404).json({ error: "Facture introuvable" }); await client.query("ROLLBACK"); return; }
    if (!["draft"].includes(existing.status as string)) {
      res.status(409).json({ error: "Seules les factures en brouillon peuvent être modifiées" });
      await client.query("ROLLBACK"); return;
    }

    const body = req.body as {
      notes?: string; dueDate?: string; insuranceType?: string;
      insuranceCoveragePercent?: number;
      items?: Array<{
        description: string; category?: string; quantity?: number; unitPrice: number;
        discount?: number; tax?: number; sourceModule?: string; sourceEntityId?: string;
        serviceCode?: string; performedAt?: string; performedBy?: string;
      }>;
    };

    if (body.items !== undefined) {
      await client.query("DELETE FROM invoice_items WHERE invoice_id = $1", [id]);
      let subtotal = 0; let discountAmount = 0; let taxAmount = 0;
      for (const it of body.items) {
        const qty = it.quantity ?? 1; const disc = it.discount ?? 0; const tax = it.tax ?? 0;
        const total = qty * it.unitPrice - disc + tax;
        subtotal += qty * it.unitPrice; discountAmount += disc; taxAmount += tax;
        await client.query(
          `INSERT INTO invoice_items (invoice_id, description, category, quantity, unit_price, discount, tax, total_price,
             source_module, source_entity_id, service_code, performed_at, performed_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [id, it.description, it.category ?? null, qty, it.unitPrice, disc, tax, total,
           it.sourceModule ?? null, it.sourceEntityId ?? null, it.serviceCode ?? null,
           it.performedAt ? new Date(it.performedAt) : null, it.performedBy ?? null],
        );
      }
      const totalAmount  = subtotal - discountAmount + taxAmount;
      const coverPct     = body.insuranceCoveragePercent ?? Number(existing.insurance_coverage_percent ?? 0);
      const insurerShare = Math.round(totalAmount * (coverPct / 100) * 100) / 100;
      const patientShare = Math.round((totalAmount - insurerShare) * 100) / 100;
      await client.query(
        `UPDATE invoices SET
           subtotal=$1, discount_amount=$2, tax_amount=$3, total_amount=$4,
           patient_share=$5, insurer_share=$6, remaining_amount=$7, due_amount=$7,
           insurance_type=COALESCE($8,insurance_type),
           insurance_coverage_percent=COALESCE($9,insurance_coverage_percent),
           notes=COALESCE($10,notes), due_date=COALESCE($11::timestamptz, due_date),
           updated_by=$12, updated_at=NOW(), version=version+1
         WHERE id=$13`,
        [subtotal, discountAmount, taxAmount, totalAmount,
         patientShare, insurerShare, patientShare,
         body.insuranceType ?? null, body.insuranceCoveragePercent ?? null,
         body.notes ?? null, body.dueDate ?? null, a.userId, id],
      );
    }

    await client.query("COMMIT");
    await auditService.log({
      userId: a.userId, userName: a.userId, userRole: a.userRole,
      action: "update", module: "billing",
      description: `Facture modifiée: ${existing.invoice_number}`,
      resourceId: id, resourceType: "Invoice",
    });

    const full = await fetchInvoice(id);
    const its  = await fetchItems(id);
    const pays = await fetchPayments(id);
    res.json({ ...mapInvoice(full), items: its.map(mapItem), payments: pays.map(mapPayment) });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally { client.release(); }
});

// ── POST /invoices/:id/issue ──────────────────────────────────────────────────

router.post("/:id/issue", requirePermission("billing.issue"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const id = req.params.id;

    const existing = await fetchInvoice(id);
    if (!existing) { res.status(404).json({ error: "Facture introuvable" }); return; }
    if (!["draft", "pending"].includes(existing.status as string)) {
      res.status(409).json({ error: "Seule une facture en brouillon peut être émise" }); return;
    }

    await pool.query(
      `UPDATE invoices SET status='issued', issued_by=$1, issued_at=NOW(), updated_at=NOW() WHERE id=$2`,
      [a.userId, id],
    );

    await auditService.log({
      userId: a.userId, userName: a.userId, userRole: a.userRole,
      action: "issue", module: "billing",
      description: `Facture émise: ${existing.invoice_number}`,
      patientId: existing.patient_id as string, resourceId: id, resourceType: "Invoice",
    });

    const full = await fetchInvoice(id);
    const its  = await fetchItems(id);
    const pays = await fetchPayments(id);
    res.json({ ...mapInvoice(full), items: its.map(mapItem), payments: pays.map(mapPayment) });
  } catch (err) { next(err); }
});

// ── POST /invoices/:id/cancel ─────────────────────────────────────────────────

router.post("/:id/cancel", requirePermission("billing.cancel"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a    = actor(req);
    const id   = req.params.id;
    const { reason } = req.body as { reason?: string };

    const existing = await fetchInvoice(id);
    if (!existing) { res.status(404).json({ error: "Facture introuvable" }); return; }

    const paidAmount = Number(existing.paid_amount ?? 0);
    if (paidAmount > 0) {
      res.status(409).json({
        error: "Impossible d'annuler une facture partiellement ou totalement payée. Créez une note de crédit.",
        code:  "PAID_INVOICE_REQUIRES_CREDIT_NOTE",
      });
      return;
    }

    await pool.query(
      `UPDATE invoices SET status='cancelled', notes=COALESCE($1,notes), updated_at=NOW(), updated_by=$2 WHERE id=$3`,
      [reason ?? null, a.userId, id],
    );

    await auditService.log({
      userId: a.userId, userName: a.userId, userRole: a.userRole,
      action: "cancel", module: "billing",
      description: `Facture annulée: ${existing.invoice_number}. Raison: ${reason ?? "—"}`,
      patientId: existing.patient_id as string, resourceId: id, resourceType: "Invoice",
    });

    const full = await fetchInvoice(id);
    res.json(mapInvoice(full));
  } catch (err) { next(err); }
});

// ── POST /invoices/:id/credit-note ────────────────────────────────────────────

router.post("/:id/credit-note", requirePermission("credit_notes.create"), async (req: AuthenticatedRequest, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const a  = actor(req);
    const id = req.params.id;
    const { amount, reason } = req.body as { amount: number; reason: string };

    if (!amount || !reason) { res.status(400).json({ error: "amount et reason sont requis" }); await client.query("ROLLBACK"); return; }

    const existing = await fetchInvoice(id);
    if (!existing) { res.status(404).json({ error: "Facture introuvable" }); await client.query("ROLLBACK"); return; }

    const { rows: [numRow] } = await client.query(
      `SELECT 'NC-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('credit_note_seq')::TEXT, 6, '0') AS num`
    );

    const { rows: [cn] } = await client.query(
      `INSERT INTO credit_notes (note_number, invoice_id, patient_id, amount, reason, issued_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [numRow.num, id, existing.patient_id, amount, reason, a.userId],
    );

    // Update invoice status
    await client.query(
      `UPDATE invoices SET status='refunded', updated_at=NOW(), updated_by=$1 WHERE id=$2`,
      [a.userId, id],
    );

    await client.query("COMMIT");

    await auditService.log({
      userId: a.userId, userName: a.userId, userRole: a.userRole,
      action: "credit_note", module: "billing",
      description: `Note de crédit ${cn.note_number}: ${amount} DZD sur ${existing.invoice_number}. ${reason}`,
      patientId: existing.patient_id as string, resourceId: id, resourceType: "Invoice",
    });

    res.status(201).json(cn);
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally { client.release(); }
});

export default router;
