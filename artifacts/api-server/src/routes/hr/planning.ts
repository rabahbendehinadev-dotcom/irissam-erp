/**
 * /api/hr/planning — Shifts (employee_shifts) CRUD + conflict detection
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();
function actor(req: AuthenticatedRequest) {
  return { userId: req.auth?.userId ?? "system", userName: req.auth?.userId ?? "system" };
}

// GET /hr/planning/shifts — list shifts with filters
router.get("/shifts", requirePermission("hr.planning.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { employee_id, department_id, date_from, date_to, type, status, limit = "200", offset = "0" } = req.query as Record<string, string>;
    const conds: string[] = ["s.deleted_at IS NULL"];
    const params: any[] = [];
    let pi = 1;
    if (employee_id) { conds.push(`s.employee_id=$${pi++}::uuid`); params.push(employee_id); }
    if (department_id) { conds.push(`s.department_id=$${pi++}::uuid`); params.push(department_id); }
    if (date_from) { conds.push(`s.shift_date >= $${pi++}::date`); params.push(date_from); }
    if (date_to) { conds.push(`s.shift_date <= $${pi++}::date`); params.push(date_to); }
    if (type) { conds.push(`s.type=$${pi++}::shift_type`); params.push(type); }
    if (status) { conds.push(`s.status=$${pi++}::shift_status`); params.push(status); }

    const rows = await pool.query(`
      SELECT s.*,
        e.first_name || ' ' || e.last_name AS employee_name,
        e.matricule, e.photo_url,
        d.name AS department_name
      FROM employee_shifts s
      JOIN employees e ON e.id = s.employee_id
      LEFT JOIN hr_departments d ON d.id = s.department_id
      WHERE ${conds.join(" AND ")}
      ORDER BY s.shift_date, s.start_time
      LIMIT $${pi} OFFSET $${pi+1}`,
      [...params, parseInt(limit), parseInt(offset)]
    );
    const tot = await pool.query(`SELECT COUNT(*) AS total FROM employee_shifts s WHERE ${conds.join(" AND ")}`, params);
    res.json({ data: rows.rows, total: parseInt(tot.rows[0].total) });
  } catch (err) { next(err); }
});

// POST /hr/planning/shifts — create shift with conflict detection
router.post("/shifts", requirePermission("hr.planning.manage"), async (req: AuthenticatedRequest, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const act = actor(req);
    const { employeeId, departmentId, siteId, service, shiftDate, type, startTime, endTime, breakMinutes, role, notes } = req.body;
    if (!employeeId || !shiftDate || !type || !startTime || !endTime) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "employeeId, shiftDate, type, startTime, endTime requis" });
    }

    // Conflict detection
    const conflict = await client.query(`
      SELECT id FROM employee_shifts
      WHERE employee_id=$1::uuid
        AND shift_date=$2::date
        AND deleted_at IS NULL
        AND status != 'annule'
        AND (
          (start_time < $4::time AND end_time > $3::time)
        )`,
      [employeeId, shiftDate, startTime, endTime]
    );
    if (conflict.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Conflit de planning: shift déjà assigné sur ce créneau", conflictingShiftId: conflict.rows[0].id });
    }

    const row = await client.query(`
      INSERT INTO employee_shifts
        (employee_id, department_id, site_id, service, shift_date, type,
         start_time, end_time, break_minutes, role, status, notes, created_by, updated_by)
      VALUES ($1::uuid,$2,$3,$4,$5::date,$6::shift_type,$7::time,$8::time,
              COALESCE($9,0),$10,'planifie'::shift_status,$11,$12::uuid,$12::uuid)
      RETURNING *`,
      [employeeId, departmentId ?? null, siteId ?? null, service ?? null,
       shiftDate, type, startTime, endTime, breakMinutes, role ?? null, notes ?? null, act.userId]);

    await client.query(`
      INSERT INTO hr_audit_events (employee_id, actor_id, actor_name, action, entity_type, entity_id, new_values)
      VALUES ($1::uuid,$2::uuid,$3,'create_shift','shift',$4::uuid,$5::jsonb)`,
      [employeeId, act.userId, act.userName, row.rows[0].id,
       JSON.stringify({ shiftDate, type, startTime, endTime })]);

    await client.query("COMMIT");
    res.status(201).json(row.rows[0]);
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    if (err.code === "23P01") {
      return res.status(409).json({ error: "Conflit de planning détecté (contrainte DB)" });
    }
    next(err);
  } finally { client.release(); }
});

// PATCH /hr/planning/shifts/:id
router.patch("/shifts/:id", requirePermission("hr.planning.manage"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const act = actor(req);
    const { status, startTime, endTime, notes } = req.body;
    await pool.query(`
      UPDATE employee_shifts SET
        status=COALESCE($1::shift_status,status),
        start_time=COALESCE($2::time,start_time),
        end_time=COALESCE($3::time,end_time),
        notes=COALESCE($4,notes),
        updated_at=NOW(), updated_by=$5::uuid, version=version+1
      WHERE id=$6::uuid AND deleted_at IS NULL`,
      [status ?? null, startTime ?? null, endTime ?? null, notes ?? null, act.userId, req.params.id]);
    const row = await pool.query("SELECT * FROM employee_shifts WHERE id=$1::uuid", [req.params.id]);
    res.json(row.rows[0]);
  } catch (err) { next(err); }
});

// DELETE /hr/planning/shifts/:id — soft-delete (set status=annule)
router.delete("/shifts/:id", requirePermission("hr.planning.manage"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const act = actor(req);
    await pool.query(`
      UPDATE employee_shifts SET status='annule'::shift_status, deleted_at=NOW(),
        deleted_by=$1::uuid, updated_at=NOW()
      WHERE id=$2::uuid AND deleted_at IS NULL`, [act.userId, req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /hr/planning/shifts/duplicate-week — duplicate a week of shifts
router.post("/shifts/duplicate-week", requirePermission("hr.planning.manage"), async (req: AuthenticatedRequest, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const act = actor(req);
    const { sourceWeekStart, targetWeekStart, employeeIds } = req.body;
    if (!sourceWeekStart || !targetWeekStart) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "sourceWeekStart et targetWeekStart requis" });
    }

    const sourceEnd = new Date(sourceWeekStart);
    sourceEnd.setDate(sourceEnd.getDate() + 6);
    const diff = Math.round((new Date(targetWeekStart).getTime() - new Date(sourceWeekStart).getTime()) / 86400000);

    let empFilter = "";
    const params: any[] = [sourceWeekStart, sourceEnd.toISOString().split("T")[0]];
    if (employeeIds?.length) {
      empFilter = `AND employee_id = ANY($3::uuid[])`;
      params.push(employeeIds);
    }

    const { rows: sourceShifts } = await client.query(
      `SELECT * FROM employee_shifts WHERE shift_date BETWEEN $1::date AND $2::date AND deleted_at IS NULL ${empFilter}`,
      params
    );

    let created = 0;
    for (const s of sourceShifts) {
      const newDate = new Date(s.shift_date);
      newDate.setDate(newDate.getDate() + diff);
      try {
        await client.query(`
          INSERT INTO employee_shifts
            (employee_id, department_id, site_id, service, shift_date, type,
             start_time, end_time, break_minutes, role, status, notes, created_by, updated_by)
          VALUES ($1,$2,$3,$4,$5::date,$6::shift_type,$7,$8,$9,$10,'planifie',$11,$12::uuid,$12::uuid)`,
          [s.employee_id, s.department_id, s.site_id, s.service,
           newDate.toISOString().split("T")[0], s.type, s.start_time, s.end_time,
           s.break_minutes, s.role, s.notes, act.userId]);
        created++;
      } catch (_) { /* skip conflicts */ }
    }

    await client.query("COMMIT");
    res.json({ created, skipped: sourceShifts.length - created });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally { client.release(); }
});

// GET /hr/planning/templates
router.get("/templates", requirePermission("hr.planning.view"), async (_req, res, next) => {
  try {
    // Return distinct shift patterns as templates
    const rows = await pool.query(`
      SELECT DISTINCT type, start_time, end_time, break_minutes,
        COUNT(*)::int AS usage_count
      FROM employee_shifts WHERE deleted_at IS NULL
      GROUP BY type, start_time, end_time, break_minutes
      ORDER BY type, start_time`);
    res.json(rows.rows);
  } catch (err) { next(err); }
});

export default router;
