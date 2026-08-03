/**
 * /api/medical-stock/movements — stock movement log + manual entry
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();
function actor(req: AuthenticatedRequest) {
  return { userId: req.auth?.userId ?? "system" };
}

router.get("/movements", requirePermission("stock.movements.view"),
  async (req, res, next): Promise<void> => {
    try {
      const { item_id, movement_type, from_date, to_date, limit = "50", offset = "0" } = req.query as Record<string,string>;
      const conds = ["1=1"];
      const params: unknown[] = [];
      let pi = 1;
      if (item_id)      { conds.push(`m.item_id=$${pi++}::uuid`); params.push(item_id); }
      if (movement_type){ conds.push(`m.movement_type=$${pi++}::medical_movement_type`); params.push(movement_type); }
      if (from_date)    { conds.push(`m.performed_at >= $${pi++}::date`); params.push(from_date); }
      if (to_date)      { conds.push(`m.performed_at < ($${pi++}::date + interval '1 day')`); params.push(to_date); }
      const [rows, tot] = await Promise.all([
        pool.query(`
          SELECT m.*, i.name AS item_name, i.code AS item_code,
            u.symbol AS unit_symbol,
            usr.first_name||' '||usr.last_name AS performed_by_name,
            b.batch_number, b.lot_number
          FROM medical_stock_movements m
          JOIN medical_items i ON i.id = m.item_id
          LEFT JOIN medical_units un ON un.id = i.unit_id
          LEFT JOIN medical_units u ON u.id = i.unit_id
          LEFT JOIN users usr ON usr.id = m.performed_by
          LEFT JOIN medical_batches b ON b.id = m.batch_id
          WHERE ${conds.join(" AND ")}
          ORDER BY m.performed_at DESC
          LIMIT $${pi} OFFSET $${pi+1}`, [...params, parseInt(limit), parseInt(offset)]),
        pool.query(`SELECT COUNT(*) AS total FROM medical_stock_movements m WHERE ${conds.join(" AND ")}`, params)
      ]);
      res.json({ data: rows.rows, total: parseInt(tot.rows[0].total) });
    } catch (err) { next(err); }
  }
);

// Manual stock entry (entree / retour)
router.post("/movements", requirePermission("stock.movements.create"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { item_id, batch_id, movement_type, quantity, unit_cost, notes, reference_type, reference_id } = req.body;
      if (!item_id || !movement_type || !quantity)
        return void res.status(400).json({ error: "item_id, movement_type, quantity requis" });
      if (quantity <= 0)
        return void res.status(400).json({ error: "La quantité doit être positive" });

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const itemRow = await client.query(
          `SELECT quantity_on_hand, average_cost, unit_cost AS current_unit_cost FROM medical_items WHERE id=$1::uuid AND deleted_at IS NULL FOR UPDATE`,
          [item_id]);
        if (!itemRow.rows[0]) { await client.query("ROLLBACK"); return void res.status(404).json({ error: "Article non trouvé" }); }

        const current = Number(itemRow.rows[0].quantity_on_hand);
        const isOut = ['sortie','consommation','transfert_out','peremption','perte'].includes(movement_type);
        const qChange = isOut ? -quantity : quantity;
        const newQty = current + qChange;

        if (newQty < 0) { await client.query("ROLLBACK"); return void res.status(400).json({ error: "Stock insuffisant" }); }

        const cost = unit_cost ?? Number(itemRow.rows[0].current_unit_cost);
        const total = cost * Math.abs(quantity);

        // Update item stock
        let newAvg = Number(itemRow.rows[0].average_cost);
        if (!isOut && quantity > 0 && cost > 0) {
          // Weighted average cost
          newAvg = current > 0
            ? (current * newAvg + quantity * cost) / newQty
            : cost;
        }

        await client.query(
          `UPDATE medical_items SET quantity_on_hand=$1, average_cost=$2, last_purchase_price=CASE WHEN $3 THEN $4 ELSE last_purchase_price END, version=version+1 WHERE id=$5::uuid`,
          [newQty, newAvg, !isOut && cost > 0, cost, item_id]);

        if (batch_id) {
          const batchRow = await client.query(`SELECT quantity_on_hand FROM medical_batches WHERE id=$1::uuid FOR UPDATE`, [batch_id]);
          if (batchRow.rows[0]) {
            const bQty = Number(batchRow.rows[0].quantity_on_hand) + qChange;
            await client.query(`UPDATE medical_batches SET quantity_on_hand=$1 WHERE id=$2::uuid`, [Math.max(0, bQty), batch_id]);
          }
        }

        // Record movement
        const { rows } = await client.query(`
          INSERT INTO medical_stock_movements (item_id, batch_id, movement_type, quantity, quantity_before, quantity_after, unit_cost, total_cost, reference_type, reference_id, performed_by, notes)
          VALUES ($1::uuid,$2::uuid,$3::medical_movement_type,$4,$5,$6,$7,$8,$9,$10::uuid,$11::uuid,$12) RETURNING *`,
          [item_id, batch_id??null, movement_type, Math.abs(quantity), current, newQty, cost, total,
           reference_type??null, reference_id??null, act.userId, notes??null]);

        await client.query("COMMIT");
        res.status(201).json(rows[0]);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally { client.release(); }
    } catch (err) { next(err); }
  }
);

export default router;
