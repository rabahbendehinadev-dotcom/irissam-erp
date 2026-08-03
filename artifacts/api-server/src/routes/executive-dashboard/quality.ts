import { Router } from 'express';
import { db } from '@workspace/db';
import { requirePermission } from '../../middleware/requirePermission.js';

const router = Router();
async function safe<T>(fn: () => Promise<T>, fb: T): Promise<T> {
  try { return await fn(); } catch { return fb; }
}

// GET /api/executive-dashboard/quality
router.get('/', requirePermission('executive.view_quality'), async (req, res) => {
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

  const [incidentSummary, incidentTrend, ncStatus, capaOverdue, riskHeatmap,
         auditsScheduled, topIndicators] = await Promise.all([
    safe(() => db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status NOT IN ('clos','annule')) as open,
        COUNT(*) FILTER (WHERE severity='critique')              as critical,
        COUNT(*) FILTER (WHERE severity='majeur')               as major,
        COUNT(*) FILTER (WHERE status='clos')                   as closed
      FROM quality_incidents
      WHERE occurred_date >= $1 AND occurred_date <= $2`, [start, end]), []),
    safe(() => db.query(`
      SELECT DATE_TRUNC('month', occurred_date)::date as month,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE severity='critique') as critical
      FROM quality_incidents
      WHERE occurred_date >= NOW()-INTERVAL '12 months'
      GROUP BY 1 ORDER BY 1`, []), []),
    safe(() => db.query(`
      SELECT status, COUNT(*) as count FROM quality_non_conformities
      WHERE created_at >= $1 AND created_at <= $2 GROUP BY status`, [start, end]), []),
    safe(() => db.query(`
      SELECT reference, title, due_date, status, capa_type,
        EXTRACT(DAY FROM NOW()-due_date)::int as days_overdue
      FROM quality_corrective_actions
      WHERE due_date < NOW() AND status NOT IN ('efficace','inefficace','annule')
      ORDER BY days_overdue DESC LIMIT 15`, []), []),
    safe(() => db.query(`
      SELECT probability, impact, COUNT(*) as count
      FROM quality_risk_register
      WHERE status NOT IN ('accepte','archive')
      GROUP BY probability, impact ORDER BY probability, impact`, []), []),
    safe(() => db.query(`
      SELECT status, COUNT(*) as count FROM quality_audits
      WHERE planned_date >= $1 AND planned_date <= $2
      GROUP BY status`, [start, end]), []),
    safe(() => db.query(`
      SELECT qi.name, qi.unit, qi.target_value,
        (SELECT qiv.value FROM quality_indicator_values qiv
          WHERE qiv.indicator_id=qi.id
          ORDER BY qiv.created_at DESC LIMIT 1) as latest_value,
        (SELECT qiv.trend FROM quality_indicator_values qiv
          WHERE qiv.indicator_id=qi.id
          ORDER BY qiv.created_at DESC LIMIT 1) as trend
      FROM quality_indicators qi
      WHERE qi.is_active = true
      ORDER BY qi.name LIMIT 12`, []), []),
  ]);

  const s = (incidentSummary as any[])[0] ?? {};
  res.json({
    period: { type: period, start, end },
    incidentSummary: {
      total:    Number(s.total    ?? 0),
      open:     Number(s.open     ?? 0),
      critical: Number(s.critical ?? 0),
      major:    Number(s.major    ?? 0),
      closed:   Number(s.closed   ?? 0),
    },
    incidentTrend,
    ncByStatus:    ncStatus,
    capaOverdue,
    riskHeatmap,
    auditsScheduled,
    topIndicators,
  });
});

export default router;
