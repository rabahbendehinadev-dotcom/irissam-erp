/**
 * Doctor Portal — Lab Orders
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission.js";
import type { AuthenticatedRequest } from "../../middleware/requireAuth.js";

const router = Router();

router.post("/", requirePermission("doctor_portal.lab.create"), async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth!;
  const { patientId, encounterId, test, category, urgency, clinicalNote } = req.body as Record<string, string>;
  if (!patientId || !encounterId || !test) {
    res.status(400).json({ message: "patientId, encounterId et test requis" });
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
      `INSERT INTO lab_orders
         (patient_id, encounter_id, patient_name, requested_by_id, requested_by_name,
          test, category, urgency, clinical_note, status, source_module, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'demandee','laboratoire',now(),now())
       RETURNING *`,
      [patientId, encounterId, patient.rows[0]?.full_name ?? "", auth.userId, doctorName,
       test, category ?? "biologie", urgency ?? "routine", clinicalNote ?? null]
    );
    await pool.query(
      `INSERT INTO audit_logs (module,action,user_id,user_name,user_role,patient_id,resource_id,resource_type,ip,severity)
       VALUES ('lab_orders','create_lab_order',$1,$2,$3,$4,$5,'lab_order',$6,'info')`,
      [auth.userId, doctorName, auth.role, patientId, result.rows[0].id, req.ip]
    ).catch(() => {});
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("[dp/lab-orders POST]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.get("/", requirePermission("doctor_portal.lab.view_results"), async (req, res) => {
  const doctorId = (req as AuthenticatedRequest).auth!.userId;
  const { status, critical, page = "1", limit = "20" } = req.query as Record<string, string>;
  const params: unknown[] = [doctorId];
  const conds = ["lo.requested_by_id=$1", "lo.deleted_at IS NULL"];
  if (status) { params.push(status); conds.push(`lo.status=$${params.length}`); }
  if (critical === "true") { conds.push("lo.is_critical=true"); }
  params.push(Number(limit), (Number(page) - 1) * Number(limit));
  try {
    const result = await pool.query(
      `SELECT lo.*, p.first_name||' '||p.last_name AS patient_full_name, p.mrn
       FROM lab_orders lo
       JOIN patients p ON p.id=lo.patient_id
       WHERE ${conds.join(" AND ")}
       ORDER BY lo.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ orders: result.rows });
  } catch (err) {
    console.error("[dp/lab-orders GET]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.get("/:id", requirePermission("doctor_portal.lab.view_results"), async (req, res) => {
  const doctorId = (req as AuthenticatedRequest).auth!.userId;
  try {
    const result = await pool.query(
      `SELECT lo.*, p.first_name||' '||p.last_name AS patient_full_name, p.mrn, p.date_of_birth
       FROM lab_orders lo JOIN patients p ON p.id=lo.patient_id
       WHERE lo.id=$1 AND lo.requested_by_id=$2 AND lo.deleted_at IS NULL`,
      [req.params.id, doctorId]
    );
    if (!result.rowCount) { res.status(404).json({ message: "Analyse introuvable" }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

export default router;
