/**
 * Patient Portal — Invoices & Payments
 * GET /patient-portal/invoices
 * GET /patient-portal/invoices/:id
 * GET /patient-portal/payments
 */
import { Router } from "express";
import type { Response } from "express";
import { pool } from "@workspace/db";
import { requirePatientAuth, type PatientRequest } from "../../middleware/requirePatientAuth.js";

const router = Router();

async function auditLog(accountId: string, patientId: string, resId: string, ip: string | undefined) {
  try {
    await pool.query(
      `INSERT INTO patient_portal_access_logs (account_id,patient_id,action,resource,resource_id,ip)
       VALUES ($1,$2,'view_invoice','invoice',$3::uuid,$4)`,
      [accountId, patientId, resId, ip ?? null],
    );
  } catch { /* non-blocking */ }
}

router.get("/", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { patientId } = req.patient!;
  try {
    const { rows } = await pool.query(
      `SELECT id, invoice_number, invoice_date AS date, total_amount AS total,
              ROUND((total_amount * COALESCE(insurance_coverage_percent,0) / 100.0)::numeric,2) AS insurance_share,
              patient_share, paid_amount, status, due_amount AS balance_due
       FROM invoices
       WHERE patient_id=$1 AND deleted_at IS NULL
       ORDER BY invoice_date DESC`,
      [patientId],
    );
    res.json({ invoices: rows });
  } catch (err) {
    console.error("[portal/invoices]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

router.get("/:id", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { patientId, accountId } = req.patient!;
  try {
    const { rows } = await pool.query(
      `SELECT i.id, i.invoice_number, i.invoice_date AS date,
              i.total_amount AS total, i.patient_share, i.paid_amount,
              i.due_amount AS balance_due, i.status, i.notes,
              ROUND((i.total_amount * COALESCE(i.insurance_coverage_percent,0) / 100.0)::numeric,2) AS insurance_share
       FROM invoices i
       WHERE i.id=$1 AND i.patient_id=$2 AND i.deleted_at IS NULL`,
      [req.params.id, patientId],
    );
    if (!rows[0]) {
      res.status(404).json({ message: "Facture introuvable." });
      return;
    }
    await auditLog(accountId, patientId, req.params.id, req.ip);
    res.json({ invoice: rows[0] });
  } catch (err) {
    console.error("[portal/invoices/:id]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

export default router;
