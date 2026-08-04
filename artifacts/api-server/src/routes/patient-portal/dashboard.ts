/**
 * Patient Portal — Dashboard
 * GET /patient-portal/dashboard
 */
import { Router } from "express";
import type { Response } from "express";
import { pool } from "@workspace/db";
import { requirePatientAuth, type PatientRequest } from "../../middleware/requirePatientAuth.js";

const router = Router();

router.get("/", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { patientId } = req.patient!;

  try {
    const [
      patientRes,
      nextApptRes,
      lastLabRes,
      lastImagingRes,
      lastRxRes,
      balanceRes,
      insuranceRes,
      unreadRes,
    ] = await Promise.all([
      // Patient name
      pool.query(
        `SELECT first_name, last_name, mpi_id FROM patients WHERE id=$1`,
        [patientId],
      ),
      // Next upcoming appointment
      pool.query(
        `SELECT id, scheduled_at, department_name, doctor_name, status, notes
         FROM appointments
         WHERE patient_id=$1 AND scheduled_at > now()
           AND status IN ('pending','confirmed')
           AND deleted_at IS NULL
         ORDER BY scheduled_at ASC LIMIT 1`,
        [patientId],
      ),
      // Last published lab result
      pool.query(
        `SELECT id, test, category, result, result_at, validated_by_name, laboratory, patient_visible_note
         FROM lab_orders
         WHERE patient_id=$1 AND published_to_patient=TRUE AND deleted_at IS NULL
         ORDER BY published_at DESC LIMIT 1`,
        [patientId],
      ),
      // Last published imaging report
      pool.query(
        `SELECT id, exam, region, report, reported_by_name, reported_at, patient_visible_note
         FROM imaging_orders
         WHERE patient_id=$1 AND published_to_patient=TRUE AND deleted_at IS NULL
         ORDER BY published_at DESC LIMIT 1`,
        [patientId],
      ),
      // Last prescription
      pool.query(
        `SELECT id, created_at, doctor_name, items
         FROM prescriptions
         WHERE patient_id=$1 AND published_to_patient=TRUE AND deleted_at IS NULL
         ORDER BY created_at DESC LIMIT 1`,
        [patientId],
      ),
      // Financial balance
      pool.query(
        `SELECT
           COALESCE(SUM(total_amount),0)    AS total,
           COALESCE(SUM(patient_share),0)   AS patient_total,
           COALESCE(SUM(paid_amount),0)     AS paid,
           COALESCE(SUM(due_amount),0)      AS balance
         FROM invoices
         WHERE patient_id=$1 AND deleted_at IS NULL`,
        [patientId],
      ),
      // Active insurance
      pool.query(
        `SELECT insurer_name, coverage_percent, valid_until AS expiry_date, is_active AS active
         FROM insurance_policies
         WHERE patient_id=$1 AND is_active=TRUE
         ORDER BY created_at DESC LIMIT 1`,
        [patientId],
      ),
      // Unread notifications count
      pool.query(
        `SELECT count(*)::int AS count
         FROM patient_portal_notifications n
         JOIN patient_portal_accounts a ON a.id=n.account_id
         WHERE a.patient_id=$1 AND n.read=FALSE`,
        [patientId],
      ),
    ]);

    res.json({
      patient:      patientRes.rows[0] ?? null,
      nextAppointment: nextApptRes.rows[0] ?? null,
      lastLabResult:   lastLabRes.rows[0] ?? null,
      lastImaging:     lastImagingRes.rows[0] ?? null,
      lastPrescription: lastRxRes.rows[0] ?? null,
      balance:         balanceRes.rows[0] ?? { total: 0, patient_total: 0, paid: 0, balance: 0 },
      insurance:       insuranceRes.rows[0] ?? null,
      unreadNotifications: unreadRes.rows[0]?.count ?? 0,
    });
  } catch (err) {
    console.error("[portal/dashboard]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

export default router;
