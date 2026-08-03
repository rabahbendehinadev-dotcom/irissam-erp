import { Router } from 'express';
import { db } from '@workspace/db';
import { requirePermission } from '../../middleware/requirePermission.js';

const router = Router();
async function safe<T>(fn: () => Promise<T>, fb: T): Promise<T> {
  try { return await fn(); } catch { return fb; }
}

// GET /api/executive-dashboard/biomedical
router.get('/', requirePermission('executive.view_biomedical'), async (req, res) => {
  const { period = 'month', from, to } = req.query as Record<string,string>;
  const now = new Date();
  let start = new Date(now); let end = new Date(now);
  if (from && to) { start = new Date(from); end = new Date(to); }
  else {
    switch (period) {
      case 'week':   start.setDate(now.getDate()-6); break;
      case 'year':   start.setMonth(0,1); break;
      case 'quarter':start.setMonth(Math.floor(now.getMonth()/3)*3,1); break;
      default:       start.setDate(1);
    }
    start.setHours(0,0,0,0); end.setHours(23,59,59,999);
  }

  const [summary, byStatus, maintenanceDue, calibrationExpired, topCostly, workOrders] = await Promise.all([
    safe(() => db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status='operational')     as operational,
        COUNT(*) FILTER (WHERE status='out_of_service')  as out_of_service,
        COUNT(*) FILTER (WHERE status='under_maintenance') as under_maintenance,
        COUNT(*) FILTER (WHERE status='decommissioned')  as decommissioned,
        COUNT(*) FILTER (WHERE next_maintenance_date < NOW() AND status != 'decommissioned') as maintenance_overdue,
        COUNT(*) FILTER (WHERE next_calibration_date  < NOW() AND status != 'decommissioned') as calibration_overdue,
        COALESCE(SUM(current_value),0) as total_value
      FROM biomedical_equipment WHERE deleted_at IS NULL`, []), []),
    safe(() => db.query(`
      SELECT status, COUNT(*) as count FROM biomedical_equipment
      WHERE deleted_at IS NULL GROUP BY status ORDER BY count DESC`, []), []),
    safe(() => db.query(`
      SELECT be.internal_code, be.serial_number,
        bm.name as model, bc.name as category,
        be.next_maintenance_date,
        EXTRACT(DAY FROM NOW()-be.next_maintenance_date)::int as days_overdue
      FROM biomedical_equipment be
      LEFT JOIN biomedical_models bc ON bc.id=be.model_id
      LEFT JOIN biomedical_categories cat ON cat.id=be.category_id
      LEFT JOIN biomedical_models bm ON bm.id=be.model_id
      WHERE be.next_maintenance_date < NOW()
        AND be.status NOT IN ('decommissioned','out_of_service')
        AND be.deleted_at IS NULL
      ORDER BY days_overdue DESC LIMIT 15`, []), []),
    safe(() => db.query(`
      SELECT be.internal_code, be.serial_number,
        be.next_calibration_date,
        EXTRACT(DAY FROM NOW()-be.next_calibration_date)::int as days_overdue
      FROM biomedical_equipment be
      WHERE be.next_calibration_date < NOW()
        AND be.status != 'decommissioned'
        AND be.deleted_at IS NULL
      ORDER BY days_overdue DESC LIMIT 15`, []), []),
    safe(() => db.query(`
      SELECT be.internal_code,
        COALESCE(SUM(wo.total_cost),0) as maintenance_cost
      FROM biomedical_work_orders wo
      JOIN biomedical_equipment be ON be.id=wo.equipment_id AND be.deleted_at IS NULL
      WHERE wo.start_date >= $1 AND wo.start_date <= $2
      GROUP BY be.internal_code ORDER BY maintenance_cost DESC LIMIT 10`, [start, end]), []),
    safe(() => db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status='open')        as open,
        COUNT(*) FILTER (WHERE status='in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status='closed')      as closed,
        COALESCE(SUM(total_cost),0)                  as total_cost,
        ROUND(AVG(EXTRACT(HOUR FROM (end_date-start_date))),1) as avg_repair_hours
      FROM biomedical_work_orders
      WHERE start_date >= $1 AND start_date <= $2`, [start, end]), []),
  ]);

  const s  = (summary    as any[])[0] ?? {};
  const wo = (workOrders as any[])[0] ?? {};
  res.json({
    period: { type: period, start, end },
    summary: {
      total:             Number(s.total             ?? 0),
      operational:       Number(s.operational       ?? 0),
      outOfService:      Number(s.out_of_service    ?? 0),
      underMaintenance:  Number(s.under_maintenance ?? 0),
      decommissioned:    Number(s.decommissioned    ?? 0),
      maintenanceOverdue:Number(s.maintenance_overdue ?? 0),
      calibrationOverdue:Number(s.calibration_overdue ?? 0),
      totalValue:        Number(s.total_value       ?? 0),
    },
    byStatus,
    maintenanceDue,
    calibrationExpired,
    topCostlyEquipment: topCostly,
    workOrdersSummary: {
      total:        Number(wo.total         ?? 0),
      open:         Number(wo.open          ?? 0),
      inProgress:   Number(wo.in_progress   ?? 0),
      closed:       Number(wo.closed        ?? 0),
      totalCost:    Number(wo.total_cost    ?? 0),
      avgRepairHours:Number(wo.avg_repair_hours ?? 0),
    },
  });
});

export default router;
