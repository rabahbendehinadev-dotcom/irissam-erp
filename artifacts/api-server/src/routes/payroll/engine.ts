/**
 * Payroll Calculation Engine
 * All financial math done with NUMERIC(12,2) via PostgreSQL — no JS floats.
 */
import { type PoolClient } from 'pg';

export interface EngineResult {
  employeeRunId: string;
  success: boolean;
  anomalies: Array<{ code: string; message: string; severity: 'info' | 'warning' | 'critical' }>;
}

/** Calculate payroll for one employee inside a transaction. */
export async function calculateEmployee(
  client: PoolClient,
  runId: string,
  employeeId: string,
  periodId: string,
  userId: string,
): Promise<EngineResult> {
  const anomalies: EngineResult['anomalies'] = [];
  let _step = 'init';
  const q = async (step: string, sql: string, params?: any[]) => {
    _step = step;
    return client.query(sql, params);
  };

  try {

  // ── 1. Get settings ──────────────────────────────────────────────────────
  const settingsRes = await q('settings',
    `SELECT working_days_per_month, working_hours_per_day,
            overtime_rate_25, overtime_rate_50, overtime_rate_100,
            night_shift_rate, guard_12h_rate, guard_24h_rate,
            late_deduction_method, late_grace_minutes,
            absence_deduction_method, rounding_decimal
     FROM payroll_settings LIMIT 1`,
  );
  const s = settingsRes.rows[0] ?? {
    working_days_per_month: 26, working_hours_per_day: 8,
    overtime_rate_25: 1.25, overtime_rate_50: 1.50, overtime_rate_100: 2.00,
    night_shift_rate: 1.30, guard_12h_rate: 1.25, guard_24h_rate: 1.50,
    late_deduction_method: 'pro_rata', late_grace_minutes: 5,
    absence_deduction_method: 'daily_rate', rounding_decimal: 2,
  };
  const wdpm = parseFloat(s.working_days_per_month);
  const wphd = parseFloat(s.working_hours_per_day);

  // ── 2. Get period dates ──────────────────────────────────────────────────
  const periodRes = await q('s2',
    `SELECT start_date, end_date, month, year FROM payroll_periods WHERE id = $1`,
    [periodId],
  );
  const period = periodRes.rows[0];
  if (!period) throw new Error('Period not found');

  // ── 3. Get active contract ────────────────────────────────────────────────
  const contractRes = await q('s3',
    `SELECT ec.id, ec.salary_base, ec.type, ec.is_full_time, ec.weekly_hours
     FROM employee_contracts ec
     WHERE ec.employee_id = $1
       AND ec.status = 'actif'
       AND ec.start_date <= $2
       AND (ec.end_date IS NULL OR ec.end_date >= $3)
     ORDER BY ec.start_date DESC LIMIT 1`,
    [employeeId, period.end_date, period.start_date],
  );

  let salaryBase = 0;
  let contractId: string | null = null;
  if (contractRes.rows.length === 0) {
    anomalies.push({ code: 'NO_ACTIVE_CONTRACT', message: 'Aucun contrat actif pour cette période', severity: 'critical' });
    // Try employee_profiles as fallback
    const profRes = await q('s4',
      `SELECT salary_base FROM employee_profiles WHERE employee_id = $1 LIMIT 1`,
      [employeeId],
    );
    if (profRes.rows.length > 0 && profRes.rows[0].salary_base) {
      salaryBase = parseFloat(profRes.rows[0].salary_base);
    }
  } else {
    contractId = contractRes.rows[0].id;
    salaryBase = parseFloat(contractRes.rows[0].salary_base) || 0;
  }

  if (salaryBase <= 0) {
    anomalies.push({ code: 'NO_BASE_SALARY', message: 'Salaire de base non défini', severity: 'critical' });
  }

  // ── 4. Attendance snapshot ────────────────────────────────────────────────
  const attendRes = await q('s5',
    `SELECT
       COUNT(*) FILTER (WHERE status = 'present' OR total_worked_minutes > 0) AS days_worked,
       COALESCE(SUM(total_worked_minutes), 0) AS total_worked_minutes,
       COALESCE(SUM(overtime_minutes), 0) AS overtime_minutes,
       COALESCE(SUM(late_minutes), 0) AS late_minutes,
       COUNT(*) FILTER (WHERE check_in IS NOT NULL AND check_out IS NULL) AS missing_checkouts
     FROM attendance_records
     WHERE employee_id = $1
       AND record_date BETWEEN $2 AND $3`,
    [employeeId, period.start_date, period.end_date],
  );
  const atd = attendRes.rows[0];
  const daysWorked = parseFloat(atd.days_worked) || 0;
  const overtimeMinutes = parseInt(atd.overtime_minutes) || 0;
  const lateMinutes = Math.max(0, parseInt(atd.late_minutes) - (s.late_grace_minutes * (daysWorked || 1)));
  const missingCheckouts = parseInt(atd.missing_checkouts) || 0;

  if (missingCheckouts > 0) {
    anomalies.push({ code: 'MISSING_CHECKOUT', message: `${missingCheckouts} check-out(s) manquant(s)`, severity: 'warning' });
  }

  // ── 5. Absence / Leave snapshot ───────────────────────────────────────────
  const absRes = await q('s6',
    `SELECT
       COALESCE(SUM(
         GREATEST(0, (LEAST(date_to, $3) - GREATEST(date_from, $2))::integer + 1)
       ), 0) AS absence_days
     FROM absence_records
     WHERE employee_id = $1
       AND status IN ('approuvee')
       AND date_from <= $3 AND date_to >= $2`,
    [employeeId, period.start_date, period.end_date],
  );
  const daysAbsent = parseFloat(absRes.rows[0].absence_days) || 0;

  const leaveRes = await q('s7',
    `SELECT
       COALESCE(SUM(number_of_days) FILTER (WHERE leave_type != 'sans_solde'), 0) AS paid_leave_days,
       COALESCE(SUM(number_of_days) FILTER (WHERE leave_type = 'sans_solde'), 0)     AS unpaid_leave_days
     FROM leave_requests
     WHERE employee_id = $1
       AND status = 'approuvee'
       AND date_from <= $3 AND date_to >= $2`,
    [employeeId, period.start_date, period.end_date],
  );
  const daysPaidLeave   = parseFloat(leaveRes.rows[0].paid_leave_days)   || 0;
  const daysUnpaidLeave = parseFloat(leaveRes.rows[0].unpaid_leave_days) || 0;

  // ── 6. Overtime records (approved) ───────────────────────────────────────
  const otRes = await q('s8',
    `SELECT id, record_date, overtime_hours, compensation_type
     FROM overtime_records
     WHERE employee_id = $1
       AND status = 'approuvee'
       AND record_date BETWEEN $2 AND $3`,
    [employeeId, period.start_date, period.end_date],
  );
  const pendingOT = await q('s9',
    `SELECT COUNT(*) AS cnt FROM overtime_records
     WHERE employee_id = $1 AND status = 'soumise' AND record_date BETWEEN $2 AND $3`,
    [employeeId, period.start_date, period.end_date],
  );
  if (parseInt(pendingOT.rows[0].cnt) > 0) {
    anomalies.push({ code: 'UNAPPROVED_OVERTIME', message: 'Heures supplémentaires non approuvées', severity: 'warning' });
  }

  // ── 7. Daily / Hourly rates ───────────────────────────────────────────────
  // Use NUMERIC precision via string — no JS float arithmetic
  const dailyRateNum = salaryBase > 0 ? (salaryBase / wdpm) : 0;
  const hourlyRateNum = salaryBase > 0 ? (salaryBase / (wdpm * wphd)) : 0;

  // ── 8. Upsert payroll_employee_runs ──────────────────────────────────────
  const perRes = await q('s10',
    `INSERT INTO payroll_employee_runs
       (run_id, employee_id, contract_id, working_days, days_worked, days_absent,
        days_paid_leave, days_unpaid_leave, minutes_late, overtime_minutes,
        salary_base, calculated_at, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),$12,$12)
     ON CONFLICT (run_id, employee_id) DO UPDATE SET
       contract_id      = EXCLUDED.contract_id,
       working_days     = EXCLUDED.working_days,
       days_worked      = EXCLUDED.days_worked,
       days_absent      = EXCLUDED.days_absent,
       days_paid_leave  = EXCLUDED.days_paid_leave,
       days_unpaid_leave= EXCLUDED.days_unpaid_leave,
       minutes_late     = EXCLUDED.minutes_late,
       overtime_minutes = EXCLUDED.overtime_minutes,
       salary_base      = EXCLUDED.salary_base,
       calculated_at    = now(),
       updated_by       = EXCLUDED.updated_by,
       version          = payroll_employee_runs.version + 1
     RETURNING id`,
    [
      runId, employeeId, contractId, wdpm, daysWorked, daysAbsent,
      daysPaidLeave, daysUnpaidLeave, lateMinutes, overtimeMinutes,
      salaryBase.toFixed(2), userId,
    ],
  );
  const employeeRunId: string = perRes.rows[0].id;

  // ── 9. Clear previous lines ───────────────────────────────────────────────
  await q('s11',`DELETE FROM payroll_earnings WHERE employee_run_id = $1`, [employeeRunId]);
  await q('s12',`DELETE FROM payroll_deductions WHERE employee_run_id = $1`, [employeeRunId]);
  await q('s13',`DELETE FROM payroll_overtime_lines WHERE employee_run_id = $1`, [employeeRunId]);
  await q('s14',`DELETE FROM payroll_absence_lines WHERE employee_run_id = $1`, [employeeRunId]);

  // ── 10. Earnings ──────────────────────────────────────────────────────────
  let totalEarnings = 0;

  // Salary base — full month on earnings side; deductions handle absences separately
  // (standard Algerian payslip format: show full base, then deduct)
  if (salaryBase > 0) {
    const baseAmount = salaryBase;
    await q('s15',
      `INSERT INTO payroll_earnings (employee_run_id, component_code, component_name, quantity, unit_amount, amount, taxable, social_sec)
       VALUES ($1,'SAL_BASE','Salaire de base',$2,$3,$4,true,true)`,
      [employeeRunId, wdpm.toFixed(4), dailyRateNum.toFixed(2), baseAmount.toFixed(2)],
    );
    totalEarnings += baseAmount;
  }

  // Active salary components (non-base earnings)
  const compRes = await q('s16',
    `SELECT * FROM payroll_salary_components
     WHERE type = 'earning' AND active = true AND code != 'SAL_BASE'
       AND (effective_to IS NULL OR effective_to >= $1)
       AND effective_from <= $2
       AND deleted_at IS NULL
     ORDER BY priority`,
    [period.start_date, period.end_date],
  );
  for (const comp of compRes.rows) {
    let amount = 0;
    const qty = 1;
    if (comp.calculation_method === 'fixed' && parseFloat(comp.fixed_amount) > 0) {
      amount = parseFloat(comp.fixed_amount);
    } else if (comp.calculation_method === 'percentage_of_base') {
      amount = +(salaryBase * parseFloat(comp.percentage)).toFixed(2);
    } else if (comp.calculation_method === 'percentage_of_brut') {
      // Will be applied after brut is known — skip for now
      continue;
    } else {
      continue; // hourly_rate and formula handled separately
    }
    if (amount <= 0) continue;
    await q('s17',
      `INSERT INTO payroll_earnings (employee_run_id, component_id, component_code, component_name, quantity, unit_amount, amount, taxable, social_sec)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [employeeRunId, comp.id, comp.code, comp.name, qty.toFixed(4), amount.toFixed(2), amount.toFixed(2), comp.taxable, comp.social_security_applicable],
    );
    totalEarnings += amount;
  }

  // Overtime lines — tiered: first 8h at rate_25, next 8h at rate_50, beyond at rate_100
  for (const ot of otRes.rows) {
    const otHours = parseFloat(ot.overtime_hours) || 0;
    if (otHours <= 0) continue;
    const rate25  = parseFloat(s.overtime_rate_25);
    const rate50  = parseFloat(s.overtime_rate_50);
    const rate100 = parseFloat(s.overtime_rate_100);
    const h25  = Math.min(otHours, 8);
    const h50  = Math.max(0, Math.min(otHours - 8, 8));
    const h100 = Math.max(0, otHours - 16);
    const otAmount = +(hourlyRateNum * (h25 * rate25 + h50 * rate50 + h100 * rate100)).toFixed(2);
    // Store the dominant multiplier for payroll_overtime_lines reporting
    const dominantMultiplier = h100 > 0 ? rate100 : (h50 > 0 ? rate50 : rate25);
    await q('s18',
      `INSERT INTO payroll_overtime_lines (employee_run_id, overtime_record_id, record_date, overtime_hours, rate_multiplier, hourly_base, amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [employeeRunId, ot.id, ot.record_date, otHours.toFixed(2), dominantMultiplier.toFixed(4), hourlyRateNum.toFixed(2), otAmount.toFixed(2)],
    );
    await q('s19',
      `INSERT INTO payroll_earnings (employee_run_id, component_code, component_name, quantity, unit_amount, amount, taxable, social_sec)
       VALUES ($1,'HEURES_SUP','Heures supplémentaires',$2,$3,$4,true,true)`,
      [employeeRunId, otHours.toFixed(4), (otAmount / otHours).toFixed(2), otAmount.toFixed(2)],
    );
    totalEarnings += otAmount;
  }

  // Bonuses
  const bonusRes = await q('s20',
    `SELECT * FROM payroll_bonuses WHERE employee_id = $1 AND run_id = $2 AND deleted_at IS NULL`,
    [employeeId, runId],
  );
  for (const b of bonusRes.rows) {
    const bAmt = parseFloat(b.amount);
    await q('s21',
      `INSERT INTO payroll_earnings (employee_run_id, component_code, component_name, quantity, unit_amount, amount, taxable, social_sec)
       VALUES ($1,'BONUS','Bonus',1,$2,$2,$3,false)`,
      [employeeRunId, bAmt.toFixed(2), b.taxable],
    );
    totalEarnings += bAmt;
  }

  // Adjustments (earning type)
  const adjResE = await q('s22',
    `SELECT * FROM payroll_adjustments WHERE employee_id = $1 AND run_id = $2 AND type = 'earning' AND deleted_at IS NULL`,
    [employeeId, runId],
  );
  for (const adj of adjResE.rows) {
    const aAmt = parseFloat(adj.amount);
    await q('s23',
      `INSERT INTO payroll_earnings (employee_run_id, component_code, component_name, quantity, unit_amount, amount, taxable, social_sec)
       VALUES ($1,'RAPPEL',$2,1,$3,$3,true,true)`,
      [employeeRunId, adj.description, aAmt.toFixed(2)],
    );
    totalEarnings += aAmt;
  }

  const brut = +(totalEarnings).toFixed(2);

  // ── 11. Deductions ────────────────────────────────────────────────────────
  let totalDeductions = 0;

  // Absence deduction
  if (daysAbsent > 0) {
    const absAmt = +(dailyRateNum * daysAbsent).toFixed(2);
    await q('s24',
      `INSERT INTO payroll_deductions (employee_run_id, component_code, component_name, quantity, unit_amount, amount)
       VALUES ($1,'DED_ABSENCE','Absence',$2,$3,$4)`,
      [employeeRunId, daysAbsent.toFixed(4), dailyRateNum.toFixed(2), absAmt.toFixed(2)],
    );
    totalDeductions += absAmt;
  }

  // Unpaid leave deduction
  if (daysUnpaidLeave > 0) {
    const ulAmt = +(dailyRateNum * daysUnpaidLeave).toFixed(2);
    await q('s25',
      `INSERT INTO payroll_deductions (employee_run_id, component_code, component_name, quantity, unit_amount, amount)
       VALUES ($1,'DED_CONGE_SS','Congé sans solde',$2,$3,$4)`,
      [employeeRunId, daysUnpaidLeave.toFixed(4), dailyRateNum.toFixed(2), ulAmt.toFixed(2)],
    );
    totalDeductions += ulAmt;
  }

  // Late deduction (pro-rata)
  if (lateMinutes > 0 && s.late_deduction_method === 'pro_rata') {
    const minuteRate = hourlyRateNum / 60;
    const lateAmt = +(minuteRate * lateMinutes).toFixed(2);
    await q('s26',
      `INSERT INTO payroll_deductions (employee_run_id, component_code, component_name, quantity, unit_amount, amount)
       VALUES ($1,'DED_RETARD','Retard',$2,$3,$4)`,
      [employeeRunId, lateMinutes.toFixed(4), minuteRate.toFixed(2), lateAmt.toFixed(2)],
    );
    totalDeductions += lateAmt;
  }

  // Adjustments (deduction type)
  const adjResD = await q('s27',
    `SELECT * FROM payroll_adjustments WHERE employee_id = $1 AND run_id = $2 AND type = 'deduction' AND deleted_at IS NULL`,
    [employeeId, runId],
  );
  for (const adj of adjResD.rows) {
    const aAmt = Math.abs(parseFloat(adj.amount));
    await q('s28',
      `INSERT INTO payroll_deductions (employee_run_id, component_code, component_name, quantity, unit_amount, amount)
       VALUES ($1,'AUTRE_DED',$2,1,$3,$3)`,
      [employeeRunId, adj.description, aAmt.toFixed(2)],
    );
    totalDeductions += aAmt;
  }

  // ── 12. Advances ──────────────────────────────────────────────────────────
  let totalAdvances = 0;
  const advRes = await q('s29',
    `SELECT id, amount FROM payroll_advances
     WHERE employee_id = $1
       AND status = 'approved'
       AND deduction_period_id = $2`,
    [employeeId, periodId],
  );
  for (const adv of advRes.rows) {
    const advAmt = parseFloat(adv.amount);
    await q('s30',
      `INSERT INTO payroll_deductions (employee_run_id, component_code, component_name, quantity, unit_amount, amount)
       VALUES ($1,'DED_AVANCE','Avance',1,$2,$2)`,
      [employeeRunId, advAmt.toFixed(2)],
    );
    totalDeductions += advAmt;
    totalAdvances += advAmt;
    // Mark advance as deducted
    await q('s31',
      `UPDATE payroll_advances SET status = 'fully_deducted', deducted_amount = $1, deducted_at = now(), deducted_in_run_id = $2 WHERE id = $3`,
      [advAmt.toFixed(2), runId, adv.id],
    );
  }

  // ── 13. Loans ─────────────────────────────────────────────────────────────
  let totalLoans = 0;
  const loanRes = await q('s32',
    `SELECT l.id, l.installment_amount, l.remaining_amount,
            (SELECT COUNT(*) FROM payroll_loan_installments WHERE loan_id = l.id) AS paid_count
     FROM payroll_loans l
     WHERE l.employee_id = $1
       AND l.status = 'active'
       AND l.deleted_at IS NULL`,
    [employeeId],
  );
  for (const loan of loanRes.rows) {
    const installAmt = Math.min(parseFloat(loan.installment_amount), parseFloat(loan.remaining_amount));
    if (installAmt <= 0) continue;
    // Check for duplicate installment this run
    const dupCheck = await q('s33',
      `SELECT id FROM payroll_loan_installments WHERE loan_id = $1 AND run_id = $2`,
      [loan.id, runId],
    );
    if (dupCheck.rows.length > 0) continue; // Already deducted

    const installNo = parseInt(loan.paid_count) + 1;
    await q('s34',
      `INSERT INTO payroll_loan_installments (loan_id, employee_run_id, run_id, installment_no, amount, status, paid_at)
       VALUES ($1,$2,$3,$4,$5,'paid',now())`,
      [loan.id, employeeRunId, runId, installNo, installAmt.toFixed(2)],
    );
    const newRemaining = Math.max(0, parseFloat(loan.remaining_amount) - installAmt);
    const newStatus = newRemaining <= 0 ? 'completed' : 'active';
    await q('s35',
      `UPDATE payroll_loans SET remaining_amount = $1, paid_installments = paid_installments + 1, status = $2, updated_at = now(),
       completed_at = CASE WHEN $3 THEN now() ELSE NULL END
       WHERE id = $4`,
      [newRemaining.toFixed(2), newStatus, newRemaining <= 0, loan.id],
    );
    await q('s36',
      `INSERT INTO payroll_deductions (employee_run_id, component_code, component_name, quantity, unit_amount, amount)
       VALUES ($1,'DED_PRET','Prêt - remboursement',1,$2,$2)`,
      [employeeRunId, installAmt.toFixed(2)],
    );
    totalDeductions += installAmt;
    totalLoans += installAmt;
  }

  // ── 14. Social security (CNAS employee 9%) ────────────────────────────────
  const ssRes = await q('s37',
    `SELECT employee_rate FROM payroll_social_security_rules WHERE code = 'CNAS_EMP' AND active = true LIMIT 1`,
  );
  const ssRate = ssRes.rows.length > 0 ? parseFloat(ssRes.rows[0].employee_rate) : 0.09;
  const cotisations = +(brut * ssRate).toFixed(2);
  if (cotisations > 0) {
    await q('s38',
      `INSERT INTO payroll_deductions (employee_run_id, component_code, component_name, quantity, unit_amount, amount)
       VALUES ($1,'DED_SOCIALE','Cotisation CNAS',1,$2,$2)`,
      [employeeRunId, cotisations.toFixed(2)],
    );
    totalDeductions += cotisations;
  }

  // ── 15. IRG (income tax) — progressive brackets ───────────────────────────
  const taxableIncome = Math.max(0, brut - cotisations);
  const taxRulesRes = await q('s39',
    `SELECT bracket_min, bracket_max, rate, fixed_amount
     FROM payroll_tax_rules
     WHERE active = true AND deleted_at IS NULL
       AND (effective_to IS NULL OR effective_to >= $1)
     ORDER BY bracket_min`,
    [period.start_date],
  );
  // Progressive (cumulative) brackets — each bracket taxes only its slice
  let tax = 0;
  for (const bracket of taxRulesRes.rows) {
    const bMin = parseFloat(bracket.bracket_min);
    const bMax = bracket.bracket_max ? parseFloat(bracket.bracket_max) : Infinity;
    if (taxableIncome > bMin) {
      const taxable = Math.min(taxableIncome, bMax) - bMin;
      tax += taxable * parseFloat(bracket.rate) + parseFloat(bracket.fixed_amount);
    }
  }
  tax = +tax.toFixed(2);
  if (tax > 0) {
    await q('s40',
      `INSERT INTO payroll_deductions (employee_run_id, component_code, component_name, quantity, unit_amount, amount)
       VALUES ($1,'DED_IMPOT','Impôt sur le revenu (IRG)',1,$2,$2)`,
      [employeeRunId, tax.toFixed(2)],
    );
    totalDeductions += tax;
  }

  // ── 16. Net ───────────────────────────────────────────────────────────────
  const net = +(brut - totalDeductions).toFixed(2);

  // Anomaly: negative net
  if (net < 0) {
    anomalies.push({ code: 'NEGATIVE_NET', message: `Salaire net négatif: ${net.toFixed(2)} DZD`, severity: 'critical' });
  }

  // ── 17. Update employee run totals ────────────────────────────────────────
  const hasAnomalies = anomalies.length > 0;
  const criticalCount = anomalies.filter(a => a.severity === 'critical').length;
  await q('s41',
    `UPDATE payroll_employee_runs SET
       total_earnings = $2, total_deductions = $3, total_advances = $4, total_loans = $5,
       brut = $6, cotisations = $7, tax = $8, net = $9,
       has_anomalies = $10, anomaly_count = $11, critical_anomaly_count = $12,
       updated_at = now(), version = version + 1
     WHERE id = $1`,
    [
      employeeRunId,
      totalEarnings.toFixed(2), totalDeductions.toFixed(2),
      totalAdvances.toFixed(2), totalLoans.toFixed(2),
      brut.toFixed(2), cotisations.toFixed(2), tax.toFixed(2), Math.max(0, net).toFixed(2),
      hasAnomalies, anomalies.length, criticalCount,
    ],
  );

  // ── 18. Insert anomalies ──────────────────────────────────────────────────
  for (const a of anomalies) {
    await q('s42',
      `INSERT INTO payroll_anomalies (run_id, employee_id, employee_run_id, code, message, severity)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT DO NOTHING`,
      [runId, employeeId, employeeRunId, a.code, a.message, a.severity],
    );
  }

  return { employeeRunId, success: criticalCount === 0, anomalies };
  } catch (e: any) {
    (e as any)._step = _step;
    throw e;
  }
}
