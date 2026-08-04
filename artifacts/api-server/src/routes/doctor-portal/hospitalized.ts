/**
 * Doctor Portal — Hospitalized patients (scoped to requesting doctor)
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission.js";
import type { AuthenticatedRequest } from "../../middleware/requireAuth.js";

const router = Router();

router.get("/", requirePermission("doctor_portal.hospitalized.view"), async (req, res) => {
  const doctorId = (req as AuthenticatedRequest).auth!.userId;
  try {
    const result = await pool.query(
      `SELECT adm.id, adm.admission_number, adm.patient_id, adm.patient_name,
              adm.service_name, adm.bed_number, adm.room_number, adm.floor_label,
              adm.motif, adm.diagnosis, adm.admission_date, adm.admission_time,
              adm.expected_discharge_date, adm.status, adm.encounter_id,
              p.mrn, p.date_of_birth, p.gender, p.blood_type,
              p.allergies, p.chronic_diseases,
              (CURRENT_DATE - adm.admission_date::date) AS hospitalization_days,
              (SELECT json_agg(lo ORDER BY lo.result_at DESC)
               FROM (SELECT id, test, result, is_critical, result_at
                     FROM lab_orders
                     WHERE patient_id=p.id AND status IN ('validee','critique')
                     ORDER BY result_at DESC LIMIT 3) lo) AS recent_labs,
              (SELECT json_agg(rx ORDER BY rx.prescribed_at DESC)
               FROM (SELECT id, drug, dosage, frequency, status
                     FROM prescriptions
                     WHERE patient_id=p.id AND status='prescrit' AND deleted_at IS NULL
                     LIMIT 5) rx) AS active_prescriptions
       FROM admissions adm
       JOIN patients p ON p.id = adm.patient_id
       WHERE adm.doctor_id=$1 AND adm.status='active'
       ORDER BY adm.admission_date DESC, adm.admission_time DESC`,
      [doctorId]
    );
    res.json({ admissions: result.rows });
  } catch (err) {
    console.error("[dp/hospitalized]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

export default router;
