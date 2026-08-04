/**
 * Patient Portal — Appointments
 * GET  /patient-portal/appointments          – list (upcoming/past/cancelled/pending)
 * GET  /patient-portal/appointments/:id      – detail
 * POST /patient-portal/appointments/:id/cancel – cancel appointment
 */
import { Router } from "express";
import type { Response } from "express";
import { pool } from "@workspace/db";
import { requirePatientAuth, type PatientRequest } from "../../middleware/requirePatientAuth.js";

const router = Router();

async function auditLog(accountId: string, patientId: string, action: string, resId: string | null, ip: string | undefined) {
  try {
    await pool.query(
      `INSERT INTO patient_portal_access_logs (account_id,patient_id,action,resource,resource_id,ip)
       VALUES ($1,$2,$3,'appointment',$4::uuid,$5)`,
      [accountId, patientId, action, resId, ip ?? null],
    );
  } catch { /* non-blocking */ }
}

// GET /appointments
router.get("/", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { patientId } = req.patient!;
  const { filter = "upcoming" } = req.query as { filter?: string };

  let whereExtra = "";
  if (filter === "upcoming")   whereExtra = "AND a.scheduled_at >= now() AND a.status NOT IN ('cancelled','no_show')";
  if (filter === "past")       whereExtra = "AND a.scheduled_at < now() AND a.status NOT IN ('cancelled')";
  if (filter === "cancelled")  whereExtra = "AND a.status = 'cancelled'";
  if (filter === "pending")    whereExtra = "AND a.status = 'pending'";

  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.scheduled_at, a.department_name AS service,
              a.doctor_name AS medecin, a.status, a.type, a.notes,
              a.cancelled_reason, a.duration
       FROM appointments a
       WHERE a.patient_id=$1
         AND a.deleted_at IS NULL
         ${whereExtra}
       ORDER BY a.scheduled_at DESC
       LIMIT 100`,
      [patientId],
    );
    res.json({ appointments: rows });
  } catch (err) {
    console.error("[portal/appointments]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// GET /appointments/:id
router.get("/:id", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { patientId, accountId } = req.patient!;
  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.scheduled_at, a.department_name AS service,
              a.doctor_name AS medecin, a.status, a.type, a.notes,
              a.cancelled_reason, a.duration
       FROM appointments a
       WHERE a.id=$1 AND a.patient_id=$2 AND a.deleted_at IS NULL`,
      [req.params.id, patientId],
    );
    if (!rows[0]) {
      res.status(404).json({ message: "Rendez-vous introuvable." });
      return;
    }
    await auditLog(accountId, patientId, "view_appointment", req.params.id, req.ip);
    res.json({ appointment: rows[0] });
  } catch (err) {
    console.error("[portal/appointments/:id]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// POST /appointments/:id/cancel
router.post("/:id/cancel", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { patientId, accountId } = req.patient!;
  const { reason } = req.body ?? {};
  try {
    const { rows } = await pool.query(
      `SELECT id, scheduled_at, status FROM appointments
       WHERE id=$1 AND patient_id=$2 AND deleted_at IS NULL`,
      [req.params.id, patientId],
    );
    if (!rows[0]) {
      res.status(404).json({ message: "Rendez-vous introuvable." });
      return;
    }
    const appt = rows[0];
    if (!["pending","confirmed"].includes(appt.status)) {
      res.status(400).json({ message: "Ce rendez-vous ne peut pas être annulé." });
      return;
    }
    // Only allow cancellation > 2 hours before
    const hoursUntil = (new Date(appt.scheduled_at).getTime() - Date.now()) / 3600000;
    if (hoursUntil < 2) {
      res.status(400).json({ message: "Annulation impossible moins de 2h avant le rendez-vous." });
      return;
    }
    await pool.query(
      `UPDATE appointments SET status='cancelled', cancelled_reason=$1, updated_at=now() WHERE id=$2`,
      [reason ?? "Annulé par le patient", req.params.id],
    );
    await auditLog(accountId, patientId, "cancel_appointment", req.params.id, req.ip);
    res.json({ message: "Rendez-vous annulé." });
  } catch (err) {
    console.error("[portal/appointments/:id/cancel]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

export default router;
