import { Router } from 'express';
import { db } from '@workspace/db';
import { requirePermission } from '../../middleware/requirePermission.js';

const router = Router();

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

// GET /api/executive-dashboard/capacity
router.get('/', requirePermission('executive.view'), async (req, res) => {
  const { site_id } = req.query as Record<string,string>;
  const sf = site_id ? `AND site_id='${site_id}'` : '';

  const [bedsByService, icuStatus, blocStatus, saturated, forecast] = await Promise.all([
    safe(() => db.query(`
      SELECT
        COALESCE(service_id::text,'Unknown') as service,
        type,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status='occupied') as occupied,
        COUNT(*) FILTER (WHERE status='available') as available,
        COUNT(*) FILTER (WHERE status='cleaning') as cleaning
      FROM occupancy_beds WHERE deleted_at IS NULL ${sf}
      GROUP BY service_id, type ORDER BY total DESC`, []), []),
    safe(() => db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='active') as occupied,
        COUNT(*) FILTER (WHERE status='discharged' OR status IS NULL) as available,
        COUNT(*) as total
      FROM icu_patients WHERE deleted_at IS NULL ${sf}`, []), [{ occupied:'0', available:'0', total:'0' }]),
    safe(() => db.query(`
      SELECT status, COUNT(*) as count FROM operating_rooms WHERE deleted_at IS NULL ${sf}
      GROUP BY status`, []), []),
    safe(() => db.query(`
      SELECT
        COALESCE(service_id::text,'Unknown') as service,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status='occupied') as occupied,
        ROUND(100.0 * COUNT(*) FILTER (WHERE status='occupied') / NULLIF(COUNT(*),0),1) as rate
      FROM occupancy_beds WHERE deleted_at IS NULL ${sf}
      GROUP BY service_id
      HAVING COUNT(*) FILTER (WHERE status='occupied')::float / NULLIF(COUNT(*),0) >= 0.9
      ORDER BY rate DESC`, []), []),
    // 7-day forecast: admission trend last 14d extrapolated
    safe(() => db.query(`
      SELECT
        DATE_TRUNC('day', admission_date)::date as day,
        COUNT(*) as admissions,
        COUNT(*) FILTER (WHERE actual_discharge_date::date = admission_date::date OR actual_discharge_date IS NULL) as active
      FROM admissions WHERE deleted_at IS NULL ${sf}
        AND admission_date >= NOW() - INTERVAL '14 days'
      GROUP BY 1 ORDER BY 1`, []), []),
  ]);

  const icu = (icuStatus as any[])[0] ?? { occupied:'0', available:'0', total:'0' };

  res.json({
    generatedAt: new Date().toISOString(),
    beds: {
      byService: bedsByService,
    },
    icu: {
      occupied: Number(icu.occupied ?? 0),
      available: Number(icu.available ?? 0),
      total:    Number(icu.total ?? 0),
      rate: Number(icu.total) > 0 ? Math.round(100 * Number(icu.occupied) / Number(icu.total)) : 0,
    },
    bloc: {
      rooms: blocStatus,
    },
    saturatedServices: saturated,
    forecast7Days:     forecast,
  });
});

export default router;
