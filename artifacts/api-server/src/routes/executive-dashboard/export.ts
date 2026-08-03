import { Router } from 'express';
import { db } from '@workspace/db';
import { requirePermission } from '../../middleware/requirePermission.js';
import PDFDocument from 'pdfkit';

const router = Router();
async function safe<T>(fn: () => Promise<T>, fb: T): Promise<T> {
  try { return await fn(); } catch { return fb; }
}

// GET /api/executive-dashboard/export/pdf
router.get('/pdf', requirePermission('executive.export_pdf'), async (req, res) => {
  const { site_id, period = 'month' } = req.query as Record<string,string>;
  const sf = site_id ? `AND site_id='${site_id}'` : '';
  const now = new Date();
  const today = new Date(now); today.setHours(0,0,0,0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [overview, alerts] = await Promise.all([
    safe(() => db.query(`
      SELECT
        (SELECT COUNT(*) FROM patients WHERE deleted_at IS NULL ${sf}) as total_patients,
        (SELECT COUNT(*) FROM admissions WHERE deleted_at IS NULL AND admission_date >= $1 ${sf}) as admissions_month,
        (SELECT COUNT(*) FILTER (WHERE status='occupied') FROM occupancy_beds WHERE deleted_at IS NULL ${sf}) as beds_occupied,
        (SELECT COUNT(*) FROM occupancy_beds WHERE deleted_at IS NULL ${sf}) as beds_total,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE deleted_at IS NULL AND invoice_date >= $1 ${sf}) as ca_month,
        (SELECT COALESCE(SUM(remaining_amount),0) FROM invoices WHERE deleted_at IS NULL AND status NOT IN ('paid','cancelled') ${sf}) as unpaid,
        (SELECT COUNT(*) FROM quality_incidents WHERE status NOT IN ('clos','annule')) as incidents_open,
        (SELECT COUNT(*) FROM biomedical_equipment WHERE status='out_of_service' AND deleted_at IS NULL) as equipment_down
    `, [monthStart]), []),
    safe(() => db.query(`
      SELECT COUNT(*) FILTER (WHERE status='occupied')::float / NULLIF(COUNT(*),0)*100 as occ_rate
      FROM occupancy_beds WHERE deleted_at IS NULL ${sf}`, []), []),
  ]);

  const d  = (overview as any[])[0] ?? {};
  const oc = (alerts   as any[])[0] ?? {};

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="direction_${now.toISOString().split('T')[0]}.pdf"`);

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(res);

  // Header
  doc.fontSize(22).font('Helvetica-Bold').fillColor('#1a365d')
     .text('IRISSAM HOSPITAL', 50, 50, { align: 'center' });
  doc.fontSize(14).font('Helvetica').fillColor('#4a5568')
     .text('Tableau de Bord Direction — Rapport Exécutif', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#718096')
     .text(`Généré le ${now.toLocaleDateString('fr-FR', { weekday:'long', year:'numeric', month:'long', day:'numeric' })} à ${now.toLocaleTimeString('fr-FR')}`, { align: 'center' });
  doc.moveDown();

  // Separator
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').stroke();
  doc.moveDown();

  // Period
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#2d3748').text(`Période : ${period.toUpperCase()}`);
  doc.moveDown();

  // KPIs section
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#1a365d').text('INDICATEURS CLÉS');
  doc.moveDown(0.5);

  const kpis = [
    ['Total Patients',          Number(d.total_patients    ?? 0).toLocaleString()],
    ['Admissions (mois)',        Number(d.admissions_month  ?? 0).toLocaleString()],
    ['Occupation Lits',          `${Math.round(Number(oc.occ_rate ?? 0))}% (${d.beds_occupied}/${d.beds_total})`],
    ["CA Mois",                  `${Number(d.ca_month  ?? 0).toLocaleString()} DZD`],
    ["Reste à Recouvrer",        `${Number(d.unpaid    ?? 0).toLocaleString()} DZD`],
    ['Incidents Qualité Ouverts',Number(d.incidents_open   ?? 0).toString()],
    ['Équipements en Panne',     Number(d.equipment_down   ?? 0).toString()],
  ];

  kpis.forEach(([label, value]) => {
    doc.fontSize(10).font('Helvetica').fillColor('#4a5568').text(`• ${label}:`, 60, doc.y, { continued: true });
    doc.font('Helvetica-Bold').fillColor('#2d3748').text(`  ${value}`);
  });

  doc.moveDown(2);
  doc.fontSize(9).font('Helvetica').fillColor('#a0aec0')
     .text('Ce rapport est confidentiel et destiné à la direction uniquement.', { align: 'center' });

  doc.end();
});

// GET /api/executive-dashboard/export/excel
router.get('/excel', requirePermission('executive.export_excel'), async (req, res) => {
  const { site_id, period = 'month' } = req.query as Record<string,string>;
  const sf = site_id ? `AND site_id='${site_id}'` : '';
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const start = monthStart;
  const end   = now;

  const [patients, admissions, finance, hr, stock, biomedical, quality] = await Promise.all([
    safe(() => db.query(`SELECT id, first_name, last_name, gender, date_of_birth, status, created_at FROM patients WHERE deleted_at IS NULL ${sf} ORDER BY created_at DESC LIMIT 500`), []),
    safe(() => db.query(`SELECT admission_number, patient_id, service_id::text, type, status, admission_date, actual_discharge_date FROM admissions WHERE deleted_at IS NULL AND admission_date >= $1 ${sf} ORDER BY admission_date DESC`, [start]), []),
    safe(() => db.query(`SELECT invoice_number, patient_name, total_amount, paid_amount, remaining_amount, status, insurance_type, invoice_date FROM invoices WHERE deleted_at IS NULL AND invoice_date >= $1 ${sf} ORDER BY invoice_date DESC`, [start]), []),
    safe(() => db.query(`SELECT matricule, first_name, last_name, category, status, hire_date FROM employees WHERE deleted_at IS NULL ORDER BY last_name LIMIT 500`), []),
    safe(() => db.query(`SELECT code, name, item_type, quantity_on_hand, reorder_point, unit_cost FROM medical_items WHERE is_active=true AND deleted_at IS NULL ORDER BY name LIMIT 500`), []),
    safe(() => db.query(`SELECT internal_code, serial_number, status, criticality, next_maintenance_date FROM biomedical_equipment WHERE deleted_at IS NULL ORDER BY internal_code LIMIT 500`), []),
    safe(() => db.query(`SELECT reference, title, incident_type, severity, status, occurred_date FROM quality_incidents ORDER BY occurred_date DESC LIMIT 200`), []),
  ]);

  // Build simple CSV-style JSON and return as JSON (frontend converts to XLSX)
  // We use a lightweight approach: return structured data with sheet names
  res.json({
    exportedAt: now.toISOString(),
    period: { type: period, start, end },
    sheets: {
      Overview: { columns: ['Indicateur','Valeur'], rows: [
        ['Total patients', (patients as any[]).length],
        ['Admissions mois', (admissions as any[]).length],
        ['Factures mois',   (finance  as any[]).length],
        ['Personnel actif', (hr       as any[]).length],
      ]},
      Medical:    { columns: Object.keys((admissions  as any[])[0]  ?? {}), rows: admissions    },
      Finance:    { columns: Object.keys((finance     as any[])[0]  ?? {}), rows: finance        },
      RH:         { columns: Object.keys((hr          as any[])[0]  ?? {}), rows: hr             },
      Stock:      { columns: Object.keys((stock       as any[])[0]  ?? {}), rows: stock          },
      Biomedical: { columns: Object.keys((biomedical  as any[])[0]  ?? {}), rows: biomedical     },
      Qualite:    { columns: Object.keys((quality     as any[])[0]  ?? {}), rows: quality        },
    },
  });
});

export default router;
