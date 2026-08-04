/**
 * Doctor Portal — Emergency cases assigned to the doctor
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission.js";
import type { AuthenticatedRequest } from "../../middleware/requireAuth.js";

const router = Router();

router.get("/", requirePermission("doctor_portal.emergencies.view"), async (req, res) => {
  const doctorId = (req as AuthenticatedRequest).auth!.userId;
  try {
    const result = await pool.query(
      `SELECT ev.id, ev.encounter_id, ev.patient_id, ev.priority, ev.status,
              ev.assigned_room_name, ev.assigned_doctor_name, ev.assigned_nurse_name,
              EXTRACT(EPOCH FROM (now() - enc.opened_at))/60 AS wait_minutes,
              enc.chief_complaint, enc.workflow_status,
              p.first_name||' '||p.last_name AS patient_name,
              p.mrn, p.date_of_birth, p.gender,
              p.allergies, p.chronic_diseases,
              (SELECT row_to_json(v) FROM (
                SELECT heart_rate, blood_pressure_systolic, blood_pressure_diastolic,
                       temperature, oxygen_saturation, respiratory_rate, recorded_at
                FROM emergency_vitals WHERE visit_id=ev.id
                ORDER BY recorded_at DESC LIMIT 1
              ) v) AS latest_vitals
       FROM emergency_visits ev
       JOIN encounters enc ON enc.id = ev.encounter_id
       JOIN patients p ON p.id = ev.patient_id
       WHERE ev.assigned_doctor_id=$1
         AND ev.status NOT IN ('sorti','transfere','hospitalise','decede')
       ORDER BY
         CASE ev.priority
           WHEN 'p1' THEN 1 WHEN 'p2' THEN 2 WHEN 'p3' THEN 3
           WHEN 'p4' THEN 4 ELSE 5
         END, enc.opened_at ASC`,
      [doctorId]
    );
    res.json({ cases: result.rows });
  } catch (err) {
    console.error("[dp/emergencies GET]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.post("/:id/decision", requirePermission("doctor_portal.emergencies.decide"), async (req, res) => {
  const auth   = (req as AuthenticatedRequest).auth!;
  const { decision, motif, notes } = req.body as Record<string, string>;
  const allowed = ["sortie","hospitalisation","icu","bloc","transfert"];
  if (!allowed.includes(decision)) {
    res.status(400).json({ message: "Décision invalide" });
    return;
  }
  try {
    const visit = await pool.query(
      `SELECT ev.id, ev.encounter_id, enc.patient_id
       FROM emergency_visits ev
       JOIN encounters enc ON enc.id=ev.encounter_id
       WHERE ev.id=$1 AND ev.assigned_doctor_id=$2`,
      [req.params.id, auth.userId]
    );
    if (!visit.rowCount) { res.status(404).json({ message: "Cas introuvable" }); return; }

    const statusMap: Record<string, string> = {
      sortie: "sorti", hospitalisation: "hospitalise",
      icu: "reanimation", bloc: "hospitalise", transfert: "transfere",
    };
    const newStatus = statusMap[decision];

    await pool.query(
      `UPDATE emergency_visits SET status=$1::emergency_patient_status, updated_at=now() WHERE id=$2`,
      [newStatus, req.params.id]
    );
    await pool.query(
      `UPDATE encounters SET workflow_status=$1, updated_at=now() WHERE id=$2`,
      [`decision_${decision}`, visit.rows[0].encounter_id]
    );
    await pool.query(
      `INSERT INTO audit_logs
         (module,action,user_id,user_name,user_role,patient_id,resource_id,resource_type,ip,severity,new_value)
       VALUES ('emergencies','emergency_decision',$1,$2,$3,$4,$5,'emergency_visit',$6,'info',$7)`,
      [auth.userId, `${auth.firstName ?? ""} ${auth.lastName ?? ""}`.trim(),
       auth.role, visit.rows[0].patient_id, req.params.id, req.ip,
       JSON.stringify({ decision, motif, notes })]
    ).catch(() => {});
    res.json({ id: req.params.id, decision, status: newStatus });
  } catch (err) {
    console.error("[dp/emergencies/decision]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

export default router;
