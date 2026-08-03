/** /api/hr/overtime */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();
function actor(req: AuthenticatedRequest) {
  return { userId: req.auth?.userId ?? "system", userName: req.auth?.userId ?? "system" };
}

router.get("/", requirePermission("hr.overtime.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { employee_id, status, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const conds: string[] = ["o.deleted_at IS NULL"];
    const params: any[] = [];
    let pi = 1;
    if (employee_id) { conds.push(`o.employee_id=$${pi++}::uuid`); params.push(employee_id); }
    if (status) { conds.push(`o.status=$${pi++}::absence_status`); params.push(status); }
    const rows = await pool.query(`
      SELECT o.*, e.first_name || ' ' || e.last_name AS employee_name, e.matricule
      FROM overtime_records o
      JOIN employees e ON e.id = o.employee_id
      WHERE ${conds.join(" AND ")}
      ORDER BY o.record_date DESC LIMIT $${pi} OFFSET $${pi+1}`,
      [...params, parseInt(limit), parseInt(offset)]);
    const tot = await pool.query(`SELECT COUNT(*) AS total FROM overtime_records o WHERE ${conds.join(" AND ")}`, params);
    res.json({ data: rows.rows, total: parseInt(tot.rows[0].total) });
  } catch (err) { next(err); }
});

router.post("/", requirePermission("hr.attendance.create"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const act = actor(req);
    const { employeeId, recordDate, plannedHours, workedHours, reason, compensationType } = req.body;
    if (!employeeId || !recordDate || !plannedHours || !workedHours) return res.status(400).json({ error: "employeeId, recordDate, plannedHours, workedHours requis" });
    const overtimeHours = Math.max(0, parseFloat(workedHours) - parseFloat(plannedHours));
    const row = await pool.query(`
      INSERT INTO overtime_records (employee_id, record_date, planned_hours, worked_hours, overtime_hours, reason,
        compensation_type, status, created_by, updated_by)
      VALUES ($1::uuid,$2::date,$3,$4,$5,$6,COALESCE($7,'paiement')::overtime_compensation,'soumise'::absence_status,$8::uuid,$8::uuid)
      RETURNING *`,
      [employeeId, recordDate, parseFloat(plannedHours), parseFloat(workedHours), overtimeHours,
       reason ?? null, compensationType ?? null, act.userId]);
    res.status(201).json(row.rows[0]);
  } catch (err) { next(err); }
});

router.post("/:id/approve", requirePermission("hr.overtime.approve"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const act = actor(req);
    const row = await pool.query(`
      UPDATE overtime_records SET status='approuvee'::absence_status, approved_by=$1::uuid, approved_at=NOW(), updated_at=NOW(), updated_by=$1::uuid
      WHERE id=$2::uuid AND deleted_at IS NULL RETURNING *`,
      [act.userId, req.params.id]);
    await pool.query(`
      INSERT INTO hr_audit_events (actor_id, actor_name, action, entity_type, entity_id)
      VALUES ($1::uuid,$2,'approve_overtime','overtime',$3::uuid)`,
      [act.userId, act.userName, req.params.id]);
    res.json(row.rows[0]);
  } catch (err) { next(err); }
});

router.post("/:id/reject", requirePermission("hr.overtime.approve"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const act = actor(req);
    await pool.query(`UPDATE overtime_records SET status='rejetee'::absence_status, updated_at=NOW(), updated_by=$1::uuid WHERE id=$2::uuid`,
      [act.userId, req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
