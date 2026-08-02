/**
 * /invoices routes
 *
 * GET  /invoices              — list with filters
 * GET  /invoices/stats        — financial stats
 * GET  /invoices/:id          — single invoice + items + payments + claims
 * GET  /invoices/:id/pdf      — download invoice as PDF
 * POST /invoices              — create draft (with double-billing guard)
 * PATCH /invoices/:id         — update draft
 * POST /invoices/:id/issue    — 9-step transactional issue
 * POST /invoices/:id/cancel   — cancel (requires credit note if paid)
 * POST /invoices/:id/credit-note — create credit note
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { auditService } from "../services/audit";
import { requirePermission } from "../middleware/requirePermission";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import type { ActorCtx } from "../repositories/types";
import { generateInvoicePdf } from "../lib/pdfGenerator";

const router = Router();

function actor(req: AuthenticatedRequest): ActorCtx {
  return {
    userId:   req.auth?.userId ?? "system",
    userName: req.auth?.userId ?? "system",
    userRole: req.auth?.role   ?? "guest",
  };
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

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
    insuranceCoveragePercent: Number(row.insurance_coverage_percent ?? 0),
    subtotal:         Number(row.subtotal         ?? 0),
    discountAmount:   Number(row.discount_amount  ?? 0),
    taxAmount:        Number(row.tax_amount        ?? 0),
    totalAmount:      Number(row.total_amount      ?? 0),
    patientShare:     Number(row.patient_share     ?? 0),
    insurerShare:     Number(row.insurer_share     ?? 0),
    paidAmount:       Number(row.paid_amount       ?? 0),
    remainingAmount:  Number(row.remaining_amount  ?? 0),
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
    recordedBy:    row.recorded_by,
    paidAt:        row.paid_at,
    createdAt:     row.created_at,
  };
}

// ── Recalculate totals in PostgreSQL (NUMERIC precision) ──────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function recalcTotals(client: any, invoiceId: string, coverPct: number) {
  await client.query(`
    UPDATE invoices i SET
      subtotal         = t.subtotal,
      discount_amount  = t.discount_total,
      tax_amount       = t.tax_total,
      total_amount     = t.total_amount,
      insurer_share    = ROUND(t.total_amount * ($2::NUMERIC / 100), 2),
      patient_share    = t.total_amount - ROUND(t.total_amount * ($2::NUMERIC / 100), 2),
      remaining_amount = t.total_amount - ROUND(t.total_amount * ($2::NUMERIC / 100), 2) - COALESCE(i.paid_amount, 0),
      due_amount       = t.total_amount - ROUND(t.total_amount * ($2::NUMERIC / 100), 2) - COALESCE(i.paid_amount, 0),
      updated_at       = NOW()
    FROM (
      SELECT
        COALESCE(SUM(quantity::NUMERIC * unit_price::NUMERIC),  0) AS subtotal,
        COALESCE(SUM(discount::NUMERIC),  0) AS discount_total,
        COALESCE(SUM(tax::NUMERIC),       0) AS tax_total,
        COALESCE(SUM(total_price::NUMERIC), 0) AS total_amount
      FROM invoice_items WHERE invoice_id = $1
    ) t
    WHERE i.id = $1
  `, [invoiceId, coverPct]);
}

// ── GET /invoices/stats ───────────────────────────────────────────────────────

router.get("/stats", requirePermission("billing.view"), async (_req: AuthenticatedRequest, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COALESCE(SUM(total_amount) FILTER (
          WHERE invoice_date::date = CURRENT_DATE AND deleted_at IS NULL), 0) AS ca_today,
        COALESCE(SUM(total_amount) FILTER (
          WHERE DATE_TRUNC('month', invoice_date) = DATE_TRUNC('month', NOW()) AND deleted_at IS NULL), 0) AS ca_month,
        COUNT(*) FILTER (
          WHERE status IN ('issued','partially_paid','overdue') AND deleted_at IS NULL) AS unpaid_count,
        COALESCE(SUM(paid_amount) FILTER (
          WHERE DATE_TRUNC('month', invoice_date) = DATE_TRUNC('month', NOW()) AND deleted_at IS NULL), 0) AS payments_month,
        COALESCE(SUM(remaining_amount) FILTER (
          WHERE status NOT IN ('paid','cancelled','refunded') AND deleted_at IS NULL), 0) AS total_remaining,
        (SELECT COUNT(*) FROM insurance_claims WHERE status IN ('draft','submitted','under_review')) AS insurance_pending
      FROM invoices
    `);
    res.json({
      ca_today:          Number(rows[0].ca_today),
      ca_month:          Number(rows[0].ca_month),
      unpaid_count:      Number(rows[0].unpaid_count),
      payments_month:    Number(rows[0].payments_month),
      total_remaining:   Number(rows[0].total_remaining),
      insurance_pending: Number(rows[0].insurance_pending),
    });
  } catch (err) { next(err); }
});

// ── GET /invoices ─────────────────────────────────────────────────────────────

router.get("/", requirePermission("billing.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { search, status, patientId, encounterId, dateFrom, dateTo, limit = "100", offset = "0" } =
      req.query as Record<string, string>;

    const conditions: string[] = ["i.deleted_at IS NULL"];
    const params: unknown[]    = [];

    if (status     && status !== "all") { params.push(status);     conditions.push(`i.status = $${params.length}`); }
    if (patientId)                       { params.push(patientId);  conditions.push(`i.patient_id = $${params.length}`); }
    if (encounterId)                     { params.push(encounterId); conditions.push(`i.encounter_id = $${params.length}`); }
    if (dateFrom)                        { params.push(dateFrom);   conditions.push(`i.invoice_date::date >= $${params.length}::date`); }
    if (dateTo)                          { params.push(dateTo);     conditions.push(`i.invoice_date::date <= $${params.length}::date`); }
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
    const id = String(req.params["id"]);
    const row = await fetchInvoice(id);
    if (!row) { res.status(404).json({ error: "Facture introuvable" }); return; }

    const [items, payments, claimRows] = await Promise.all([
      fetchItems(id),
      fetchPayments(id),
      pool.query(`SELECT * FROM insurance_claims WHERE invoice_id = $1 ORDER BY created_at`, [id]),
    ]);

    res.json({
      ...mapInvoice(row),
      items:    items.map(mapItem),
      payments: payments.map(mapPayment),
      claims:   claimRows.rows,
    });
  } catch (err) { next(err); }
});

// ── GET /invoices/:id/pdf ─────────────────────────────────────────────────────

router.get("/:id/pdf", requirePermission("billing.print"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = String(req.params["id"]);
    const row = await fetchInvoice(id);
    if (!row) { res.status(404).json({ error: "Facture introuvable" }); return; }

    const [items, payments] = await Promise.all([
      fetchItems(id),
      fetchPayments(id),
    ]);

    const invoiceNumber = String(row.invoice_number ?? "FACT");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${invoiceNumber}.pdf"`);

    generateInvoicePdf(
      {
        invoiceNumber,
        invoiceDate:              row.invoice_date as string,
        dueDate:                  row.due_date as string | null,
        status:                   String(row.status ?? ""),
        patientName:              String(row.patient_full_name ?? row.patient_name ?? ""),
        patientMrn:               row.patient_mrn as string,
        encounterNumber:          row.encounter_number as string,
        insuranceType:            row.insurance_type as string,
        insuranceCoveragePercent: Number(row.insurance_coverage_percent ?? 0),
        subtotal:                 Number(row.subtotal ?? 0),
        discountAmount:           Number(row.discount_amount ?? 0),
        taxAmount:                Number(row.tax_amount ?? 0),
        totalAmount:              Number(row.total_amount ?? 0),
        patientShare:             Number(row.patient_share ?? 0),
        insurerShare:             Number(row.insurer_share ?? 0),
        paidAmount:               Number(row.paid_amount ?? 0),
        remainingAmount:          Number(row.remaining_amount ?? 0),
        currency:                 String(row.currency ?? "DZD"),
        notes:                    row.notes as string,
        items:  items.map(mapItem) as Parameters<typeof generateInvoicePdf>[0]["items"],
        payments: payments.map(p => ({
          paymentNumber: String(p.payment_number ?? ""),
          method:        String(p.method ?? ""),
          amount:        Number(p.amount ?? 0),
          paidAt:        p.paid_at as string,
        })),
      },
      res,
    );
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
      items?: Array<{
        description:    string;
        category?:      string;
        quantity?:      number;
        unitPrice:      number;
        discount?:      number;
        tax?:           number;
        sourceModule?:  string;
        sourceEntityId?: string;
        serviceCode?:   string;
        performedAt?:   string;
        performedBy?:   string;
      }>;
    };

    if (!body.patientId) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "patientId requis" }); return;
    }

    const items = body.items ?? [];

    // ── Validation: no empty items, no zero prices ──────────────────────────
    for (const it of items) {
      if (!it.description?.trim()) {
        await client.query("ROLLBACK");
        res.status(400).json({ error: "Chaque ligne doit avoir une description" }); return;
      }
      if ((it.unitPrice ?? 0) <= 0) {
        await client.query("ROLLBACK");
        res.status(400).json({
          error: `Tarif non configuré pour: "${it.description}". Configurez un prix avant d'émettre.`,
          code: "TARIF_NON_CONFIGURE",
        }); return;
      }
      if ((it.quantity ?? 1) <= 0) {
        await client.query("ROLLBACK");
        res.status(400).json({ error: "La quantité doit être > 0" }); return;
      }
      const disc = it.discount ?? 0;
      const line = (it.quantity ?? 1) * it.unitPrice;
      if (disc > line) {
        await client.query("ROLLBACK");
        res.status(400).json({ error: `La remise (${disc}) dépasse le montant de la ligne (${line})` }); return;
      }
    }

    // ── Double-billing guard: check each source entity ──────────────────────
    for (const it of items) {
      if (!it.sourceEntityId || !it.sourceModule) continue;
      const { rows: [conflict] } = await client.query(
        `SELECT be.id, inv.invoice_number
           FROM billable_events be
      LEFT JOIN invoice_items ii ON ii.id = be.billed_invoice_item_id
      LEFT JOIN invoices inv     ON inv.id = ii.invoice_id AND inv.status NOT IN ('cancelled','refunded') AND inv.deleted_at IS NULL
          WHERE be.source_module     = $1
            AND be.source_entity_id  = $2::uuid
            AND be.status IN ('reserved','billed')`,
        [it.sourceModule, it.sourceEntityId],
      );
      if (conflict) {
        await client.query("ROLLBACK");
        res.status(409).json({
          error:           `Service déjà facturé: "${it.description}"`,
          code:            "DOUBLE_BILLING",
          invoiceNumber:   conflict.invoice_number,
          sourceModule:    it.sourceModule,
          sourceEntityId:  it.sourceEntityId,
        }); return;
      }
    }

    // ── Check for existing active invoice for this encounter ─────────────────
    if (body.encounterId) {
      const { rows: [existingInv] } = await client.query(
        `SELECT invoice_number FROM invoices
          WHERE encounter_id = $1
            AND status NOT IN ('cancelled','refunded')
            AND deleted_at IS NULL
          LIMIT 1`,
        [body.encounterId],
      );
      if (existingInv) {
        await client.query("ROLLBACK");
        res.status(409).json({
          error:         `Une facture active existe déjà pour cet encounter: ${existingInv.invoice_number}`,
          code:          "ENCOUNTER_ALREADY_INVOICED",
          invoiceNumber: existingInv.invoice_number,
        }); return;
      }
    }

    // ── Generate invoice number ───────────────────────────────────────────────
    const { rows: [numRow] } = await client.query(
      `SELECT 'FACT-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('invoice_number_seq')::TEXT, 6, '0') AS num`,
    );
    const invoiceNumber = numRow.num as string;

    // ── Get patient name ──────────────────────────────────────────────────────
    const { rows: [pat] } = await client.query(
      `SELECT first_name || ' ' || last_name AS name FROM patients WHERE id = $1`, [body.patientId],
    );

    // ── Insert invoice (totals will be recalculated from items in PostgreSQL) ─
    const { rows: [inv] } = await client.query(
      `INSERT INTO invoices (
         invoice_number, patient_id, patient_name, encounter_id, admission_id, consultation_id,
         site_id, insurance_type, insurance_coverage_percent,
         status, type, subtotal, discount_amount, tax_amount,
         total_amount, patient_share, insurer_share, paid_amount, remaining_amount,
         due_amount, currency, due_date, notes, created_by, invoice_date
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,
         'draft','facture',0,0,0,0,0,0,0,0,0,'DZD',$10,$11,$12,NOW()
       ) RETURNING id`,
      [
        invoiceNumber, body.patientId, pat?.name ?? "", body.encounterId ?? null,
        body.admissionId ?? null, body.consultationId ?? null, body.siteId ?? null,
        body.insuranceType ?? null, body.insuranceCoveragePercent ?? 0,
        body.dueDate ?? null, body.notes ?? null, a.userId,
      ],
    );
    const invoiceId = inv.id as string;

    // ── Insert items + track inserted IDs for billable_event linking ──────────
    const insertedItems: Array<{ id: string; it: typeof items[0] }> = [];
    for (const it of items) {
      const qty   = it.quantity ?? 1;
      const disc  = it.discount ?? 0;
      const tax   = it.tax      ?? 0;
      const total = qty * it.unitPrice - disc + tax;
      const { rows: [item] } = await client.query(
        `INSERT INTO invoice_items (
           invoice_id, description, category, quantity, unit_price, discount, tax, total_price,
           source_module, source_entity_id, service_code, performed_at, performed_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
        [
          invoiceId, it.description, it.category ?? null, qty, it.unitPrice,
          disc, tax, total,
          it.sourceModule   ?? null,
          it.sourceEntityId ?? null,
          it.serviceCode    ?? null,
          it.performedAt    ? new Date(it.performedAt) : null,
          it.performedBy    ?? null,
        ],
      );
      insertedItems.push({ id: item.id as string, it });
    }

    // ── Recalculate totals in PostgreSQL (NUMERIC) ────────────────────────────
    await recalcTotals(client, invoiceId, body.insuranceCoveragePercent ?? 0);

    // ── Reserve billable events (upsert) ──────────────────────────────────────
    for (const { id: itemId, it } of insertedItems) {
      if (!it.sourceEntityId || !it.sourceModule) continue;
      await client.query(
        `INSERT INTO billable_events (
           patient_id, encounter_id, source_module, source_entity_id,
           description, quantity, unit_price, total_price, service_code,
           performed_at, status, billed_invoice_item_id
         ) VALUES ($1,$2,$3,$4::uuid,$5,$6,$7,$8,$9,$10,'reserved',$11)
         ON CONFLICT (source_module, source_entity_id)
           WHERE source_entity_id IS NOT NULL AND status != 'cancelled'
         DO UPDATE SET
           status = 'reserved',
           billed_invoice_item_id = EXCLUDED.billed_invoice_item_id`,
        [
          body.patientId, body.encounterId ?? null,
          it.sourceModule, it.sourceEntityId,
          it.description, it.quantity ?? 1, it.unitPrice,
          (it.quantity ?? 1) * it.unitPrice - (it.discount ?? 0) + (it.tax ?? 0),
          it.serviceCode ?? null,
          it.performedAt ? new Date(it.performedAt) : new Date(),
          itemId,
        ],
      );
    }

    await client.query("COMMIT");

    await auditService.log(
      { action: "create", module: "system", resourceId: invoiceId, resourceType: "Invoice", patientId: body.patientId },
      a,
    );

    const full = await fetchInvoice(invoiceId);
    const its  = await fetchItems(invoiceId);
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
    const a  = actor(req);
    const id = String(req.params["id"]);

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
      // Release billable_event reservations for old items
      await client.query(
        `UPDATE billable_events SET status='unbilled', billed_invoice_item_id=NULL
          WHERE billed_invoice_item_id IN (SELECT id FROM invoice_items WHERE invoice_id = $1)`,
        [id],
      );
      await client.query("DELETE FROM invoice_items WHERE invoice_id = $1", [id]);

      const insertedItems: Array<{ id: string; it: typeof body.items[0] }> = [];
      for (const it of body.items) {
        const qty  = it.quantity ?? 1;
        const disc = it.discount ?? 0;
        const tax  = it.tax      ?? 0;
        const total = qty * it.unitPrice - disc + tax;
        const { rows: [item] } = await client.query(
          `INSERT INTO invoice_items (invoice_id, description, category, quantity, unit_price, discount, tax, total_price,
             source_module, source_entity_id, service_code, performed_at, performed_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
          [id, it.description, it.category ?? null, qty, it.unitPrice, disc, tax, total,
           it.sourceModule ?? null, it.sourceEntityId ?? null, it.serviceCode ?? null,
           it.performedAt ? new Date(it.performedAt) : null, it.performedBy ?? null],
        );
        insertedItems.push({ id: item.id as string, it });
      }

      const coverPct = body.insuranceCoveragePercent
        ?? Number(existing.insurance_coverage_percent ?? 0);
      await recalcTotals(client, id, coverPct);

      // Re-reserve billable events
      for (const { id: itemId, it } of insertedItems) {
        if (!it.sourceEntityId || !it.sourceModule) continue;
        await client.query(
          `INSERT INTO billable_events (
             patient_id, encounter_id, source_module, source_entity_id,
             description, quantity, unit_price, total_price, service_code,
             performed_at, status, billed_invoice_item_id
           ) VALUES ($1,$2,$3,$4::uuid,$5,$6,$7,$8,$9,$10,'reserved',$11)
           ON CONFLICT (source_module, source_entity_id)
             WHERE source_entity_id IS NOT NULL AND status != 'cancelled'
           DO UPDATE SET status='reserved', billed_invoice_item_id=EXCLUDED.billed_invoice_item_id`,
          [
            existing.patient_id, existing.encounter_id ?? null,
            it.sourceModule, it.sourceEntityId,
            it.description, it.quantity ?? 1, it.unitPrice,
            (it.quantity ?? 1) * it.unitPrice - (it.discount ?? 0) + (it.tax ?? 0),
            it.serviceCode ?? null,
            it.performedAt ? new Date(it.performedAt) : new Date(),
            itemId,
          ],
        );
      }
    }

    // Update metadata
    await client.query(
      `UPDATE invoices SET
         insurance_type             = COALESCE($1, insurance_type),
         insurance_coverage_percent = COALESCE($2, insurance_coverage_percent),
         notes                      = COALESCE($3, notes),
         due_date                   = COALESCE($4::timestamptz, due_date),
         updated_by                 = $5,
         updated_at                 = NOW(),
         version                    = version + 1
       WHERE id = $6`,
      [body.insuranceType ?? null, body.insuranceCoveragePercent ?? null,
       body.notes ?? null, body.dueDate ?? null, a.userId, id],
    );

    await client.query("COMMIT");
    await auditService.log(
      { action: "update", module: "system", resourceId: id as string, resourceType: "Invoice" },
      a,
    );

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
// 9-step transactional issue process

router.post("/:id/issue", requirePermission("billing.issue"), async (req: AuthenticatedRequest, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const a  = actor(req);
    const id = String(req.params["id"]);

    // Step 1: Lock invoice row
    const { rows: [existing] } = await client.query(
      `SELECT i.*, p.first_name || ' ' || p.last_name AS patient_full_name, p.mrn AS patient_mrn
         FROM invoices i JOIN patients p ON p.id = i.patient_id
        WHERE i.id = $1 AND i.deleted_at IS NULL FOR UPDATE`,
      [id],
    );
    if (!existing) { await client.query("ROLLBACK"); res.status(404).json({ error: "Facture introuvable" }); return; }
    if (!["draft","pending"].includes(existing.status as string)) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "Seule une facture en brouillon peut être émise" }); return;
    }

    // Step 2: Verify at least one item
    const items = await fetchItems(id);
    if (items.length === 0) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Impossible d'émettre une facture sans ligne" }); return;
    }

    // Step 3: Verify no zero-price items
    const zeroPriceItem = items.find(it => Number(it.unit_price ?? 0) <= 0);
    if (zeroPriceItem) {
      await client.query("ROLLBACK");
      res.status(400).json({
        error: `Tarif non configuré pour: "${zeroPriceItem.description}". Configurez un prix avant d'émettre.`,
        code:  "TARIF_NON_CONFIGURE",
      }); return;
    }

    // Step 4: Double-billing re-check (defensive — guard already runs on create)
    for (const it of items) {
      if (!it.source_entity_id || !it.source_module) continue;
      const { rows: [conflict] } = await client.query(
        `SELECT be.id
           FROM billable_events be
           JOIN invoice_items ii2 ON ii2.id = be.billed_invoice_item_id
           JOIN invoices inv2     ON inv2.id = ii2.invoice_id
                                 AND inv2.id != $3
                                 AND inv2.status NOT IN ('cancelled','refunded')
          WHERE be.source_module = $1 AND be.source_entity_id = $2::uuid AND be.status = 'billed'`,
        [it.source_module, it.source_entity_id, id],
      );
      if (conflict) {
        await client.query("ROLLBACK");
        res.status(409).json({
          error: `Double facturation détectée pour: "${it.description}"`,
          code:  "DOUBLE_BILLING",
        }); return;
      }
    }

    // Step 5: Recalculate totals in PostgreSQL
    await recalcTotals(client, id, Number(existing.insurance_coverage_percent ?? 0));

    // Step 6: Update invoice status
    await client.query(
      `UPDATE invoices SET status='issued', issued_by=$1, issued_at=NOW(), updated_at=NOW(), version=version+1 WHERE id=$2`,
      [a.userId, id],
    );

    // Step 7: Mark billable events as 'billed'
    await client.query(
      `UPDATE billable_events SET status='billed', is_billed=TRUE
        WHERE billed_invoice_item_id IN (SELECT id FROM invoice_items WHERE invoice_id = $1)
          AND status = 'reserved'`,
      [id],
    );

    // Step 8: Audit
    await client.query("COMMIT");
    await auditService.log(
      { action: "issue", module: "system", resourceId: id as string, resourceType: "Invoice", patientId: existing.patient_id as string },
      a,
    );

    // Step 9: Reload and return
    const full = await fetchInvoice(id);
    const its  = await fetchItems(id);
    const pays = await fetchPayments(id);
    res.json({ ...mapInvoice(full), items: its.map(mapItem), payments: pays.map(mapPayment) });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally { client.release(); }
});

// ── POST /invoices/:id/cancel ─────────────────────────────────────────────────

router.post("/:id/cancel", requirePermission("billing.cancel"), async (req: AuthenticatedRequest, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const a    = actor(req);
    const id   = String(req.params["id"]);
    const { reason } = req.body as { reason?: string };

    const existing = await fetchInvoice(id);
    if (!existing) { await client.query("ROLLBACK"); res.status(404).json({ error: "Facture introuvable" }); return; }

    if (Number(existing.paid_amount ?? 0) > 0) {
      await client.query("ROLLBACK");
      res.status(409).json({
        error: "Impossible d'annuler une facture partiellement ou totalement payée. Créez une note de crédit.",
        code:  "PAID_INVOICE_REQUIRES_CREDIT_NOTE",
      }); return;
    }

    await client.query(
      `UPDATE invoices SET status='cancelled', notes=COALESCE($1,notes), updated_at=NOW(), updated_by=$2 WHERE id=$3`,
      [reason ?? null, a.userId, id],
    );

    // Release billable event reservations
    await client.query(
      `UPDATE billable_events SET status='unbilled', billed_invoice_item_id=NULL, is_billed=FALSE
        WHERE billed_invoice_item_id IN (SELECT id FROM invoice_items WHERE invoice_id = $1)`,
      [id],
    );

    await client.query("COMMIT");
    await auditService.log(
      { action: "cancel", module: "system", resourceId: id as string, resourceType: "Invoice", patientId: existing.patient_id as string },
      a,
    );

    const full = await fetchInvoice(id);
    res.json(mapInvoice(full));
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally { client.release(); }
});

// ── POST /invoices/:id/credit-note ────────────────────────────────────────────

router.post("/:id/credit-note", requirePermission("credit_notes.create"), async (req: AuthenticatedRequest, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const a  = actor(req);
    const id = String(req.params["id"]);
    const { amount, reason } = req.body as { amount: number; reason: string };

    if (!amount || !reason) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "amount et reason sont requis" }); return;
    }

    const existing = await fetchInvoice(id);
    if (!existing) { await client.query("ROLLBACK"); res.status(404).json({ error: "Facture introuvable" }); return; }

    const { rows: [numRow] } = await client.query(
      `SELECT 'NC-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('credit_note_seq')::TEXT, 6, '0') AS num`,
    );

    const { rows: [cn] } = await client.query(
      `INSERT INTO credit_notes (note_number, invoice_id, patient_id, amount, reason, issued_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [numRow.num, id, existing.patient_id, amount, reason, a.userId],
    );

    await client.query(
      `UPDATE invoices SET status='refunded', updated_at=NOW(), updated_by=$1 WHERE id=$2`,
      [a.userId, id],
    );

    await client.query("COMMIT");
    await auditService.log(
      { action: "credit_note", module: "system", resourceId: id as string, resourceType: "Invoice", patientId: existing.patient_id as string },
      a,
    );

    res.status(201).json(cn);
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally { client.release(); }
});

export default router;
