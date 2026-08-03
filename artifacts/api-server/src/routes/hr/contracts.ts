/**
 * /api/hr/contracts — Contract CRUD + renew/terminate/suspend
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();
function actor(req: AuthenticatedRequest) {
  return { userId: req.auth?.userId ?? "system", userName: req.auth?.userId ?? "system" };
}
async function nextContractNumber(client: any): Promise<string> {
  const { rows } = await client.query("SELECT nextval('contract_number_seq') AS n");
  return `CTR-${new Date().getFullYear()}-${String(rows[0].n).padStart(4, "0")}`;
}

// GET /hr/contracts — list
router.get("/", requirePermission("hr.contracts.view"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const { status, employee_id, expiring_days, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const conds: string[] = ["c.deleted_at IS NULL"];
    const params: any[] = [];
    let pi = 1;
    if (status) { conds.push(`c.status = $${pi++}::contract_status`); params.push(status); }
    if (employee_id) { conds.push(`c.employee_id = $${pi++}::uuid`); params.push(employee_id); }
    if (expiring_days) {
      conds.push(`c.end_date IS NOT NULL AND c.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + ($${pi++} || ' days')::INTERVAL`);
      params.push(parseInt(expiring_days));
    }
    const rows = await pool.query(`
      SELECT c.*,
        e.first_name || ' ' || e.last_name AS employee_name,
        e.matricule,
        CASE WHEN c.end_date IS NOT NULL THEN (c.end_date - CURRENT_DATE) ELSE NULL END AS days_remaining
      FROM employee_contracts c
      JOIN employees e ON e.id = c.employee_id
      WHERE ${conds.join(" AND ")}
      ORDER BY c.start_date DESC
      LIMIT $${pi} OFFSET $${pi+1}`,
      [...params, parseInt(limit), parseInt(offset)]
    );
    const tot = await pool.query(
      `SELECT COUNT(*) AS total FROM employee_contracts c WHERE ${conds.join(" AND ")}`,
      params
    );
    res.json({ data: rows.rows, total: parseInt(tot.rows[0].total) });
  } catch (err) { next(err); }
});

// POST /hr/contracts — create
router.post("/", requirePermission("hr.contracts.create"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const act = actor(req);
    const { employeeId, type, status, startDate, endDate, trialEndDate, isFullTime, weeklyHours, salaryBase, notes, documentUrl } = req.body;
    if (!employeeId || !type || !startDate) {
      await client.query("ROLLBACK");
      return void res.status(400).json({ error: "employeeId, type, startDate requis" });
    }
    const contractNumber = await nextContractNumber(client);
    const row = await client.query(`
      INSERT INTO employee_contracts
        (contract_number, employee_id, type, status, start_date, end_date,
         trial_end_date, is_full_time, weekly_hours, salary_base, notes, document_url,
         created_by, updated_by)
      VALUES ($1,$2::uuid,$3::contract_type,COALESCE($4,'actif')::contract_status,
              $5,$6,$7,COALESCE($8,TRUE),$9,$10,$11,$12,$13::uuid,$13::uuid)
      RETURNING *`,
      [contractNumber, employeeId, type, status, startDate, endDate ?? null,
       trialEndDate ?? null, isFullTime, weeklyHours ?? 40, salaryBase ?? null,
       notes ?? null, documentUrl ?? null, act.userId]
    );
    await client.query(`
      INSERT INTO hr_audit_events (employee_id, actor_id, actor_name, action, entity_type, entity_id, new_values)
      VALUES ($1::uuid,$2::uuid,$3,'create_contract','contract',$4::uuid,$5::jsonb)`,
      [employeeId, act.userId, act.userName, row.rows[0].id,
       JSON.stringify({ contractNumber, type, startDate })]);
    await client.query("COMMIT");
    res.status(201).json(row.rows[0]);
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally { client.release(); }
});

// PATCH /hr/contracts/:id — update
router.patch("/:id", requirePermission("hr.contracts.update"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const act = actor(req);
    const { status, endDate, notes, documentUrl } = req.body;
    await pool.query(`
      UPDATE employee_contracts SET
        status = COALESCE($1::contract_status, status),
        end_date = COALESCE($2, end_date),
        notes = COALESCE($3, notes),
        document_url = COALESCE($4, document_url),
        updated_at = NOW(), updated_by = $5::uuid, version = version + 1
      WHERE id = $6::uuid AND deleted_at IS NULL`,
      [status ?? null, endDate ?? null, notes ?? null, documentUrl ?? null, act.userId, id]);
    const row = await pool.query("SELECT * FROM employee_contracts WHERE id=$1::uuid", [id]);
    res.json(row.rows[0]);
  } catch (err) { next(err); }
});

// POST /hr/contracts/:id/renew — renew contract
router.post("/:id/renew", requirePermission("hr.contracts.renew"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { id } = req.params;
    const act = actor(req);
    const { startDate, endDate, salaryBase, notes } = req.body;

    const old = await client.query("SELECT * FROM employee_contracts WHERE id=$1::uuid AND deleted_at IS NULL", [id]);
    if (!old.rows[0]) { await client.query("ROLLBACK"); return void res.status(404).json({ error: "Contrat non trouvé" }); }

    // Mark old contract as renewed
    await client.query(`UPDATE employee_contracts SET status='renouvele'::contract_status, updated_at=NOW(), updated_by=$1::uuid WHERE id=$2::uuid`,
      [act.userId, id]);

    const contractNumber = await nextContractNumber(client);
    const newRow = await client.query(`
      INSERT INTO employee_contracts
        (contract_number, employee_id, type, status, start_date, end_date,
         is_full_time, weekly_hours, salary_base, notes, renewed_from_id, created_by, updated_by)
      VALUES ($1,$2::uuid,$3::contract_type,'actif'::contract_status,$4,$5,$6,$7,$8,$9,$10::uuid,$11::uuid,$11::uuid)
      RETURNING *`,
      [contractNumber, old.rows[0].employee_id, old.rows[0].type,
       startDate, endDate ?? null, old.rows[0].is_full_time, old.rows[0].weekly_hours,
       salaryBase ?? old.rows[0].salary_base, notes ?? null, id, act.userId]);

    await client.query(`
      INSERT INTO hr_audit_events (employee_id, actor_id, actor_name, action, entity_type, entity_id, new_values)
      VALUES ($1::uuid,$2::uuid,$3,'renew_contract','contract',$4::uuid,$5::jsonb)`,
      [old.rows[0].employee_id, act.userId, act.userName, newRow.rows[0].id,
       JSON.stringify({ renewedFrom: id, contractNumber })]);

    await client.query("COMMIT");
    res.status(201).json(newRow.rows[0]);
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally { client.release(); }
});

// POST /hr/contracts/:id/terminate
router.post("/:id/terminate", requirePermission("hr.contracts.update"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const act = actor(req);
    const { reason } = req.body;
    await pool.query(`
      UPDATE employee_contracts SET status='resilie'::contract_status,
        terminated_at=NOW(), termination_reason=$1,
        updated_at=NOW(), updated_by=$2::uuid
      WHERE id=$3::uuid AND deleted_at IS NULL`,
      [reason ?? null, act.userId, id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
