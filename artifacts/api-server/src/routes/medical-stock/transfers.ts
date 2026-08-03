/**
 * /api/medical-stock/transfers — inter-service / inter-site stock transfers
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();
function actor(req: AuthenticatedRequest) {
  return { userId: req.auth?.userId ?? "system" };
}

router.get("/transfers", requirePermission("stock.transfers.view"),
  async (req, res, next): Promise<void> => {
    try {
      const { status, limit = "50", offset = "0" } = req.query as Record<string,string>;
      const conds = ["t.deleted_at IS NULL"];
      const params: unknown[] = [];
      let pi = 1;
      if (status) { conds.push(`t.status=$${pi++}::medical_transfer_status`); params.push(status); }
      const [rows, tot] = await Promise.all([
        pool.query(`
          SELECT t.*,
            cr.first_name||' '||cr.last_name AS created_by_name,
            (SELECT COUNT(*) FROM medical_transfer_items WHERE transfer_id = t.id) AS items_count
          FROM medical_stock_transfers t
          JOIN users cr ON cr.id = t.created_by
          WHERE ${conds.join(" AND ")}
          ORDER BY t.transfer_date DESC LIMIT $${pi} OFFSET $${pi+1}`,
          [...params, parseInt(limit), parseInt(offset)]),
        pool.query(`SELECT COUNT(*) AS total FROM medical_stock_transfers t WHERE ${conds.join(" AND ")}`, params)
      ]);
      res.json({ data: rows.rows, total: parseInt(tot.rows[0].total) });
    } catch (err) { next(err); }
  }
);

router.get("/transfers/:id", requirePermission("stock.transfers.view"),
  async (req, res, next): Promise<void> => {
    try {
      const { rows } = await pool.query(`SELECT * FROM medical_stock_transfers WHERE id=$1::uuid AND deleted_at IS NULL`, [req.params.id]);
      if (!rows[0]) return void res.status(404).json({ error: "Transfert non trouvé" });
      const items = await pool.query(`
        SELECT ti.*, i.name AS item_name, i.code AS item_code, u.symbol AS unit_symbol, b.batch_number
        FROM medical_transfer_items ti
        JOIN medical_items i ON i.id = ti.item_id
        LEFT JOIN medical_units u ON u.id = i.unit_id
        LEFT JOIN medical_batches b ON b.id = ti.batch_id
        WHERE ti.transfer_id=$1::uuid`, [req.params.id]);
      res.json({ ...rows[0], items: items.rows });
    } catch (err) { next(err); }
  }
);

router.post("/transfers", requirePermission("stock.transfers.create"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { from_location, to_location, transfer_date, notes, items = [] } = req.body;
      if (!from_location || !to_location || !items.length)
        return void res.status(400).json({ error: "from_location, to_location, items requis" });

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const { rows } = await client.query(`
          INSERT INTO medical_stock_transfers (from_location, to_location, transfer_date, notes, created_by, updated_by)
          VALUES ($1,$2,$3,$4,$5::uuid,$5::uuid) RETURNING *`,
          [from_location, to_location, transfer_date ?? new Date().toISOString().split('T')[0], notes??null, act.userId]);
        const tid = rows[0].id;
        for (const it of items) {
          await client.query(`
            INSERT INTO medical_transfer_items (transfer_id, item_id, batch_id, quantity_sent, unit_cost, notes)
            VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6)`,
            [tid, it.item_id, it.batch_id??null, it.quantity, it.unit_cost??0, it.notes??null]);
        }
        await client.query("COMMIT");
        res.status(201).json(rows[0]);
      } catch (err) { await client.query("ROLLBACK"); throw err; }
      finally { client.release(); }
    } catch (err) { next(err); }
  }
);

router.post("/transfers/:id/approve", requirePermission("stock.transfers.approve"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { rows } = await pool.query(`
        UPDATE medical_stock_transfers SET status='approuvee', approved_by=$1::uuid, approved_at=NOW(), updated_by=$1::uuid
        WHERE id=$2::uuid AND status='soumise' AND deleted_at IS NULL RETURNING *`, [act.userId, req.params.id]);
      if (!rows[0]) return void res.status(404).json({ error: "Transfert non trouvé ou non soumis" });
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

router.post("/transfers/:id/submit", requirePermission("stock.transfers.create"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { rows } = await pool.query(`
        UPDATE medical_stock_transfers SET status='soumise', updated_by=$1::uuid
        WHERE id=$2::uuid AND status='brouillon' AND deleted_at IS NULL RETURNING *`, [act.userId, req.params.id]);
      if (!rows[0]) return void res.status(404).json({ error: "Transfert non trouvé" });
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

// Receive a transfer — move stock between locations
router.post("/transfers/:id/receive", requirePermission("stock.transfers.approve"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { received_items = [], received_date, notes } = req.body;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const trfRow = await client.query(
          `SELECT * FROM medical_stock_transfers WHERE id=$1::uuid AND deleted_at IS NULL FOR UPDATE`, [req.params.id]);
        if (!trfRow.rows[0]) { await client.query("ROLLBACK"); return void res.status(404).json({ error: "Transfert non trouvé" }); }
        if (!['approuvee','en_transit'].includes(trfRow.rows[0].status)) {
          await client.query("ROLLBACK"); return void res.status(400).json({ error: "Le transfert doit être approuvé" });
        }

        for (const ri of received_items) {
          const ti = await client.query(`SELECT * FROM medical_transfer_items WHERE id=$1::uuid FOR UPDATE`, [ri.transfer_item_id]);
          if (!ti.rows[0]) continue;

          const itemRow = await client.query(`SELECT quantity_on_hand FROM medical_items WHERE id=$1::uuid FOR UPDATE`, [ti.rows[0].item_id]);
          const before = Number(itemRow.rows[0]?.quantity_on_hand ?? 0);

          await client.query(`UPDATE medical_transfer_items SET quantity_received=$1 WHERE id=$2::uuid`, [ri.quantity_received, ri.transfer_item_id]);
          await client.query(`UPDATE medical_items SET quantity_on_hand=quantity_on_hand+$1 WHERE id=$2::uuid`, [ri.quantity_received, ti.rows[0].item_id]);
          await client.query(`
            INSERT INTO medical_stock_movements (item_id, batch_id, movement_type, quantity, quantity_before, quantity_after, reference_type, reference_id, performed_by, notes)
            VALUES ($1::uuid,$2::uuid,'transfert_in',$3,$4,$5,'transfer',$6::uuid,$7::uuid,$8)`,
            [ti.rows[0].item_id, ti.rows[0].batch_id, ri.quantity_received, before, before+ri.quantity_received, req.params.id, act.userId, notes??null]);
        }

        await client.query(`UPDATE medical_stock_transfers SET status='recue', received_date=$1, received_by=$2::uuid, updated_by=$2::uuid WHERE id=$3::uuid`,
          [received_date ?? new Date().toISOString().split('T')[0], act.userId, req.params.id]);
        await client.query("COMMIT");
        res.json({ ok: true });
      } catch (err) { await client.query("ROLLBACK"); throw err; }
      finally { client.release(); }
    } catch (err) { next(err); }
  }
);

export default router;
