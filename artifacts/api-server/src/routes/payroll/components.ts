import { Router } from 'express';
import { pool } from '@workspace/db';
import { requirePermission } from '../../middleware/requirePermission';
import type { AuthenticatedRequest } from '../../middleware/requireAuth';

const router = Router();

router.get('/components', requirePermission('payroll.components.view'), async (req: AuthenticatedRequest, res) => {
  try {
    const { type, active } = req.query;
    const cond: string[] = ['deleted_at IS NULL'];
    const params: any[] = [];
    if (type)   { params.push(type);   cond.push(`type = $${params.length}`); }
    if (active !== undefined) { params.push(active === 'true'); cond.push(`active = $${params.length}`); }
    const r = await pool.query(
      `SELECT * FROM payroll_salary_components WHERE ${cond.join(' AND ')} ORDER BY type, priority`,
      params,
    );
    res.json({ data: r.rows });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/components/:id', requirePermission('payroll.components.view'), async (req: AuthenticatedRequest, res) => {
  try {
    const r = await pool.query(`SELECT * FROM payroll_salary_components WHERE id = $1 AND deleted_at IS NULL`, [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/components', requirePermission('payroll.components.manage'), async (req: AuthenticatedRequest, res) => {
  try {
    const { code, name, nameAr, nameEn, type, calculationMethod, fixedAmount, percentage, taxable,
            socialSecurityApplicable, active, priority, effectiveFrom, effectiveTo } = req.body;
    if (!code || !name || !type) return res.status(400).json({ error: 'code, name, type required' });
    const r = await pool.query(
      `INSERT INTO payroll_salary_components
         (code,name,name_ar,name_en,type,calculation_method,fixed_amount,percentage,taxable,social_security_applicable,active,priority,effective_from,effective_to,created_by,updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15) RETURNING *`,
      [code,name,nameAr||null,nameEn||null,type,calculationMethod||'fixed',fixedAmount||0,percentage||0,
       taxable!==false,socialSecurityApplicable!==false,active!==false,priority||100,effectiveFrom||'today',effectiveTo||null,req.auth!.userId],
    );
    await pool.query(
      `INSERT INTO payroll_audit_events (user_id,user_role,action,entity_type,entity_id,after_state) VALUES ($1,$2,'create_component','payroll_salary_components',$3,$4)`,
      [req.auth!.userId, req.auth!.role, r.rows[0].id, JSON.stringify(r.rows[0])],
    );
    res.status(201).json(r.rows[0]);
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'Code déjà existant' });
    res.status(500).json({ error: e.message });
  }
});

router.patch('/components/:id', requirePermission('payroll.components.manage'), async (req: AuthenticatedRequest, res) => {
  try {
    const old = await pool.query(`SELECT * FROM payroll_salary_components WHERE id = $1 AND deleted_at IS NULL`, [req.params.id]);
    if (!old.rows.length) return res.status(404).json({ error: 'Not found' });
    const { name, nameAr, nameEn, fixedAmount, percentage, taxable, socialSecurityApplicable, active, priority, effectiveTo } = req.body;
    const r = await pool.query(
      `UPDATE payroll_salary_components SET
         name = COALESCE($1, name), name_ar = COALESCE($2, name_ar), name_en = COALESCE($3, name_en),
         fixed_amount = COALESCE($4, fixed_amount), percentage = COALESCE($5, percentage),
         taxable = COALESCE($6, taxable), social_security_applicable = COALESCE($7, social_security_applicable),
         active = COALESCE($8, active), priority = COALESCE($9, priority), effective_to = COALESCE($10, effective_to),
         updated_at = now(), updated_by = $11, version = version + 1
       WHERE id = $12 RETURNING *`,
      [name||null, nameAr||null, nameEn||null, fixedAmount??null, percentage??null, taxable??null,
       socialSecurityApplicable??null, active??null, priority??null, effectiveTo||null, req.auth!.userId, req.params.id],
    );
    await pool.query(
      `INSERT INTO payroll_audit_events (user_id,user_role,action,entity_type,entity_id,before_state,after_state) VALUES ($1,$2,'update_component','payroll_salary_components',$3,$4,$5)`,
      [req.auth!.userId, req.auth!.role, req.params.id, JSON.stringify(old.rows[0]), JSON.stringify(r.rows[0])],
    );
    res.json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/components/:id', requirePermission('payroll.components.manage'), async (req: AuthenticatedRequest, res) => {
  try {
    await pool.query(`UPDATE payroll_salary_components SET deleted_at = now() WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
