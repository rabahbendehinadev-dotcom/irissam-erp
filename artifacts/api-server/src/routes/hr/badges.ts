/**
 * /api/hr/badges — Badge devices, assignments, events
 * Includes a DEV-ONLY simulate endpoint
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();
function actor(req: AuthenticatedRequest) {
  return { userId: req.auth?.userId ?? "system", userName: req.auth?.userId ?? "system" };
}

// ─── Devices ──────────────────────────────────────────────────────────────────

router.get("/devices", requirePermission("hr.badges.view"), async (_req, res, next) => {
  try {
    const rows = await pool.query(`
      SELECT d.*, COUNT(e.id)::int AS event_count_today
      FROM badge_devices d
      LEFT JOIN badge_events e ON e.device_id = d.id
        AND e.event_time::date = CURRENT_DATE
      WHERE d.deleted_at IS NULL
      GROUP BY d.id ORDER BY d.name`);
    res.json(rows.rows);
  } catch (err) { next(err); }
});

router.post("/devices", requirePermission("hr.badges.manage"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const act = actor(req);
    const { code, name, siteId, location, ipAddress, serialNumber, firmware, notes } = req.body;
    const row = await pool.query(`
      INSERT INTO badge_devices (code, name, site_id, location, ip_address, serial_number, firmware, notes, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5::inet,$6,$7,$8,$9::uuid,$9::uuid) RETURNING *`,
      [code, name, siteId ?? null, location ?? null, ipAddress ?? null, serialNumber ?? null, firmware ?? null, notes ?? null, act.userId]);
    res.status(201).json(row.rows[0]);
  } catch (err) { next(err); }
});

router.patch("/devices/:id", requirePermission("hr.badges.manage"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const act = actor(req);
    const { status, location, firmware, notes } = req.body;
    await pool.query(`
      UPDATE badge_devices SET
        status=COALESCE($1::badge_device_status,status),
        location=COALESCE($2,location), firmware=COALESCE($3,firmware),
        notes=COALESCE($4,notes), updated_at=NOW(), updated_by=$5::uuid
      WHERE id=$6::uuid AND deleted_at IS NULL`,
      [status ?? null, location ?? null, firmware ?? null, notes ?? null, act.userId, req.params.id]);
    const row = await pool.query("SELECT * FROM badge_devices WHERE id=$1::uuid", [req.params.id]);
    res.json(row.rows[0]);
  } catch (err) { next(err); }
});

// ─── Assignments ──────────────────────────────────────────────────────────────

router.get("/assignments", requirePermission("hr.badges.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { employee_id } = req.query as Record<string, string>;
    const conds = ["a.deleted_at IS NULL"];
    const params: any[] = [];
    let pi = 1;
    if (employee_id) { conds.push(`a.employee_id=$${pi++}::uuid`); params.push(employee_id); }
    const rows = await pool.query(`
      SELECT a.*, e.first_name || ' ' || e.last_name AS employee_name, e.matricule
      FROM badge_assignments a
      JOIN employees e ON e.id = a.employee_id
      WHERE ${conds.join(" AND ")} ORDER BY a.assigned_at DESC`, params);
    res.json(rows.rows);
  } catch (err) { next(err); }
});

router.post("/assignments", requirePermission("hr.badges.manage"), async (req: AuthenticatedRequest, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const act = actor(req);
    const { employeeId, badgeNumber } = req.body;
    if (!employeeId || !badgeNumber) { await client.query("ROLLBACK"); return res.status(400).json({ error: "employeeId et badgeNumber requis" }); }

    // Revoke any existing active badge for this employee
    await client.query(`
      UPDATE badge_assignments SET status='revoked', revoked_at=NOW(), revoked_by=$1::uuid, deleted_at=NOW(), updated_at=NOW()
      WHERE employee_id=$2::uuid AND status='active' AND deleted_at IS NULL`,
      [act.userId, employeeId]);

    const row = await client.query(`
      INSERT INTO badge_assignments (employee_id, badge_number, status, assigned_by, created_by, updated_by)
      VALUES ($1::uuid,$2,'active',$3::uuid,$3::uuid,$3::uuid) RETURNING *`,
      [employeeId, badgeNumber, act.userId]);

    await client.query(`
      INSERT INTO hr_audit_events (employee_id, actor_id, actor_name, action, entity_type, entity_id, new_values)
      VALUES ($1::uuid,$2::uuid,$3,'assign_badge','badge',$4::uuid,$5::jsonb)`,
      [employeeId, act.userId, act.userName, row.rows[0].id, JSON.stringify({ badgeNumber })]);

    await client.query("COMMIT");
    res.status(201).json(row.rows[0]);
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally { client.release(); }
});

router.post("/assignments/:id/revoke", requirePermission("hr.badges.manage"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const act = actor(req);
    const row = await pool.query(`
      UPDATE badge_assignments SET status='revoked', revoked_at=NOW(), revoked_by=$1::uuid,
        deleted_at=NOW(), updated_at=NOW()
      WHERE id=$2::uuid AND deleted_at IS NULL RETURNING *`,
      [act.userId, req.params.id]);

    if (row.rows[0]) {
      await pool.query(`
        INSERT INTO hr_audit_events (employee_id, actor_id, actor_name, action, entity_type, entity_id)
        VALUES ($1::uuid,$2::uuid,$3,'revoke_badge','badge',$4::uuid)`,
        [row.rows[0].employee_id, act.userId, act.userName, req.params.id]);
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── Events ───────────────────────────────────────────────────────────────────

router.get("/events", requirePermission("hr.badges.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { employee_id, device_id, date, processed, limit = "100", offset = "0" } = req.query as Record<string, string>;
    const conds: string[] = [];
    const params: any[] = [];
    let pi = 1;
    if (employee_id) { conds.push(`e.employee_id=$${pi++}::uuid`); params.push(employee_id); }
    if (device_id) { conds.push(`e.device_id=$${pi++}::uuid`); params.push(device_id); }
    if (date) { conds.push(`e.event_time::date=$${pi++}::date`); params.push(date); }
    if (processed !== undefined) { conds.push(`e.processed=$${pi++}`); params.push(processed === "true"); }
    const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
    const rows = await pool.query(`
      SELECT e.*, emp.first_name || ' ' || emp.last_name AS employee_name, emp.matricule,
        d.name AS device_name
      FROM badge_events e
      LEFT JOIN employees emp ON emp.id = e.employee_id
      LEFT JOIN badge_devices d ON d.id = e.device_id
      ${where} ORDER BY e.event_time DESC LIMIT $${pi} OFFSET $${pi+1}`,
      [...params, parseInt(limit), parseInt(offset)]);
    res.json(rows.rows);
  } catch (err) { next(err); }
});

// Endpoint: receive badge event from device (future hardware integration)
router.post("/events", async (req, res, next) => {
  try {
    const { employeeId, badgeNumber, deviceId, eventType, eventTime, rawData } = req.body;
    if (!badgeNumber || !eventType) return res.status(400).json({ error: "badgeNumber et eventType requis" });

    // Resolve employee from badge number if not provided
    let resolvedEmployeeId = employeeId;
    if (!resolvedEmployeeId && badgeNumber) {
      const ba = await pool.query(
        `SELECT employee_id FROM badge_assignments WHERE badge_number=$1 AND status='active' AND deleted_at IS NULL LIMIT 1`,
        [badgeNumber]
      );
      resolvedEmployeeId = ba.rows[0]?.employee_id ?? null;
    }

    const row = await pool.query(`
      INSERT INTO badge_events (employee_id, badge_number, device_id, event_type, event_time, raw_data, processed, anomaly)
      VALUES ($1,$2,$3,$4::badge_event_type,COALESCE($5,NOW()),$6::jsonb,FALSE,
        CASE WHEN $1 IS NULL THEN 'Badge inconnu' ELSE NULL END)
      RETURNING *`,
      [resolvedEmployeeId ?? null, badgeNumber, deviceId ?? null,
       eventType, eventTime ?? null, rawData ? JSON.stringify(rawData) : null]);

    // If check_in/check_out event and employee resolved, update attendance
    if (resolvedEmployeeId && ["check_in","check_out"].includes(eventType)) {
      const today = new Date().toISOString().split("T")[0];
      if (eventType === "check_in") {
        await pool.query(`
          INSERT INTO attendance_records (employee_id, record_date, check_in, status, source)
          VALUES ($1::uuid, $2::date, NOW(), 'present'::attendance_status, 'badge'::attendance_source)
          ON CONFLICT (employee_id, record_date) DO UPDATE SET check_in=NOW(), updated_at=NOW()`,
          [resolvedEmployeeId, today]);
      } else {
        await pool.query(`
          UPDATE attendance_records SET check_out=NOW(), status='sorti'::attendance_status, updated_at=NOW()
          WHERE employee_id=$1::uuid AND record_date=$2::date AND check_in IS NOT NULL`,
          [resolvedEmployeeId, today]);
      }
      await pool.query("UPDATE badge_events SET processed=TRUE WHERE id=$1::uuid", [row.rows[0].id]);
    }

    res.status(201).json(row.rows[0]);
  } catch (err) { next(err); }
});

// DEV-ONLY: simulate a badge event (admin only)
router.post("/simulate", requirePermission("hr.badges.manage"), async (req: AuthenticatedRequest, res, next) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Simulation désactivée en production" });
  }
  try {
    const act = actor(req);
    const { employeeId, eventType, deviceId } = req.body;
    if (!employeeId || !eventType) return res.status(400).json({ error: "employeeId et eventType requis" });

    const ba = await pool.query(
      `SELECT badge_number FROM badge_assignments WHERE employee_id=$1::uuid AND status='active' AND deleted_at IS NULL LIMIT 1`,
      [employeeId]
    );
    const badgeNumber = ba.rows[0]?.badge_number ?? `SIM-${employeeId.slice(0,8)}`;

    const row = await pool.query(`
      INSERT INTO badge_events (employee_id, badge_number, device_id, event_type, event_time, raw_data, processed)
      VALUES ($1::uuid,$2,$3,$4::badge_event_type,NOW(),'{"simulated":true}'::jsonb,FALSE)
      RETURNING *`,
      [employeeId, badgeNumber, deviceId ?? null, eventType]);

    // Forward to attendance
    await pool.query(`
      INSERT INTO attendance_records (employee_id, record_date, check_in, status, source)
      VALUES ($1::uuid, CURRENT_DATE, NOW(), 'present'::attendance_status, 'badge'::attendance_source)
      ON CONFLICT (employee_id, record_date) DO UPDATE SET
        ${eventType === "check_in" ? "check_in=NOW()" : "check_out=NOW()"},
        updated_at=NOW()`,
      [employeeId]);

    await pool.query("UPDATE badge_events SET processed=TRUE WHERE id=$1::uuid", [row.rows[0].id]);
    res.json({ ok: true, event: row.rows[0], badgeNumber });
  } catch (err) { next(err); }
});

export default router;
