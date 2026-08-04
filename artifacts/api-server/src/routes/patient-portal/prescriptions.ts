/**
 * Patient Portal — Prescriptions
 * GET /patient-portal/prescriptions
 * GET /patient-portal/prescriptions/:id
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
       VALUES ($1,$2,'view_prescription','prescription',$3::uuid,$4)`,
      [accountId, patientId, resId, ip ?? null],
    );
  } catch { /* non-blocking */ }
}

router.get("/", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { patientId } = req.patient!;
  try {
    const { rows } = await pool.query(
      `SELECT id, drug, dosage, route, frequency, duration,
              prescribed_by_name AS medecin, prescribed_at AS date,
              status, published_to_patient, published_at
       FROM prescriptions
       WHERE patient_id=$1
         AND published_to_patient=TRUE
         AND deleted_at IS NULL
       ORDER BY prescribed_at DESC`,
      [patientId],
    );
    res.json({ prescriptions: rows });
  } catch (err) {
    console.error("[portal/prescriptions]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

router.get("/:id", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { patientId, accountId } = req.patient!;
  try {
    const { rows } = await pool.query(
      `SELECT id, drug, dosage, route, frequency, duration,
              prescribed_by_name AS medecin, prescribed_at AS date,
              dispenser_comment, status, published_at
       FROM prescriptions
       WHERE id=$1 AND patient_id=$2
         AND published_to_patient=TRUE
         AND deleted_at IS NULL`,
      [req.params.id, patientId],
    );
    if (!rows[0]) {
      res.status(404).json({ message: "Ordonnance introuvable." });
      return;
    }
    await auditLog(accountId, patientId, req.params.id, req.ip);
    res.json({ prescription: rows[0] });
  } catch (err) {
    console.error("[portal/prescriptions/:id]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

export default router;
