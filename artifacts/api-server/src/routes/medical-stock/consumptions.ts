/**
 * /api/medical-stock/consumptions — service consumption records (FIFO/FEFO deduction)
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();
function actor(req: AuthenticatedRequest) {
  return { userId: req.auth?.userId ?? "system" };
}

router.get("/consumptions", requirePermission("stock.consumptions.view"),
  async (req, res, next): Promise<void> => {
    try {
      const { department, status, from_date, to_date, limit = "50", offset = "0" } = req.query as Record<string,string>;
      const conds = ["mc.deleted_at IS NULL"];
      const params: unknown[] = [];
      let pi = 1;
      if (department) { conds.push(`mc.department=$${pi++}`); params.push(department); }
      if (status)     { conds.push(`mc.status=$${pi++}::cons_status`); params.push(status); }
      if (from_date)  { conds.push(`mc.consumption_date >= $${pi++}::date`); params.push(from_date); }
      if (to_date)    { conds.push(`mc.consumption_date <= $${pi++}::date`); params.push(to_date); }
      const [rows, tot] = await Promise.all([
        pool.query(`
          SELECT mc.*, cr.first_name||' '||cr.last_name AS created_by_name,
            p.first_name||' '||p.last_name AS patient_name,
            (SELECT COALESCE(SUM(ci.quantity * ci.unit_cost),0) FROM medical_consumption_items ci WHERE ci.consumption_id = mc.id) AS total_value,
            (SELECT COUNT(*) FROM medical_consumption_items ci WHERE ci.consumption_id = mc.id) AS items_count
          FROM medical_consumptions mc
          JOIN users cr ON cr.id = mc.created_by
          LEFT JOIN patients p ON p.id = mc.patient_id
          WHERE ${conds.join(" AND ")}
          ORDER BY mc.consumption_date DESC, mc.created_at DESC
          LIMIT $${pi} OFFSET $${pi+1}`, [...params, parseInt(limit), parseInt(offset)]),
        pool.query(`SELECT COUNT(*) AS total FROM medical_consumptions mc WHERE ${conds.join(" AND ")}`, params)
      ]);
      res.json({ data: rows.rows, total: parseInt(tot.rows[0].total) });
    } catch (err) { next(err); }
  }
);

router.get("/consumptions/:id", requirePermission("stock.consumptions.view"),
  async (req, res, next): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT mc.*, p.first_name||' '||p.last_name AS patient_name FROM medical_consumptions mc
         LEFT JOIN patients p ON p.id = mc.patient_id
         WHERE mc.id=$1::uuid AND mc.deleted_at IS NULL`, [req.params.id]);
      if (!rows[0]) return void res.status(404).json({ error: "Consommation non trouvée" });
      const items = await pool.query(`
        SELECT ci.*, i.name AS item_name, i.code AS item_code, u.symbol AS unit_symbol, b.batch_number
        FROM medical_consumption_items ci
        JOIN medical_items i ON i.id = ci.item_id
        LEFT JOIN medical_units u ON u.id = i.unit_id
        LEFT JOIN medical_batches b ON b.id = ci.batch_id
        WHERE ci.consumption_id=$1::uuid`, [req.params.id]);
      res.json({ ...rows[0], items: items.rows });
    } catch (err) { next(err); }
  }
);

// POST — create consumption (FEFO: First Expired First Out)
router.post("/consumptions", requirePermission("stock.consumptions.create"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { department, patient_id, encounter_id, consumption_date, notes, items = [], auto_validate = false } = req.body;
      if (!department || !items.length)
        return void res.status(400).json({ error: "department et items requis" });

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Verify stock availability
        for (const it of items) {
          const stock = await client.query(
            `SELECT quantity_on_hand FROM medical_items WHERE id=$1::uuid AND deleted_at IS NULL`, [it.item_id]);
          if (!stock.rows[0]) { await client.query("ROLLBACK"); return void res.status(404).json({ error: `Article ${it.item_id} non trouvé` }); }
          if (Number(stock.rows[0].quantity_on_hand) < it.quantity) {
            await client.query("ROLLBACK");
            return void res.status(400).json({ error: `Stock insuffisant pour l'article ${it.item_id}`, available: stock.rows[0].quantity_on_hand });
          }
        }

        const { rows } = await client.query(`
          INSERT INTO medical_consumptions (department, patient_id, encounter_id, consumption_date, notes, status, created_by, updated_by)
          VALUES ($1,$2::uuid,$3::uuid,$4,$5,'brouillon',$6::uuid,$6::uuid) RETURNING *`,
          [department, patient_id??null, encounter_id??null,
           consumption_date ?? new Date().toISOString().split('T')[0], notes??null, act.userId]);
        const consId = rows[0].id;

        for (const it of items) {
          // FEFO: pick batch with earliest expiry date first
          const itemRow = await client.query(
            `SELECT quantity_on_hand, average_cost FROM medical_items WHERE id=$1::uuid FOR UPDATE`, [it.item_id]);
          const cost = Number(itemRow.rows[0].average_cost);
          const before = Number(itemRow.rows[0].quantity_on_hand);

          // Find batches by FEFO order
          const batches = await client.query(`
            SELECT id, quantity_on_hand FROM medical_batches
            WHERE item_id=$1::uuid AND status='actif' AND quantity_on_hand > 0 AND deleted_at IS NULL
            ORDER BY expiry_date NULLS LAST, received_date`, [it.item_id]);

          let remaining = it.quantity;
          let usedBatchId = null;
          for (const batch of batches.rows) {
            if (remaining <= 0) break;
            const take = Math.min(remaining, Number(batch.quantity_on_hand));
            await client.query(`UPDATE medical_batches SET quantity_on_hand = quantity_on_hand - $1 WHERE id=$2::uuid`, [take, batch.id]);
            remaining -= take;
            usedBatchId = batch.id;
          }

          await client.query(`UPDATE medical_items SET quantity_on_hand = quantity_on_hand - $1, version=version+1 WHERE id=$2::uuid`, [it.quantity, it.item_id]);
          const after = before - it.quantity;

          await client.query(`
            INSERT INTO medical_consumption_items (consumption_id, item_id, batch_id, quantity, unit_cost, total_cost, notes)
            VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7)`,
            [consId, it.item_id, usedBatchId, it.quantity, cost, it.quantity * cost, it.notes??null]);

          await client.query(`
            INSERT INTO medical_stock_movements (item_id, batch_id, movement_type, quantity, quantity_before, quantity_after, unit_cost, total_cost, reference_type, reference_id, performed_by)
            VALUES ($1::uuid,$2::uuid,'consommation',$3,$4,$5,$6,$7,'consumption',$8::uuid,$9::uuid)`,
            [it.item_id, usedBatchId, it.quantity, before, after, cost, it.quantity * cost, consId, act.userId]);
        }

        if (auto_validate) {
          await client.query(`UPDATE medical_consumptions SET status='validee', validated_by=$1::uuid, validated_at=NOW() WHERE id=$2::uuid`, [act.userId, consId]);
        }

        await client.query("COMMIT");
        res.status(201).json({ ...rows[0], status: auto_validate ? 'validee' : 'brouillon' });
      } catch (err) { await client.query("ROLLBACK"); throw err; }
      finally { client.release(); }
    } catch (err) { next(err); }
  }
);

router.post("/consumptions/:id/validate", requirePermission("stock.consumptions.validate"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { rows } = await pool.query(`
        UPDATE medical_consumptions SET status='validee', validated_by=$1::uuid, validated_at=NOW(), updated_by=$1::uuid
        WHERE id=$2::uuid AND status='brouillon' AND deleted_at IS NULL RETURNING *`, [act.userId, req.params.id]);
      if (!rows[0]) return void res.status(404).json({ error: "Consommation non trouvée ou déjà validée" });
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

export default router;
