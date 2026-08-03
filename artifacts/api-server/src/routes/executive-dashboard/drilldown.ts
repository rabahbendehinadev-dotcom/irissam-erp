import { Router } from 'express';
import { db } from '@workspace/db';
import { requirePermission } from '../../middleware/requirePermission.js';

const router = Router();
async function safe<T>(fn: () => Promise<T>, fb: T): Promise<T> {
  try { return await fn(); } catch { return fb; }
}

// GET /api/executive-dashboard/drilldown/:metric
router.get('/:metric', requirePermission('executive.view'), async (req, res) => {
  const { metric } = req.params;
  const { limit = '50', site_id } = req.query as Record<string,string>;
  const sf = site_id ? `AND site_id='${site_id}'` : '';
  const lim = Math.min(parseInt(limit) || 50, 200);

  switch (metric) {
    case 'urgences_waiting': {
      const rows = await safe(() => db.query(`
        SELECT ev.id, ev.priority, ev.status, ev.chief_complaint,
          ev.created_at,
          EXTRACT(EPOCH FROM (NOW()-ev.created_at))/60 as wait_minutes,
          p.first_name||' '||p.last_name as patient_name, p.date_of_birth
        FROM emergency_visits ev
        LEFT JOIN patients p ON p.id=ev.patient_id AND p.deleted_at IS NULL
        WHERE ev.deleted_at IS NULL
          AND ev.status NOT IN ('discharged','admitted','transferred','left_without_being_seen')
        ORDER BY ev.priority ASC, ev.created_at ASC LIMIT $1`, [lim]), []);
      return res.json({ metric, data: rows });
    }
    case 'reste_a_recouvrer': {
      const rows = await safe(() => db.query(`
        SELECT id, invoice_number, patient_name, total_amount, remaining_amount,
          invoice_date, due_date, status, insurance_type
        FROM invoices WHERE deleted_at IS NULL
          AND status NOT IN ('paid','cancelled') ${sf}
          AND remaining_amount > 0
        ORDER BY remaining_amount DESC LIMIT $1`, [lim]), []);
      return res.json({ metric, data: rows });
    }
    case 'stock_critique': {
      const rows = await safe(() => db.query(`
        SELECT mi.code, mi.name, mi.item_type, mi.quantity_on_hand,
          mi.reorder_point, mi.min_stock_level, mi.unit_cost,
          ROUND(100.0*mi.quantity_on_hand/NULLIF(mi.reorder_point,0),1) as stock_pct
        FROM medical_items mi
        WHERE mi.is_active=true AND mi.deleted_at IS NULL
          AND mi.quantity_on_hand <= mi.reorder_point
        ORDER BY stock_pct ASC LIMIT $1`, [lim]), []);
      return res.json({ metric, data: rows });
    }
    case 'personnel_absent': {
      const today = new Date().toISOString().split('T')[0];
      const rows = await safe(() => db.query(`
        SELECT e.matricule, e.first_name||' '||e.last_name as name,
          e.category, e.department_id::text as department,
          ar.status, ar.late_minutes
        FROM attendance_records ar
        JOIN employees e ON e.id=ar.employee_id AND e.deleted_at IS NULL
        WHERE ar.record_date=$1 AND ar.status='absent' AND ar.deleted_at IS NULL
        ORDER BY e.last_name LIMIT $2`, [today, lim]), []);
      return res.json({ metric, data: rows });
    }
    case 'equipements_en_panne': {
      const rows = await safe(() => db.query(`
        SELECT be.internal_code, be.serial_number, be.status, be.criticality,
          bm.name as model,
          bl.name as location,
          be.last_maintenance_date
        FROM biomedical_equipment be
        LEFT JOIN biomedical_models bm ON bm.id=be.model_id
        LEFT JOIN biomedical_locations bl ON bl.id=be.location_id
        WHERE be.status='out_of_service' AND be.deleted_at IS NULL
        ORDER BY be.criticality DESC, be.internal_code LIMIT $1`, [lim]), []);
      return res.json({ metric, data: rows });
    }
    case 'incidents_ouverts': {
      const rows = await safe(() => db.query(`
        SELECT reference, title, incident_type, severity, status,
          occurred_date, declared_at, declared_by
        FROM quality_incidents
        WHERE status NOT IN ('clos','annule')
        ORDER BY severity DESC, occurred_date DESC LIMIT $1`, [lim]), []);
      return res.json({ metric, data: rows });
    }
    case 'capa_retard': {
      const rows = await safe(() => db.query(`
        SELECT reference, title, capa_type, status, due_date,
          EXTRACT(DAY FROM NOW()-due_date)::int as days_overdue
        FROM quality_corrective_actions
        WHERE due_date < NOW() AND status NOT IN ('efficace','inefficace','annule')
        ORDER BY days_overdue DESC LIMIT $1`, [lim]), []);
      return res.json({ metric, data: rows });
    }
    case 'creances_assurance': {
      const rows = await safe(() => db.query(`
        SELECT invoice_number, patient_name, insurance_type,
          insurer_share, remaining_amount, invoice_date, due_date, status
        FROM invoices WHERE deleted_at IS NULL
          AND insurance_type IS NOT NULL
          AND status NOT IN ('paid','cancelled')
          AND insurer_share > 0 ${sf}
        ORDER BY insurer_share DESC LIMIT $1`, [lim]), []);
      return res.json({ metric, data: rows });
    }
    case 'maintenance_retard': {
      const rows = await safe(() => db.query(`
        SELECT be.internal_code, be.serial_number, be.criticality,
          be.next_maintenance_date,
          EXTRACT(DAY FROM NOW()-be.next_maintenance_date)::int as days_overdue
        FROM biomedical_equipment be
        WHERE be.next_maintenance_date < NOW()
          AND be.status NOT IN ('decommissioned','out_of_service')
          AND be.deleted_at IS NULL
        ORDER BY days_overdue DESC LIMIT $1`, [lim]), []);
      return res.json({ metric, data: rows });
    }
    case 'lots_expirant': {
      const rows = await safe(() => db.query(`
        SELECT mb.batch_number, mi.name as item_name,
          mb.expiry_date, mb.quantity_on_hand,
          EXTRACT(DAY FROM mb.expiry_date-NOW())::int as days_left,
          mb.quantity_on_hand * mi.unit_cost as value
        FROM medical_batches mb
        JOIN medical_items mi ON mi.id=mb.item_id AND mi.deleted_at IS NULL
        WHERE mb.expiry_date <= NOW()+INTERVAL '90 days'
          AND mb.expiry_date > NOW()
          AND mb.quantity_on_hand > 0 AND mb.deleted_at IS NULL
        ORDER BY mb.expiry_date ASC LIMIT $1`, [lim]), []);
      return res.json({ metric, data: rows });
    }
    default:
      return res.status(404).json({ error: `Unknown metric: ${metric}` });
  }
});

export default router;
