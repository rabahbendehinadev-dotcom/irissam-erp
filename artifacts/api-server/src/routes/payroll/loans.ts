import { Router } from 'express';
import { pool } from '@workspace/db';
import { requirePermission } from '../../middleware/requirePermission';
import type { AuthenticatedRequest } from '../../middleware/requireAuth';

const router = Router();

router.get('/loans', requirePermission('payroll.loans.view'), async (req: AuthenticatedRequest, res) => {
  try {
    const { employeeId, status, limit = 50, offset = 0 } = req.query;
    const cond: string[] = ['pl.deleted_at IS NULL'];
    const params: any[] = [];
    if (req.auth!.role === 'employee') {
      const emp = await pool.query(`SELECT id FROM employees WHERE linked_user_id = $1 LIMIT 1`, [req.auth!.userId]);
      if (!emp.rows.length) return res.json({ data: [], total: 0 });
      params.push(emp.rows[0].id); cond.push(`pl.employee_id = $${params.length}`);
    } else if (employeeId) {
      params.push(employeeId); cond.push(`pl.employee_id = $${params.length}`);
    }
    if (status) { params.push(status); cond.push(`pl.status = $${params.length}`); }
    params.push(limit); params.push(offset);
    const r = await pool.query(
      `SELECT pl.*, e.matricule, e.first_name, e.last_name
       FROM payroll_loans pl
       JOIN employees e ON e.id = pl.employee_id
       WHERE ${cond.join(' AND ')}
       ORDER BY pl.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    res.json({ data: r.rows, total: r.rowCount });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/loans/:id/installments', requirePermission('payroll.loans.view'), async (req: AuthenticatedRequest, res) => {
  try {
    const r = await pool.query(
      `SELECT pli.*, pp.month, pp.year FROM payroll_loan_installments pli
       LEFT JOIN payroll_runs pr ON pr.id = pli.run_id
       LEFT JOIN payroll_periods pp ON pp.id = pr.period_id
       WHERE pli.loan_id = $1 ORDER BY pli.installment_no`,
      [req.params.id],
    );
    res.json({ data: r.rows });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/loans', requirePermission('payroll.loans.manage'), async (req: AuthenticatedRequest, res) => {
  try {
    const { employeeId, totalAmount, installmentAmount, numberOfInstallments, startPeriodId, reason } = req.body;
    if (!employeeId || !totalAmount || !installmentAmount || !numberOfInstallments)
      return res.status(400).json({ error: 'employeeId, totalAmount, installmentAmount, numberOfInstallments required' });
    if (parseFloat(installmentAmount) > parseFloat(totalAmount))
      return res.status(400).json({ error: 'installmentAmount cannot exceed totalAmount' });
    const r = await pool.query(
      `INSERT INTO payroll_loans (employee_id, total_amount, installment_amount, number_of_installments, remaining_amount, start_period_id, reason, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$2,$5,$6,$7,$7) RETURNING *`,
      [employeeId, totalAmount, installmentAmount, numberOfInstallments, startPeriodId || null, reason || null, req.auth!.userId],
    );
    await pool.query(
      `INSERT INTO payroll_audit_events (user_id,user_role,action,entity_type,entity_id,employee_id,after_state)
       VALUES ($1,$2,'create_loan','payroll_loans',$3,$4,$5)`,
      [req.auth!.userId, req.auth!.role, r.rows[0].id, employeeId, JSON.stringify(r.rows[0])],
    );
    res.status(201).json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch('/loans/:id/approve', requirePermission('payroll.loans.manage'), async (req: AuthenticatedRequest, res) => {
  try {
    const r = await pool.query(
      `UPDATE payroll_loans SET status = 'active', approved_by = $1, approved_at = now(), updated_at = now(), version = version + 1 WHERE id = $2 AND status = 'pending' RETURNING *`,
      [req.auth!.userId, req.params.id],
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found or not pending' });
    res.json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch('/loans/:id/reject', requirePermission('payroll.loans.manage'), async (req: AuthenticatedRequest, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'reason is required' });
    const r = await pool.query(
      `UPDATE payroll_loans SET status = 'rejected', rejection_reason = $1, updated_at = now(), version = version + 1 WHERE id = $2 AND status = 'pending' RETURNING *`,
      [reason, req.params.id],
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found or not pending' });
    res.json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
