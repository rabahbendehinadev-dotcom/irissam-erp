import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();

// GET /quality/dashboard
router.get("/dashboard", requirePermission("quality.dashboard.view"),
  async (_req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { rows: [kpis] } = await pool.query("SELECT * FROM v_quality_dashboard_kpis");

      const { rows: incidentsByMonth } = await pool.query(`
        SELECT to_char(date_trunc('month', occurrence_date), 'YYYY-MM') AS month,
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE severity IN ('grave','critique')) AS severe
        FROM quality_incidents
        WHERE occurrence_date >= now() - INTERVAL '12 months'
        GROUP BY 1 ORDER BY 1
      `);

      const { rows: byType } = await pool.query(`
        SELECT incident_type AS name, COUNT(*) AS value
        FROM quality_incidents WHERE created_at >= now() - INTERVAL '90 days'
        GROUP BY 1 ORDER BY 2 DESC
      `);

      const { rows: bySeverity } = await pool.query(`
        SELECT severity AS name, COUNT(*) AS value
        FROM quality_incidents WHERE status <> 'clos'
        GROUP BY 1 ORDER BY 2 DESC
      `);

      const { rows: capaStatus } = await pool.query(`
        SELECT 'corrective' AS capa_type, status, COUNT(*) AS cnt FROM quality_corrective_actions GROUP BY status
        UNION ALL
        SELECT 'preventive', status, COUNT(*) FROM quality_preventive_actions GROUP BY status
        ORDER BY 1,2
      `);

      const { rows: riskHeatmap } = await pool.query("SELECT * FROM v_quality_risk_heatmap ORDER BY probability, impact");

      const { rows: indicators } = await pool.query(`
        SELECT qi.id, qi.name, qi.unit, qi.target_value, qi.alert_threshold,
               (SELECT value FROM quality_indicator_values WHERE indicator_id = qi.id ORDER BY period_start DESC LIMIT 1) AS last_value,
               (SELECT trend FROM quality_indicator_values WHERE indicator_id = qi.id ORDER BY period_start DESC LIMIT 1) AS trend
        FROM quality_indicators qi WHERE qi.is_active = true ORDER BY qi.name LIMIT 10
      `);

      const { rows: upcomingAudits } = await pool.query(`
        SELECT id, reference, title, audit_type, planned_start_date, lead_auditor_name
        FROM quality_audits WHERE status = 'planifie' AND planned_start_date <= CURRENT_DATE + 60
        ORDER BY planned_start_date LIMIT 5
      `);

      const { rows: expiringDocs } = await pool.query(`
        SELECT id, reference, title, doc_type, expiry_date, owner_name
        FROM quality_documents WHERE status = 'publie' AND expiry_date <= CURRENT_DATE + 60
        ORDER BY expiry_date LIMIT 5
      `);

      const { rows: overdueCapas } = await pool.query(`
        SELECT 'corrective' AS capa_type, id, reference, title, due_date, responsible_name, department
        FROM quality_corrective_actions
        WHERE status NOT IN ('efficace','inefficace','annulee') AND due_date < CURRENT_DATE
        UNION ALL
        SELECT 'preventive', id, reference, title, due_date, responsible_name, department
        FROM quality_preventive_actions
        WHERE status NOT IN ('efficace','inefficace','annulee') AND due_date < CURRENT_DATE
        ORDER BY due_date LIMIT 10
      `);

      res.json({
        kpis,
        incidentsByMonth,
        byType,
        bySeverity,
        capaStatus,
        riskHeatmap,
        indicators,
        upcomingAudits,
        expiringDocs,
        overdueCapas,
      });
    } catch (err) { next(err); }
  }
);

export default router;
