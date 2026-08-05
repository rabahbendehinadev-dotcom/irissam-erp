import { Router } from 'express';
import { pool } from '@workspace/db';
import { requirePermission } from '../../middleware/requirePermission';
import type { AuthenticatedRequest } from '../../middleware/requireAuth';

const router = Router();

// GET /api/payroll/dashboard
router.get('/dashboard', requirePermission('payroll.dashboard.view'), async (req: AuthenticatedRequest, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;

    // Get latest run
    const latestRunRes = await pool.query(
      `SELECT pr.*, pp.month, pp.year FROM payroll_runs pr
       JOIN payroll_periods pp ON pp.id = pr.period_id
       WHERE pr.deleted_at IS NULL AND pr.status != 'cancelled'
       ORDER BY pp.year DESC, pp.month DESC LIMIT 1`,
    );
    const latestRun = latestRunRes.rows[0];

    const [kpis, monthlySalary, byDept, anomalies, activeAdvances, activeLoans] = await Promise.allSettled([
      // KPIs from latest run
      latestRun ? pool.query(
        `SELECT total_brut, total_net, total_employees,
                total_earnings, total_deductions, total_advances, total_loans,
                total_anomalies, total_critical_anomalies,
                total_tax, total_social_sec
         FROM payroll_runs WHERE id = $1`,
        [latestRun.id],
      ) : Promise.resolve({ rows: [{}] }),

      // Monthly salary trend (12 months)
      pool.query(
        `SELECT pp.month, pp.year, pr.total_brut, pr.total_net, pr.total_employees
         FROM payroll_runs pr
         JOIN payroll_periods pp ON pp.id = pr.period_id
         WHERE pr.status IN ('paid','locked','payslips_generated') AND pr.deleted_at IS NULL
           AND pp.year = $1
         ORDER BY pp.month`,
        [year],
      ),

      // By department
      pool.query(
        `SELECT d.name AS department, SUM(per.net) AS total_net, COUNT(*) AS headcount
         FROM payroll_employee_runs per
         JOIN employees e ON e.id = per.employee_id
         LEFT JOIN employee_profiles ep ON ep.employee_id = e.id
         LEFT JOIN departments d ON d.id = ep.department_id
         WHERE per.run_id = $1
         GROUP BY d.name ORDER BY total_net DESC LIMIT 10`,
        [latestRun?.id || '00000000-0000-0000-0000-000000000000'],
      ),

      // Open anomalies
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE severity = 'critical' AND resolved = false) AS critical,
                COUNT(*) FILTER (WHERE severity = 'warning' AND resolved = false) AS warning
         FROM payroll_anomalies
         WHERE run_id IN (SELECT id FROM payroll_runs WHERE status NOT IN ('paid','cancelled'))`,
      ),

      // Active advances
      pool.query(
        `SELECT COUNT(*) AS count, COALESCE(SUM(amount - deducted_amount),0) AS balance
         FROM payroll_advances WHERE status IN ('approved','partially_deducted')`,
      ),

      // Active loans
      pool.query(
        `SELECT COUNT(*) AS count, COALESCE(SUM(remaining_amount),0) AS balance
         FROM payroll_loans WHERE status = 'active'`,
      ),
    ]);

    const kpisData = kpis.status === 'fulfilled' ? kpis.value.rows[0] : {};
    const prevRunRes = await pool.query(
      `SELECT total_net FROM payroll_runs pr
       JOIN payroll_periods pp ON pp.id = pr.period_id
       WHERE pr.status IN ('paid','locked') AND pr.deleted_at IS NULL
       ORDER BY pp.year DESC, pp.month DESC LIMIT 1 OFFSET 1`,
    );
    const prevNet = parseFloat(prevRunRes.rows[0]?.total_net || 0);
    const currNet = parseFloat(kpisData?.total_net || 0);
    const variation = prevNet > 0 ? ((currNet - prevNet) / prevNet * 100).toFixed(1) : null;

    res.json({
      latestRun,
      kpis: {
        ...kpisData,
        variation_vs_previous: variation,
      },
      anomalies: anomalies.status === 'fulfilled' ? anomalies.value.rows[0] : {},
      activeAdvances: activeAdvances.status === 'fulfilled' ? activeAdvances.value.rows[0] : {},
      activeLoans: activeLoans.status === 'fulfilled' ? activeLoans.value.rows[0] : {},
      charts: {
        monthlySalary: monthlySalary.status === 'fulfilled' ? monthlySalary.value.rows : [],
        byDepartment: byDept.status === 'fulfilled' ? byDept.value.rows : [],
      },
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
