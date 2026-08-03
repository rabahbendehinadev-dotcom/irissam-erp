import { Router } from 'express';
import { pool } from '@workspace/db';
import { requirePermission } from '../../middleware/requirePermission';
import type { AuthenticatedRequest } from '../../middleware/requireAuth';
import PDFDocument from 'pdfkit';

const router = Router();

router.get('/payslips', requirePermission('payroll.payslips.view'), async (req: AuthenticatedRequest, res) => {
  try {
    const { runId, employeeId, limit = 50, offset = 0 } = req.query;
    const cond: string[] = [];
    const params: any[] = [];
    // Employee sees own payslips only
    if (req.auth!.role === 'employee') {
      const emp = await pool.query(`SELECT id FROM employees WHERE linked_user_id = $1 LIMIT 1`, [req.auth!.userId]);
      if (!emp.rows.length) return res.json({ data: [], total: 0 });
      params.push(emp.rows[0].id); cond.push(`ps.employee_id = $${params.length}`);
    } else {
      if (runId)      { params.push(runId);      cond.push(`ps.run_id = $${params.length}`); }
      if (employeeId) { params.push(employeeId); cond.push(`ps.employee_id = $${params.length}`); }
    }
    const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
    params.push(limit); params.push(offset);
    const r = await pool.query(
      `SELECT ps.*, e.matricule, e.first_name, e.last_name, per.net, per.brut, per.salary_base,
              pp.month, pp.year, pp.payment_date
       FROM payroll_payslips ps
       JOIN employees e ON e.id = ps.employee_id
       JOIN payroll_employee_runs per ON per.id = ps.employee_run_id
       JOIN payroll_runs pr ON pr.id = ps.run_id
       JOIN payroll_periods pp ON pp.id = pr.period_id
       ${where}
       ORDER BY pp.year DESC, pp.month DESC, e.last_name
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    res.json({ data: r.rows, total: r.rowCount });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/payroll/payslips/:id/pdf
router.get('/payslips/:id/pdf', requirePermission('payroll.payslips.view'), async (req: AuthenticatedRequest, res) => {
  try {
    // Load all data for payslip
    const slipRes = await pool.query(
      `SELECT ps.*, e.matricule, e.first_name, e.last_name, e.gender, e.date_of_birth,
              ep.department_id, d.name AS department, pos.name AS position,
              ec.type AS contract_type,
              per.salary_base, per.days_worked, per.days_absent, per.minutes_late,
              per.overtime_minutes, per.total_earnings, per.total_deductions,
              per.brut, per.cotisations, per.tax, per.net, per.payment_method, per.bank_account,
              pp.month, pp.year, pp.payment_date, pp.start_date, pp.end_date
       FROM payroll_payslips ps
       JOIN employees e ON e.id = ps.employee_id
       JOIN payroll_employee_runs per ON per.id = ps.employee_run_id
       JOIN payroll_runs pr ON pr.id = ps.run_id
       JOIN payroll_periods pp ON pp.id = pr.period_id
       LEFT JOIN employee_profiles ep ON ep.employee_id = e.id
       LEFT JOIN hr_departments d ON d.id = ep.department_id
       LEFT JOIN employee_positions pos ON pos.id = ep.position_id
       LEFT JOIN employee_contracts ec ON ec.employee_id = e.id AND ec.status = 'actif'
       WHERE ps.id = $1`,
      [req.params.id],
    );
    if (!slipRes.rows.length) return res.status(404).json({ error: 'Payslip not found' });

    // Employee can only see own
    if (req.auth!.role === 'employee') {
      const empR = await pool.query(`SELECT id FROM employees WHERE linked_user_id = $1`, [req.auth!.userId]);
      if (!empR.rows.length || empR.rows[0].id !== slipRes.rows[0].employee_id)
        return res.status(403).json({ error: 'Accès refusé' });
    }

    const slip = slipRes.rows[0];

    // Load earnings/deductions lines
    const earnings = await pool.query(
      `SELECT component_name, quantity, unit_amount, amount FROM payroll_earnings WHERE employee_run_id = $1 ORDER BY component_code`,
      [slip.employee_run_id],
    );
    const deductions = await pool.query(
      `SELECT component_name, quantity, unit_amount, amount FROM payroll_deductions WHERE employee_run_id = $1 ORDER BY component_code`,
      [slip.employee_run_id],
    );

    // Log print/view
    await pool.query(
      `UPDATE payroll_payslips SET printed_count = printed_count + 1, last_printed_at = now(), last_printed_by = $1 WHERE id = $2`,
      [req.auth!.userId, req.params.id],
    );
    await pool.query(
      `INSERT INTO payroll_audit_events (user_id,user_role,action,entity_type,entity_id,employee_id,run_id)
       VALUES ($1,$2,'print_payslip','payroll_payslips',$3,$4,$5)`,
      [req.auth!.userId, req.auth!.role, req.params.id, slip.employee_id, slip.run_id],
    );

    // Generate PDF
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${slip.payslip_number}.pdf"`);
    res.setHeader('Cache-Control', 'no-store');
    doc.pipe(res);

    const fmt = (n: any) => parseFloat(n || 0).toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text('IRISSAM HOSPITAL', { align: 'center' });
    doc.fontSize(11).font('Helvetica').text('Bulletin de Paie', { align: 'center' });
    doc.fontSize(10).text(`Période: ${monthNames[slip.month - 1]} ${slip.year}`, { align: 'center' });
    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);

    // Employee info
    doc.fontSize(10).font('Helvetica-Bold').text('Informations Employé');
    doc.font('Helvetica').fontSize(9);
    const infoY = doc.y;
    doc.text(`Matricule: ${slip.matricule || '-'}`, 40, infoY);
    doc.text(`Nom: ${slip.last_name} ${slip.first_name}`, 40);
    doc.text(`Département: ${slip.department || '-'}`, 40);
    doc.text(`Poste: ${slip.position || '-'}`, 40);
    doc.text(`Contrat: ${slip.contract_type || '-'}`, 40);
    doc.text(`N° Bulletin: ${slip.payslip_number}`, 300, infoY);
    if (slip.payment_date) doc.text(`Date paiement: ${new Date(slip.payment_date).toLocaleDateString('fr-DZ')}`, 300);
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);

    // Attendance summary
    doc.font('Helvetica-Bold').fontSize(10).text('Présence');
    doc.font('Helvetica').fontSize(9);
    doc.text(`Jours travaillés: ${parseFloat(slip.days_worked||0).toFixed(1)}  |  Jours absence: ${parseFloat(slip.days_absent||0).toFixed(1)}  |  Retard (min): ${slip.minutes_late||0}  |  Heures sup (min): ${slip.overtime_minutes||0}`);
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);

    // Earnings column
    const tableTop = doc.y;
    const col1 = 40, col2 = 300, col3 = 430, col4 = 520;
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Rubrique', col1, tableTop);
    doc.text('Quantité', col2, tableTop);
    doc.text('Taux', col3, tableTop);
    doc.text('Montant', col4, tableTop);
    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();

    doc.font('Helvetica-Bold').fontSize(9).text('GAINS', col1); doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(8);
    for (const e of earnings.rows) {
      doc.text(e.component_name, col1, doc.y, { width: 250 });
      doc.text(parseFloat(e.quantity).toFixed(2), col2, doc.y - doc.currentLineHeight());
      doc.text(fmt(e.unit_amount), col3, doc.y - doc.currentLineHeight());
      doc.text(fmt(e.amount), col4, doc.y - doc.currentLineHeight());
    }
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(9).text(`Total Brut: ${fmt(slip.brut)} DZD`, col4 - 80);
    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();

    doc.font('Helvetica-Bold').fontSize(9).text('RETENUES', col1); doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(8);
    for (const d of deductions.rows) {
      doc.text(d.component_name, col1, doc.y, { width: 250 });
      doc.text(parseFloat(d.quantity).toFixed(2), col2, doc.y - doc.currentLineHeight());
      doc.text(fmt(d.unit_amount), col3, doc.y - doc.currentLineHeight());
      doc.text(fmt(d.amount), col4, doc.y - doc.currentLineHeight());
    }
    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();

    // Net
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica-Bold').text(`NET À PAYER: ${fmt(slip.net)} DZD`, { align: 'right' });
    doc.fontSize(9).font('Helvetica').text(`Cotisations CNAS: ${fmt(slip.cotisations)} DZD  |  IRG: ${fmt(slip.tax)} DZD`, { align: 'right' });

    // Signatures
    doc.moveDown(2);
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Signature RH:', 80, doc.y);
    doc.text('Signature Finance:', 350, doc.y - doc.currentLineHeight());
    doc.moveDown(2);
    doc.moveTo(80, doc.y).lineTo(220, doc.y).stroke();
    doc.moveTo(350, doc.y).lineTo(490, doc.y).stroke();

    // Footer
    doc.fontSize(7).font('Helvetica').text(
      'Ce bulletin de paie est confidentiel. IRISSAM HOSPITAL — Système de Gestion Hospitalière',
      40, 780, { align: 'center', width: 515 },
    );

    doc.end();
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/payroll/employees/:employeeId/history
router.get('/employees/:employeeId/history', requirePermission('payroll.payslips.view'), async (req: AuthenticatedRequest, res) => {
  try {
    // Employee sees only own
    if (req.auth!.role === 'employee') {
      const emp = await pool.query(`SELECT id FROM employees WHERE linked_user_id = $1 LIMIT 1`, [req.auth!.userId]);
      if (!emp.rows.length || emp.rows[0].id !== req.params.employeeId)
        return res.status(403).json({ error: 'Accès refusé' });
    }
    const r = await pool.query(
      `SELECT ps.*, pp.month, pp.year, pp.payment_date, per.net, per.brut, per.salary_base
       FROM payroll_payslips ps
       JOIN payroll_employee_runs per ON per.id = ps.employee_run_id
       JOIN payroll_runs pr ON pr.id = ps.run_id
       JOIN payroll_periods pp ON pp.id = pr.period_id
       WHERE ps.employee_id = $1
       ORDER BY pp.year DESC, pp.month DESC`,
      [req.params.employeeId],
    );
    res.json({ data: r.rows });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
