/**
 * GET /api/doctor-portal/agenda  — doctor's agenda (appointments + on-call etc.)
 * Query params: start, end (ISO date strings), view (day|week|month|list)
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission.js";
import type { AuthenticatedRequest } from "../../middleware/requireAuth.js";

const router = Router();

router.get("/", requirePermission("doctor_portal.agenda.view"), async (req, res) => {
  const doctorId = (req as AuthenticatedRequest).auth!.userId;
  const start = (req.query.start as string) || new Date().toISOString().slice(0, 10);
  const end   = (req.query.end   as string) || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  try {
    const appointments = await pool.query(
      `SELECT a.id, a.patient_id, a.patient_name, a.patient_mpi,
              a.scheduled_at, a.duration, a.status, a.type,
              a.department_name, a.notes, a.cancelled_reason,
              p.mrn, p.date_of_birth, p.gender,
              p.allergies, p.chronic_diseases
       FROM appointments a
       LEFT JOIN patients p ON p.id = a.patient_id
       WHERE a.doctor_id = $1
         AND a.scheduled_at >= $2::timestamptz
         AND a.scheduled_at <  ($3::date + INTERVAL '1 day')::timestamptz
         AND a.deleted_at IS NULL
       ORDER BY a.scheduled_at ASC`,
      [doctorId, start, end]
    );

    res.json({ appointments: appointments.rows });
  } catch (err) {
    console.error("[doctor-portal/agenda]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// PATCH /agenda/:id/status — mark arrived / absent / etc.
router.patch("/:id/status", requirePermission("doctor_portal.agenda.view"), async (req, res) => {
  const doctorId = (req as AuthenticatedRequest).auth!.userId;
  const { status } = req.body as { status: string };
  const allowed = ["confirmed","arrived","in_consultation","in_progress","completed","absent","no_show","cancelled"];
  if (!allowed.includes(status)) {
    res.status(400).json({ message: "Statut invalide" });
    return;
  }
  try {
    const result = await pool.query(
      `UPDATE appointments SET status=$1, updated_at=now()
       WHERE id=$2 AND doctor_id=$3 AND deleted_at IS NULL
       RETURNING id, status`,
      [status, req.params.id, doctorId]
    );
    if (!result.rowCount) { res.status(404).json({ message: "Rendez-vous introuvable" }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[doctor-portal/agenda/status]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

export default router;
