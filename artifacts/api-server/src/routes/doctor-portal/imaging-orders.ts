/**
 * Doctor Portal — Imaging Orders
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission.js";
import type { AuthenticatedRequest } from "../../middleware/requireAuth.js";

const router = Router();

router.post("/", requirePermission("doctor_portal.imaging.create"), async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth!;
  const { patientId, encounterId, exam, region, side, urgency, withContrast } = req.body as Record<string, string>;
  if (!patientId || !encounterId || !exam || !region) {
    res.status(400).json({ message: "patientId, encounterId, exam et region requis" });
    return;
  }
  try {
    const [enc, patient] = await Promise.all([
      pool.query(`SELECT id FROM encounters WHERE id=$1 AND patient_id=$2 AND deleted_at IS NULL`, [encounterId, patientId]),
      pool.query(`SELECT first_name||' '||last_name AS full_name FROM patients WHERE id=$1`, [patientId]),
    ]);
    if (!enc.rowCount) { res.status(400).json({ message: "Encounter invalide" }); return; }

    const doctorName = `${auth.firstName ?? ""} ${auth.lastName ?? ""}`.trim();
    const result = await pool.query(
      `INSERT INTO imaging_orders
         (patient_id, encounter_id, patient_name,
          requested_by_id, requested_by_name,
          exam, region, side, urgency, with_contrast,
          status, source_module, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'demandee','imagerie',now(),now())
       RETURNING *`,
      [patientId, encounterId, patient.rows[0]?.full_name ?? "",
       auth.userId, doctorName,
       exam, region, side ?? null, urgency ?? "routine", withContrast === "true"]
    );
    await pool.query(
      `INSERT INTO audit_logs (module,action,user_id,user_name,user_role,patient_id,resource_id,resource_type,ip,severity)
       VALUES ('imaging_orders','create_imaging_order',$1,$2,$3,$4,$5,'imaging_order',$6,'info')`,
      [auth.userId, doctorName, auth.role, patientId, result.rows[0].id, req.ip]
    ).catch(() => {});
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("[dp/imaging-orders POST]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.get("/", requirePermission("doctor_portal.imaging.view_reports"), async (req, res) => {
  const doctorId = (req as AuthenticatedRequest).auth!.userId;
  const { page = "1", limit = "20" } = req.query as Record<string, string>;
  try {
    const result = await pool.query(
      `SELECT io.*, p.first_name||' '||p.last_name AS patient_full_name, p.mrn
       FROM imaging_orders io JOIN patients p ON p.id=io.patient_id
       WHERE io.requested_by_id=$1 AND io.deleted_at IS NULL
       ORDER BY io.created_at DESC LIMIT $2 OFFSET $3`,
      [doctorId, Number(limit), (Number(page) - 1) * Number(limit)]
    );
    res.json({ orders: result.rows });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.get("/:id", requirePermission("doctor_portal.imaging.view_reports"), async (req, res) => {
  const doctorId = (req as AuthenticatedRequest).auth!.userId;
  try {
    const result = await pool.query(
      `SELECT io.*, p.first_name||' '||p.last_name AS patient_full_name, p.mrn
       FROM imaging_orders io JOIN patients p ON p.id=io.patient_id
       WHERE io.id=$1 AND io.requested_by_id=$2 AND io.deleted_at IS NULL`,
      [req.params.id, doctorId]
    );
    if (!result.rowCount) { res.status(404).json({ message: "Examen introuvable" }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

export default router;
