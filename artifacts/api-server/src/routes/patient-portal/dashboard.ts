/**
 * Patient Portal — Dashboard
 * GET /patient-portal/dashboard
 *
 * Contrat frontend (DashboardData dans patient-portal/src/lib/types.ts) :
 * réponse camelCase, clés { nextAppointment, lastLabResult, lastImaging,
 * lastPrescription, balance, insurance, unreadNotifications }.
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
      nextApptRes,
      lastLabRes,
      lastImagingRes,
      lastRxRes,
      balanceRes,
      insuranceRes,
      unreadRes,
    ] = await Promise.all([
      // Next upcoming appointment
      pool.query(
        `SELECT id, scheduled_at AS "scheduledAt", doctor_name AS "doctorName",
                department_name AS "departmentName", status
         FROM appointments
         WHERE patient_id=$1 AND scheduled_at > now()
           AND status IN ('pending','confirmed')
           AND deleted_at IS NULL
         ORDER BY scheduled_at ASC LIMIT 1`,
        [patientId],
      ),
      // Last published lab result
      pool.query(
        `SELECT id, id AS "orderNumber", published_at AS "publishedAt",
                test AS "testType", status
         FROM lab_orders
         WHERE patient_id=$1 AND published_to_patient=TRUE AND deleted_at IS NULL
         ORDER BY published_at DESC LIMIT 1`,
        [patientId],
      ),
      // Last published imaging report
      pool.query(
        `SELECT id, id AS "orderNumber", published_at AS "publishedAt",
                exam AS "studyType", status
         FROM imaging_orders
         WHERE patient_id=$1 AND published_to_patient=TRUE AND deleted_at IS NULL
         ORDER BY published_at DESC LIMIT 1`,
        [patientId],
      ),
      // Last published prescription.
      // NB schéma réel : la table est UNE LIGNE PAR MÉDICAMENT (colonne `drug`),
      // le prescripteur est `prescribed_by_name` — il n'existe NI `doctor_name`
      // NI `items` (cause du 500 précédent).
      pool.query(
        `SELECT id, drug, prescribed_at AS "prescribedAt", published_at AS "publishedAt"
         FROM prescriptions
         WHERE patient_id=$1 AND published_to_patient=TRUE AND deleted_at IS NULL
         ORDER BY published_at DESC LIMIT 1`,
        [patientId],
      ),
      // Financial balance
      pool.query(
        `SELECT
           COALESCE(SUM(total_amount),0)::text  AS total,
           COALESCE(SUM(patient_share),0)::text AS "patientTotal",
           COALESCE(SUM(paid_amount),0)::text   AS paid,
           COALESCE(SUM(due_amount),0)::text    AS balance
         FROM invoices
         WHERE patient_id=$1 AND deleted_at IS NULL`,
        [patientId],
      ),
      // Active insurance
      pool.query(
        `SELECT insurer_name AS "insurerName", coverage_percent AS "coveragePercent",
                valid_until AS "expiryDate", is_active AS active
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
      nextAppointment:  nextApptRes.rows[0] ?? null,
      lastLabResult:    lastLabRes.rows[0] ?? null,
      lastImaging:      lastImagingRes.rows[0] ?? null,
      lastPrescription: lastRxRes.rows[0] ?? null,
      balance:          balanceRes.rows[0] ?? { total: "0", patientTotal: "0", paid: "0", balance: "0" },
      insurance:        insuranceRes.rows[0] ?? null,
      unreadNotifications: unreadRes.rows[0]?.count ?? 0,
    });
  } catch (err) {
    console.error("[portal/dashboard]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

export default router;
