import { Router } from 'express';
import { pool } from '@workspace/db';
import { requirePermission } from '../../middleware/requirePermission';
import type { AuthenticatedRequest } from '../../middleware/requireAuth';

const router = Router();

router.get('/advances', requirePermission('payroll.advances.view'), async (req: AuthenticatedRequest, res) => {
  try {
    const { employeeId, status, limit = 50, offset = 0 } = req.query;
    const cond: string[] = ['pa.deleted_at IS NULL'];
    const params: any[] = [];
    // Employee sees own data only
    if (req.auth!.role === 'employee') {
      const emp = await pool.query(`SELECT id FROM employees WHERE linked_user_id = $1 LIMIT 1`, [req.auth!.userId]);
      if (!emp.rows.length) return res.json({ data: [], total: 0 });
      params.push(emp.rows[0].id); cond.push(`pa.employee_id = $${params.length}`);
    } else if (employeeId) {
      params.push(employeeId); cond.push(`pa.employee_id = $${params.length}`);
    }
    if (status) { params.push(status); cond.push(`pa.status = $${params.length}`); }
    params.push(limit); params.push(offset);
    const r = await pool.query(
      `SELECT pa.*, e.matricule, e.first_name, e.last_name, pp.month, pp.year
       FROM payroll_advances pa
       JOIN employees e ON e.id = pa.employee_id
       LEFT JOIN payroll_periods pp ON pp.id = pa.deduction_period_id
       WHERE ${cond.join(' AND ')}
       ORDER BY pa.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    res.json({ data: r.rows, total: r.rowCount });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/advances', requirePermission('payroll.advances.manage'), async (req: AuthenticatedRequest, res) => {
  try {
    const { employeeId, amount, deductionPeriodId, reason } = req.body;
    if (!employeeId || !amount) return res.status(400).json({ error: 'employeeId, amount required' });
    if (parseFloat(amount) <= 0) return res.status(400).json({ error: 'amount must be positive' });
    const r = await pool.query(
      `INSERT INTO payroll_advances (employee_id, amount, deduction_period_id, reason, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$5) RETURNING *`,
      [employeeId, amount, deductionPeriodId || null, reason || null, req.auth!.userId],
    );
    await pool.query(
      `INSERT INTO payroll_audit_events (user_id,user_role,action,entity_type,entity_id,employee_id,after_state)
       VALUES ($1,$2,'create_advance','payroll_advances',$3,$4,$5)`,
      [req.auth!.userId, req.auth!.role, r.rows[0].id, employeeId, JSON.stringify(r.rows[0])],
    );
    res.status(201).json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch('/advances/:id/approve', requirePermission('payroll.advances.manage'), async (req: AuthenticatedRequest, res) => {
  try {
    const r = await pool.query(
      `UPDATE payroll_advances SET status = 'approved', approved_by = $1, approved_at = now(), updated_at = now(), version = version + 1 WHERE id = $2 AND status = 'pending' RETURNING *`,
      [req.auth!.userId, req.params.id],
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found or not pending' });
    res.json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch('/advances/:id/reject', requirePermission('payroll.advances.manage'), async (req: AuthenticatedRequest, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'reason is required' });
    const r = await pool.query(
      `UPDATE payroll_advances SET status = 'rejected', rejection_reason = $1, updated_at = now(), version = version + 1 WHERE id = $2 AND status = 'pending' RETURNING *`,
      [reason, req.params.id],
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found or not pending' });
    res.json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
