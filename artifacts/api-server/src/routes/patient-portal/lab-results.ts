/**
 * Patient Portal — Lab Results (published only)
 * GET /patient-portal/lab-results
 * GET /patient-portal/lab-results/:id
 */
import { Router } from "express";
import type { Response } from "express";
import { pool } from "@workspace/db";
import { requirePatientAuth, type PatientRequest } from "../../middleware/requirePatientAuth.js";

const router = Router();

async function auditLog(accountId: string, patientId: string, action: string, resId: string, ip: string | undefined) {
  try {
    await pool.query(
      `INSERT INTO patient_portal_access_logs (account_id,patient_id,action,resource,resource_id,ip)
       VALUES ($1,$2,$3,'lab_result',$4::uuid,$5)`,
      [accountId, patientId, action, resId, ip ?? null],
    );
  } catch { /* non-blocking */ }
}

router.get("/", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { patientId } = req.patient!;
  try {
    const { rows } = await pool.query(
      `SELECT id, test, category, result, result_at, validated_by_name AS medecin,
              laboratory, published_at, patient_visible_note, is_critical
       FROM lab_orders
       WHERE patient_id=$1
         AND published_to_patient=TRUE
         AND status IN ('validee','resultat_disponible')
         AND deleted_at IS NULL
       ORDER BY published_at DESC`,
      [patientId],
    );
    res.json({ results: rows });
  } catch (err) {
    console.error("[portal/lab-results]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

router.get("/:id", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { patientId, accountId } = req.patient!;
  try {
    const { rows } = await pool.query(
      `SELECT id, test, category, result, result_at, validated_by_name AS medecin,
              laboratory, requested_by_name AS prescripteur, published_at,
              patient_visible_note, is_critical, urgency
       FROM lab_orders
       WHERE id=$1 AND patient_id=$2
         AND published_to_patient=TRUE
         AND status IN ('validee','resultat_disponible')
         AND deleted_at IS NULL`,
      [req.params.id, patientId],
    );
    if (!rows[0]) {
      res.status(404).json({ message: "Résultat introuvable." });
      return;
    }
    await auditLog(accountId, patientId, "view_lab_result", req.params.id, req.ip);
    res.json({ result: rows[0] });
  } catch (err) {
    console.error("[portal/lab-results/:id]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// Staff: POST /publish/:id  – requires staff permission (called from main ERP)
router.post("/:id/publish", async (req, res) => {
  // This endpoint is for staff — but since it needs staff auth, it's better placed
  // in the main ERP routes. Here we just return 404 to avoid confusion.
  res.status(404).json({ message: "Utilisez l'API staff pour publier les résultats." });
});

export default router;
