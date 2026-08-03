/**
 * /api/hr/attendance — Daily attendance, check-in/out, corrections
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();
function actor(req: AuthenticatedRequest) {
  return { userId: req.auth?.userId ?? "system", userName: req.auth?.userId ?? "system" };
}

// GET /hr/attendance — list
router.get("/", requirePermission("hr.attendance.view"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const { date, employee_id, status, department_id, limit = "100", offset = "0" } = req.query as Record<string, string>;
    const conds: string[] = ["a.deleted_at IS NULL"];
    const params: any[] = [];
    let pi = 1;
    if (date) { conds.push(`a.record_date=$${pi++}::date`); params.push(date); }
    if (employee_id) { conds.push(`a.employee_id=$${pi++}::uuid`); params.push(employee_id); }
    if (status) { conds.push(`a.status=$${pi++}::attendance_status`); params.push(status); }
    if (department_id) { conds.push(`ep.department_id=$${pi++}::uuid`); params.push(department_id); }

    const rows = await pool.query(`
      SELECT a.*,
        e.first_name || ' ' || e.last_name AS employee_name,
        e.matricule, e.photo_url,
        ep.department_id,
        d.name AS department_name,
        pos.name AS position_name
      FROM attendance_records a
      JOIN employees e ON e.id = a.employee_id
      LEFT JOIN employee_profiles ep ON ep.employee_id = e.id AND ep.deleted_at IS NULL
      LEFT JOIN hr_departments d ON d.id = ep.department_id
      LEFT JOIN employee_positions pos ON pos.id = ep.position_id
      WHERE ${conds.join(" AND ")}
      ORDER BY a.record_date DESC, e.last_name
      LIMIT $${pi} OFFSET $${pi+1}`,
      [...params, parseInt(limit), parseInt(offset)]
    );
    const tot = await pool.query(
      `SELECT COUNT(*) AS total FROM attendance_records a
       LEFT JOIN employee_profiles ep ON ep.employee_id = a.employee_id AND ep.deleted_at IS NULL
       WHERE ${conds.join(" AND ")}`, params);

    // Daily stats if date given
    let stats = null;
    if (date) {
      const s = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE a.status='present')::int AS present,
          COUNT(*) FILTER (WHERE a.status='absent')::int AS absent,
          COUNT(*) FILTER (WHERE a.status='retard')::int AS late,
          COUNT(*) FILTER (WHERE a.status='sorti')::int AS checked_out,
          COUNT(*) FILTER (WHERE a.status='en_pause')::int AS on_break,
          COUNT(*) FILTER (WHERE a.status='en_mission')::int AS on_mission,
          COUNT(*) FILTER (WHERE a.status='en_garde')::int AS on_shift,
          COUNT(*) FILTER (WHERE a.status='non_pointe')::int AS not_checked_in
        FROM attendance_records a WHERE a.record_date=$1::date AND a.deleted_at IS NULL`, [date]);
      stats = s.rows[0];
    }

    res.json({ data: rows.rows, total: parseInt(tot.rows[0].total), stats });
  } catch (err) { next(err); }
});

// POST /hr/attendance/check-in — badge check-in
router.post("/check-in", requirePermission("hr.attendance.create"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const act = actor(req);
    const { employeeId, checkIn, source, deviceId, shiftId } = req.body;
    if (!employeeId) { await client.query("ROLLBACK"); return void res.status(400).json({ error: "employeeId requis" }); }

    const now = checkIn ? new Date(checkIn) : new Date();
    const today = now.toISOString().split("T")[0];

    // Get planned shift for late calculation
    const shift = shiftId
      ? (await client.query("SELECT * FROM employee_shifts WHERE id=$1::uuid", [shiftId])).rows[0]
      : (await client.query(
          `SELECT * FROM employee_shifts WHERE employee_id=$1::uuid AND shift_date=$2::date AND deleted_at IS NULL ORDER BY start_time LIMIT 1`,
          [employeeId, today]
        )).rows[0];

    let lateMinutes = 0;
    let attendanceStatus = "present";
    let plannedStart = null, plannedEnd = null;

    if (shift) {
      plannedStart = new Date(`${today}T${shift.start_time}`);
      plannedEnd = new Date(`${today}T${shift.end_time}`);
      const gracePeriod = 5; // minutes
      const diffMin = Math.floor((now.getTime() - plannedStart.getTime()) / 60000);
      if (diffMin > gracePeriod) {
        lateMinutes = diffMin;
        attendanceStatus = "retard";

        // Create late record
        await client.query(`
          INSERT INTO late_records (employee_id, record_date, planned_time, arrival_time, late_minutes, status, created_by, updated_by)
          VALUES ($1::uuid, $2::date, $3::time, $4::time, $5, 'en_attente'::late_status, $6::uuid, $6::uuid)
          ON CONFLICT DO NOTHING`,
          [employeeId, today, shift.start_time,
           now.toTimeString().slice(0,8), lateMinutes, act.userId]);
      }
    }

    // Upsert attendance record
    const row = await client.query(`
      INSERT INTO attendance_records
        (employee_id, shift_id, record_date, planned_start, planned_end,
         check_in, status, late_minutes, source, device_id, created_by, updated_by)
      VALUES ($1::uuid, $2, $3::date, $4, $5, $6, $7::attendance_status, $8,
              $9::attendance_source, $10, $11::uuid, $11::uuid)
      ON CONFLICT (employee_id, record_date) DO UPDATE SET
        check_in = EXCLUDED.check_in,
        status = EXCLUDED.status,
        late_minutes = EXCLUDED.late_minutes,
        shift_id = COALESCE(EXCLUDED.shift_id, attendance_records.shift_id),
        planned_start = COALESCE(EXCLUDED.planned_start, attendance_records.planned_start),
        planned_end = COALESCE(EXCLUDED.planned_end, attendance_records.planned_end),
        updated_at = NOW(), updated_by = $11::uuid
      RETURNING *`,
      [employeeId, shiftId ?? null, today,
       plannedStart?.toISOString() ?? null, plannedEnd?.toISOString() ?? null,
       now.toISOString(), attendanceStatus, lateMinutes,
       source ?? "manuel", deviceId ?? null, act.userId]
    );

    // Log attendance event
    await client.query(`
      INSERT INTO attendance_events (record_id, employee_id, event_type, event_time, source, device_id, created_by)
      VALUES ($1::uuid,$2::uuid,'check_in'::badge_event_type,$3,$4::attendance_source,$5,$6::uuid)`,
      [row.rows[0].id, employeeId, now.toISOString(), source ?? "manuel", deviceId ?? null, act.userId]);

    await client.query("COMMIT");
    res.json({ record: row.rows[0], lateMinutes });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally { client.release(); }
});

// POST /hr/attendance/check-out
router.post("/check-out", requirePermission("hr.attendance.create"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const act = actor(req);
    const { employeeId, checkOut, source, deviceId } = req.body;
    if (!employeeId) { await client.query("ROLLBACK"); return void res.status(400).json({ error: "employeeId requis" }); }

    const now = checkOut ? new Date(checkOut) : new Date();
    const today = now.toISOString().split("T")[0];

    const existing = await client.query(
      `SELECT * FROM attendance_records WHERE employee_id=$1::uuid AND record_date=$2::date AND deleted_at IS NULL`,
      [employeeId, today]
    );
    if (!existing.rows[0]?.check_in) {
      await client.query("ROLLBACK");
      return void res.status(400).json({ error: "Aucun check-in trouvé pour aujourd'hui" });
    }

    const rec = existing.rows[0];
    const checkInTime = new Date(rec.check_in);
    const totalWorkedMinutes = Math.floor((now.getTime() - checkInTime.getTime()) / 60000)
      - (rec.break_start && rec.break_end
          ? Math.floor((new Date(rec.break_end).getTime() - new Date(rec.break_start).getTime()) / 60000)
          : 0);

    const overtimeMinutes = rec.planned_end
      ? Math.max(0, Math.floor((now.getTime() - new Date(rec.planned_end).getTime()) / 60000))
      : 0;

    const row = await client.query(`
      UPDATE attendance_records SET
        check_out=$1, status='sorti'::attendance_status,
        total_worked_minutes=$2, overtime_minutes=$3,
        updated_at=NOW(), updated_by=$4::uuid
      WHERE employee_id=$5::uuid AND record_date=$6::date AND deleted_at IS NULL
      RETURNING *`,
      [now.toISOString(), totalWorkedMinutes, overtimeMinutes, act.userId, employeeId, today]
    );

    await client.query(`
      INSERT INTO attendance_events (record_id, employee_id, event_type, event_time, source, device_id, created_by)
      VALUES ($1::uuid,$2::uuid,'check_out'::badge_event_type,$3,$4::attendance_source,$5,$6::uuid)`,
      [row.rows[0].id, employeeId, now.toISOString(), source ?? "manuel", deviceId ?? null, act.userId]);

    await client.query("COMMIT");
    res.json({ record: row.rows[0], totalWorkedMinutes, overtimeMinutes });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally { client.release(); }
});

// PATCH /hr/attendance/:id/correct — manual correction
router.patch("/:id/correct", requirePermission("hr.attendance.correct"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const act = actor(req);
    const { checkIn, checkOut, status, anomaly, notes } = req.body;
    const row = await pool.query(`
      UPDATE attendance_records SET
        check_in=COALESCE($1,check_in), check_out=COALESCE($2,check_out),
        status=COALESCE($3::attendance_status,status),
        anomaly=$4, notes=COALESCE($5,notes),
        approved_by=$6::uuid, approved_at=NOW(),
        updated_at=NOW(), updated_by=$6::uuid
      WHERE id=$7::uuid AND deleted_at IS NULL
      RETURNING *`,
      [checkIn ?? null, checkOut ?? null, status ?? null, anomaly ?? null, notes ?? null, act.userId, req.params.id]);

    await pool.query(`
      INSERT INTO hr_audit_events (actor_id, actor_name, action, entity_type, entity_id, new_values)
      VALUES ($1::uuid,$2,'correct_attendance','attendance',$3::uuid,$4::jsonb)`,
      [act.userId, act.userName, req.params.id, JSON.stringify({ checkIn, checkOut, status })]);

    res.json(row.rows[0]);
  } catch (err) { next(err); }
});

// GET /hr/attendance/today — today's snapshot
router.get("/today", requirePermission("hr.attendance.view"), async (_req, res, next) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const rows = await pool.query(`
      SELECT a.*, e.first_name || ' ' || e.last_name AS employee_name,
        e.matricule, e.photo_url, d.name AS department_name
      FROM attendance_records a
      JOIN employees e ON e.id = a.employee_id
      LEFT JOIN employee_profiles ep ON ep.employee_id = e.id AND ep.deleted_at IS NULL
      LEFT JOIN hr_departments d ON d.id = ep.department_id
      WHERE a.record_date=$1::date AND a.deleted_at IS NULL
      ORDER BY e.last_name`, [today]);
    res.json(rows.rows);
  } catch (err) { next(err); }
});

export default router;
