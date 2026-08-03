/**
 * /api/hr/leaves — Leave requests: create, manager-approve, hr-approve, reject
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();
function actor(req: AuthenticatedRequest) {
  return { userId: req.auth?.userId ?? "system", userName: req.auth?.userId ?? "system" };
}

// GET /hr/leaves
router.get("/", requirePermission("hr.leaves.view"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const { employee_id, status, leave_type, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const conds: string[] = ["lr.deleted_at IS NULL"];
    const params: any[] = [];
    let pi = 1;
    if (employee_id) { conds.push(`lr.employee_id=$${pi++}::uuid`); params.push(employee_id); }
    if (status) { conds.push(`lr.status=$${pi++}::leave_status`); params.push(status); }
    if (leave_type) { conds.push(`lr.leave_type=$${pi++}::leave_type`); params.push(leave_type); }

    const rows = await pool.query(`
      SELECT lr.*,
        e.first_name || ' ' || e.last_name AS employee_name, e.matricule,
        r.first_name || ' ' || r.last_name AS replacement_name
      FROM leave_requests lr
      JOIN employees e ON e.id = lr.employee_id
      LEFT JOIN employees r ON r.id = lr.replacement_employee_id
      WHERE ${conds.join(" AND ")}
      ORDER BY lr.created_at DESC
      LIMIT $${pi} OFFSET $${pi+1}`,
      [...params, parseInt(limit), parseInt(offset)]
    );
    const tot = await pool.query(`SELECT COUNT(*) AS total FROM leave_requests lr WHERE ${conds.join(" AND ")}`, params);
    res.json({ data: rows.rows, total: parseInt(tot.rows[0].total) });
  } catch (err) { next(err); }
});

// POST /hr/leaves
router.post("/", requirePermission("hr.leaves.create"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const act = actor(req);
    const { employeeId, leaveType, dateFrom, dateTo, numberOfDays, replacementEmployeeId, reason, documentUrl } = req.body;
    if (!employeeId || !leaveType || !dateFrom || !dateTo || !numberOfDays) {
      await client.query("ROLLBACK");
      return void res.status(400).json({ error: "employeeId, leaveType, dateFrom, dateTo, numberOfDays requis" });
    }

    const currentYear = new Date(dateFrom).getFullYear();

    // Check balance
    const bal = await client.query(
      `SELECT * FROM leave_balances WHERE employee_id=$1::uuid AND leave_type=$2::leave_type AND year=$3`,
      [employeeId, leaveType, currentYear]
    );

    if (bal.rows[0]) {
      const remaining = parseFloat(bal.rows[0].remaining_days ?? "0");
      if (parseFloat(numberOfDays) > remaining) {
        await client.query("ROLLBACK");
        return void res.status(422).json({
          error: "Solde insuffisant",
          code: "INSUFFICIENT_BALANCE",
          requested: parseFloat(numberOfDays),
          remaining,
        });
      }
    }

    // Lock balance and reserve pending
    if (bal.rows[0]) {
      await client.query(`
        UPDATE leave_balances SET pending_days = pending_days + $1, updated_at=NOW()
        WHERE employee_id=$2::uuid AND leave_type=$3::leave_type AND year=$4`,
        [parseFloat(numberOfDays), employeeId, leaveType, currentYear]
      );
    }

    const row = await client.query(`
      INSERT INTO leave_requests
        (employee_id, leave_type, date_from, date_to, number_of_days,
         balance_before, replacement_employee_id, reason, document_url,
         status, created_by, updated_by)
      VALUES ($1::uuid,$2::leave_type,$3::date,$4::date,$5,$6,$7,$8,$9,
              'soumise'::leave_status,$10::uuid,$10::uuid)
      RETURNING *`,
      [employeeId, leaveType, dateFrom, dateTo, parseFloat(numberOfDays),
       bal.rows[0]?.remaining_days ?? null, replacementEmployeeId ?? null,
       reason ?? null, documentUrl ?? null, act.userId]
    );

    await client.query(`
      INSERT INTO hr_audit_events (employee_id, actor_id, actor_name, action, entity_type, entity_id, new_values)
      VALUES ($1::uuid,$2::uuid,$3,'create_leave_request','leave_request',$4::uuid,$5::jsonb)`,
      [employeeId, act.userId, act.userName, row.rows[0].id,
       JSON.stringify({ leaveType, dateFrom, dateTo, numberOfDays })]);

    await client.query("COMMIT");
    res.status(201).json(row.rows[0]);
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally { client.release(); }
});

// POST /hr/leaves/:id/manager-approve
router.post("/:id/manager-approve", requirePermission("hr.leaves.manager_approve"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const act = actor(req);
    const { comment } = req.body;
    const row = await pool.query(`
      UPDATE leave_requests SET
        status='validation_rh'::leave_status,
        manager_approved_at=NOW(), manager_id=$1::uuid, manager_comment=$2,
        updated_at=NOW(), updated_by=$1::uuid
      WHERE id=$3::uuid AND deleted_at IS NULL AND status IN ('soumise','validation_manager')
      RETURNING *`,
      [act.userId, comment ?? null, req.params.id]
    );
    if (!row.rows[0]) return void res.status(404).json({ error: "Demande non trouvée ou statut invalide" });
    res.json(row.rows[0]);
  } catch (err) { next(err); }
});

// POST /hr/leaves/:id/hr-approve
router.post("/:id/hr-approve", requirePermission("hr.leaves.hr_approve"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const act = actor(req);
    const { comment } = req.body;

    const lr = await client.query(
      `SELECT * FROM leave_requests WHERE id=$1::uuid AND deleted_at IS NULL FOR UPDATE`, [req.params.id]
    );
    if (!lr.rows[0]) { await client.query("ROLLBACK"); return void res.status(404).json({ error: "Demande non trouvée" }); }
    if (!["soumise","validation_manager","validation_rh"].includes(lr.rows[0].status)) {
      await client.query("ROLLBACK");
      return void res.status(422).json({ error: "Statut invalide pour approbation RH" });
    }

    const currentYear = new Date(lr.rows[0].date_from).getFullYear();
    const nd = parseFloat(lr.rows[0].number_of_days);

    // Re-check balance under lock
    const bal = await client.query(
      `SELECT * FROM leave_balances WHERE employee_id=$1::uuid AND leave_type=$2::leave_type AND year=$3 FOR UPDATE`,
      [lr.rows[0].employee_id, lr.rows[0].leave_type, currentYear]
    );
    if (bal.rows[0]) {
      const actualRemaining = parseFloat(bal.rows[0].remaining_days ?? "0");
      if (nd > actualRemaining + parseFloat(bal.rows[0].pending_days ?? "0")) {
        await client.query("ROLLBACK");
        return void res.status(422).json({ error: "Solde insuffisant au moment de l'approbation" });
      }
      // Move from pending to used
      await client.query(`
        UPDATE leave_balances SET
          used_days = used_days + $1,
          pending_days = GREATEST(0, pending_days - $1),
          updated_at=NOW()
        WHERE employee_id=$2::uuid AND leave_type=$3::leave_type AND year=$4`,
        [nd, lr.rows[0].employee_id, lr.rows[0].leave_type, currentYear]
      );
    }

    const balAfter = bal.rows[0]
      ? parseFloat(bal.rows[0].total_days) - parseFloat(bal.rows[0].used_days) - nd
      : null;

    const row = await client.query(`
      UPDATE leave_requests SET
        status='approuvee'::leave_status,
        hr_approved_at=NOW(), hr_comment=$1,
        balance_after=$2, approved_by=$3::uuid,
        updated_at=NOW(), updated_by=$3::uuid
      WHERE id=$4::uuid
      RETURNING *`,
      [comment ?? null, balAfter, act.userId, req.params.id]
    );

    await client.query(`
      INSERT INTO hr_audit_events (employee_id, actor_id, actor_name, action, entity_type, entity_id, new_values)
      VALUES ($1::uuid,$2::uuid,$3,'approve_leave','leave_request',$4::uuid,$5::jsonb)`,
      [lr.rows[0].employee_id, act.userId, act.userName, req.params.id,
       JSON.stringify({ status: "approuvee", balanceAfter: balAfter })]);

    await client.query("COMMIT");
    res.json(row.rows[0]);
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally { client.release(); }
});

// POST /hr/leaves/:id/reject
router.post("/:id/reject", requirePermission("hr.leaves.hr_approve"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const act = actor(req);
    const { comment } = req.body;

    const lr = await client.query(`SELECT * FROM leave_requests WHERE id=$1::uuid FOR UPDATE`, [req.params.id]);
    if (!lr.rows[0]) { await client.query("ROLLBACK"); return void res.status(404).json({ error: "Demande non trouvée" }); }

    // Release pending days
    const currentYear = new Date(lr.rows[0].date_from).getFullYear();
    await client.query(`
      UPDATE leave_balances SET pending_days = GREATEST(0, pending_days - $1), updated_at=NOW()
      WHERE employee_id=$2::uuid AND leave_type=$3::leave_type AND year=$4`,
      [parseFloat(lr.rows[0].number_of_days), lr.rows[0].employee_id, lr.rows[0].leave_type, currentYear]
    );

    const isManager = req.auth?.permissions?.includes("hr.leaves.manager_approve");
    const row = await client.query(`
      UPDATE leave_requests SET
        status='rejetee'::leave_status,
        ${isManager ? "manager_rejected_at=NOW(), manager_comment" : "hr_rejected_at=NOW(), hr_comment"}=$1,
        updated_at=NOW(), updated_by=$2::uuid
      WHERE id=$3::uuid RETURNING *`,
      [comment ?? null, act.userId, req.params.id]
    );

    await client.query("COMMIT");
    res.json(row.rows[0]);
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally { client.release(); }
});

// POST /hr/leaves/:id/cancel
router.post("/:id/cancel", requirePermission("hr.leaves.create"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const act = actor(req);
    const lr = await client.query(`SELECT * FROM leave_requests WHERE id=$1::uuid FOR UPDATE`, [req.params.id]);
    if (!lr.rows[0]) { await client.query("ROLLBACK"); return void res.status(404).json({ error: "Demande non trouvée" }); }

    if (lr.rows[0].status === "approuvee") {
      // Return used days to balance
      const currentYear = new Date(lr.rows[0].date_from).getFullYear();
      await client.query(`
        UPDATE leave_balances SET used_days = GREATEST(0, used_days - $1), updated_at=NOW()
        WHERE employee_id=$2::uuid AND leave_type=$3::leave_type AND year=$4`,
        [parseFloat(lr.rows[0].number_of_days), lr.rows[0].employee_id, lr.rows[0].leave_type, currentYear]
      );
    } else {
      // Release pending
      const currentYear = new Date(lr.rows[0].date_from).getFullYear();
      await client.query(`
        UPDATE leave_balances SET pending_days = GREATEST(0, pending_days - $1), updated_at=NOW()
        WHERE employee_id=$2::uuid AND leave_type=$3::leave_type AND year=$4`,
        [parseFloat(lr.rows[0].number_of_days), lr.rows[0].employee_id, lr.rows[0].leave_type, currentYear]
      );
    }

    await client.query(`UPDATE leave_requests SET status='annulee'::leave_status, updated_at=NOW(), updated_by=$1::uuid WHERE id=$2::uuid`,
      [act.userId, req.params.id]);
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally { client.release(); }
});

// GET /hr/leaves/balances — all balances
router.get("/balances", requirePermission("hr.leaves.view"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const { employee_id, year } = req.query as Record<string, string>;
    const conds: string[] = [];
    const params: any[] = [];
    let pi = 1;
    if (employee_id) { conds.push(`lb.employee_id=$${pi++}::uuid`); params.push(employee_id); }
    if (year) { conds.push(`lb.year=$${pi++}`); params.push(parseInt(year)); }
    const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
    const rows = await pool.query(`
      SELECT lb.*, e.first_name || ' ' || e.last_name AS employee_name, e.matricule
      FROM leave_balances lb
      JOIN employees e ON e.id = lb.employee_id
      ${where} ORDER BY e.last_name, lb.leave_type`, params);
    res.json(rows.rows);
  } catch (err) { next(err); }
});

export default router;
