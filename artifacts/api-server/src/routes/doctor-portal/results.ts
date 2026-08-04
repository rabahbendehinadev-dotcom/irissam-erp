/**
 * Doctor Portal — Results Inbox
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission.js";
import type { AuthenticatedRequest } from "../../middleware/requireAuth.js";

const router = Router();

router.get("/", requirePermission("doctor_portal.lab.view_results"), async (req, res) => {
  const doctorId = (req as AuthenticatedRequest).auth!.userId;
  const { tab = "new" } = req.query as Record<string, string>;

  try {
    let labWhere = "lo.requested_by_id=$1 AND lo.deleted_at IS NULL";
    if (tab === "new")      labWhere += " AND lo.status IN ('validee','critique') AND lo.acknowledged_at IS NULL";
    if (tab === "critical") labWhere += " AND lo.is_critical=true AND lo.acknowledged_at IS NULL";
    if (tab === "read")     labWhere += " AND lo.acknowledged_at IS NOT NULL";

    const labs = await pool.query(
      `SELECT lo.id, lo.test, lo.category, lo.patient_id, lo.status, lo.result_at,
              lo.result, lo.is_critical, lo.acknowledged_at, lo.urgency,
              p.first_name||' '||p.last_name AS patient_name, p.mrn
       FROM lab_orders lo JOIN patients p ON p.id=lo.patient_id
       WHERE ${labWhere}
       ORDER BY lo.is_critical DESC, lo.result_at DESC NULLS LAST LIMIT 50`,
      [doctorId]
    );

    let imgWhere = "io.requested_by_id=$1 AND io.deleted_at IS NULL AND io.status='interpretee'";
    if (tab === "read") imgWhere += " AND io.acknowledged_at IS NOT NULL";
    if (tab === "new")  imgWhere += " AND io.acknowledged_at IS NULL";

    const imaging = await pool.query(
      `SELECT io.id, io.exam, io.region, io.patient_id, io.status,
              io.reported_at, io.report, io.acknowledged_at, io.urgency,
              p.first_name||' '||p.last_name AS patient_name, p.mrn
       FROM imaging_orders io JOIN patients p ON p.id=io.patient_id
       WHERE ${imgWhere}
       ORDER BY io.reported_at DESC NULLS LAST LIMIT 50`,
      [doctorId]
    );

    res.json({ labs: labs.rows, imaging: imaging.rows });
  } catch (err) {
    console.error("[dp/results GET]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.post("/:id/acknowledge", requirePermission("doctor_portal.lab.acknowledge_critical"), async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth!;
  const { type = "lab" } = req.query as Record<string, string>;
  const table = type === "imaging" ? "imaging_orders" : "lab_orders";
  const ownerCol = "requested_by_id";
  try {
    const result = await pool.query(
      `UPDATE ${table} SET acknowledged_at=now(), acknowledged_by_id=$1, updated_at=now()
       WHERE id=$2 AND ${ownerCol}=$1 RETURNING id, patient_id`,
      [auth.userId, req.params.id]
    );
    if (!result.rowCount) { res.status(404).json({ message: "Résultat introuvable" }); return; }
    await pool.query(
      `INSERT INTO audit_logs (module,action,user_id,user_name,user_role,patient_id,resource_id,resource_type,ip,severity)
       VALUES ($1,'acknowledge_critical_result',$2,$3,$4,$5,$6,$7,$8,'warning')`,
      [type === "imaging" ? "imagerie" : "laboratoire",
       auth.userId, auth.userId,  // user_name falls back to userId if name not in token
       auth.role, result.rows[0].patient_id, req.params.id,
       type === "imaging" ? "imaging_order" : "lab_order", req.ip ?? ""]
    ).catch(e => console.error("[dp/results/audit]", e.message));
    res.json({ id: req.params.id, acknowledged: true });
  } catch (err) {
    console.error("[dp/results/acknowledge]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

export default router;
