/**
 * /api/medical-stock/dashboard  — KPI cards + charts
 * /api/medical-stock/reports    — analytics & export data
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();

function n(v: unknown): number {
  const x = Number(v); return Number.isFinite(x) ? x : 0;
}

router.get("/dashboard", requirePermission("stock.dashboard.view"),
  async (_req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const [kpis, byCategory, topItems, topDepts, movements7d, expirations] = await Promise.all([
        pool.query(`
          SELECT
            COUNT(*) FILTER (WHERE deleted_at IS NULL AND is_active) AS total_items,
            COUNT(*) FILTER (WHERE deleted_at IS NULL AND is_active AND quantity_on_hand <= 0) AS rupture_count,
            COUNT(*) FILTER (WHERE deleted_at IS NULL AND is_active
              AND quantity_on_hand > 0 AND quantity_on_hand <= min_stock_level) AS critical_count,
            COUNT(*) FILTER (WHERE deleted_at IS NULL AND is_active
              AND quantity_on_hand > min_stock_level AND quantity_on_hand <= reorder_point) AS low_count,
            COALESCE(SUM(quantity_on_hand * average_cost) FILTER (WHERE deleted_at IS NULL AND is_active), 0) AS total_value,
            COUNT(*) FILTER (WHERE deleted_at IS NULL AND is_active
              AND max_stock_level IS NOT NULL AND quantity_on_hand > max_stock_level) AS overstock_count
          FROM medical_items`),
        pool.query(`
          SELECT c.name AS category, c.color,
            COUNT(i.id) AS items,
            COALESCE(SUM(i.quantity_on_hand * i.average_cost), 0) AS value
          FROM medical_categories c
          LEFT JOIN medical_items i ON i.category_id = c.id AND i.deleted_at IS NULL AND i.is_active
          WHERE c.deleted_at IS NULL
          GROUP BY c.id, c.name, c.color ORDER BY value DESC LIMIT 8`),
        pool.query(`
          SELECT i.id, i.code, i.name, i.quantity_on_hand, i.average_cost,
            i.quantity_on_hand * i.average_cost AS value,
            u.symbol AS unit_symbol
          FROM medical_items i
          LEFT JOIN medical_units u ON u.id = i.unit_id
          WHERE i.deleted_at IS NULL AND i.is_active
          ORDER BY (i.quantity_on_hand * i.average_cost) DESC LIMIT 10`),
        pool.query(`
          SELECT department, COUNT(*) AS cons_count,
            SUM(ci.quantity * ci.unit_cost) AS total_value
          FROM medical_consumptions mc
          JOIN medical_consumption_items ci ON ci.consumption_id = mc.id
          WHERE mc.deleted_at IS NULL AND mc.status = 'validee'
            AND mc.consumption_date >= CURRENT_DATE - 30
          GROUP BY department ORDER BY total_value DESC LIMIT 8`),
        pool.query(`
          SELECT DATE(performed_at) AS day,
            SUM(CASE WHEN movement_type = 'entree' THEN quantity ELSE 0 END) AS entries,
            SUM(CASE WHEN movement_type IN ('sortie','consommation') THEN quantity ELSE 0 END) AS exits
          FROM medical_stock_movements
          WHERE performed_at >= CURRENT_DATE - 6
          GROUP BY DATE(performed_at) ORDER BY day`),
        pool.query(`
          SELECT COUNT(*) FILTER (WHERE expiry_date < CURRENT_DATE) AS expired,
            COUNT(*) FILTER (WHERE expiry_date >= CURRENT_DATE AND expiry_date <= CURRENT_DATE + 7) AS critical_7d,
            COUNT(*) FILTER (WHERE expiry_date > CURRENT_DATE + 7 AND expiry_date <= CURRENT_DATE + 30) AS urgent_30d,
            COUNT(*) FILTER (WHERE expiry_date > CURRENT_DATE + 30 AND expiry_date <= CURRENT_DATE + 90) AS warn_90d
          FROM medical_batches
          WHERE deleted_at IS NULL AND status = 'actif' AND quantity_on_hand > 0`)
      ]);

      res.json({
        kpis: {
          totalItems:     n(kpis.rows[0].total_items),
          ruptureCount:   n(kpis.rows[0].rupture_count),
          criticalCount:  n(kpis.rows[0].critical_count),
          lowCount:       n(kpis.rows[0].low_count),
          overstockCount: n(kpis.rows[0].overstock_count),
          totalValue:     n(kpis.rows[0].total_value),
        },
        byCategory:  byCategory.rows,
        topItems:    topItems.rows,
        topDepartments: topDepts.rows,
        movementsTrend: movements7d.rows,
        expirations: expirations.rows[0],
      });
    } catch (err) { next(err); }
  }
);

router.get("/reports/movements", requirePermission("stock.reports.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { from, to, item_id, type, limit = "100", offset = "0" } = req.query as Record<string,string>;
      const conds: string[] = ["1=1"];
      const params: unknown[] = [];
      let pi = 1;
      if (from)    { conds.push(`m.performed_at >= $${pi++}::date`); params.push(from); }
      if (to)      { conds.push(`m.performed_at < ($${pi++}::date + interval '1 day')`); params.push(to); }
      if (item_id) { conds.push(`m.item_id = $${pi++}::uuid`); params.push(item_id); }
      if (type)    { conds.push(`m.movement_type = $${pi++}::medical_movement_type`); params.push(type); }

      const { rows } = await pool.query(`
        SELECT m.*, i.name AS item_name, i.code AS item_code,
          u.first_name || ' ' || u.last_name AS performed_by_name,
          b.batch_number, b.lot_number
        FROM medical_stock_movements m
        JOIN medical_items i ON i.id = m.item_id
        LEFT JOIN users u ON u.id = m.performed_by
        LEFT JOIN medical_batches b ON b.id = m.batch_id
        WHERE ${conds.join(" AND ")}
        ORDER BY m.performed_at DESC
        LIMIT $${pi} OFFSET $${pi+1}`, [...params, parseInt(limit), parseInt(offset)]);

      const tot = await pool.query(`
        SELECT COUNT(*) AS total FROM medical_stock_movements m WHERE ${conds.join(" AND ")}`, params);
      res.json({ data: rows, total: parseInt(tot.rows[0].total) });
    } catch (err) { next(err); }
  }
);

router.get("/reports/valuations", requirePermission("stock.reports.view"),
  async (_req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { rows } = await pool.query(`
        SELECT i.id, i.code, i.name, i.item_type,
          cat.name AS category,
          i.quantity_on_hand,
          i.average_cost, i.unit_cost, i.last_purchase_price,
          i.quantity_on_hand * i.average_cost AS stock_value,
          u.symbol AS unit_symbol
        FROM medical_items i
        LEFT JOIN medical_categories cat ON cat.id = i.category_id
        LEFT JOIN medical_units u ON u.id = i.unit_id
        WHERE i.deleted_at IS NULL AND i.is_active
        ORDER BY (i.quantity_on_hand * i.average_cost) DESC`);
      res.json({ data: rows });
    } catch (err) { next(err); }
  }
);

export default router;
