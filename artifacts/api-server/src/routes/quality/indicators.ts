import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();

router.get("/indicators", requirePermission("quality.indicators.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { q, category, is_active } = req.query as Record<string,string>;
      const conds: string[] = []; const params: unknown[] = []; let pi = 1;
      if (q)        { conds.push(`(name ILIKE $${pi} OR reference ILIKE $${pi})`); params.push(`%${q}%`); pi++; }
      if (category) { conds.push(`category = $${pi++}`); params.push(category); }
      if (is_active !== undefined) { conds.push(`is_active = $${pi++}`); params.push(is_active === "true"); }
      const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
      const { rows } = await pool.query(
        `SELECT i.*, (SELECT value FROM quality_indicator_values WHERE indicator_id = i.id ORDER BY period_start DESC LIMIT 1) AS last_value,
                     (SELECT trend FROM quality_indicator_values WHERE indicator_id = i.id ORDER BY period_start DESC LIMIT 1) AS trend
         FROM quality_indicators i ${where} ORDER BY i.name`, params);
      res.json({ data: rows });
    } catch (err) { next(err); }
  }
);

router.get("/indicators/:id/values", requirePermission("quality.indicators.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { limit = "24" } = req.query as Record<string,string>;
      const { rows } = await pool.query(
        "SELECT * FROM quality_indicator_values WHERE indicator_id = $1 ORDER BY period_start DESC LIMIT $2",
        [req.params.id, limit]);
      res.json({ data: rows });
    } catch (err) { next(err); }
  }
);

router.post("/indicators", requirePermission("quality.indicators.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const {
        name, description, category, unit = "%", target_value, alert_threshold,
        frequency = "mensuel", formula, data_source,
      } = req.body;
      if (!name) { res.status(400).json({ error: "name requis" }); return; }
      const userId = req.auth?.userId;
      const { rows: [ind] } = await pool.query(`
        INSERT INTO quality_indicators
          (name, description, category, unit, target_value, alert_threshold,
           frequency, formula, data_source, responsible_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [name, description, category, unit, target_value || null, alert_threshold || null,
         frequency, formula, data_source, userId]);
      res.status(201).json(ind);
    } catch (err) { next(err); }
  }
);

router.post("/indicators/:id/values", requirePermission("quality.indicators.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { period_label, period_start, period_end, value, trend, comments } = req.body;
      if (!period_label || value === undefined) {
        res.status(400).json({ error: "period_label et value requis" }); return;
      }
      const userId = req.auth?.userId;
      const { rows: [v] } = await pool.query(`
        INSERT INTO quality_indicator_values
          (indicator_id, period_label, period_start, period_end, value, trend, comments, recorded_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (indicator_id, period_label)
        DO UPDATE SET value = EXCLUDED.value, trend = EXCLUDED.trend, comments = EXCLUDED.comments
        RETURNING *`,
        [req.params.id, period_label, period_start, period_end, value, trend || null, comments, userId]);
      res.status(201).json(v);
    } catch (err) { next(err); }
  }
);

export default router;
