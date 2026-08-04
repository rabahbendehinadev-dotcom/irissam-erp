/**
 * GET /api/doctor-portal/dashboard
 * KPI cards + widget data scoped to the requesting doctor.
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission.js";
import type { AuthenticatedRequest } from "../../middleware/requireAuth.js";

const router = Router();

router.get("/", requirePermission("doctor_portal.dashboard.view"), async (req, res) => {
  const doctorId = (req as AuthenticatedRequest).auth!.userId;
  const today    = new Date().toISOString().slice(0, 10);

  try {
    const [
      appointmentsToday,
      pendingPatients,
      completedConsultations,
      labResultsToReview,
      criticalResults,
      hospitalizedCount,
      emergenciesAssigned,
      prescriptionsToday,
      overdueTasks,
      unreadMessages,
    ] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) FROM appointments
         WHERE doctor_id=$1 AND DATE(scheduled_at)=$2 AND deleted_at IS NULL`,
        [doctorId, today]
      ),
      pool.query(
        `SELECT COUNT(*) FROM appointments
         WHERE doctor_id=$1 AND DATE(scheduled_at)=$2
           AND status IN ('pending','confirmed') AND deleted_at IS NULL`,
        [doctorId, today]
      ),
      pool.query(
        `SELECT COUNT(*) FROM consultations
         WHERE doctor_id=$1 AND DATE(created_at)=$2 AND status='terminee'`,
        [doctorId, today]
      ),
      pool.query(
        `SELECT COUNT(*) FROM lab_orders
         WHERE requested_by_id=$1 AND status IN ('validee','critique')
           AND acknowledged_at IS NULL`,
        [doctorId]
      ),
      pool.query(
        `SELECT COUNT(*) FROM lab_orders
         WHERE requested_by_id=$1 AND is_critical=true AND acknowledged_at IS NULL`,
        [doctorId]
      ),
      pool.query(
        `SELECT COUNT(*) FROM admissions
         WHERE doctor_id=$1 AND status='active'`,
        [doctorId]
      ),
      pool.query(
        `SELECT COUNT(*) FROM emergency_visits
         WHERE assigned_doctor_id=$1
           AND status NOT IN ('sorti','transfere','hospitalise','decede')`,
        [doctorId]
      ),
      pool.query(
        `SELECT COUNT(*) FROM prescriptions
         WHERE prescribed_by_id=$1 AND DATE(prescribed_at)=$2`,
        [doctorId, today]
      ),
      pool.query(
        `SELECT COUNT(*) FROM clinical_tasks
         WHERE assigned_to=$1 AND status IN ('open','in_progress') AND due_at < now()`,
        [doctorId]
      ),
      pool.query(
        `SELECT COUNT(*) FROM doctor_messages WHERE recipient_id=$1 AND is_read=false`,
        [doctorId]
      ),
    ]);

    const nextPatient = await pool.query(
      `SELECT a.id, a.patient_name, a.patient_id, a.scheduled_at, a.notes AS motif, a.status,
              p.mrn, p.date_of_birth, p.gender
       FROM appointments a
       LEFT JOIN patients p ON p.id = a.patient_id
       WHERE a.doctor_id=$1 AND DATE(a.scheduled_at)=$2
         AND a.status IN ('pending','confirmed') AND a.deleted_at IS NULL
       ORDER BY a.scheduled_at ASC LIMIT 1`,
      [doctorId, today]
    );

    const criticalLabs = await pool.query(
      `SELECT lo.id, lo.test, lo.patient_id,
              p.first_name||' '||p.last_name AS patient_name, p.mrn,
              lo.result, lo.result_at, lo.is_critical
       FROM lab_orders lo
       JOIN patients p ON p.id = lo.patient_id
       WHERE lo.requested_by_id=$1 AND lo.is_critical=true AND lo.acknowledged_at IS NULL
       ORDER BY lo.result_at DESC LIMIT 5`,
      [doctorId]
    );

    res.json({
      kpis: {
        appointmentsToday:      Number(appointmentsToday.rows[0].count),
        pendingPatients:        Number(pendingPatients.rows[0].count),
        completedConsultations: Number(completedConsultations.rows[0].count),
        labResultsToReview:     Number(labResultsToReview.rows[0].count),
        criticalResults:        Number(criticalResults.rows[0].count),
        hospitalizedCount:      Number(hospitalizedCount.rows[0].count),
        emergenciesAssigned:    Number(emergenciesAssigned.rows[0].count),
        prescriptionsToday:     Number(prescriptionsToday.rows[0].count),
        overdueTasks:           Number(overdueTasks.rows[0].count),
        unreadMessages:         Number(unreadMessages.rows[0].count),
      },
      nextPatient:  nextPatient.rows[0] ?? null,
      criticalLabs: criticalLabs.rows,
    });
  } catch (err) {
    console.error("[doctor-portal/dashboard]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

export default router;
