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
import { auditService } from "../services/audit";
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

/**
 * GET /patients/check-duplicates?lastName=&firstName=[&dateOfBirth=&phone=&idDocumentNumber=]
 *
 * Tiered duplicate search with normalized comparison (trim/lower/collapse spaces):
 *   very_strong — same ID document number
 *   strong      — same phone (digits-only) or same normalized name + date of birth
 *   possible    — same normalized name only (must not auto-block saving)
 *
 * Response candidates match the frontend DuplicatePatientModal contract:
 *   { patient, matchStrength, similarity, matchOn[] }
 */
router.get("/check-duplicates", requirePermission("patients.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { lastName, firstName, dateOfBirth, phone, idDocumentNumber } =
      req.query as Record<string, string | undefined>;
    if (!lastName?.trim() || !firstName?.trim()) {
      res.status(400).json({ message: "lastName and firstName are required" });
      return;
    }

    const candidates = await patientService.findDuplicateCandidates({
      lastName:         lastName.trim(),
      firstName:        firstName.trim(),
      dateOfBirth:      dateOfBirth?.trim() || undefined,
      phone:            phone?.trim() || undefined,
      idDocumentNumber: idDocumentNumber?.trim() || undefined,
    });

    const TIER_META: Record<string, { strength: string; similarity: number; matchOn: string[] }> = {
      very_strong:     { strength: "very_strong", similarity: 98, matchOn: ["Pièce d'identité"] },
      strong_phone:    { strength: "strong",      similarity: 90, matchOn: ["Téléphone"] },
      strong_name_dob: { strength: "strong",      similarity: 85, matchOn: ["Nom", "Prénom", "Date de naissance"] },
      possible_name:   { strength: "possible",    similarity: 60, matchOn: ["Nom", "Prénom"] },
    };

    res.json({
      duplicates: candidates.map(({ patient, tier }) => ({
        patient:       mapPatient(patient),
        matchStrength: TIER_META[tier].strength,
        similarity:    TIER_META[tier].similarity,
        matchOn:       TIER_META[tier].matchOn,
      })),
    });
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

    // mpiId and fileNumber are intentionally NOT derived here.
    // PatientService.create() generates them from the same sequential counter
    // as the MRN (inside the transaction), so they are collision-free.
    // Passing placeholder values from the route is no longer needed.
    const patient = await patientService.create({
      mpiId:          body.mpiId        || "",   // overridden by service
      fileNumber:     body.fileNumber   || "",   // overridden by service
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

// GET /patients/:id/stats — compteurs réels pour les cartes d'en-tête de la fiche.
// Toutes les valeurs viennent de PostgreSQL, scoping strict WHERE patient_id.
router.get("/:id/stats", requirePermission("patients.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const patientId = String(req.params["id"]);

    const exists = await pool.query(`SELECT 1 FROM patients WHERE id = $1 AND deleted_at IS NULL`, [patientId]);
    if (!exists.rows[0]) {
      res.status(404).json({ message: "Patient not found" });
      return;
    }

    // Les agrégats financiers exigent billing.view (même frontière d'autorisation
    // que /patients/:id/financial-summary) — sinon billed/paid restent null et
    // aucune requête sur invoices n'est exécutée.
    const canViewBilling =
      req.auth?.role === "super_admin" ||
      (req.auth?.permissions ?? []).includes("billing.view");

    const [cons, adm, emer, lab, img, rx, fin] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS n, MAX(created_at) AS last
           FROM consultations WHERE patient_id = $1 AND deleted_at IS NULL`,
        [patientId],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS n,
                COUNT(*) FILTER (WHERE type = 'hospitalisation')::int AS hosp,
                MAX(admission_date) AS last
           FROM admissions WHERE patient_id = $1 AND deleted_at IS NULL`,
        [patientId],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS n, MAX(arrival_time) AS last
           FROM emergency_visits WHERE patient_id = $1 AND deleted_at IS NULL`,
        [patientId],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS n FROM lab_orders WHERE patient_id = $1 AND deleted_at IS NULL`,
        [patientId],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS n FROM imaging_orders WHERE patient_id = $1 AND deleted_at IS NULL`,
        [patientId],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS n FROM prescriptions WHERE patient_id = $1 AND deleted_at IS NULL`,
        [patientId],
      ),
      canViewBilling
        ? pool.query(
            `SELECT COALESCE(SUM(total_amount), 0) AS billed, COALESCE(SUM(paid_amount), 0) AS paid
               FROM invoices
              WHERE patient_id = $1 AND deleted_at IS NULL AND status NOT IN ('cancelled','refunded')`,
            [patientId],
          )
        : Promise.resolve(null),
    ]);

    const lastDates = [cons.rows[0].last, adm.rows[0].last, emer.rows[0].last]
      .filter(Boolean)
      .map((d: string | Date) => new Date(d).getTime());

    res.json({
      consultations:    cons.rows[0].n,
      hospitalizations: adm.rows[0].hosp,
      admissions:       adm.rows[0].n,
      emergencies:      emer.rows[0].n,
      analyses:         lab.rows[0].n,
      imageries:        img.rows[0].n,
      prescriptions:    rx.rows[0].n,
      billed:           fin ? Number(fin.rows[0].billed) : null,
      paid:             fin ? Number(fin.rows[0].paid) : null,
      lastVisit:        lastDates.length ? new Date(Math.max(...lastDates)).toISOString() : null,
    });
  } catch (err) {
    next(err);
  }
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

// ─── Clinical record sub-routes (Patient Detail tabs) ────────────────────────
// Every query below is strictly patient-scoped (WHERE patient_id = $1).
// No demo/mock/fallback data — empty arrays when the patient has no records.

const VACCINATION_STATUSES = ["administre", "planifie", "en_retard", "refuse"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Resolve the authenticated user's display name from the users table
 *  (the JWT payload only carries userId/role/permissions). */
async function resolveUserName(req: AuthenticatedRequest): Promise<string | null> {
  const uid = req.auth?.userId;
  if (!uid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid)) return null;
  const { rows } = await pool.query(`SELECT first_name, last_name FROM users WHERE id = $1`, [uid]);
  if (!rows[0]) return null;
  const name = [rows[0]["first_name"], rows[0]["last_name"]].filter(Boolean).join(" ").trim();
  return name || null;
}

function mapVaccination(r: Record<string, unknown>) {
  return {
    id:                 r["id"],
    patientId:          r["patient_id"],
    vaccine:            r["vaccine"],
    disease:            r["disease"],
    doseLabel:          r["dose_label"],
    dateGiven:          r["date_given"],
    nextDoseDate:       r["next_dose_date"],
    status:             r["status"],
    lotNumber:          r["lot_number"],
    administeredByName: r["administered_by_name"],
    service:            r["service"],
    notes:              r["notes"],
    createdAt:          r["created_at"],
    updatedAt:          r["updated_at"],
  };
}

// PATCH /patients/:id/allergies — narrow update touching ONLY patients.allergies.
// Rationale: PUT /patients/:id rebuilds the whole record and nulls omitted
// optional fields, so a tab-level save built from a possibly-stale snapshot
// could overwrite unrelated concurrent edits. This endpoint removes that
// lost-update risk for allergy changes.
router.patch("/:id/allergies", requirePermission("patients.edit"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const patientId = String(req.params["id"]);
    const raw = (req.body as { allergies?: unknown }).allergies;
    if (!Array.isArray(raw)) {
      res.status(400).json({ message: "allergies doit être un tableau de chaînes" });
      return;
    }
    const allergies = [...new Set(
      raw.map(a => String(a ?? "").trim()).filter(a => a.length > 0 && a.length <= 200),
    )];
    if (allergies.length > 100) {
      res.status(400).json({ message: "Trop d'entrées (max 100)" });
      return;
    }

    const { rows: prevRows } = await pool.query(
      `SELECT allergies FROM patients WHERE id = $1 AND deleted_at IS NULL`, [patientId]);
    if (prevRows.length === 0) { res.status(404).json({ message: "Patient not found" }); return; }

    const { rows } = await pool.query(
      `UPDATE patients SET allergies = $2, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING allergies`,
      [patientId, allergies],
    );

    await auditService.log({
      module: "system", action: "update", resourceType: "PatientAllergies",
      resourceId: patientId, patientId,
      oldValue: { allergies: prevRows[0]?.["allergies"] ?? [] },
      newValue: { allergies },
    }, actor(req));

    res.json({ allergies: rows[0]?.["allergies"] ?? allergies });
  } catch (err) { next(err); }
});

// GET /patients/:id/vaccinations — real per-patient records only
router.get("/:id/vaccinations", requirePermission("patients.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const patientId = String(req.params["id"]);
    const { rows } = await pool.query(
      `SELECT * FROM patient_vaccinations
        WHERE patient_id = $1 AND deleted_at IS NULL
        ORDER BY COALESCE(date_given, next_dose_date) DESC NULLS LAST, created_at DESC`,
      [patientId],
    );
    res.json(rows.map(mapVaccination));
  } catch (err) { next(err); }
});

// POST /patients/:id/vaccinations
router.post("/:id/vaccinations", requirePermission("patients.edit"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const patientId = String(req.params["id"]);
    const b = req.body as {
      vaccine?: string; disease?: string; doseLabel?: string;
      dateGiven?: string; nextDoseDate?: string; status?: string;
      lotNumber?: string; service?: string; notes?: string;
    };
    const vaccine = (b.vaccine ?? "").trim();
    if (!vaccine) { res.status(400).json({ message: "vaccine requis" }); return; }
    if (b.dateGiven && !DATE_RE.test(b.dateGiven)) { res.status(400).json({ message: "dateGiven invalide (YYYY-MM-DD attendu)" }); return; }
    if (b.nextDoseDate && !DATE_RE.test(b.nextDoseDate)) { res.status(400).json({ message: "nextDoseDate invalide (YYYY-MM-DD attendu)" }); return; }
    const status = b.status ?? (b.dateGiven ? "administre" : "planifie");
    if (!VACCINATION_STATUSES.includes(status)) {
      res.status(400).json({ message: `status invalide (${VACCINATION_STATUSES.join(", ")})` }); return;
    }

    const { rows: pRows } = await pool.query(
      `SELECT 1 FROM patients WHERE id = $1 AND deleted_at IS NULL`, [patientId]);
    if (pRows.length === 0) { res.status(404).json({ message: "Patient not found" }); return; }

    const adminName = status === "administre" ? await resolveUserName(req) : null;
    const { rows } = await pool.query(
      `INSERT INTO patient_vaccinations
         (patient_id, vaccine, disease, dose_label, date_given, next_dose_date,
          status, lot_number, administered_by_name, service, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [patientId, vaccine, b.disease ?? null, b.doseLabel ?? null,
       b.dateGiven ?? null, b.nextDoseDate ?? null, status,
       b.lotNumber ?? null, adminName,
       b.service ?? null, b.notes ?? null],
    );
    await auditService.log({
      module: "system", action: "create", resourceType: "PatientVaccination",
      resourceId: String(rows[0]["id"]), patientId,
      newValue: { vaccine, status },
    }, actor(req));
    res.status(201).json(mapVaccination(rows[0]));
  } catch (err) { next(err); }
});

// PATCH /patients/:id/vaccinations/:vaccinationId
router.patch("/:id/vaccinations/:vaccinationId", requirePermission("patients.edit"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const patientId = String(req.params["id"]);
    const vaccinationId = String(req.params["vaccinationId"]);
    const b = req.body as Record<string, unknown>;
    const sets: string[] = [];
    const params: unknown[] = [patientId, vaccinationId];
    const push = (col: string, val: unknown) => { params.push(val); sets.push(`${col} = $${params.length}`); };

    if (typeof b["vaccine"] === "string" && (b["vaccine"] as string).trim()) push("vaccine", (b["vaccine"] as string).trim());
    if ("disease" in b)   push("disease", b["disease"] ?? null);
    if ("doseLabel" in b) push("dose_label", b["doseLabel"] ?? null);
    if ("dateGiven" in b) {
      if (b["dateGiven"] && !DATE_RE.test(String(b["dateGiven"]))) { res.status(400).json({ message: "dateGiven invalide" }); return; }
      push("date_given", b["dateGiven"] ?? null);
    }
    if ("nextDoseDate" in b) {
      if (b["nextDoseDate"] && !DATE_RE.test(String(b["nextDoseDate"]))) { res.status(400).json({ message: "nextDoseDate invalide" }); return; }
      push("next_dose_date", b["nextDoseDate"] ?? null);
    }
    if ("status" in b) {
      if (!VACCINATION_STATUSES.includes(String(b["status"]))) { res.status(400).json({ message: "status invalide" }); return; }
      push("status", b["status"]);
      if (b["status"] === "administre") push("administered_by_name", await resolveUserName(req));
    }
    if ("lotNumber" in b) push("lot_number", b["lotNumber"] ?? null);
    if ("service" in b)   push("service", b["service"] ?? null);
    if ("notes" in b)     push("notes", b["notes"] ?? null);
    if (sets.length === 0) { res.status(400).json({ message: "Aucun champ à modifier" }); return; }
    sets.push(`updated_at = now()`);

    const { rows } = await pool.query(
      `UPDATE patient_vaccinations SET ${sets.join(", ")}
        WHERE patient_id = $1 AND id = $2 AND deleted_at IS NULL
        RETURNING *`,
      params,
    );
    if (rows.length === 0) { res.status(404).json({ message: "Vaccination introuvable" }); return; }
    await auditService.log({
      module: "system", action: "update", resourceType: "PatientVaccination",
      resourceId: vaccinationId, patientId, newValue: b as Record<string, unknown>,
    }, actor(req));
    res.json(mapVaccination(rows[0]));
  } catch (err) { next(err); }
});

// DELETE /patients/:id/vaccinations/:vaccinationId — soft delete
router.delete("/:id/vaccinations/:vaccinationId", requirePermission("patients.edit"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const patientId = String(req.params["id"]);
    const vaccinationId = String(req.params["vaccinationId"]);
    const { rows } = await pool.query(
      `UPDATE patient_vaccinations SET deleted_at = now()
        WHERE patient_id = $1 AND id = $2 AND deleted_at IS NULL
        RETURNING id, vaccine`,
      [patientId, vaccinationId],
    );
    if (rows.length === 0) { res.status(404).json({ message: "Vaccination introuvable" }); return; }
    await auditService.log({
      module: "system", action: "delete", resourceType: "PatientVaccination",
      resourceId: vaccinationId, patientId, oldValue: { vaccine: rows[0]["vaccine"] },
    }, actor(req));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /patients/:id/consents — staff view of this patient's portal consents
router.get("/:id/consents", requirePermission("patients.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const patientId = String(req.params["id"]);
    const { rows } = await pool.query(
      `SELECT id, title, description, status, signed_at, refused_at,
              refusal_reason, document_url, expires_at, created_at
         FROM patient_portal_consents
        WHERE patient_id = $1
        ORDER BY created_at DESC`,
      [patientId],
    );
    res.json(rows.map(r => ({
      id:            r["id"],
      title:         r["title"],
      description:   r["description"],
      status:        r["status"],
      signedAt:      r["signed_at"],
      refusedAt:     r["refused_at"],
      refusalReason: r["refusal_reason"],
      hasPdf:        !!r["document_url"],
      expiresAt:     r["expires_at"],
      createdAt:     r["created_at"],
    })));
  } catch (err) { next(err); }
});

// GET /patients/:id/audit — real audit trail for this patient's record
router.get("/:id/audit", requirePermission("patients.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const patientId = String(req.params["id"]);
    const { rows } = await pool.query(
      `SELECT a.id, a."timestamp", a.module, a.action, a.old_value, a.new_value,
              a.user_id, a.user_name, a.user_role, a.resource_id, a.resource_type,
              a.ip, a.severity, u.first_name, u.last_name
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.user_id
        WHERE a.patient_id = $1
        ORDER BY a."timestamp" DESC
        LIMIT 500`,
      [patientId],
    );
    res.json(rows.map(r => {
      const resolved = [r["first_name"], r["last_name"]].filter(Boolean).join(" ").trim();
      return {
        id:           r["id"],
        timestamp:    r["timestamp"],
        module:       r["module"],
        action:       r["action"],
        oldValue:     r["old_value"],
        newValue:     r["new_value"],
        userId:       r["user_id"],
        userName:     resolved || r["user_name"],
        userRole:     r["user_role"],
        resourceId:   r["resource_id"],
        resourceType: r["resource_type"],
        ip:           r["ip"],
        severity:     r["severity"],
      };
    }));
  } catch (err) { next(err); }
});

// GET /patients/:id/timeline — aggregated event history for ONE patient.
// Every sub-query filters WHERE patient_id = $1; no cross-patient data.
router.get("/:id/timeline", requirePermission("patients.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const patientId = String(req.params["id"]);
    const q = (sql: string) => pool.query(sql, [patientId]).then(r => r.rows);

    const [
      patientRows, creatorRows, consultations, admissions, emergencies,
      labs, imaging, rxs, appts, docs, invs, pays, vaccs,
    ] = await Promise.all([
      q(`SELECT id, created_at FROM patients WHERE id = $1 AND deleted_at IS NULL`),
      q(`SELECT COALESCE(
                  NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''),
                  a.user_name
                ) AS user_name
           FROM audit_logs a
           LEFT JOIN users u ON u.id = a.user_id
          WHERE a.patient_id = $1 AND a.action IN ('create','created') AND a.resource_type ILIKE 'patient'
          ORDER BY a."timestamp" ASC LIMIT 1`),
      q(`SELECT id, number, reason, diagnosis, scheduled_at, created_at, doctor_name, service_name
           FROM consultations WHERE patient_id = $1 AND deleted_at IS NULL
          ORDER BY scheduled_at DESC NULLS LAST LIMIT 100`),
      q(`SELECT id, admission_number, type, motif, admission_date, actual_discharge_date,
                discharge_type, doctor_name, service_name, created_at
           FROM admissions WHERE patient_id = $1 AND deleted_at IS NULL
          ORDER BY created_at DESC LIMIT 100`),
      q(`SELECT id, chief_complaint, arrival_time, assigned_doctor_name, created_at
           FROM emergency_visits WHERE patient_id = $1 AND deleted_at IS NULL
          ORDER BY arrival_time DESC NULLS LAST LIMIT 100`),
      q(`SELECT id, test, status, requested_at, requested_by_name, result_at, is_critical, created_at
           FROM lab_orders WHERE patient_id = $1 AND deleted_at IS NULL
          ORDER BY requested_at DESC NULLS LAST LIMIT 150`),
      q(`SELECT id, exam, region, requested_at, requested_by_name, created_at
           FROM imaging_orders WHERE patient_id = $1 AND deleted_at IS NULL
          ORDER BY requested_at DESC NULLS LAST LIMIT 100`),
      q(`SELECT id, drug, dosage, frequency, prescribed_at, prescribed_by_name, created_at
           FROM prescriptions WHERE patient_id = $1 AND deleted_at IS NULL
          ORDER BY prescribed_at DESC NULLS LAST LIMIT 150`),
      q(`SELECT id, scheduled_at, status, type, doctor_name, department_name, created_at
           FROM appointments WHERE patient_id = $1 AND deleted_at IS NULL
          ORDER BY scheduled_at DESC NULLS LAST LIMIT 100`),
      q(`SELECT id, title, category, created_at
           FROM document_records WHERE patient_id = $1 AND deleted_at IS NULL
          ORDER BY created_at DESC LIMIT 100`),
      q(`SELECT id, invoice_number, status, total_amount, currency, invoice_date, created_at
           FROM invoices WHERE patient_id = $1 AND deleted_at IS NULL
          ORDER BY created_at DESC LIMIT 100`),
      q(`SELECT id, payment_number, amount, method, paid_at, created_at
           FROM payments WHERE patient_id = $1
          ORDER BY created_at DESC LIMIT 100`),
      q(`SELECT id, vaccine, dose_label, status, date_given, created_at
           FROM patient_vaccinations WHERE patient_id = $1 AND deleted_at IS NULL
          ORDER BY created_at DESC LIMIT 100`),
    ]);

    if (patientRows.length === 0) { res.status(404).json({ message: "Patient not found" }); return; }

    interface Ev {
      id: string; patientId: string; type: string; title: string; description?: string;
      createdAt: string; userId: string; userName: string; siteId: string; siteName: string;
      doctor?: string; service?: string;
    }
    const events: Ev[] = [];
    const iso = (v: unknown): string | null => (v ? new Date(v as string).toISOString() : null);
    const amount = (v: unknown): string =>
      v == null ? "" : `${Number(v).toLocaleString("fr-FR")} DZD`;
    const base = { patientId, userId: "", userName: "—", siteId: "", siteName: "" };

    const patientCreatedAt = iso(patientRows[0]["created_at"]);
    if (patientCreatedAt) {
      events.push({
        ...base, id: `creation-${patientId}`, type: "creation",
        title: "Création du dossier patient",
        userName: (creatorRows[0]?.["user_name"] as string) ?? "—",
        createdAt: patientCreatedAt,
      });
    }
    for (const c of consultations) {
      const at = iso(c["scheduled_at"]) ?? iso(c["created_at"]); if (!at) continue;
      events.push({
        ...base, id: `consultation-${c["id"]}`, type: "consultation",
        title: `Consultation ${c["number"] ?? ""}`.trim(),
        description: (c["reason"] as string) ?? (c["diagnosis"] as string) ?? undefined,
        doctor: (c["doctor_name"] as string) ?? undefined,
        service: (c["service_name"] as string) ?? undefined,
        createdAt: at,
      });
    }
    for (const a of admissions) {
      const at = iso(a["admission_date"]) ?? iso(a["created_at"]); if (!at) continue;
      const isHosp = a["type"] === "hospitalisation";
      events.push({
        ...base, id: `admission-${a["id"]}`, type: isHosp ? "hospitalization" : "admission",
        title: `Admission ${a["admission_number"] ?? ""}`.trim(),
        description: (a["motif"] as string) ?? undefined,
        doctor: (a["doctor_name"] as string) ?? undefined,
        service: (a["service_name"] as string) ?? undefined,
        createdAt: at,
      });
      const out = iso(a["actual_discharge_date"]);
      if (out) {
        events.push({
          ...base, id: `discharge-${a["id"]}`, type: "discharge",
          title: "Sortie",
          description: a["discharge_type"] ? `Type : ${a["discharge_type"]}` : undefined,
          service: (a["service_name"] as string) ?? undefined,
          createdAt: out,
        });
      }
    }
    for (const e of emergencies) {
      const at = iso(e["arrival_time"]) ?? iso(e["created_at"]); if (!at) continue;
      events.push({
        ...base, id: `emergency-${e["id"]}`, type: "emergency",
        title: "Passage aux urgences",
        description: (e["chief_complaint"] as string) ?? undefined,
        doctor: (e["assigned_doctor_name"] as string) ?? undefined,
        service: "Urgences", createdAt: at,
      });
    }
    for (const l of labs) {
      const at = iso(l["requested_at"]) ?? iso(l["created_at"]); if (!at) continue;
      events.push({
        ...base, id: `lab-${l["id"]}`, type: "laboratory",
        title: `Analyse — ${l["test"]}`,
        description: l["status"] ? `Statut : ${l["status"]}` : undefined,
        doctor: (l["requested_by_name"] as string) ?? undefined,
        service: "Laboratoire", createdAt: at,
      });
      const resultAt = iso(l["result_at"]);
      if (resultAt) {
        events.push({
          ...base, id: `lab-result-${l["id"]}`, type: "result",
          title: `Résultat — ${l["test"]}`,
          description: l["is_critical"] ? "Résultat critique" : undefined,
          service: "Laboratoire", createdAt: resultAt,
        });
      }
    }
    for (const im of imaging) {
      const at = iso(im["requested_at"]) ?? iso(im["created_at"]); if (!at) continue;
      const region = im["region"] ? ` (${im["region"]})` : "";
      events.push({
        ...base, id: `imaging-${im["id"]}`, type: "imaging",
        title: `Imagerie — ${im["exam"]}${region}`,
        doctor: (im["requested_by_name"] as string) ?? undefined,
        service: "Imagerie", createdAt: at,
      });
    }
    for (const rx of rxs) {
      const at = iso(rx["prescribed_at"]) ?? iso(rx["created_at"]); if (!at) continue;
      const dosage = [rx["dosage"], rx["frequency"]].filter(Boolean).join(" · ");
      events.push({
        ...base, id: `prescription-${rx["id"]}`, type: "prescription",
        title: `Prescription — ${rx["drug"]}`,
        description: dosage || undefined,
        doctor: (rx["prescribed_by_name"] as string) ?? undefined,
        createdAt: at,
      });
    }
    for (const ap of appts) {
      const at = iso(ap["scheduled_at"]) ?? iso(ap["created_at"]); if (!at) continue;
      events.push({
        ...base, id: `appointment-${ap["id"]}`, type: "appointment",
        title: `Rendez-vous${ap["doctor_name"] ? ` — ${ap["doctor_name"]}` : ""}`,
        description: [ap["type"], ap["status"]].filter(Boolean).join(" · ") || undefined,
        doctor: (ap["doctor_name"] as string) ?? undefined,
        service: (ap["department_name"] as string) ?? undefined,
        createdAt: at,
      });
    }
    for (const d of docs) {
      const at = iso(d["created_at"]); if (!at) continue;
      events.push({
        ...base, id: `document-${d["id"]}`, type: "document",
        title: `Document — ${d["title"]}`,
        service: (d["category"] as string) ?? undefined,
        createdAt: at,
      });
    }
    for (const inv of invs) {
      const at = iso(inv["invoice_date"]) ?? iso(inv["created_at"]); if (!at) continue;
      events.push({
        ...base, id: `invoice-${inv["id"]}`, type: "invoice",
        title: `Facture ${inv["invoice_number"] ?? ""}`.trim(),
        description: [amount(inv["total_amount"]), inv["status"]].filter(Boolean).join(" — ") || undefined,
        createdAt: at,
      });
    }
    for (const p of pays) {
      const at = iso(p["paid_at"]) ?? iso(p["created_at"]); if (!at) continue;
      events.push({
        ...base, id: `payment-${p["id"]}`, type: "payment",
        title: `Paiement ${p["payment_number"] ?? ""}`.trim(),
        description: [amount(p["amount"]), p["method"]].filter(Boolean).join(" · ") || undefined,
        createdAt: at,
      });
    }
    for (const v of vaccs) {
      const at = iso(v["date_given"]) ?? iso(v["created_at"]); if (!at) continue;
      events.push({
        ...base, id: `vaccination-${v["id"]}`, type: "vaccination",
        title: `Vaccin — ${v["vaccine"]}`,
        description: [v["dose_label"], v["status"]].filter(Boolean).join(" · ") || undefined,
        createdAt: at,
      });
    }

    events.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json(events.slice(0, 300));
  } catch (err) { next(err); }
});

export default router;
