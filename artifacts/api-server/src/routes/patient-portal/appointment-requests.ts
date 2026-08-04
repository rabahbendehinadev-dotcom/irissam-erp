/**
 * Patient Portal — Appointment Requests (Wizard-submitted)
 * GET  /patient-portal/appointment-requests
 * POST /patient-portal/appointment-requests
 * PATCH /patient-portal/appointment-requests/:id/cancel
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
       VALUES ($1,$2,$3,'appointment_request',$4::uuid,$5)`,
      [accountId, patientId, action, resId, ip ?? null],
    );
  } catch { /* non-blocking */ }
}

router.get("/", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { patientId } = req.patient!;
  try {
    const { rows } = await pool.query(
      `SELECT id, service, motif, preferred_date, preferred_period, preferred_site,
              preferred_doctor, status, proposed_date, admin_notes, created_at
       FROM patient_portal_appointment_requests
       WHERE patient_id=$1
       ORDER BY created_at DESC`,
      [patientId],
    );
    res.json({ requests: rows });
  } catch (err) {
    console.error("[portal/appt-requests]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

router.post("/", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { patientId, accountId } = req.patient!;
  const { service, motif, preferredSite, preferredDate, preferredPeriod, preferredDoctor, notes } = req.body ?? {};
  if (!service || !motif) {
    res.status(400).json({ message: "Service et motif requis." });
    return;
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO patient_portal_appointment_requests
         (account_id, patient_id, service, motif, preferred_site, preferred_date,
          preferred_period, preferred_doctor, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6::date,$7,$8,$9,'submitted')
       RETURNING id, service, motif, status, created_at`,
      [accountId, patientId, service, motif, preferredSite ?? null,
       preferredDate ?? null, preferredPeriod ?? "any", preferredDoctor ?? null, notes ?? null],
    );

    // Create notification for admin (system job)
    await pool.query(
      `INSERT INTO patient_portal_notifications (account_id, patient_id, type, title, body, link)
       SELECT id, patient_id,
              'appointment_approved',
              'Demande de RDV soumise',
              'Votre demande de rendez-vous a été soumise et sera traitée.',
              '/patient-portal/appointment-requests'
       FROM patient_portal_accounts WHERE patient_id=$1`,
      [patientId],
    ).catch(() => {});

    await auditLog(accountId, patientId, "submit_appointment_request", rows[0].id, req.ip);
    res.status(201).json({ request: rows[0] });
  } catch (err) {
    console.error("[portal/appt-requests POST]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

router.patch("/:id/cancel", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { patientId, accountId } = req.patient!;
  try {
    const { rows } = await pool.query(
      `UPDATE patient_portal_appointment_requests
       SET status='cancelled', updated_at=now()
       WHERE id=$1 AND patient_id=$2
         AND status IN ('draft','submitted','under_review')
       RETURNING id`,
      [req.params.id, patientId],
    );
    if (!rows[0]) {
      res.status(404).json({ message: "Demande introuvable ou non annulable." });
      return;
    }
    await auditLog(accountId, patientId, "cancel_appointment_request", req.params.id, req.ip);
    res.json({ message: "Demande annulée." });
  } catch (err) {
    console.error("[portal/appt-requests PATCH]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

export default router;
