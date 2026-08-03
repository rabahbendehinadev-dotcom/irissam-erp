/** /api/hr/absences */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();
function actor(req: AuthenticatedRequest) {
  return { userId: req.auth?.userId ?? "system", userName: req.auth?.userId ?? "system" };
}

router.get("/", requirePermission("hr.absences.view"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const { employee_id, status, type, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const conds: string[] = ["a.deleted_at IS NULL"];
    const params: any[] = [];
    let pi = 1;
    if (employee_id) { conds.push(`a.employee_id=$${pi++}::uuid`); params.push(employee_id); }
    if (status) { conds.push(`a.status=$${pi++}::absence_status`); params.push(status); }
    if (type) { conds.push(`a.type=$${pi++}::absence_type`); params.push(type); }
    const rows = await pool.query(`
      SELECT a.*, e.first_name || ' ' || e.last_name AS employee_name, e.matricule
      FROM absence_records a
      JOIN employees e ON e.id = a.employee_id
      WHERE ${conds.join(" AND ")}
      ORDER BY a.date_from DESC LIMIT $${pi} OFFSET $${pi+1}`,
      [...params, parseInt(limit), parseInt(offset)]);
    const tot = await pool.query(`SELECT COUNT(*) AS total FROM absence_records a WHERE ${conds.join(" AND ")}`, params);
    res.json({ data: rows.rows, total: parseInt(tot.rows[0].total) });
  } catch (err) { next(err); }
});

router.post("/", requirePermission("hr.absences.manage"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const act = actor(req);
    const { employeeId, dateFrom, dateTo, type, reason, documentUrl } = req.body;
    if (!employeeId || !dateFrom || !dateTo || !type) return void res.status(400).json({ error: "employeeId, dateFrom, dateTo, type requis" });
    const row = await pool.query(`
      INSERT INTO absence_records (employee_id, date_from, date_to, type, reason, document_url, status, created_by, updated_by)
      VALUES ($1::uuid,$2::date,$3::date,$4::absence_type,$5,$6,'soumise'::absence_status,$7::uuid,$7::uuid) RETURNING *`,
      [employeeId, dateFrom, dateTo, type, reason ?? null, documentUrl ?? null, act.userId]);
    res.status(201).json(row.rows[0]);
  } catch (err) { next(err); }
});

router.post("/:id/approve", requirePermission("hr.absences.manage"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const act = actor(req);
    const row = await pool.query(`
      UPDATE absence_records SET status='approuvee'::absence_status, approved_by=$1::uuid, approved_at=NOW(), updated_at=NOW(), updated_by=$1::uuid
      WHERE id=$2::uuid AND deleted_at IS NULL RETURNING *`,
      [act.userId, req.params.id]);
    await pool.query(`
      INSERT INTO hr_audit_events (actor_id, actor_name, action, entity_type, entity_id)
      VALUES ($1::uuid,$2,'approve_absence','absence',$3::uuid)`,
      [act.userId, act.userName, req.params.id]);
    res.json(row.rows[0]);
  } catch (err) { next(err); }
});

router.post("/:id/reject", requirePermission("hr.absences.manage"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const act = actor(req);
    await pool.query(`UPDATE absence_records SET status='rejetee'::absence_status, updated_at=NOW(), updated_by=$1::uuid WHERE id=$2::uuid`,
      [act.userId, req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
