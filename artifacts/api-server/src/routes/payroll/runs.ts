import { Router } from 'express';
import { pool } from '@workspace/db';
import { requirePermission } from '../../middleware/requirePermission';
import type { AuthenticatedRequest } from '../../middleware/requireAuth';
import { calculateEmployee } from './engine.js';

const router = Router();

// GET /api/payroll/runs
router.get('/runs', requirePermission('payroll.periods.view'), async (req: AuthenticatedRequest, res) => {
  try {
    const { periodId, status, limit = 20, offset = 0 } = req.query;
    const cond: string[] = ['pr.deleted_at IS NULL'];
    const params: any[] = [];
    if (periodId) { params.push(periodId); cond.push(`pr.period_id = $${params.length}`); }
    if (status)   { params.push(status);   cond.push(`pr.status = $${params.length}`); }
    params.push(limit); params.push(offset);
    const rows = await pool.query(
      `SELECT pr.*, pp.month, pp.year, pp.start_date, pp.end_date
       FROM payroll_runs pr
       JOIN payroll_periods pp ON pp.id = pr.period_id
       WHERE ${cond.join(' AND ')}
       ORDER BY pr.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    res.json({ data: rows.rows, total: rows.rowCount });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/payroll/runs/:id
router.get('/runs/:id', requirePermission('payroll.periods.view'), async (req: AuthenticatedRequest, res) => {
  try {
    const r = await pool.query(
      `SELECT pr.*, pp.month, pp.year, pp.start_date, pp.end_date, pp.payment_date
       FROM payroll_runs pr
       JOIN payroll_periods pp ON pp.id = pr.period_id
       WHERE pr.id = $1 AND pr.deleted_at IS NULL`,
      [req.params.id],
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    const run = r.rows[0];

    // Employee runs with anomaly summary
    const empRuns = await pool.query(
      `SELECT per.*, e.matricule, e.first_name, e.last_name, e.status AS emp_status,
              d.name AS department_name, pos.name AS position_name
       FROM payroll_employee_runs per
       JOIN employees e ON e.id = per.employee_id
       LEFT JOIN employee_profiles ep ON ep.employee_id = e.id
       LEFT JOIN departments d ON d.id = ep.department_id
       LEFT JOIN employee_positions pos ON pos.id = ep.position_id
       WHERE per.run_id = $1
       ORDER BY e.last_name, e.first_name`,
      [req.params.id],
    );
    run.employee_runs = empRuns.rows;

    // Anomalies
    const anomalies = await pool.query(
      `SELECT pa.*, e.matricule, e.first_name, e.last_name
       FROM payroll_anomalies pa
       LEFT JOIN employees e ON e.id = pa.employee_id
       WHERE pa.run_id = $1 ORDER BY pa.severity DESC, pa.created_at`,
      [req.params.id],
    );
    run.anomalies = anomalies.rows;

    res.json(run);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/payroll/runs — create run
router.post('/runs', requirePermission('payroll.runs.create'), async (req: AuthenticatedRequest, res) => {
  try {
    const { periodId, label } = req.body;
    if (!periodId) return res.status(400).json({ error: 'periodId is required' });
    const period = await pool.query(`SELECT * FROM payroll_periods WHERE id = $1 AND deleted_at IS NULL`, [periodId]);
    if (!period.rows.length) return res.status(404).json({ error: 'Period not found' });
    if (['locked', 'paid', 'cancelled'].includes(period.rows[0].status))
      return res.status(409).json({ error: 'Période non modifiable' });

    const r = await pool.query(
      `INSERT INTO payroll_runs (period_id, label, status, created_by, updated_by)
       VALUES ($1,$2,'draft',$3,$3) RETURNING *`,
      [periodId, label || `Run ${new Date().toISOString()}`, req.auth!.userId],
    );
    await pool.query(
      `INSERT INTO payroll_audit_events (user_id, user_role, action, entity_type, entity_id, run_id, period_id)
       VALUES ($1,$2,'create_run','payroll_runs',$3,$3,$4)`,
      [req.auth!.userId, req.auth!.role, r.rows[0].id, periodId],
    );
    res.status(201).json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/payroll/runs/:id/collect — collect HR data
router.post('/runs/:id/collect', requirePermission('payroll.runs.calculate'), async (req: AuthenticatedRequest, res) => {
  try {
    const run = await getRun(req.params.id);
    if (!run) return res.status(404).json({ error: 'Not found' });
    if (!['draft', 'calculated'].includes(run.status))
      return res.status(409).json({ error: 'Run must be in draft or calculated status' });

    // Collect all active employees for the period
    const empRes = await pool.query(
      `SELECT DISTINCT e.id
       FROM employees e
       JOIN employee_contracts ec ON ec.employee_id = e.id
       WHERE e.status = 'active'
         AND e.deleted_at IS NULL
         AND ec.status = 'active'
         AND ec.deleted_at IS NULL`,
    );

    await pool.query(
      `UPDATE payroll_runs SET status = 'collecting_data', data_collected_at = now(), data_collected_by = $1,
       total_employees = $2, updated_at = now(), updated_by = $1, version = version + 1
       WHERE id = $3`,
      [req.auth!.userId, empRes.rowCount, req.params.id],
    );
    await auditRun(req.params.id, run.period_id, req.auth!.userId, req.auth!.role, 'collect_data', { employeeCount: empRes.rowCount });
    res.json({ success: true, employeeCount: empRes.rowCount });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/payroll/runs/:id/calculate
router.post('/runs/:id/calculate', requirePermission('payroll.runs.calculate'), async (req: AuthenticatedRequest, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const runRes = await client.query(
      `SELECT pr.*, pp.start_date, pp.end_date, pp.id AS period_id
       FROM payroll_runs pr JOIN payroll_periods pp ON pp.id = pr.period_id
       WHERE pr.id = $1 AND pr.deleted_at IS NULL`,
      [req.params.id],
    );
    if (!runRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
    const run = runRes.rows[0];
    if (!['draft', 'collecting_data', 'calculated'].includes(run.status)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Cannot recalculate a run in status: ' + run.status });
    }

    // Clear old anomalies
    await client.query(`DELETE FROM payroll_anomalies WHERE run_id = $1`, [req.params.id]);

    // Get employees
    const empRes = await client.query(
      `SELECT DISTINCT e.id
       FROM employees e
       WHERE e.status = 'active' AND e.deleted_at IS NULL`,
    );

    const results: Array<{ employeeId: string; employeeRunId: string; success: boolean }> = [];
    let totalBrut = 0, totalNet = 0, totalEarnings = 0, totalDeductions = 0;
    let totalTax = 0, totalSS = 0, totalAdvances = 0, totalLoans = 0;
    let totalAnomalies = 0, totalCritical = 0;

    for (const emp of empRes.rows) {
      try {
        const result = await calculateEmployee(client, req.params.id, emp.id, run.period_id, req.auth!.userId);
        results.push({ employeeId: emp.id, employeeRunId: result.employeeRunId, success: result.success });
        totalAnomalies += result.anomalies.length;
        totalCritical += result.anomalies.filter(a => a.severity === 'critical').length;
      } catch (calcErr: any) {
        await client.query(
          `INSERT INTO payroll_anomalies (run_id, employee_id, code, message, severity)
           VALUES ($1,$2,'CALC_ERROR',$3,'critical') ON CONFLICT DO NOTHING`,
          [req.params.id, emp.id, `Erreur calcul: ${calcErr.message}`],
        );
        totalCritical++;
      }
    }

    // Sum totals from employee runs
    const totals = await client.query(
      `SELECT COALESCE(SUM(brut),0) AS brut, COALESCE(SUM(net),0) AS net,
              COALESCE(SUM(total_earnings),0) AS earnings, COALESCE(SUM(total_deductions),0) AS deductions,
              COALESCE(SUM(tax),0) AS tax, COALESCE(SUM(cotisations),0) AS ss,
              COALESCE(SUM(total_advances),0) AS advances, COALESCE(SUM(total_loans),0) AS loans,
              COUNT(*) AS emp_count
       FROM payroll_employee_runs WHERE run_id = $1`,
      [req.params.id],
    );
    const t = totals.rows[0];

    await client.query(
      `UPDATE payroll_runs SET
         status = 'calculated', calculated_at = now(), calculated_by = $1,
         total_employees = $2, total_brut = $3, total_net = $4,
         total_earnings = $5, total_deductions = $6, total_tax = $7,
         total_social_sec = $8, total_advances = $9, total_loans = $10,
         total_anomalies = $11, total_critical_anomalies = $12,
         updated_at = now(), updated_by = $1, version = version + 1
       WHERE id = $13`,
      [
        req.auth!.userId, parseInt(t.emp_count),
        t.brut, t.net, t.earnings, t.deductions, t.tax, t.ss, t.advances, t.loans,
        totalAnomalies, totalCritical, req.params.id,
      ],
    );

    await client.query('COMMIT');
    await auditRun(req.params.id, run.period_id, req.auth!.userId, req.auth!.role, 'calculate', {
      employeeCount: empRes.rowCount, totalBrut: t.brut, totalNet: t.net, totalCritical,
    });
    res.json({ success: true, employeeCount: empRes.rowCount, totalAnomalies, totalCritical, totalBrut: t.brut, totalNet: t.net });
  } catch (e: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// POST /api/payroll/runs/:id/review
router.post('/runs/:id/review', requirePermission('payroll.runs.review'), async (req: AuthenticatedRequest, res) => {
  try {
    const run = await getRun(req.params.id);
    if (!run) return res.status(404).json({ error: 'Not found' });
    if (run.status !== 'calculated') return res.status(409).json({ error: 'Run must be calculated first' });
    await pool.query(
      `UPDATE payroll_runs SET status = 'under_review', reviewed_at = now(), reviewed_by = $1, updated_at = now(), updated_by = $1, version = version + 1 WHERE id = $2`,
      [req.auth!.userId, req.params.id],
    );
    await auditRun(req.params.id, run.period_id, req.auth!.userId, req.auth!.role, 'review');
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/payroll/runs/:id/hr-approve
router.post('/runs/:id/hr-approve', requirePermission('payroll.runs.hr_approve'), async (req: AuthenticatedRequest, res) => {
  try {
    const run = await getRun(req.params.id);
    if (!run) return res.status(404).json({ error: 'Not found' });
    if (run.status !== 'under_review') return res.status(409).json({ error: 'Run must be under review' });
    if (run.total_critical_anomalies > 0)
      return res.status(409).json({ error: `${run.total_critical_anomalies} anomalie(s) critique(s) non résolue(s)` });
    const { comment } = req.body;
    await pool.query(
      `UPDATE payroll_runs SET status = 'hr_approved', hr_approved_at = now(), hr_approved_by = $1,
       hr_approval_comment = $2, updated_at = now(), updated_by = $1, version = version + 1 WHERE id = $3`,
      [req.auth!.userId, comment || null, req.params.id],
    );
    await auditRun(req.params.id, run.period_id, req.auth!.userId, req.auth!.role, 'hr_approve', { comment });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/payroll/runs/:id/finance-approve
router.post('/runs/:id/finance-approve', requirePermission('payroll.runs.finance_approve'), async (req: AuthenticatedRequest, res) => {
  try {
    const run = await getRun(req.params.id);
    if (!run) return res.status(404).json({ error: 'Not found' });
    if (run.status !== 'hr_approved') return res.status(409).json({ error: 'Run must be HR approved first' });
    const { comment } = req.body;
    await pool.query(
      `UPDATE payroll_runs SET status = 'finance_approved', finance_approved_at = now(), finance_approved_by = $1,
       finance_approval_comment = $2, updated_at = now(), updated_by = $1, version = version + 1 WHERE id = $3`,
      [req.auth!.userId, comment || null, req.params.id],
    );
    await auditRun(req.params.id, run.period_id, req.auth!.userId, req.auth!.role, 'finance_approve', { comment });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/payroll/runs/:id/lock
router.post('/runs/:id/lock', requirePermission('payroll.runs.lock'), async (req: AuthenticatedRequest, res) => {
  try {
    const run = await getRun(req.params.id);
    if (!run) return res.status(404).json({ error: 'Not found' });
    if (run.status !== 'finance_approved') return res.status(409).json({ error: 'Run must be Finance approved first' });
    await pool.query(
      `UPDATE payroll_runs SET status = 'locked', locked_at = now(), locked_by = $1,
       updated_at = now(), updated_by = $1, version = version + 1 WHERE id = $2`,
      [req.auth!.userId, req.params.id],
    );
    await auditRun(req.params.id, run.period_id, req.auth!.userId, req.auth!.role, 'lock_run');
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/payroll/runs/:id/generate-payslips
router.post('/runs/:id/generate-payslips', requirePermission('payroll.runs.lock'), async (req: AuthenticatedRequest, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const runRes = await client.query(
      `SELECT pr.*, pp.month, pp.year FROM payroll_runs pr JOIN payroll_periods pp ON pp.id = pr.period_id WHERE pr.id = $1`,
      [req.params.id],
    );
    if (!runRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
    const run = runRes.rows[0];
    if (run.status !== 'locked') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Run must be locked' }); }

    const empRuns = await client.query(
      `SELECT per.id, per.employee_id, e.matricule, e.first_name, e.last_name
       FROM payroll_employee_runs per
       JOIN employees e ON e.id = per.employee_id
       WHERE per.run_id = $1 AND per.excluded = false`,
      [req.params.id],
    );

    const periodLabel = `${String(run.month).padStart(2, '0')}/${run.year}`;
    let generated = 0;
    for (const er of empRuns.rows) {
      const slipNum = `BS-${run.year}-${String(run.month).padStart(2, '0')}-${er.matricule || er.employee_id.slice(0, 8).toUpperCase()}`;
      await client.query(
        `INSERT INTO payroll_payslips (employee_run_id, run_id, employee_id, payslip_number, period_label, generated_by, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$6,$6)
         ON CONFLICT (employee_run_id) DO UPDATE SET generated_at = now(), updated_at = now()`,
        [er.id, req.params.id, er.employee_id, slipNum, periodLabel, req.auth!.userId],
      );
      generated++;
    }

    await client.query(
      `UPDATE payroll_runs SET status = 'payslips_generated', payslips_generated_at = now(), payslips_generated_by = $1,
       updated_at = now(), updated_by = $1, version = version + 1 WHERE id = $2`,
      [req.auth!.userId, req.params.id],
    );
    await client.query('COMMIT');
    await auditRun(req.params.id, run.period_id, req.auth!.userId, req.auth!.role, 'generate_payslips', { generated });
    res.json({ success: true, generated });
  } catch (e: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// POST /api/payroll/runs/:id/mark-paid
router.post('/runs/:id/mark-paid', requirePermission('payroll.runs.mark_paid'), async (req: AuthenticatedRequest, res) => {
  try {
    const run = await getRun(req.params.id);
    if (!run) return res.status(404).json({ error: 'Not found' });
    if (run.status !== 'payslips_generated') return res.status(409).json({ error: 'Payslips must be generated first' });
    // Double-payment check
    const existing = await pool.query(
      `SELECT id FROM payroll_runs WHERE period_id = $1 AND status = 'paid' AND id != $2`,
      [run.period_id, req.params.id],
    );
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Un run est déjà marqué payé pour cette période' });

    await pool.query(
      `UPDATE payroll_runs SET status = 'paid', marked_paid_at = now(), marked_paid_by = $1,
       updated_at = now(), updated_by = $1, version = version + 1 WHERE id = $2`,
      [req.auth!.userId, req.params.id],
    );
    await pool.query(
      `UPDATE payroll_periods SET status = 'paid', paid_at = now(), paid_by = $1 WHERE id = $2`,
      [req.auth!.userId, run.period_id],
    );
    await auditRun(req.params.id, run.period_id, req.auth!.userId, req.auth!.role, 'mark_paid');
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/payroll/runs/:id/anomalies
router.get('/runs/:id/anomalies', requirePermission('payroll.runs.review'), async (req: AuthenticatedRequest, res) => {
  try {
    const r = await pool.query(
      `SELECT pa.*, e.matricule, e.first_name, e.last_name
       FROM payroll_anomalies pa
       LEFT JOIN employees e ON e.id = pa.employee_id
       WHERE pa.run_id = $1
       ORDER BY pa.severity DESC, e.last_name`,
      [req.params.id],
    );
    res.json({ data: r.rows });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/payroll/runs/:runId/anomalies/:anomalyId/resolve
router.patch('/runs/:runId/anomalies/:anomalyId/resolve', requirePermission('payroll.runs.review'), async (req: AuthenticatedRequest, res) => {
  try {
    const { note } = req.body;
    const r = await pool.query(
      `UPDATE payroll_anomalies SET resolved = true, resolved_by = $1, resolved_at = now(), resolution_note = $2 WHERE id = $3 RETURNING *`,
      [req.auth!.userId, note || null, req.params.anomalyId],
    );
    // Recompute critical count
    const crit = await pool.query(
      `SELECT COUNT(*) FROM payroll_anomalies WHERE run_id = $1 AND severity = 'critical' AND resolved = false`,
      [req.params.runId],
    );
    await pool.query(`UPDATE payroll_runs SET total_critical_anomalies = $1 WHERE id = $2`, [parseInt(crit.rows[0].count), req.params.runId]);
    res.json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/payroll/employees/:id — employee payroll profile (sensitive)
router.get('/employees/:id', requirePermission('payroll.view_sensitive'), async (req: AuthenticatedRequest, res) => {
  try {
    // Allow employee to see own data
    const empRes = await pool.query(
      `SELECT e.*, ec.salary_base, ec.type AS contract_type, ec.status AS contract_status,
              ep.department_id, ep.position_id, d.name AS department, pos.name AS position,
              ep.payment_method, ep.bank_account_number
       FROM employees e
       LEFT JOIN employee_contracts ec ON ec.employee_id = e.id AND ec.status = 'active'
       LEFT JOIN employee_profiles ep ON ep.employee_id = e.id
       LEFT JOIN departments d ON d.id = ep.department_id
       LEFT JOIN employee_positions pos ON pos.id = ep.position_id
       WHERE e.id = $1 AND e.deleted_at IS NULL
       LIMIT 1`,
      [req.params.id],
    );
    if (!empRes.rows.length) return res.status(404).json({ error: 'Not found' });
    const emp = empRes.rows[0];

    // Last 6 payslips
    const slips = await pool.query(
      `SELECT ps.*, pp.month, pp.year, per.net, per.brut
       FROM payroll_payslips ps
       JOIN payroll_employee_runs per ON per.id = ps.employee_run_id
       JOIN payroll_runs pr ON pr.id = ps.run_id
       JOIN payroll_periods pp ON pp.id = pr.period_id
       WHERE ps.employee_id = $1
       ORDER BY pp.year DESC, pp.month DESC LIMIT 6`,
      [req.params.id],
    );
    emp.recent_payslips = slips.rows;

    // Active advances
    const advances = await pool.query(
      `SELECT * FROM payroll_advances WHERE employee_id = $1 AND status IN ('approved','partially_deducted') ORDER BY created_at DESC`,
      [req.params.id],
    );
    emp.active_advances = advances.rows;

    // Active loans
    const loans = await pool.query(
      `SELECT * FROM payroll_loans WHERE employee_id = $1 AND status = 'active' ORDER BY created_at DESC`,
      [req.params.id],
    );
    emp.active_loans = loans.rows;

    res.json(emp);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Helpers
async function getRun(id: string) {
  const r = await pool.query(`SELECT * FROM payroll_runs WHERE id = $1 AND deleted_at IS NULL`, [id]);
  return r.rows[0] || null;
}
async function auditRun(runId: string, periodId: string, userId: string, role: string, action: string, meta?: any) {
  await pool.query(
    `INSERT INTO payroll_audit_events (user_id, user_role, action, entity_type, entity_id, run_id, period_id, metadata)
     VALUES ($1,$2,$3,'payroll_runs',$4,$4,$5,$6)`,
    [userId, role, action, runId, periodId, meta ? JSON.stringify(meta) : null],
  );
}

export default router;
