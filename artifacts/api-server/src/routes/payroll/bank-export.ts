import { Router } from 'express';
import { pool } from '@workspace/db';
import { requirePermission } from '../../middleware/requirePermission';
import type { AuthenticatedRequest } from '../../middleware/requireAuth';

const router = Router();

// GET /api/payroll/bank-export?runId=...&format=csv|excel
router.get('/bank-export', requirePermission('payroll.bank_export'), async (req: AuthenticatedRequest, res) => {
  try {
    const { runId, orderId, format = 'csv' } = req.query;
    if (!runId && !orderId) return res.status(400).json({ error: 'runId or orderId required' });

    const whereClause = orderId
      ? `ppoi.order_id = '${orderId}'`
      : `per.run_id = '${runId}'`;

    const rows = await pool.query(
      `SELECT e.matricule, e.first_name, e.last_name,
              COALESCE(ppoi.bank_account, ep.bank_account_number, '') AS bank_account,
              per.net AS amount,
              ps.payslip_number AS reference,
              pp.month, pp.year
       FROM payroll_employee_runs per
       JOIN employees e ON e.id = per.employee_id
       LEFT JOIN employee_profiles ep ON ep.employee_id = e.id
       LEFT JOIN payroll_payslips ps ON ps.employee_run_id = per.id
       LEFT JOIN payroll_payment_order_items ppoi ON ppoi.employee_run_id = per.id
       JOIN payroll_runs pr ON pr.id = per.run_id
       JOIN payroll_periods pp ON pp.id = pr.period_id
       WHERE ${whereClause} AND per.excluded = false AND per.net > 0
       ORDER BY e.last_name, e.first_name`,
    );

    if (format === 'csv') {
      const header = 'matricule,nom,prenom,compte_bancaire,montant_net,reference\n';
      const lines = rows.rows.map(r =>
        [r.matricule, r.last_name, r.first_name, r.bank_account, parseFloat(r.amount).toFixed(2), r.reference].join(','),
      ).join('\n');
      const filename = `export-paie-${rows.rows[0]?.year || ''}-${String(rows.rows[0]?.month || '').padStart(2, '0')}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-store');
      res.send('\uFEFF' + header + lines); // BOM for Excel FR
    } else {
      // Plain JSON for flexibility
      res.json({ data: rows.rows, count: rows.rowCount });
    }

    // Log export
    await pool.query(
      `INSERT INTO payroll_audit_events (user_id,user_role,action,entity_type,metadata) VALUES ($1,$2,'bank_export','payroll_bank_exports',$3)`,
      [req.auth!.userId, req.auth!.role, JSON.stringify({ runId, orderId, format, recordCount: rows.rowCount })],
    );
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
