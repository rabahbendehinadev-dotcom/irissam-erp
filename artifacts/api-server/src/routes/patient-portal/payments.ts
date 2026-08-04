/**
 * Patient Portal — Payments
 * GET /patient-portal/payments
 * GET /patient-portal/payments/:id
 */
import { Router } from "express";
import type { Response } from "express";
import { pool } from "@workspace/db";
import { requirePatientAuth, type PatientRequest } from "../../middleware/requirePatientAuth.js";

const router = Router();

router.get("/", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { patientId } = req.patient!;
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.invoice_id, i.invoice_number, p.amount, p.paid_at AS payment_date,
              p.method AS payment_method, p.reference, p.status, p.receipt_number
       FROM payments p
       JOIN invoices i ON i.id = p.invoice_id
       WHERE (i.patient_id=$1 OR p.patient_id=$1)
       ORDER BY p.paid_at DESC`,
      [patientId],
    );
    res.json({ payments: rows });
  } catch (err) {
    console.error("[portal/payments]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

router.get("/:id", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { patientId } = req.patient!;
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.invoice_id, i.invoice_number, p.amount, p.paid_at AS payment_date,
              p.method AS payment_method, p.reference, p.status, p.notes, p.receipt_number
       FROM payments p
       JOIN invoices i ON i.id = p.invoice_id
       WHERE p.id=$1 AND (i.patient_id=$2 OR p.patient_id=$2)`,
      [req.params.id, patientId],
    );
    if (!rows[0]) {
      res.status(404).json({ message: "Paiement introuvable." });
      return;
    }
    res.json({ payment: rows[0] });
  } catch (err) {
    console.error("[portal/payments/:id]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// Payment gateway foundation — placeholder
router.post("/gateway/initiate", requirePatientAuth, async (_req, res) => {
  res.status(503).json({
    message: "Paiement en ligne non disponible pour le moment.",
    code: "GATEWAY_NOT_CONFIGURED",
  });
});

export default router;
