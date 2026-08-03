/**
 * /api/medical-stock/inventory — inventory sessions (physical count)
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();
function actor(req: AuthenticatedRequest) {
  return { userId: req.auth?.userId ?? "system" };
}

router.get("/inventory", requirePermission("stock.inventory.view"),
  async (req, res, next): Promise<void> => {
    try {
      const { status, limit = "20", offset = "0" } = req.query as Record<string,string>;
      const conds = ["s.deleted_at IS NULL"];
      const params: unknown[] = [];
      let pi = 1;
      if (status) { conds.push(`s.status=$${pi++}::medical_inventory_status`); params.push(status); }
      const [rows, tot] = await Promise.all([
        pool.query(`
          SELECT s.*, cr.first_name||' '||cr.last_name AS created_by_name
          FROM medical_inventory_sessions s
          JOIN users cr ON cr.id = s.created_by
          WHERE ${conds.join(" AND ")}
          ORDER BY s.start_date DESC LIMIT $${pi} OFFSET $${pi+1}`, [...params, parseInt(limit), parseInt(offset)]),
        pool.query(`SELECT COUNT(*) AS total FROM medical_inventory_sessions s WHERE ${conds.join(" AND ")}`, params)
      ]);
      res.json({ data: rows.rows, total: parseInt(tot.rows[0].total) });
    } catch (err) { next(err); }
  }
);

router.get("/inventory/:id", requirePermission("stock.inventory.view"),
  async (req, res, next): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM medical_inventory_sessions WHERE id=$1::uuid AND deleted_at IS NULL`, [req.params.id]);
      if (!rows[0]) return void res.status(404).json({ error: "Session non trouvée" });
      const items = await pool.query(`
        SELECT ii.*, i.name AS item_name, i.code AS item_code, u.symbol AS unit_symbol,
          b.batch_number, b.lot_number
        FROM medical_inventory_items ii
        JOIN medical_items i ON i.id = ii.item_id
        LEFT JOIN medical_units u ON u.id = i.unit_id
        LEFT JOIN medical_batches b ON b.id = ii.batch_id
        WHERE ii.session_id=$1::uuid ORDER BY i.name`, [req.params.id]);
      res.json({ ...rows[0], items: items.rows });
    } catch (err) { next(err); }
  }
);

router.post("/inventory", requirePermission("stock.inventory.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { name, description, location, start_date, notes } = req.body;
      if (!name) return void res.status(400).json({ error: "name requis" });

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const { rows } = await client.query(`
          INSERT INTO medical_inventory_sessions (name, description, location, start_date, notes, created_by, updated_by)
          VALUES ($1,$2,$3,$4,$5,$6::uuid,$6::uuid) RETURNING *`,
          [name, description??null, location??null, start_date ?? new Date().toISOString().split('T')[0], notes??null, act.userId]);
        const sessionId = rows[0].id;

        // Snapshot current stock as theoretical quantities
        const items = await client.query(`
          SELECT i.id AS item_id, i.quantity_on_hand AS theoretical_qty, i.average_cost AS unit_cost,
            NULL::uuid AS batch_id
          FROM medical_items i WHERE i.deleted_at IS NULL AND i.is_active`);

        let total = 0;
        for (const it of items.rows) {
          await client.query(`
            INSERT INTO medical_inventory_items (session_id, item_id, batch_id, theoretical_qty, unit_cost)
            VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5)`,
            [sessionId, it.item_id, it.batch_id, it.theoretical_qty, it.unit_cost]);
          total++;
        }
        await client.query(`UPDATE medical_inventory_sessions SET total_items=$1 WHERE id=$2::uuid`, [total, sessionId]);
        await client.query("COMMIT");
        res.status(201).json({ ...rows[0], total_items: total });
      } catch (err) { await client.query("ROLLBACK"); throw err; }
      finally { client.release(); }
    } catch (err) { next(err); }
  }
);

// PATCH /inventory/:id/items/:itemId — count a line
router.patch("/inventory/:id/items/:itemId", requirePermission("stock.inventory.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { counted_qty, notes } = req.body;
      if (counted_qty === undefined) return void res.status(400).json({ error: "counted_qty requis" });
      const { rows } = await pool.query(`
        UPDATE medical_inventory_items
        SET counted_qty=$1, is_counted=TRUE, notes=$2, counted_by=$3::uuid, counted_at=NOW()
        WHERE id=$4::uuid AND session_id=$5::uuid RETURNING *`,
        [counted_qty, notes??null, act.userId, req.params.itemId, req.params.id]);
      if (!rows[0]) return void res.status(404).json({ error: "Ligne non trouvée" });

      // Update session progress
      await pool.query(`
        UPDATE medical_inventory_sessions
        SET items_counted = (SELECT COUNT(*) FROM medical_inventory_items WHERE session_id=$1 AND is_counted),
            variance_count = (SELECT COUNT(*) FROM medical_inventory_items WHERE session_id=$1 AND counted_qty IS NOT NULL AND counted_qty <> theoretical_qty),
            variance_value = (SELECT COALESCE(SUM(ABS((counted_qty - theoretical_qty) * unit_cost)),0) FROM medical_inventory_items WHERE session_id=$1 AND counted_qty IS NOT NULL)
        WHERE id=$1::uuid`, [req.params.id]);
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

// POST /inventory/:id/validate — apply variances to stock
router.post("/inventory/:id/validate", requirePermission("stock.inventory.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const session = await client.query(
          `SELECT * FROM medical_inventory_sessions WHERE id=$1::uuid AND deleted_at IS NULL FOR UPDATE`, [req.params.id]);
        if (!session.rows[0]) { await client.query("ROLLBACK"); return void res.status(404).json({ error: "Session non trouvée" }); }
        if (session.rows[0].status !== 'en_cours') { await client.query("ROLLBACK"); return void res.status(400).json({ error: "Session déjà clôturée" }); }

        const variances = await client.query(`
          SELECT ii.*, i.quantity_on_hand AS current_qty
          FROM medical_inventory_items ii
          JOIN medical_items i ON i.id = ii.item_id
          WHERE ii.session_id=$1::uuid AND ii.counted_qty IS NOT NULL AND ii.counted_qty <> ii.theoretical_qty
          FOR UPDATE OF i`, [req.params.id]);

        for (const v of variances.rows) {
          const diff = Number(v.counted_qty) - Number(v.theoretical_qty);
          const newQty = Math.max(0, Number(v.current_qty) + diff);
          await client.query(`UPDATE medical_items SET quantity_on_hand=$1, version=version+1 WHERE id=$2::uuid`, [newQty, v.item_id]);
          const mvtType = diff >= 0 ? 'inventaire_plus' : 'inventaire_moins';
          await client.query(`
            INSERT INTO medical_stock_movements (item_id, movement_type, quantity, quantity_before, quantity_after, reference_type, reference_id, performed_by)
            VALUES ($1::uuid,$2::medical_movement_type,$3,$4,$5,'inventory',$6::uuid,$7::uuid)`,
            [v.item_id, mvtType, Math.abs(diff), v.current_qty, newQty, req.params.id, act.userId]);

          await client.query(`
            INSERT INTO medical_stock_adjustments (item_id, reason, quantity_before, quantity_change, quantity_after, notes, created_by, updated_by, approved_by, approved_at)
            VALUES ($1::uuid,'inventaire',$2,$3,$4,'Validation inventaire '||$5,$6::uuid,$6::uuid,$6::uuid,NOW())`,
            [v.item_id, v.current_qty, diff, newQty, session.rows[0].session_number, act.userId]);
        }

        await client.query(`UPDATE medical_inventory_sessions SET status='validee', end_date=CURRENT_DATE, validated_by=$1::uuid, validated_at=NOW() WHERE id=$2::uuid`,
          [act.userId, req.params.id]);
        await client.query("COMMIT");
        res.json({ ok: true, variances_applied: variances.rows.length });
      } catch (err) { await client.query("ROLLBACK"); throw err; }
      finally { client.release(); }
    } catch (err) { next(err); }
  }
);

export default router;
