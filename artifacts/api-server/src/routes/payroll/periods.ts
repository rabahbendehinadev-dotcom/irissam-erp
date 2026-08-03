import { Router } from 'express';
import { pool } from '@workspace/db';
import { requirePermission } from '../../middleware/requirePermission';
import type { AuthenticatedRequest } from '../../middleware/requireAuth';

const router = Router();

// GET /api/payroll/periods
router.get('/periods', requirePermission('payroll.periods.view'), async (req: AuthenticatedRequest, res) => {
  try {
    const { status, year, limit = 24, offset = 0 } = req.query;
    const conditions: string[] = ['pp.deleted_at IS NULL'];
    const params: any[] = [];
    if (status) { params.push(status); conditions.push(`pp.status = $${params.length}`); }
    if (year)   { params.push(year);   conditions.push(`pp.year = $${params.length}`); }
    params.push(limit); params.push(offset);
    const rows = await pool.query(
      `SELECT pp.*,
              (SELECT COUNT(*) FROM payroll_runs pr WHERE pr.period_id = pp.id AND pr.deleted_at IS NULL) AS run_count
       FROM payroll_periods pp
       WHERE ${conditions.join(' AND ')}
       ORDER BY pp.year DESC, pp.month DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const total = await pool.query(`SELECT COUNT(*) FROM payroll_periods WHERE deleted_at IS NULL`);
    res.json({ data: rows.rows, total: parseInt(total.rows[0].count) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/payroll/periods/:id
router.get('/periods/:id', requirePermission('payroll.periods.view'), async (req: AuthenticatedRequest, res) => {
  try {
    const r = await pool.query(
      `SELECT pp.*, u.first_name || ' ' || u.last_name AS locked_by_name
       FROM payroll_periods pp
       LEFT JOIN employees u ON u.id = pp.locked_by
       WHERE pp.id = $1 AND pp.deleted_at IS NULL`,
      [req.params.id],
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/payroll/periods
router.post('/periods', requirePermission('payroll.periods.create'), async (req: AuthenticatedRequest, res) => {
  try {
    const { month, year, startDate, endDate, paymentDate, notes } = req.body;
    if (!month || !year || !startDate || !endDate)
      return res.status(400).json({ error: 'month, year, startDate, endDate are required' });
    // Application-level duplicate check (UNIQUE constraint allows multiple NULL site_id)
    const dup = await pool.query(
      `SELECT id FROM payroll_periods WHERE month = $1 AND year = $2 AND deleted_at IS NULL LIMIT 1`,
      [month, year],
    );
    if (dup.rows.length > 0)
      return res.status(409).json({ error: 'Une période existe déjà pour ce mois/année' });
    const r = await pool.query(
      `INSERT INTO payroll_periods (month, year, start_date, end_date, payment_date, notes, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING *`,
      [month, year, startDate, endDate, paymentDate || null, notes || null, req.auth!.userId],
    );
    await pool.query(
      `INSERT INTO payroll_audit_events (user_id, user_role, action, entity_type, entity_id, period_id, after_state)
       VALUES ($1,$2,'create_period','payroll_periods',$3,$3,$4)`,
      [req.auth!.userId, req.auth!.role, r.rows[0].id, JSON.stringify(r.rows[0])],
    );
    res.status(201).json(r.rows[0]);
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'Une période existe déjà pour ce mois/année' });
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/payroll/periods/:id
router.patch('/periods/:id', requirePermission('payroll.periods.update'), async (req: AuthenticatedRequest, res) => {
  try {
    const existing = await pool.query(`SELECT * FROM payroll_periods WHERE id = $1 AND deleted_at IS NULL`, [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Not found' });
    if (['locked', 'paid'].includes(existing.rows[0].status))
      return res.status(409).json({ error: 'Période verrouillée — modification interdite' });
    const { paymentDate, notes } = req.body;
    const r = await pool.query(
      `UPDATE payroll_periods SET payment_date = COALESCE($1, payment_date), notes = COALESCE($2, notes),
       updated_at = now(), updated_by = $3, version = version + 1
       WHERE id = $4 RETURNING *`,
      [paymentDate || null, notes || null, req.auth!.userId, req.params.id],
    );
    res.json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/payroll/periods/:id (soft)
router.delete('/periods/:id', requirePermission('payroll.periods.update'), async (req: AuthenticatedRequest, res) => {
  try {
    const existing = await pool.query(`SELECT status FROM payroll_periods WHERE id = $1`, [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Not found' });
    if (!['draft', 'cancelled'].includes(existing.rows[0].status))
      return res.status(409).json({ error: 'Seules les périodes draft ou cancelled peuvent être supprimées' });
    await pool.query(`UPDATE payroll_periods SET deleted_at = now() WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
