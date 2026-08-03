import { Router } from 'express';
import { pool } from '@workspace/db';
import { requirePermission } from '../../middleware/requirePermission';
import type { AuthenticatedRequest } from '../../middleware/requireAuth';

const router = Router();

// GET /api/payroll/reports?type=summary|by_dept|by_category|overtime|advances_loans&year=&month=
router.get('/reports', requirePermission('payroll.reports.view'), async (req: AuthenticatedRequest, res) => {
  try {
    const { type = 'summary', year = new Date().getFullYear(), month, runId } = req.query;

    let data: any[] = [];

    if (type === 'summary') {
      // Annual summary
      const r = await pool.query(
        `SELECT pp.month, pp.year, pr.total_employees, pr.total_brut, pr.total_net,
                pr.total_earnings, pr.total_deductions, pr.total_tax, pr.total_social_sec,
                pr.total_advances, pr.total_loans, pr.status
         FROM payroll_runs pr
         JOIN payroll_periods pp ON pp.id = pr.period_id
         WHERE pp.year = $1 AND pr.deleted_at IS NULL AND pr.status != 'cancelled'
         ORDER BY pp.month`,
        [year],
      );
      data = r.rows;

    } else if (type === 'by_dept') {
      // By department for a run/period
      const r = await pool.query(
        `SELECT d.name AS department, COUNT(*) AS headcount,
                SUM(per.salary_base) AS total_base, SUM(per.brut) AS total_brut,
                SUM(per.net) AS total_net, AVG(per.net) AS avg_net
         FROM payroll_employee_runs per
         JOIN employees e ON e.id = per.employee_id
         LEFT JOIN employee_profiles ep ON ep.employee_id = e.id
         LEFT JOIN departments d ON d.id = ep.department_id
         WHERE per.run_id = $1
         GROUP BY d.name ORDER BY total_net DESC`,
        [runId || '00000000-0000-0000-0000-000000000000'],
      );
      data = r.rows;

    } else if (type === 'overtime') {
      const r = await pool.query(
        `SELECT e.matricule, e.first_name, e.last_name,
                SUM(pol.overtime_hours) AS total_hours, SUM(pol.amount) AS total_amount
         FROM payroll_overtime_lines pol
         JOIN payroll_employee_runs per ON per.id = pol.employee_run_id
         JOIN employees e ON e.id = per.employee_id
         WHERE per.run_id = $1
         GROUP BY e.id, e.matricule, e.first_name, e.last_name
         ORDER BY total_hours DESC`,
        [runId || '00000000-0000-0000-0000-000000000000'],
      );
      data = r.rows;

    } else if (type === 'advances_loans') {
      const advances = await pool.query(
        `SELECT e.matricule, e.first_name, e.last_name,
                COALESCE(SUM(pa.amount) FILTER (WHERE pa.status IN ('approved','partially_deducted')),0) AS pending_advances,
                COALESCE(SUM(pl.remaining_amount),0) AS loan_balance
         FROM employees e
         LEFT JOIN payroll_advances pa ON pa.employee_id = e.id AND pa.deleted_at IS NULL
         LEFT JOIN payroll_loans pl ON pl.employee_id = e.id AND pl.status = 'active' AND pl.deleted_at IS NULL
         WHERE e.status = 'active' AND e.deleted_at IS NULL
         GROUP BY e.id, e.matricule, e.first_name, e.last_name
         HAVING SUM(pa.amount) > 0 OR SUM(pl.remaining_amount) > 0
         ORDER BY loan_balance DESC`,
      );
      data = advances.rows;
    }

    res.json({ data, type, year, month, runId });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/payroll/audit?runId=&employeeId=
router.get('/audit', requirePermission('payroll.view_sensitive'), async (req: AuthenticatedRequest, res) => {
  try {
    const { runId, employeeId, action, limit = 100, offset = 0 } = req.query;
    const cond: string[] = [];
    const params: any[] = [];
    if (runId)      { params.push(runId);      cond.push(`pae.run_id = $${params.length}`); }
    if (employeeId) { params.push(employeeId); cond.push(`pae.employee_id = $${params.length}`); }
    if (action)     { params.push(action);     cond.push(`pae.action = $${params.length}`); }
    const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
    params.push(limit); params.push(offset);
    const r = await pool.query(
      `SELECT pae.*, e.first_name || ' ' || e.last_name AS employee_name,
              u.first_name || ' ' || u.last_name AS user_name
       FROM payroll_audit_events pae
       LEFT JOIN employees e ON e.id = pae.employee_id
       LEFT JOIN users u ON u.id = pae.user_id
       ${where}
       ORDER BY pae.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    res.json({ data: r.rows, total: r.rowCount });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
