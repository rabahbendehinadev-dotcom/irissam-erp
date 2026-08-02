/**
 * /patients routes — backed by PatientService + PatientRepository.
 *
 * JSON shape is preserved for frontend compatibility.
 *
 * Schema alignment (patientsTable):
 *  - No `name` / `age` / `service` / `registeredAt` / `medicalJson` /
 *    `emergencyContactJson` / `insuranceJson` columns (legacy).
 *  - firstName + lastName replace name; createdAt replaces registeredAt.
 *  - medical data is stored as arrays (allergies, chronicDiseases, majorHistory).
 *  - emergency contact is stored as separate columns.
 *  - insurance is stored as separate columns.
 *  - id: UUID (not integer).
 */
import { Router } from "express";
import { desc, isNull } from "drizzle-orm";
import { db, patientsTable, pool } from "@workspace/db";
import { patientService } from "../services/patient";
import { repos } from "../repositories";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requirePermission";
import type { ActorCtx } from "../repositories/types";
import type { DbPatient } from "../repositories/patient";

const router = Router();

function actor(req: AuthenticatedRequest): ActorCtx {
  return {
    userId:   req.auth?.userId ?? "system",
    userName: req.auth?.userId ?? "system",
    userRole: req.auth?.role   ?? "guest",
  };
}

function calcAge(dob: string): number {
  const year = parseInt(dob.slice(0, 4), 10);
  return isNaN(year) ? 0 : new Date().getFullYear() - year;
}

function mapPatient(p: DbPatient) {
  const emergencyContact = (
    p.emergencyContactName || p.emergencyContactPhone
  ) ? {
    name:     p.emergencyContactName    ?? undefined,
    relation: p.emergencyContactRelation ?? undefined,
    phone:    p.emergencyContactPhone   ?? undefined,
    address:  p.emergencyContactAddress ?? undefined,
  } : undefined;

  const insurance = p.insuranceType ? {
    type:         p.insuranceType         ?? undefined,
    orgName:      p.insuranceOrgName      ?? undefined,
    memberNumber: p.insuranceMemberNumber ?? undefined,
    validUntil:   p.insuranceValidUntil   ?? undefined,
  } : undefined;

  return {
    id:             p.id,
    mpiId:          p.mpiId,
    mrn:            p.mrn,
    fileNumber:     p.fileNumber,
    internalNumber: p.internalNumber ?? undefined,
    firstName:      p.firstName,
    lastName:       p.lastName,
    maidenName:     p.maidenName ?? undefined,
    gender:         p.gender,
    dateOfBirth:    p.dateOfBirth,
    age:            calcAge(p.dateOfBirth),
    placeOfBirth:   p.placeOfBirth   ?? undefined,
    nationality:    p.nationality,
    maritalStatus:  p.maritalStatus  ?? undefined,
    idDocumentType: p.idDocumentType ?? undefined,
    idDocumentNumber: p.idDocumentNumber ?? undefined,
    socialSecurityNumber: p.socialSecurityNumber ?? undefined,
    phone:          p.phone,
    phoneSecondary: p.phoneSecondary ?? undefined,
    email:          p.email    ?? undefined,
    address:        p.address  ?? undefined,
    commune:        p.commune  ?? undefined,
    wilaya:         p.wilaya   ?? undefined,
    postalCode:     p.postalCode ?? undefined,
    country:        p.country,
    bloodType:      p.bloodType ?? null,
    rhesus:         p.rhesus   ?? undefined,
    medical: {
      allergies:       p.allergies       ?? [],
      chronicDiseases: p.chronicDiseases ?? [],
      majorHistory:    p.majorHistory    ?? [],
    },
    emergencyContact,
    insurance,
    departmentId:       p.departmentId ?? undefined,
    status:             p.status,
    syncStatus:         p.syncStatus,
    isIncomplete:       p.isIncomplete,
    potentialDuplicate: p.potentialDuplicate,
    createdAt:   p.createdAt.toISOString(),
    updatedAt:   p.updatedAt.toISOString(),
    createdById: "system",
    siteId:      "site-1",
  };
}

/** GET /patients/recent — dashboard widget (5 newest) */
router.get("/recent", async (_req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(patientsTable)
      .where(isNull(patientsTable.deletedAt))
      .orderBy(desc(patientsTable.createdAt))
      .limit(5);

    res.json(rows.map((p) => ({
      id:          p.id,
      firstName:   p.firstName,
      lastName:    p.lastName,
      name:        `${p.firstName} ${p.lastName}`,
      age:         calcAge(p.dateOfBirth),
      fileNumber:  p.fileNumber,
      mrn:         p.mrn,
      createdAt:   p.createdAt.toISOString(),
    })));
  } catch (err) {
    next(err);
  }
});

/** GET /patients — full patient list */
router.get("/", async (req, res, next) => {
  try {
    const { search, status, gender, bloodType } =
      req.query as Record<string, string | undefined>;

    const result = await repos.patient.search({ query: search, status, limit: 500 });
    let rows = result.data;

    // gender and bloodType filters are not in PatientRepository.search() — apply in-memory
    if (gender && gender !== "all") {
      rows = rows.filter((p) => p.gender === gender);
    }
    if (bloodType && bloodType !== "all") {
      rows = rows.filter((p) => p.bloodType === bloodType);
    }

    res.json(rows.map(mapPatient));
  } catch (err) {
    next(err);
  }
});

/** GET /patients/:id — fetch one patient by UUID */
router.get("/:id", async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const row = await repos.patient.findById(id);
    if (!row) { res.status(404).json({ message: "Patient not found" }); return; }
    res.json(mapPatient(row));
  } catch (err) {
    next(err);
  }
});

/** POST /patients — create a new patient (requires patients.create) */
router.post("/", requirePermission("patients.create"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = req.body as PatientPayload;

    if (!body.firstName && !body.lastName) {
      res.status(400).json({ message: "firstName or lastName is required" });
      return;
    }
    if (!body.gender) {
      res.status(400).json({ message: "gender is required" });
      return;
    }
    if (!body.dateOfBirth) {
      res.status(400).json({ message: "dateOfBirth is required" });
      return;
    }
    if (!body.phone) {
      res.status(400).json({ message: "phone is required" });
      return;
    }

    const firstName = body.firstName || "";
    const lastName  = body.lastName  || "Inconnu";
    const timestamp = Date.now().toString().slice(-6);

    const patient = await patientService.create({
      mpiId:          body.mpiId        || `MPI-${timestamp}`,
      fileNumber:     body.fileNumber   || `${new Date().getFullYear()}-${timestamp}`,
      internalNumber: body.internalNumber || null,
      firstName,
      lastName,
      maidenName:     body.maidenName   || null,
      gender:         body.gender as any,
      dateOfBirth:    body.dateOfBirth,
      placeOfBirth:   body.placeOfBirth || null,
      nationality:    body.nationality  || "DZ",
      maritalStatus:  (body.maritalStatus as any) || null,
      idDocumentType:       (body.idDocumentType as any) || null,
      idDocumentNumber:     body.idDocumentNumber || null,
      socialSecurityNumber: body.socialSecurityNumber || null,
      phone:          body.phone,
      phoneSecondary: body.phoneSecondary || null,
      email:          body.email   || null,
      address:        body.address || null,
      commune:        body.commune || null,
      wilaya:         body.wilaya  || null,
      postalCode:     body.postalCode || null,
      country:        body.country || "DZ",
      bloodType:      (body.bloodType as any) || null,
      rhesus:         (body.rhesus as any)    || null,
      allergies:      body.medical?.allergies       ?? [],
      chronicDiseases: body.medical?.chronicDiseases ?? [],
      majorHistory:   body.medical?.majorHistory    ?? [],
      emergencyContactName:     body.emergencyContact?.name     || null,
      emergencyContactRelation: body.emergencyContact?.relation || null,
      emergencyContactPhone:    body.emergencyContact?.phone    || null,
      emergencyContactAddress:  body.emergencyContact?.address  || null,
      insuranceType:         (body.insurance?.type as any) || null,
      insuranceOrgName:      body.insurance?.orgName      || null,
      insuranceMemberNumber: body.insurance?.memberNumber || null,
      insuranceValidUntil:   body.insurance?.validUntil   || null,
      departmentId:  body.departmentId || null,
      status:        (body.status as any) || "active",
      syncStatus:    "synced",
      isIncomplete:  false,
      potentialDuplicate: false,
    }, actor(req));

    res.status(201).json(mapPatient(patient));
  } catch (err) {
    next(err);
  }
});

/** PUT /patients/:id — update patient (requires patients.edit) */
router.put("/:id", requirePermission("patients.edit"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const body = req.body as PatientPayload;

    const updated = await patientService.update(id, {
      firstName:      body.firstName,
      lastName:       body.lastName,
      maidenName:     body.maidenName   || null,
      gender:         body.gender as any,
      dateOfBirth:    body.dateOfBirth,
      placeOfBirth:   body.placeOfBirth || null,
      nationality:    body.nationality  || "DZ",
      maritalStatus:  (body.maritalStatus as any) || null,
      idDocumentType:       (body.idDocumentType as any) || null,
      idDocumentNumber:     body.idDocumentNumber || null,
      socialSecurityNumber: body.socialSecurityNumber || null,
      phone:          body.phone,
      phoneSecondary: body.phoneSecondary || null,
      email:          body.email   || null,
      address:        body.address || null,
      commune:        body.commune || null,
      wilaya:         body.wilaya  || null,
      postalCode:     body.postalCode || null,
      country:        body.country || "DZ",
      bloodType:      (body.bloodType as any) || null,
      rhesus:         (body.rhesus as any)    || null,
      allergies:      body.medical?.allergies       ?? undefined,
      chronicDiseases: body.medical?.chronicDiseases ?? undefined,
      majorHistory:   body.medical?.majorHistory    ?? undefined,
      emergencyContactName:     body.emergencyContact?.name     || null,
      emergencyContactRelation: body.emergencyContact?.relation || null,
      emergencyContactPhone:    body.emergencyContact?.phone    || null,
      emergencyContactAddress:  body.emergencyContact?.address  || null,
      insuranceType:         (body.insurance?.type as any) || null,
      insuranceOrgName:      body.insurance?.orgName      || null,
      insuranceMemberNumber: body.insurance?.memberNumber || null,
      insuranceValidUntil:   body.insurance?.validUntil   || null,
      departmentId:  body.departmentId || null,
    }, actor(req));

    if (!updated) {
      res.status(404).json({ message: "Patient not found" });
      return;
    }

    res.json(mapPatient(updated));
  } catch (err) {
    next(err);
  }
});

// ─── Billing sub-routes ───────────────────────────────────────────────────────

// GET /patients/:id/invoices
router.get("/:id/invoices", requirePermission("billing.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const patientId = String(req.params["id"]);
    const { search, status, dateFrom, dateTo, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const params: unknown[] = [patientId];
    const conds: string[] = ["i.patient_id = $1", "i.deleted_at IS NULL"];
    if (status)   { params.push(status);   conds.push(`i.status = $${params.length}::invoice_status`); }
    if (dateFrom) { params.push(dateFrom); conds.push(`i.invoice_date >= $${params.length}::timestamptz`); }
    if (dateTo)   { params.push(dateTo + "T23:59:59Z"); conds.push(`i.invoice_date <= $${params.length}::timestamptz`); }
    if (search)   {
      params.push(`%${search}%`);
      conds.push(`(i.invoice_number ILIKE $${params.length} OR i.patient_name ILIKE $${params.length})`);
    }
    params.push(parseInt(limit, 10) || 50);
    params.push(parseInt(offset, 10) || 0);
    const where = conds.join(" AND ");
    const { rows } = await pool.query(
      `SELECT i.id, i.invoice_number, i.patient_id, i.patient_name,
              i.encounter_id, i.invoice_date, i.status, i.type,
              i.insurance_type, i.insurance_coverage_percent,
              i.total_amount, i.subtotal, i.discount_amount, i.tax_amount,
              i.paid_amount, i.remaining_amount, i.patient_share, i.insurer_share,
              i.currency, i.notes, i.issued_at, i.due_date, i.version,
              i.created_at, i.updated_at,
              e.encounter_number
         FROM invoices i
         LEFT JOIN encounters e ON e.id = i.encounter_id
        WHERE ${where}
        ORDER BY i.invoice_date DESC, i.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    res.json(rows.map(r => ({
      id:                       r.id,
      invoiceNumber:            r.invoice_number,
      patientId:                r.patient_id,
      patientName:              r.patient_name,
      encounterId:              r.encounter_id,
      encounterNumber:          r.encounter_number,
      invoiceDate:              r.invoice_date,
      status:                   r.status,
      type:                     r.type,
      insuranceType:            r.insurance_type,
      insuranceCoveragePercent: r.insurance_coverage_percent,
      totalAmount:              r.total_amount,
      subtotal:                 r.subtotal,
      discountAmount:           r.discount_amount,
      taxAmount:                r.tax_amount,
      paidAmount:               r.paid_amount,
      remainingAmount:          r.remaining_amount,
      patientShare:             r.patient_share,
      insurerShare:             r.insurer_share,
      currency:                 r.currency,
      notes:                    r.notes,
      issuedAt:                 r.issued_at,
      dueDate:                  r.due_date,
      version:                  r.version,
      createdAt:                r.created_at,
      updatedAt:                r.updated_at,
    })));
  } catch (err) { next(err); }
});

// GET /patients/:id/payments
router.get("/:id/payments", requirePermission("payments.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const patientId = String(req.params["id"]);
    const { method, dateFrom, dateTo, limit = "100", offset = "0" } = req.query as Record<string, string>;
    const params: unknown[] = [patientId];
    const conds: string[] = ["p.patient_id = $1"];
    if (method)   { params.push(method);   conds.push(`p.method = $${params.length}::payment_method`); }
    if (dateFrom) { params.push(dateFrom); conds.push(`p.paid_at >= $${params.length}::timestamptz`); }
    if (dateTo)   { params.push(dateTo + "T23:59:59Z"); conds.push(`p.paid_at <= $${params.length}::timestamptz`); }
    params.push(parseInt(limit, 10) || 100);
    params.push(parseInt(offset, 10) || 0);
    const { rows } = await pool.query(
      `SELECT p.id, p.payment_number, p.invoice_id, p.patient_id, p.amount,
              p.method, p.reference, p.notes, p.paid_at, p.status, p.receipt_number,
              p.created_at,
              i.invoice_number, i.patient_name
         FROM payments p
         JOIN invoices i ON i.id = p.invoice_id
        WHERE ${conds.join(" AND ")}
        ORDER BY p.paid_at DESC, p.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    res.json(rows.map(r => ({
      id:            r.id,
      paymentNumber: r.payment_number,
      invoiceId:     r.invoice_id,
      invoiceNumber: r.invoice_number,
      patientId:     r.patient_id,
      patientName:   r.patient_name,
      amount:        r.amount,
      method:        r.method,
      reference:     r.reference,
      notes:         r.notes,
      paidAt:        r.paid_at,
      status:        r.status,
      receiptNumber: r.receipt_number,
      createdAt:     r.created_at,
    })));
  } catch (err) { next(err); }
});

// GET /patients/:id/financial-summary
router.get("/:id/financial-summary", requirePermission("billing.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const patientId = String(req.params["id"]);

    const [invoiceRow, paymentRow, moduleRow, monthlyInvRow, monthlyPayRow] = await Promise.all([
      pool.query(
        `SELECT
           COALESCE(SUM(total_amount), 0)                                           AS total_facture,
           COALESCE(SUM(paid_amount), 0)                                            AS total_paye,
           COALESCE(SUM(remaining_amount), 0)                                       AS total_reste,
           COALESCE(SUM(CASE WHEN insurance_type IS NOT NULL THEN insurer_share - paid_amount + patient_share ELSE 0 END), 0) AS total_creances,
           COALESCE(SUM(CASE WHEN insurance_type = 'cnas'    THEN insurer_share ELSE 0 END), 0) AS total_cnas,
           COALESCE(SUM(CASE WHEN insurance_type = 'casnos'  THEN insurer_share ELSE 0 END), 0) AS total_casnos,
           COALESCE(SUM(CASE WHEN insurance_type NOT IN ('cnas','casnos') AND insurance_type IS NOT NULL THEN insurer_share ELSE 0 END), 0) AS total_autre,
           MAX(invoice_date)  AS last_invoice_date,
           COUNT(*)           AS invoice_count
         FROM invoices
        WHERE patient_id = $1 AND deleted_at IS NULL AND status NOT IN ('cancelled','refunded')`,
        [patientId],
      ),
      pool.query(
        `SELECT MAX(paid_at) AS last_payment_date, COUNT(*) AS payment_count
           FROM payments WHERE patient_id = $1`,
        [patientId],
      ),
      pool.query(
        `SELECT be.source_module AS module,
                COALESCE(SUM(ii.total_price), 0) AS amount,
                COUNT(DISTINCT ii.id) AS count
           FROM invoice_items ii
           JOIN invoices i ON i.id = ii.invoice_id
           LEFT JOIN billable_events be ON be.billed_invoice_item_id = ii.id
          WHERE i.patient_id = $1 AND i.deleted_at IS NULL AND i.status NOT IN ('cancelled','refunded')
          GROUP BY be.source_module
          ORDER BY amount DESC`,
        [patientId],
      ),
      pool.query(
        `SELECT TO_CHAR(DATE_TRUNC('month', invoice_date), 'MM/YY') AS month,
                COALESCE(SUM(total_amount), 0) AS amount,
                COUNT(*) AS count
           FROM invoices
          WHERE patient_id = $1 AND deleted_at IS NULL AND status NOT IN ('cancelled','refunded')
            AND invoice_date >= NOW() - INTERVAL '12 months'
          GROUP BY DATE_TRUNC('month', invoice_date)
          ORDER BY DATE_TRUNC('month', invoice_date)`,
        [patientId],
      ),
      pool.query(
        `SELECT TO_CHAR(DATE_TRUNC('month', paid_at), 'MM/YY') AS month,
                COALESCE(SUM(amount), 0) AS amount,
                COUNT(*) AS count
           FROM payments
          WHERE patient_id = $1 AND paid_at >= NOW() - INTERVAL '12 months'
          GROUP BY DATE_TRUNC('month', paid_at)
          ORDER BY DATE_TRUNC('month', paid_at)`,
        [patientId],
      ),
    ]);

    const iv = invoiceRow.rows[0];
    const pv = paymentRow.rows[0];

    const MODULES = ["consultations","laboratoire","imagerie","pharmacie","hospitalisation","bloc","reanimation","system","admissions","urgences"];
    const moduleMap: Record<string, { amount: number; count: number }> = {};
    moduleRow.rows.forEach(r => { moduleMap[r.module ?? "system"] = { amount: parseFloat(r.amount), count: parseInt(r.count, 10) }; });

    res.json({
      totalFacture:        parseFloat(iv.total_facture),
      totalPaye:           parseFloat(iv.total_paye),
      totalReste:          parseFloat(iv.total_reste),
      totalCreances:       parseFloat(iv.total_creances),
      totalCnas:           parseFloat(iv.total_cnas),
      totalCasnos:         parseFloat(iv.total_casnos),
      totalAutreAssurance: parseFloat(iv.total_autre),
      lastInvoiceDate:     iv.last_invoice_date,
      lastPaymentDate:     pv.last_payment_date,
      invoiceCount:        parseInt(iv.invoice_count, 10),
      paymentCount:        parseInt(pv.payment_count, 10),
      monthlyInvoices:     monthlyInvRow.rows.map(r => ({ month: r.month, amount: parseFloat(r.amount), count: parseInt(r.count, 10) })),
      monthlyPayments:     monthlyPayRow.rows.map(r => ({ month: r.month, amount: parseFloat(r.amount), count: parseInt(r.count, 10) })),
      byModule:            MODULES.map(m => ({ module: m, ...(moduleMap[m] ?? { amount: 0, count: 0 }) })),
    });
  } catch (err) { next(err); }
});

// GET /patients/:id/billing-timeline
router.get("/:id/billing-timeline", requirePermission("billing.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const patientId = String(req.params["id"]);
    const { rows: invRows } = await pool.query(
      `SELECT id, invoice_number, status, total_amount, invoice_date AS event_date, 'invoice' AS event_type,
              issued_at, created_at
         FROM invoices
        WHERE patient_id = $1 AND deleted_at IS NULL
        ORDER BY invoice_date DESC NULLS LAST, created_at DESC`,
      [patientId],
    );
    const { rows: payRows } = await pool.query(
      `SELECT p.id, p.payment_number, p.amount, p.method, p.paid_at AS event_date,
              CASE WHEN i.remaining_amount <= 0.01 THEN 'payment_complete'
                   WHEN i.paid_amount > 0 THEN 'payment_partial'
                   ELSE 'payment' END AS event_type,
              i.invoice_number
         FROM payments p
         JOIN invoices i ON i.id = p.invoice_id
        WHERE p.patient_id = $1
        ORDER BY p.paid_at DESC`,
      [patientId],
    );

    const events = [
      ...invRows.map(r => ({
        id:          `inv-${r.id}`,
        type:        r.status === "issued" || r.status === "paid" ? "invoice" : "invoice",
        title:       r.status === "issued" ? `Facture émise ${r.invoice_number}` : `Facture ${r.invoice_number}`,
        description: `Montant: ${parseFloat(r.total_amount).toLocaleString("fr-DZ")} DZD · Statut: ${r.status}`,
        createdAt:   r.event_date ?? r.created_at,
        service:     "Facturation",
      })),
      ...payRows.map(r => ({
        id:          `pay-${r.id}`,
        type:        r.event_type === "payment_complete" ? "payment" : r.event_type === "payment_partial" ? "payment" : "payment",
        title:       r.event_type === "payment_complete"
                       ? `Paiement complet — ${r.invoice_number}`
                       : r.event_type === "payment_partial"
                         ? `Paiement partiel — ${r.invoice_number}`
                         : `Paiement ${r.payment_number}`,
        description: `${parseFloat(r.amount).toLocaleString("fr-DZ")} DZD · ${r.method}`,
        createdAt:   r.event_date,
        service:     "Facturation",
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(events);
  } catch (err) { next(err); }
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface PatientPayload {
  firstName?: string;
  lastName?: string;
  maidenName?: string;
  gender?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  nationality?: string;
  maritalStatus?: string;
  idDocumentType?: string;
  idDocumentNumber?: string;
  socialSecurityNumber?: string;
  fileNumber?: string;
  mpiId?: string;
  internalNumber?: string;
  phone?: string;
  phoneSecondary?: string;
  email?: string;
  address?: string;
  commune?: string;
  wilaya?: string;
  postalCode?: string;
  country?: string;
  bloodType?: string;
  rhesus?: string;
  medical?: { allergies?: string[]; chronicDiseases?: string[]; majorHistory?: string[] };
  emergencyContact?: { name?: string; relation?: string; phone?: string; address?: string };
  insurance?: { type?: string; orgName?: string; memberNumber?: string; validUntil?: string };
  departmentId?: string;
  status?: string;
}

export default router;
