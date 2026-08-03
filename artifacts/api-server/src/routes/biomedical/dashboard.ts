import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";

const router = Router();

// ── Main dashboard ─────────────────────────────────────────────────────────
router.get("/", requirePermission("biomed.dashboard.view"),
  async (_req, res, next): Promise<void> => {
    try {
      const [kpis, byStatus, byCategory, byCriticality,
             maintenancePlan, topFailures, recentWO, expiringSoon] = await Promise.all([
        // KPIs
        pool.query(`SELECT * FROM v_biomed_dashboard_kpis`),
        // Status breakdown
        pool.query(`SELECT status, COUNT(*) AS count
          FROM biomedical_equipment WHERE deleted_at IS NULL GROUP BY status`),
        // Category breakdown
        pool.query(`SELECT c.name, c.color, COUNT(e.id) AS count,
            COALESCE(SUM(e.current_value),0) AS value
          FROM biomedical_categories c
          LEFT JOIN biomedical_equipment e ON e.category_id=c.id AND e.deleted_at IS NULL
          GROUP BY c.id ORDER BY count DESC LIMIT 8`),
        // Criticality breakdown
        pool.query(`SELECT criticality, COUNT(*) AS count
          FROM biomedical_equipment WHERE deleted_at IS NULL GROUP BY criticality`),
        // Upcoming maintenance (next 30 days)
        pool.query(`SELECT e.internal_code, e.name, e.next_maintenance_date, e.criticality,
            l.name AS location_name
          FROM biomedical_equipment e
          LEFT JOIN biomedical_locations l ON l.id=e.location_id
          WHERE e.deleted_at IS NULL AND e.status='actif'
            AND e.next_maintenance_date IS NOT NULL
            AND e.next_maintenance_date <= CURRENT_DATE + 30
          ORDER BY e.next_maintenance_date LIMIT 10`),
        // Top failure equipment (last 90 days)
        pool.query(`SELECT e.name, e.internal_code, COUNT(f.id) AS failure_count,
            COALESCE(SUM(f.downtime_hours),0) AS total_downtime
          FROM biomedical_equipment_failures f
          JOIN biomedical_equipment e ON e.id=f.equipment_id
          WHERE f.failure_date >= now() - interval '90 days'
          GROUP BY e.id ORDER BY failure_count DESC LIMIT 5`),
        // Recent work orders
        pool.query(`SELECT wo.order_number, wo.title, wo.status, wo.order_type,
            e.name AS equipment_name, wo.scheduled_date, wo.total_cost
          FROM biomedical_work_orders wo
          JOIN biomedical_equipment e ON e.id=wo.equipment_id
          ORDER BY wo.created_at DESC LIMIT 8`),
        // Equipment with expiring calibration (next 30 days)
        pool.query(`SELECT e.internal_code, e.name, e.next_calibration_date,
            e.calibration_expired, e.criticality
          FROM biomedical_equipment e
          WHERE e.deleted_at IS NULL AND e.next_calibration_date IS NOT NULL
            AND e.next_calibration_date <= CURRENT_DATE + 30
          ORDER BY e.next_calibration_date LIMIT 8`),
      ]);

      // MTBF/MTTR (last 90d)
      const mtbf = await pool.query(`
        SELECT ROUND(
          CASE WHEN COUNT(DISTINCT f.equipment_id)>0
          THEN (SUM(EXTRACT(EPOCH FROM (COALESCE(f.downtime_end, now()) - f.failure_date))/3600)
               / NULLIF(COUNT(f.id),0))
          ELSE 0 END
        , 1) AS mttr,
        COUNT(f.id) AS total_failures
        FROM biomedical_equipment_failures f
        WHERE f.failure_date >= now() - interval '90 days'`);

      // Maintenance cost last 12 months trend
      const costTrend = await pool.query(`
        SELECT to_char(date_trunc('month', created_at), 'Mon') AS month,
          COALESCE(SUM(total_cost),0) AS cost,
          COUNT(*) AS count
        FROM biomedical_work_orders
        WHERE status='termine' AND created_at >= now() - interval '12 months'
        GROUP BY date_trunc('month', created_at)
        ORDER BY date_trunc('month', created_at)`);

      res.json({
        kpis: kpis.rows[0],
        byStatus: byStatus.rows,
        byCategory: byCategory.rows,
        byCriticality: byCriticality.rows,
        maintenancePlan: maintenancePlan.rows,
        topFailures: topFailures.rows,
        recentWorkOrders: recentWO.rows,
        expiringSoon: expiringSoon.rows,
        mttr: mtbf.rows[0]?.mttr ?? 0,
        totalFailures90d: Number(mtbf.rows[0]?.total_failures ?? 0),
        costTrend: costTrend.rows,
      });
    } catch (err) { next(err); }
  }
);

// ── MTBF per equipment ─────────────────────────────────────────────────────
router.get("/mtbf", requirePermission("biomed.reports.view"),
  async (_req, res, next): Promise<void> => {
    try {
      const { rows } = await pool.query(`
        SELECT e.name, e.internal_code,
          COUNT(f.id) AS failure_count,
          ROUND(COALESCE(SUM(f.downtime_hours),0),1) AS total_downtime,
          ROUND(COALESCE(AVG(f.downtime_hours),0),1) AS avg_downtime
        FROM biomedical_equipment e
        LEFT JOIN biomedical_equipment_failures f ON f.equipment_id=e.id
        WHERE e.deleted_at IS NULL
        GROUP BY e.id ORDER BY failure_count DESC LIMIT 20`);
      res.json({ data: rows });
    } catch (err) { next(err); }
  }
);

// ── Cost report ────────────────────────────────────────────────────────────
router.get("/costs", requirePermission("biomed.reports.view"),
  async (req, res, next): Promise<void> => {
    try {
      const { from, to } = req.query as Record<string,string>;
      const from_ = from ?? new Date(Date.now()-365*86400000).toISOString().split("T")[0];
      const to_   = to   ?? new Date().toISOString().split("T")[0];
      const { rows } = await pool.query(`
        SELECT e.name, e.internal_code, c.name AS category,
          COUNT(wo.id) AS work_order_count,
          COALESCE(SUM(wo.total_cost),0) AS total_cost,
          COALESCE(SUM(wo.labor_cost),0) AS labor_cost,
          COALESCE(SUM(wo.parts_cost),0) AS parts_cost
        FROM biomedical_equipment e
        JOIN biomedical_work_orders wo ON wo.equipment_id=e.id AND wo.status='termine'
          AND wo.created_at BETWEEN $1 AND $2
        LEFT JOIN biomedical_categories c ON c.id=e.category_id
        WHERE e.deleted_at IS NULL
        GROUP BY e.id, c.name ORDER BY total_cost DESC LIMIT 20`,
        [from_, to_]);
      res.json({ data: rows, from: from_, to: to_ });
    } catch (err) { next(err); }
  }
);

// ── Availability report ────────────────────────────────────────────────────
router.get("/availability", requirePermission("biomed.reports.view"),
  async (_req, res, next): Promise<void> => {
    try {
      const { rows } = await pool.query(`
        SELECT e.name, e.internal_code, e.status, e.criticality,
          ROUND(100 - COALESCE(
            SUM(f.downtime_hours) / NULLIF(EXTRACT(EPOCH FROM (now() - e.commissioning_date))/3600, 0) * 100
          , 0), 2) AS availability_pct,
          COALESCE(SUM(f.downtime_hours),0) AS total_downtime_hours
        FROM biomedical_equipment e
        LEFT JOIN biomedical_equipment_failures f ON f.equipment_id=e.id
          AND f.failure_date >= now() - interval '1 year'
        WHERE e.deleted_at IS NULL AND e.commissioning_date IS NOT NULL
        GROUP BY e.id ORDER BY availability_pct ASC LIMIT 20`);
      res.json({ data: rows });
    } catch (err) { next(err); }
  }
);

export default router;
