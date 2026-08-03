import { Router } from 'express';
import { pool } from '@workspace/db';
import { requirePermission } from '../../middleware/requirePermission';
import type { AuthenticatedRequest } from '../../middleware/requireAuth';

const router = Router();

router.get('/settings', requirePermission('payroll.view'), async (_req, res) => {
  try {
    const [settings, taxRules, ssRules] = await Promise.all([
      pool.query(`SELECT * FROM payroll_settings LIMIT 1`),
      pool.query(`SELECT * FROM payroll_tax_rules WHERE deleted_at IS NULL ORDER BY bracket_min`),
      pool.query(`SELECT * FROM payroll_social_security_rules WHERE deleted_at IS NULL ORDER BY code`),
    ]);
    res.json({
      settings: settings.rows[0],
      taxRules: taxRules.rows,
      socialSecurityRules: ssRules.rows,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch('/settings', requirePermission('payroll.settings.manage'), async (req: AuthenticatedRequest, res) => {
  try {
    const {
      workingDaysPerMonth, workingHoursPerDay,
      overtimeRate25, overtimeRate50, overtimeRate100,
      nightShiftRate, guard12hRate, guard24hRate,
      lateDeductionMethod, lateGraceMinutes,
      absenceDeductionMethod, roundingDecimal, currency,
    } = req.body;
    const r = await pool.query(
      `UPDATE payroll_settings SET
         working_days_per_month = COALESCE($1, working_days_per_month),
         working_hours_per_day = COALESCE($2, working_hours_per_day),
         overtime_rate_25 = COALESCE($3, overtime_rate_25),
         overtime_rate_50 = COALESCE($4, overtime_rate_50),
         overtime_rate_100 = COALESCE($5, overtime_rate_100),
         night_shift_rate = COALESCE($6, night_shift_rate),
         guard_12h_rate = COALESCE($7, guard_12h_rate),
         guard_24h_rate = COALESCE($8, guard_24h_rate),
         late_deduction_method = COALESCE($9, late_deduction_method),
         late_grace_minutes = COALESCE($10, late_grace_minutes),
         absence_deduction_method = COALESCE($11, absence_deduction_method),
         rounding_decimal = COALESCE($12, rounding_decimal),
         currency = COALESCE($13, currency),
         updated_at = now(), updated_by = $14, version = version + 1
       RETURNING *`,
      [workingDaysPerMonth, workingHoursPerDay, overtimeRate25, overtimeRate50, overtimeRate100,
       nightShiftRate, guard12hRate, guard24hRate, lateDeductionMethod, lateGraceMinutes,
       absenceDeductionMethod, roundingDecimal, currency, req.auth!.userId],
    );
    res.json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch('/settings/tax-rules/:id', requirePermission('payroll.settings.manage'), async (req: AuthenticatedRequest, res) => {
  try {
    const { rate, fixedAmount, active, effectiveTo } = req.body;
    const r = await pool.query(
      `UPDATE payroll_tax_rules SET rate = COALESCE($1, rate), fixed_amount = COALESCE($2, fixed_amount),
       active = COALESCE($3, active), effective_to = COALESCE($4, effective_to), updated_at = now(), version = version + 1
       WHERE id = $5 RETURNING *`,
      [rate ?? null, fixedAmount ?? null, active ?? null, effectiveTo || null, req.params.id],
    );
    res.json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch('/settings/ss-rules/:id', requirePermission('payroll.settings.manage'), async (req: AuthenticatedRequest, res) => {
  try {
    const { employeeRate, employerRate, active } = req.body;
    const r = await pool.query(
      `UPDATE payroll_social_security_rules SET employee_rate = COALESCE($1, employee_rate),
       employer_rate = COALESCE($2, employer_rate), active = COALESCE($3, active),
       updated_at = now(), version = version + 1 WHERE id = $4 RETURNING *`,
      [employeeRate ?? null, employerRate ?? null, active ?? null, req.params.id],
    );
    res.json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
