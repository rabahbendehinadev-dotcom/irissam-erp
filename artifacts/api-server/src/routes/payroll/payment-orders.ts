import { Router } from 'express';
import { pool } from '@workspace/db';
import { requirePermission } from '../../middleware/requirePermission';
import type { AuthenticatedRequest } from '../../middleware/requireAuth';

const router = Router();

router.get('/payment-orders', requirePermission('payroll.payment_orders.view'), async (req: AuthenticatedRequest, res) => {
  try {
    const { runId, status } = req.query;
    const cond: string[] = ['ppo.deleted_at IS NULL'];
    const params: any[] = [];
    if (runId)  { params.push(runId);  cond.push(`ppo.run_id = $${params.length}`); }
    if (status) { params.push(status); cond.push(`ppo.status = $${params.length}`); }
    const r = await pool.query(
      `SELECT ppo.*, pp.month, pp.year FROM payroll_payment_orders ppo
       JOIN payroll_runs pr ON pr.id = ppo.run_id
       JOIN payroll_periods pp ON pp.id = pr.period_id
       WHERE ${cond.join(' AND ')} ORDER BY ppo.created_at DESC`,
      params,
    );
    res.json({ data: r.rows });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/payment-orders/:id', requirePermission('payroll.payment_orders.view'), async (req: AuthenticatedRequest, res) => {
  try {
    const r = await pool.query(
      `SELECT ppo.* FROM payroll_payment_orders ppo WHERE ppo.id = $1 AND ppo.deleted_at IS NULL`, [req.params.id],
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    const order = r.rows[0];
    const items = await pool.query(
      `SELECT ppoi.*, e.matricule, e.first_name, e.last_name FROM payroll_payment_order_items ppoi
       JOIN employees e ON e.id = ppoi.employee_id WHERE ppoi.order_id = $1 ORDER BY e.last_name`,
      [req.params.id],
    );
    order.items = items.rows;
    res.json(order);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/payment-orders', requirePermission('payroll.payment_orders.create'), async (req: AuthenticatedRequest, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { runId, method, bank, reference } = req.body;
    if (!runId || !method) return (await client.query('ROLLBACK'), client.release(), res.status(400).json({ error: 'runId, method required' }));

    const runRes = await client.query(`SELECT * FROM payroll_runs WHERE id = $1 AND status IN ('locked','payslips_generated')`, [runId]);
    if (!runRes.rows.length) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Run must be locked or payslips generated' }); }

    // Check duplicate
    const dupCheck = await client.query(`SELECT id FROM payroll_payment_orders WHERE run_id = $1 AND status NOT IN ('rejected') AND deleted_at IS NULL`, [runId]);
    if (dupCheck.rows.length > 0) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Un ordre de paiement existe déjà pour ce run' }); }

    const orderNum = `OP-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${Date.now().toString().slice(-6)}`;

    // Get employee runs
    const empRuns = await client.query(
      `SELECT per.id, per.employee_id, per.net, per.bank_account FROM payroll_employee_runs per
       WHERE per.run_id = $1 AND per.excluded = false AND per.net > 0`,
      [runId],
    );

    const totalAmount = empRuns.rows.reduce((sum, er) => sum + parseFloat(er.net), 0);

    const orderRes = await client.query(
      `INSERT INTO payroll_payment_orders (run_id, order_number, method, total_amount, employee_count, bank, reference, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING *`,
      [runId, orderNum, method, totalAmount.toFixed(2), empRuns.rowCount, bank || null, reference || null, req.auth!.userId],
    );

    // Create items
    for (const er of empRuns.rows) {
      await client.query(
        `INSERT INTO payroll_payment_order_items (order_id, employee_run_id, employee_id, net_amount, bank_account)
         VALUES ($1,$2,$3,$4,$5)`,
        [orderRes.rows[0].id, er.id, er.employee_id, er.net, er.bank_account || null],
      );
    }

    await client.query('COMMIT');
    res.status(201).json(orderRes.rows[0]);
  } catch (e: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

router.patch('/payment-orders/:id/approve', requirePermission('payroll.payment_orders.approve'), async (req: AuthenticatedRequest, res) => {
  try {
    const r = await pool.query(
      `UPDATE payroll_payment_orders SET status = 'approved', approved_by = $1, approved_at = now(), updated_at = now(), version = version + 1 WHERE id = $2 AND status = 'draft' RETURNING *`,
      [req.auth!.userId, req.params.id],
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found or not in draft' });
    res.json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch('/payment-orders/:id/mark-paid', requirePermission('payroll.runs.mark_paid'), async (req: AuthenticatedRequest, res) => {
  try {
    const r = await pool.query(
      `UPDATE payroll_payment_orders SET status = 'paid', paid_at = now(), paid_by = $1, updated_at = now(), version = version + 1 WHERE id = $2 AND status IN ('approved','sent_to_bank') RETURNING *`,
      [req.auth!.userId, req.params.id],
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found or not approved' });
    res.json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
