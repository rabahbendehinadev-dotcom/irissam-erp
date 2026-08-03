/**
 * /api/hr/dashboard — KPI cards, charts, widget alerts
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

router.get("/", requirePermission("hr.dashboard.view"), async (_req: AuthenticatedRequest, res, next) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const [
      totalEmployees,
      todayAttendance,
      contractsExpiring,
      docsExpiring,
      leavesPending,
      departmentBreakdown,
      categoryBreakdown,
      attendanceTrend,
      absencesByMonth,
      lateByMonth,
      overtimeStats,
      vacantPositions,
      absentToday,
      criticalLate,
      uncoveredShifts,
    ] = await Promise.all([

      // Total + status breakdown
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE deleted_at IS NULL) AS total,
          COUNT(*) FILTER (WHERE deleted_at IS NULL AND status='actif') AS actif,
          COUNT(*) FILTER (WHERE deleted_at IS NULL AND status='en_conge') AS on_leave,
          COUNT(*) FILTER (WHERE deleted_at IS NULL AND status='suspendu') AS suspended,
          COUNT(*) FILTER (WHERE deleted_at IS NULL AND status='en_arret') AS sick
        FROM employees`),

      // Today's attendance stats
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status='present') AS present,
          COUNT(*) FILTER (WHERE status='absent') AS absent,
          COUNT(*) FILTER (WHERE status='retard') AS late,
          COUNT(*) FILTER (WHERE status='en_garde') AS on_shift,
          COUNT(*) AS total_recorded
        FROM attendance_records WHERE record_date=$1::date AND deleted_at IS NULL`, [today]),

      // Contracts expiring
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days') AS expiring_7d,
          COUNT(*) FILTER (WHERE end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days') AS expiring_30d,
          COUNT(*) FILTER (WHERE end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days') AS expiring_90d
        FROM employee_contracts
        WHERE status = 'actif' AND end_date IS NOT NULL AND deleted_at IS NULL`),

      // Documents expiring
      pool.query(`
        SELECT COUNT(*) FILTER (WHERE expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days') AS expiring_30d,
               COUNT(*) FILTER (WHERE expiry_date < CURRENT_DATE) AS expired
        FROM employee_documents WHERE deleted_at IS NULL AND expiry_date IS NOT NULL`),

      // Leaves pending
      pool.query(`
        SELECT COUNT(*) AS pending FROM leave_requests
        WHERE status IN ('soumise','validation_manager','validation_rh') AND deleted_at IS NULL`),

      // By department
      pool.query(`
        SELECT d.name, COUNT(ep.employee_id)::int AS count
        FROM hr_departments d
        LEFT JOIN employee_profiles ep ON ep.department_id = d.id AND ep.deleted_at IS NULL
        WHERE d.deleted_at IS NULL AND d.active = TRUE
        GROUP BY d.id, d.name ORDER BY count DESC LIMIT 10`),

      // By category
      pool.query(`
        SELECT category, COUNT(*)::int AS count
        FROM employees WHERE deleted_at IS NULL AND category IS NOT NULL
        GROUP BY category ORDER BY count DESC`),

      // Attendance trend last 14 days
      pool.query(`
        SELECT record_date::text AS date,
          COUNT(*) FILTER (WHERE status='present')::int AS present,
          COUNT(*) FILTER (WHERE status='retard')::int AS late,
          COUNT(*) FILTER (WHERE status='absent')::int AS absent
        FROM attendance_records
        WHERE record_date >= CURRENT_DATE - INTERVAL '14 days' AND deleted_at IS NULL
        GROUP BY record_date ORDER BY record_date`),

      // Absences by month (last 6 months)
      pool.query(`
        SELECT TO_CHAR(date_from, 'YYYY-MM') AS month, COUNT(*)::int AS count
        FROM absence_records
        WHERE date_from >= CURRENT_DATE - INTERVAL '6 months' AND deleted_at IS NULL
        GROUP BY month ORDER BY month`),

      // Late by month (last 6 months)
      pool.query(`
        SELECT TO_CHAR(record_date, 'YYYY-MM') AS month,
          COUNT(*)::int AS count,
          COALESCE(SUM(late_minutes),0)::int AS total_minutes
        FROM late_records
        WHERE record_date >= CURRENT_DATE - INTERVAL '6 months' AND deleted_at IS NULL
        GROUP BY month ORDER BY month`),

      // Overtime stats
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status='soumise') AS pending,
          COUNT(*) FILTER (WHERE status='approuvee') AS approved,
          COALESCE(SUM(overtime_hours) FILTER (WHERE status='approuvee'), 0) AS total_approved_hours
        FROM overtime_records WHERE deleted_at IS NULL`),

      // Vacant positions (max_headcount > actual)
      pool.query(`
        SELECT p.name, p.max_headcount,
          COUNT(ep.employee_id)::int AS current_count,
          GREATEST(0, p.max_headcount - COUNT(ep.employee_id)::int) AS vacancies
        FROM employee_positions p
        LEFT JOIN employee_profiles ep ON ep.position_id = p.id AND ep.deleted_at IS NULL
        WHERE p.deleted_at IS NULL AND p.max_headcount IS NOT NULL
        GROUP BY p.id, p.name, p.max_headcount
        HAVING COUNT(ep.employee_id) < p.max_headcount
        ORDER BY vacancies DESC LIMIT 5`),

      // Absent employees today (with names)
      pool.query(`
        SELECT e.id, e.first_name || ' ' || e.last_name AS name, e.matricule,
          d.name AS department, a.status
        FROM attendance_records a
        JOIN employees e ON e.id = a.employee_id
        LEFT JOIN employee_profiles ep ON ep.employee_id = e.id AND ep.deleted_at IS NULL
        LEFT JOIN hr_departments d ON d.id = ep.department_id
        WHERE a.record_date=$1::date AND a.status='absent' AND a.deleted_at IS NULL
        ORDER BY e.last_name LIMIT 10`, [today]),

      // Critical lates (> 30 min today)
      pool.query(`
        SELECT e.id, e.first_name || ' ' || e.last_name AS name, e.matricule,
          l.late_minutes, l.status
        FROM late_records l
        JOIN employees e ON e.id = l.employee_id
        WHERE l.record_date=$1::date AND l.late_minutes > 30 AND l.deleted_at IS NULL
        ORDER BY l.late_minutes DESC LIMIT 10`, [today]),

      // Uncovered shifts (no attendance record)
      pool.query(`
        SELECT s.id, e.first_name || ' ' || e.last_name AS employee_name,
          s.shift_date, s.start_time, s.type, d.name AS department
        FROM employee_shifts s
        JOIN employees e ON e.id = s.employee_id
        LEFT JOIN hr_departments d ON d.id = s.department_id
        LEFT JOIN attendance_records a ON a.employee_id = s.employee_id
          AND a.record_date = s.shift_date AND a.deleted_at IS NULL
        WHERE s.shift_date = $1::date AND s.deleted_at IS NULL
          AND s.status NOT IN ('annule','remplace')
          AND a.id IS NULL
        ORDER BY s.start_time LIMIT 10`, [today]),
    ]);

    const emp = totalEmployees.rows[0];
    const att = todayAttendance.rows[0];
    const ctr = contractsExpiring.rows[0];
    const docs = docsExpiring.rows[0];
    const ot = overtimeStats.rows[0];

    res.json({
      kpis: {
        total_employees:       n(emp.total),
        actif:                 n(emp.actif),
        on_leave:              n(emp.on_leave),
        suspended:             n(emp.suspended),
        sick:                  n(emp.sick),
        present_today:         n(att.present),
        absent_today:          n(att.absent),
        late_today:            n(att.late),
        on_shift_today:        n(att.on_shift),
        contracts_expiring_30d: n(ctr.expiring_30d),
        contracts_expiring_7d:  n(ctr.expiring_7d),
        documents_expiring_30d: n(docs.expiring_30d),
        documents_expired:      n(docs.expired),
        leaves_pending:         n(leavesPending.rows[0].pending),
        overtime_pending:       n(ot.pending),
        overtime_approved_hours: n(ot.total_approved_hours),
        vacant_positions:       vacantPositions.rows.reduce((s: number, r: any) => s + n(r.vacancies), 0),
      },
      charts: {
        by_department:    departmentBreakdown.rows,
        by_category:      categoryBreakdown.rows,
        attendance_trend: attendanceTrend.rows,
        absences_by_month: absencesByMonth.rows,
        late_by_month:    lateByMonth.rows,
      },
      alerts: {
        absent_today:      absentToday.rows,
        critical_lates:    criticalLate.rows,
        expiring_contracts: contractsExpiring.rows[0],
        vacant_positions:  vacantPositions.rows,
        uncovered_shifts:  uncoveredShifts.rows,
        leaves_pending:    n(leavesPending.rows[0].pending),
      },
    });
  } catch (err) { next(err); }
});

export default router;
