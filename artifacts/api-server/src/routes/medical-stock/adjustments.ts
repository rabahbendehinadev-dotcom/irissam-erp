/**
 * /api/medical-stock/adjustments — stock adjustments (inventory, loss, etc.)
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();
function actor(req: AuthenticatedRequest) {
  return { userId: req.auth?.userId ?? "system" };
}

router.get("/adjustments", requirePermission("stock.adjustments.view"),
  async (req, res, next): Promise<void> => {
    try {
      const { item_id, reason, limit = "50", offset = "0" } = req.query as Record<string,string>;
      const conds = ["a.deleted_at IS NULL"];
      const params: unknown[] = [];
      let pi = 1;
      if (item_id) { conds.push(`a.item_id=$${pi++}::uuid`); params.push(item_id); }
      if (reason)  { conds.push(`a.reason=$${pi++}::medical_adj_reason`); params.push(reason); }
      const [rows, tot] = await Promise.all([
        pool.query(`
          SELECT a.*, i.name AS item_name, i.code AS item_code, u.symbol AS unit_symbol,
            cr.first_name||' '||cr.last_name AS created_by_name,
            ap.first_name||' '||ap.last_name AS approved_by_name,
            b.batch_number, b.lot_number
          FROM medical_stock_adjustments a
          JOIN medical_items i ON i.id = a.item_id
          LEFT JOIN medical_units u ON u.id = i.unit_id
          LEFT JOIN users cr ON cr.id = a.created_by
          LEFT JOIN users ap ON ap.id = a.approved_by
          LEFT JOIN medical_batches b ON b.id = a.batch_id
          WHERE ${conds.join(" AND ")}
          ORDER BY a.created_at DESC
          LIMIT $${pi} OFFSET $${pi+1}`, [...params, parseInt(limit), parseInt(offset)]),
        pool.query(`SELECT COUNT(*) AS total FROM medical_stock_adjustments a WHERE ${conds.join(" AND ")}`, params)
      ]);
      res.json({ data: rows.rows, total: parseInt(tot.rows[0].total) });
    } catch (err) { next(err); }
  }
);

router.post("/adjustments", requirePermission("stock.adjustments.create"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { item_id, batch_id, reason, quantity_change, unit_cost, notes, document_ref } = req.body;
      if (!item_id || !reason || quantity_change === undefined)
        return void res.status(400).json({ error: "item_id, reason, quantity_change requis" });

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const itemRow = await client.query(
          `SELECT quantity_on_hand, average_cost FROM medical_items WHERE id=$1::uuid AND deleted_at IS NULL FOR UPDATE`, [item_id]);
        if (!itemRow.rows[0]) { await client.query("ROLLBACK"); return void res.status(404).json({ error: "Article non trouvé" }); }

        const before = Number(itemRow.rows[0].quantity_on_hand);
        const after  = before + quantity_change;
        if (after < 0) { await client.query("ROLLBACK"); return void res.status(400).json({ error: "Le stock ne peut pas être négatif" }); }

        const cost = unit_cost ?? Number(itemRow.rows[0].average_cost);
        await client.query(`UPDATE medical_items SET quantity_on_hand=$1, version=version+1 WHERE id=$2::uuid`, [after, item_id]);

        if (batch_id) {
          await client.query(`UPDATE medical_batches SET quantity_on_hand=GREATEST(0, quantity_on_hand+$1) WHERE id=$2::uuid`, [quantity_change, batch_id]);
        }

        const { rows } = await client.query(`
          INSERT INTO medical_stock_adjustments (item_id, batch_id, reason, quantity_before, quantity_change, quantity_after, unit_cost, total_value, notes, document_ref, created_by, updated_by)
          VALUES ($1::uuid,$2::uuid,$3::medical_adj_reason,$4,$5,$6,$7,$8,$9,$10,$11::uuid,$11::uuid) RETURNING *`,
          [item_id, batch_id??null, reason, before, quantity_change, after, cost, Math.abs(quantity_change * cost), notes??null, document_ref??null, act.userId]);

        const mvtType = quantity_change >= 0 ? 'ajustement_plus' : 'ajustement_moins';
        await client.query(`
          INSERT INTO medical_stock_movements (item_id, batch_id, movement_type, quantity, quantity_before, quantity_after, unit_cost, total_cost, reference_type, reference_id, performed_by, notes)
          VALUES ($1::uuid,$2::uuid,$3::medical_movement_type,$4,$5,$6,$7,$8,'adjustment',$9::uuid,$10::uuid,$11)`,
          [item_id, batch_id??null, mvtType, Math.abs(quantity_change), before, after, cost, Math.abs(quantity_change * cost), rows[0].id, act.userId, notes??null]);

        await client.query("COMMIT");
        res.status(201).json(rows[0]);
      } catch (err) { await client.query("ROLLBACK"); throw err; }
      finally { client.release(); }
    } catch (err) { next(err); }
  }
);

export default router;
