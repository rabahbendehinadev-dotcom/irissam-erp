/**
 * Patient Portal — Imaging Reports (published only)
 * GET /patient-portal/imaging
 * GET /patient-portal/imaging/:id
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
       VALUES ($1,$2,'view_imaging','imaging_order',$3::uuid,$4)`,
      [accountId, patientId, resId, ip ?? null],
    );
  } catch { /* non-blocking */ }
}

router.get("/", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { patientId } = req.patient!;
  try {
    const { rows } = await pool.query(
      `SELECT id, exam, region, side, report, reported_by_name AS radiologue,
              reported_at, published_at, patient_visible_note, status
       FROM imaging_orders
       WHERE patient_id=$1
         AND published_to_patient=TRUE
         AND report IS NOT NULL
         AND deleted_at IS NULL
       ORDER BY published_at DESC`,
      [patientId],
    );
    res.json({ reports: rows });
  } catch (err) {
    console.error("[portal/imaging]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

router.get("/:id", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { patientId, accountId } = req.patient!;
  try {
    const { rows } = await pool.query(
      `SELECT id, exam, region, side, with_contrast, report, reported_by_name AS radiologue,
              reported_at, interpreted_by_name AS interpreteur, interpreted_at,
              requested_by_name AS prescripteur, published_at, patient_visible_note, status
       FROM imaging_orders
       WHERE id=$1 AND patient_id=$2
         AND published_to_patient=TRUE
         AND deleted_at IS NULL`,
      [req.params.id, patientId],
    );
    if (!rows[0]) {
      res.status(404).json({ message: "Rapport introuvable." });
      return;
    }
    await auditLog(accountId, patientId, req.params.id, req.ip);
    res.json({ report: rows[0] });
  } catch (err) {
    console.error("[portal/imaging/:id]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

export default router;
