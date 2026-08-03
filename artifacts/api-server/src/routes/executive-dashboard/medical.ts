import { Router } from 'express';
import { db } from '@workspace/db';
import { requirePermission } from '../../middleware/requirePermission.js';

const router = Router();

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

// GET /api/executive-dashboard/medical
router.get('/', requirePermission('executive.view_medical'), async (req, res) => {
  const { period = 'month', from, to, site_id } = req.query as Record<string,string>;
  const now = new Date();
  let start = new Date(now); let end = new Date(now);
  if (from && to) { start = new Date(from); end = new Date(to); }
  else {
    switch (period) {
      case 'week':  start.setDate(now.getDate()-6); break;
      case 'year':  start.setMonth(0,1); break;
      case 'quarter': start.setMonth(Math.floor(now.getMonth()/3)*3,1); break;
      default: start.setDate(1); // month
    }
    start.setHours(0,0,0,0); end.setHours(23,59,59,999);
  }
  const sf = site_id ? `AND a.site_id='${site_id}'` : '';

  const [admByDay, consultByService, urgByPriority, dischargeByReason, avgLOS, topDiag, topServices] = await Promise.all([
    safe(() => db.query(`
      SELECT DATE_TRUNC('day', admission_date)::date as day, COUNT(*) as count
      FROM admissions WHERE deleted_at IS NULL AND admission_date >= $1 AND admission_date <= $2 ${sf}
      GROUP BY 1 ORDER BY 1`, [start, end]), []),
    safe(() => db.query(`
      SELECT s.name as service, COUNT(*) as count
      FROM consultations c
      LEFT JOIN services s ON s.id = c.service_id
      WHERE c.deleted_at IS NULL AND c.scheduled_at >= $1 AND c.scheduled_at <= $2
      GROUP BY s.name ORDER BY count DESC LIMIT 10`, [start, end]), []),
    safe(() => db.query(`
      SELECT priority, COUNT(*) as count
      FROM emergency_visits WHERE deleted_at IS NULL AND created_at >= $1 AND created_at <= $2
      GROUP BY priority ORDER BY priority`, [start, end]), []),
    safe(() => db.query(`
      SELECT COALESCE(discharge_reason,'Autre') as reason, COUNT(*) as count
      FROM admissions WHERE deleted_at IS NULL AND actual_discharge_date >= $1 AND actual_discharge_date <= $2 ${sf}
      GROUP BY discharge_reason ORDER BY count DESC LIMIT 8`, [start, end]), []),
    safe(() => db.query(`
      SELECT ROUND(AVG(
        EXTRACT(EPOCH FROM (COALESCE(actual_discharge_date::timestamp, NOW()) - admission_date::timestamp))/86400
      ),1) as avg_days
      FROM admissions WHERE deleted_at IS NULL AND admission_date >= $1 AND admission_date <= $2 ${sf}
      AND actual_discharge_date IS NOT NULL`, [start, end]), [{ avg_days: null }]),
    safe(() => db.query(`
      SELECT diagnosis_code, diagnosis_label, COUNT(*) as count
      FROM (
        SELECT primary_diagnosis_code as diagnosis_code, primary_diagnosis_label as diagnosis_label
        FROM encounters WHERE deleted_at IS NULL AND created_at >= $1 AND created_at <= $2
      ) d WHERE diagnosis_code IS NOT NULL
      GROUP BY diagnosis_code, diagnosis_label ORDER BY count DESC LIMIT 10`, [start, end]), []),
    safe(() => db.query(`
      SELECT s.name as service, COUNT(DISTINCT a.id) as admissions, COUNT(DISTINCT c.id) as consultations
      FROM services s
      LEFT JOIN admissions a ON a.service_id=s.id AND a.deleted_at IS NULL AND a.admission_date >= $1 AND a.admission_date <= $2
      LEFT JOIN consultations c ON c.service_id=s.id AND c.deleted_at IS NULL AND c.scheduled_at >= $1 AND c.scheduled_at <= $2
      WHERE s.deleted_at IS NULL
      GROUP BY s.name ORDER BY admissions DESC LIMIT 10`, [start, end]), []),
  ]);

  res.json({
    period: { type: period, start, end },
    admissionsByDay:      admByDay,
    consultationsByService: consultByService,
    urgencesByPriority:   urgByPriority,
    dischargesByReason:   dischargeByReason,
    avgLengthOfStay:      Number((avgLOS[0] as any)?.avg_days ?? 0),
    topDiagnoses:         topDiag,
    topServices:          topServices,
  });
});

export default router;
