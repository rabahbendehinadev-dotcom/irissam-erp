/**
 * Doctor Portal — Patients routes
 *
 * GET  /patients/today        — today's appointment list
 * GET  /patients              — my patients (scoped)
 * GET  /patients/:id          — patient detail (scope check → 403/404 on miss)
 * GET  /patients/:id/summary  — full patient summary
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission.js";
import type { AuthenticatedRequest } from "../../middleware/requireAuth.js";

const router = Router();

/** EXISTS clause: patient is reachable by this doctor */
const SCOPE = (alias = "p") => `(
  EXISTS (SELECT 1 FROM appointments a2
          WHERE a2.patient_id=${alias}.id AND a2.doctor_id=$1 AND a2.deleted_at IS NULL)
  OR EXISTS (SELECT 1 FROM encounters e2
             WHERE e2.patient_id=${alias}.id AND e2.primary_doctor_id=$1 AND e2.deleted_at IS NULL)
  OR EXISTS (SELECT 1 FROM admissions adm2
             WHERE adm2.patient_id=${alias}.id AND adm2.doctor_id=$1)
  OR EXISTS (SELECT 1 FROM emergency_visits ev2
             WHERE ev2.patient_id=${alias}.id AND ev2.assigned_doctor_id=$1)
)`;

// GET /patients/today
router.get("/today", requirePermission("doctor_portal.patients.view"), async (req, res) => {
  const doctorId = (req as AuthenticatedRequest).auth!.userId;
  const today    = new Date().toISOString().slice(0, 10);
  try {
    const result = await pool.query(
      `SELECT a.id AS appointment_id, a.patient_id, a.patient_name,
              a.scheduled_at, a.duration, a.status, a.type,
              a.department_name, a.notes AS motif,
              p.mrn, p.date_of_birth, p.gender, p.phone,
              p.allergies, p.chronic_diseases,
              GREATEST(0, EXTRACT(EPOCH FROM (now() - a.scheduled_at))/60)::int AS wait_minutes,
              (SELECT MAX(c.created_at) FROM consultations c
               WHERE c.patient_id=p.id AND c.doctor_id<>$1) AS last_visit
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       WHERE a.doctor_id=$1 AND DATE(a.scheduled_at)=$2 AND a.deleted_at IS NULL
       ORDER BY a.scheduled_at ASC`,
      [doctorId, today]
    );
    res.json({ patients: result.rows });
  } catch (err) {
    console.error("[dp/patients/today]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// GET /patients
router.get("/", requirePermission("doctor_portal.patients.view"), async (req, res) => {
  const doctorId = (req as AuthenticatedRequest).auth!.userId;
  const { hospitalized, page = "1", limit = "20" } = req.query as Record<string, string>;
  const offset = (Number(page) - 1) * Number(limit);

  const conditions = [SCOPE(), "p.deleted_at IS NULL"];
  const params: unknown[] = [doctorId];

  if (hospitalized === "true") {
    conditions.push(`EXISTS (SELECT 1 FROM admissions a3 WHERE a3.patient_id=p.id AND a3.doctor_id=$1 AND a3.status='active')`);
  }

  const where = conditions.join(" AND ");
  try {
    const countResult = await pool.query(`SELECT COUNT(*) FROM patients p WHERE ${where}`, params);
    const total = Number(countResult.rows[0].count);

    const qParams = [...params, Number(limit), offset];
    const result = await pool.query(
      `SELECT p.id, p.mrn, p.first_name, p.last_name, p.date_of_birth, p.gender,
              p.phone, p.allergies, p.chronic_diseases, p.blood_type, p.created_at
       FROM patients p
       WHERE ${where}
       ORDER BY p.last_name, p.first_name
       LIMIT $${qParams.length - 1} OFFSET $${qParams.length}`,
      qParams
    );
    res.json({ patients: result.rows, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error("[dp/patients]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// GET /patients/:id
router.get("/:id", requirePermission("doctor_portal.patient_detail.view"), async (req, res) => {
  const doctorId  = (req as AuthenticatedRequest).auth!.userId;
  const patientId = req.params.id;
  try {
    const result = await pool.query(
      `SELECT p.* FROM patients p
       WHERE p.id=$2 AND p.deleted_at IS NULL AND ${SCOPE()}`,
      [doctorId, patientId]
    );
    if (!result.rowCount) {
      res.status(403).json({ message: "Accès refusé ou patient introuvable" });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[dp/patients/:id]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// GET /patients/:id/summary
router.get("/:id/summary", requirePermission("doctor_portal.patient_detail.view"), async (req, res) => {
  const doctorId  = (req as AuthenticatedRequest).auth!.userId;
  const patientId = req.params.id;
  try {
    const scopeCheck = await pool.query(
      `SELECT p.id FROM patients p WHERE p.id=$2 AND p.deleted_at IS NULL AND ${SCOPE()}`,
      [doctorId, patientId]
    );
    if (!scopeCheck.rowCount) {
      res.status(403).json({ message: "Accès refusé ou patient introuvable" });
      return;
    }

    const [patient, activeEncounter, activeAdmission, recentConsultations, recentLabs, recentImaging, activePrescriptions] = await Promise.all([
      pool.query(`SELECT * FROM patients WHERE id=$1`, [patientId]),
      pool.query(`SELECT * FROM encounters WHERE patient_id=$1 AND status='open' AND deleted_at IS NULL ORDER BY opened_at DESC LIMIT 1`, [patientId]),
      pool.query(`SELECT * FROM admissions WHERE patient_id=$1 AND status='active' LIMIT 1`, [patientId]),
      pool.query(`SELECT id, created_at, status, reason, diagnosis FROM consultations WHERE patient_id=$1 ORDER BY created_at DESC LIMIT 5`, [patientId]),
      pool.query(`SELECT id, test, status, result_at, result, is_critical FROM lab_orders WHERE patient_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 5`, [patientId]),
      pool.query(`SELECT id, exam, status, reported_at, report FROM imaging_orders WHERE patient_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 5`, [patientId]),
      pool.query(`SELECT id, drug, dosage, frequency, status FROM prescriptions WHERE patient_id=$1 AND status='prescrit' AND deleted_at IS NULL LIMIT 10`, [patientId]),
    ]);

    res.json({
      patient:             patient.rows[0],
      activeEncounter:     activeEncounter.rows[0]     ?? null,
      activeAdmission:     activeAdmission.rows[0]     ?? null,
      recentConsultations: recentConsultations.rows,
      recentLabs:          recentLabs.rows,
      recentImaging:       recentImaging.rows,
      activePrescriptions: activePrescriptions.rows,
    });
  } catch (err) {
    console.error("[dp/patients/:id/summary]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

export default router;
