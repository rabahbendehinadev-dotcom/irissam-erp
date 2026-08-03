import { Router } from 'express';
import { db } from '@workspace/db';
import { requirePermission } from '../../middleware/requirePermission.js';

const router = Router();
async function safe<T>(fn: () => Promise<T>, fb: T): Promise<T> {
  try { return await fn(); } catch { return fb; }
}

// GET /api/executive-dashboard/hr
router.get('/', requirePermission('executive.view_hr'), async (req, res) => {
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
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = today.toISOString().split('T')[0];

  const [summary, attendanceByDay, byCategory, underStaffed, overtimeTop, contractsExpiring] = await Promise.all([
    safe(() => db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status='active')     as active,
        COUNT(*) FILTER (WHERE status='inactive')   as inactive,
        COUNT(*) FILTER (WHERE status='on_leave')   as on_leave
      FROM employees WHERE deleted_at IS NULL`, []), []),
    safe(() => db.query(`
      SELECT record_date::date as day,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status='present')  as present,
        COUNT(*) FILTER (WHERE status='absent')   as absent,
        COUNT(*) FILTER (WHERE late_minutes > 0)  as late,
        COALESCE(SUM(overtime_minutes),0)         as overtime_minutes
      FROM attendance_records
      WHERE record_date >= $1 AND record_date <= $2 AND deleted_at IS NULL
      GROUP BY 1 ORDER BY 1`, [start, end]), []),
    safe(() => db.query(`
      SELECT category,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status='active') as active
      FROM employees WHERE deleted_at IS NULL
      GROUP BY category ORDER BY total DESC`, []), []),
    // Services with attendance rate < 70% today
    safe(() => db.query(`
      SELECT
        COALESCE(e.department_id::text,'Inconnu') as department,
        COUNT(*) as expected,
        COUNT(*) FILTER (WHERE ar.status='present') as present,
        ROUND(100.0 * COUNT(*) FILTER (WHERE ar.status='present') / NULLIF(COUNT(*),0),1) as rate
      FROM employees e
      LEFT JOIN attendance_records ar ON ar.employee_id=e.id AND ar.record_date=$1 AND ar.deleted_at IS NULL
      WHERE e.status='active' AND e.deleted_at IS NULL
      GROUP BY e.department_id
      HAVING COUNT(*) FILTER (WHERE ar.status='present')::float / NULLIF(COUNT(*),0) < 0.7
      ORDER BY rate ASC LIMIT 10`, [todayStr]), []),
    safe(() => db.query(`
      SELECT e.first_name||' '||e.last_name as name, e.category,
        SUM(ar.overtime_minutes) as total_overtime
      FROM attendance_records ar
      JOIN employees e ON e.id=ar.employee_id AND e.deleted_at IS NULL
      WHERE ar.record_date >= $1 AND ar.record_date <= $2 AND ar.overtime_minutes > 0 AND ar.deleted_at IS NULL
      GROUP BY e.id, e.first_name, e.last_name, e.category
      ORDER BY total_overtime DESC LIMIT 10`, [start, end]), []),
    safe(() => db.query(`
      SELECT ec.contract_number, e.first_name||' '||e.last_name as employee,
        ec.end_date, ec.type,
        EXTRACT(DAY FROM ec.end_date - NOW())::int as days_left
      FROM employee_contracts ec
      JOIN employees e ON e.id=ec.employee_id AND e.deleted_at IS NULL
      WHERE ec.end_date <= NOW()+INTERVAL '60 days' AND ec.end_date > NOW()
        AND ec.status='active' AND ec.deleted_at IS NULL
      ORDER BY ec.end_date ASC LIMIT 20`, []), []),
  ]);

  const s = (summary as any[])[0] ?? {};
  res.json({
    period: { type: period, start, end },
    workforce: {
      total:    Number(s.total    ?? 0),
      active:   Number(s.active   ?? 0),
      inactive: Number(s.inactive ?? 0),
      onLeave:  Number(s.on_leave ?? 0),
    },
    attendanceByDay,
    byCategory,
    underStaffedDepts: underStaffed,
    overtimeTop10:     overtimeTop,
    contractsExpiring,
  });
});

export default router;
