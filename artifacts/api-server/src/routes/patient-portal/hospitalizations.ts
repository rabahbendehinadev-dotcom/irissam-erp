/**
 * Patient Portal — Hospitalizations
 * GET /patient-portal/hospitalizations
 * GET /patient-portal/hospitalizations/:id
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
      `SELECT a.id, a.admission_number, a.created_at AS admission_date,
              a.actual_discharge_date AS discharge_date,
              a.service_name AS ward_name, a.room_number, a.bed_number,
              a.status, a.doctor_name AS medecin,
              a.discharge_notes AS discharge_instructions, a.motif
       FROM admissions a
       WHERE a.patient_id=$1
       ORDER BY a.created_at DESC`,
      [patientId],
    );
    res.json({ hospitalizations: rows });
  } catch (err) {
    console.error("[portal/hospitalizations]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

router.get("/:id", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { patientId } = req.patient!;
  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.admission_number, a.created_at AS admission_date,
              a.actual_discharge_date AS discharge_date,
              a.service_name AS ward_name, a.room_number, a.bed_number,
              a.status, a.doctor_name AS medecin,
              a.discharge_notes AS discharge_instructions, a.motif, a.diagnosis
       FROM admissions a
       WHERE a.id=$1 AND a.patient_id=$2`,
      [req.params.id, patientId],
    );
    if (!rows[0]) {
      res.status(404).json({ message: "Hospitalisation introuvable." });
      return;
    }
    res.json({ hospitalization: rows[0] });
  } catch (err) {
    console.error("[portal/hospitalizations/:id]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

export default router;
