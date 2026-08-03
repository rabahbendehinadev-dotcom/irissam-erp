/**
 * /api/medical-stock/purchase-orders — PO lifecycle: create → approve → receive
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();
function actor(req: AuthenticatedRequest) {
  return { userId: req.auth?.userId ?? "system" };
}

router.get("/purchase-orders", requirePermission("stock.purchase_orders.view"),
  async (req, res, next): Promise<void> => {
    try {
      const { status, supplier_id, limit = "50", offset = "0" } = req.query as Record<string,string>;
      const conds = ["po.deleted_at IS NULL"];
      const params: unknown[] = [];
      let pi = 1;
      if (status)      { conds.push(`po.status=$${pi++}::medical_po_status`); params.push(status); }
      if (supplier_id) { conds.push(`po.supplier_id=$${pi++}::uuid`); params.push(supplier_id); }
      const [rows, tot] = await Promise.all([
        pool.query(`
          SELECT po.*, s.name AS supplier_name,
            creator.first_name||' '||creator.last_name AS created_by_name,
            (SELECT COUNT(*) FROM medical_purchase_order_items WHERE po_id = po.id) AS items_count
          FROM medical_purchase_orders po
          JOIN medical_suppliers s ON s.id = po.supplier_id
          JOIN users creator ON creator.id = po.created_by
          WHERE ${conds.join(" AND ")}
          ORDER BY po.order_date DESC, po.created_at DESC
          LIMIT $${pi} OFFSET $${pi+1}`, [...params, parseInt(limit), parseInt(offset)]),
        pool.query(`SELECT COUNT(*) AS total FROM medical_purchase_orders po WHERE ${conds.join(" AND ")}`, params)
      ]);
      res.json({ data: rows.rows, total: parseInt(tot.rows[0].total) });
    } catch (err) { next(err); }
  }
);

router.get("/purchase-orders/:id", requirePermission("stock.purchase_orders.view"),
  async (req, res, next): Promise<void> => {
    try {
      const { rows } = await pool.query(`
        SELECT po.*, s.name AS supplier_name
        FROM medical_purchase_orders po
        JOIN medical_suppliers s ON s.id = po.supplier_id
        WHERE po.id=$1::uuid AND po.deleted_at IS NULL`, [req.params.id]);
      if (!rows[0]) return void res.status(404).json({ error: "Bon de commande non trouvé" });
      const items = await pool.query(`
        SELECT poi.*, i.name AS item_name, i.code AS item_code, u.symbol AS unit_symbol
        FROM medical_purchase_order_items poi
        JOIN medical_items i ON i.id = poi.item_id
        LEFT JOIN medical_units u ON u.id = i.unit_id
        WHERE poi.po_id=$1::uuid ORDER BY i.name`, [req.params.id]);
      res.json({ ...rows[0], items: items.rows });
    } catch (err) { next(err); }
  }
);

router.post("/purchase-orders", requirePermission("stock.purchase_orders.create"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { supplier_id, order_date, expected_date, payment_terms, delivery_terms, notes, items = [] } = req.body;
      if (!supplier_id || !items.length)
        return void res.status(400).json({ error: "supplier_id et items requis" });

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        let totalAmount = 0;
        for (const it of items) {
          const netCost = it.unit_cost * (1 - (it.discount_percent ?? 0) / 100);
          const total = netCost * it.quantity_ordered * (1 + (it.tax_percent ?? 0) / 100);
          totalAmount += total;
        }
        const { rows } = await client.query(`
          INSERT INTO medical_purchase_orders (supplier_id, status, order_date, expected_date, total_amount, net_amount, payment_terms, delivery_terms, notes, created_by, updated_by)
          VALUES ($1::uuid,'brouillon',$2,$3,$4,$4,$5,$6,$7,$8::uuid,$8::uuid) RETURNING *`,
          [supplier_id, order_date ?? new Date().toISOString().split('T')[0], expected_date??null, totalAmount, payment_terms??null, delivery_terms??null, notes??null, act.userId]);
        const poId = rows[0].id;

        for (const it of items) {
          const netCost = it.unit_cost * (1 - (it.discount_percent ?? 0) / 100);
          const total = netCost * it.quantity_ordered * (1 + (it.tax_percent ?? 0) / 100);
          await client.query(`
            INSERT INTO medical_purchase_order_items (po_id, item_id, quantity_ordered, unit_cost, discount_percent, tax_percent, net_cost, total_cost, notes)
            VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9)`,
            [poId, it.item_id, it.quantity_ordered, it.unit_cost, it.discount_percent??0, it.tax_percent??0, netCost, total, it.notes??null]);
          await client.query(
            `UPDATE medical_items SET quantity_on_order = quantity_on_order + $1 WHERE id=$2::uuid`, [it.quantity_ordered, it.item_id]);
        }
        await client.query("COMMIT");
        res.status(201).json(rows[0]);
      } catch (err) { await client.query("ROLLBACK"); throw err; }
      finally { client.release(); }
    } catch (err) { next(err); }
  }
);

// POST /purchase-orders/:id/approve
router.post("/purchase-orders/:id/approve", requirePermission("stock.purchase_orders.approve"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { rows } = await pool.query(`
        UPDATE medical_purchase_orders SET status='approuvee', approved_by=$1::uuid, approved_at=NOW(), updated_by=$1::uuid
        WHERE id=$2::uuid AND status='soumise' AND deleted_at IS NULL RETURNING *`,
        [act.userId, req.params.id]);
      if (!rows[0]) return void res.status(404).json({ error: "Commande non trouvée ou déjà approuvée" });
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

// POST /purchase-orders/:id/submit
router.post("/purchase-orders/:id/submit", requirePermission("stock.purchase_orders.create"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { rows } = await pool.query(`
        UPDATE medical_purchase_orders SET status='soumise', updated_by=$1::uuid
        WHERE id=$2::uuid AND status='brouillon' AND deleted_at IS NULL RETURNING *`,
        [act.userId, req.params.id]);
      if (!rows[0]) return void res.status(404).json({ error: "Commande non trouvée" });
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

// POST /purchase-orders/:id/receive — receive items, create batches, add stock
router.post("/purchase-orders/:id/receive", requirePermission("stock.purchase_orders.receive"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { received_items = [], received_date, notes } = req.body;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const poRow = await client.query(
          `SELECT * FROM medical_purchase_orders WHERE id=$1::uuid AND deleted_at IS NULL FOR UPDATE`, [req.params.id]);
        if (!poRow.rows[0]) { await client.query("ROLLBACK"); return void res.status(404).json({ error: "Commande non trouvée" }); }
        if (!['approuvee','partiellement_recue'].includes(poRow.rows[0].status)) {
          await client.query("ROLLBACK"); return void res.status(400).json({ error: "La commande doit être approuvée pour réceptionner" });
        }

        let allReceived = true;
        for (const it of received_items) {
          if (!it.po_item_id || !it.quantity_received || it.quantity_received <= 0) continue;
          const poItem = await client.query(
            `SELECT * FROM medical_purchase_order_items WHERE id=$1::uuid FOR UPDATE`, [it.po_item_id]);
          if (!poItem.rows[0]) continue;

          // Create batch for received qty
          await client.query(`
            INSERT INTO medical_batches (item_id, supplier_id, lot_number, expiry_date, received_date, quantity_received, quantity_on_hand, unit_cost, po_item_id, created_by, updated_by)
            VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$6,$7,$8::uuid,$9::uuid,$9::uuid)`,
            [poItem.rows[0].item_id, poRow.rows[0].supplier_id, it.lot_number??null, it.expiry_date??null,
             received_date ?? new Date().toISOString().split('T')[0],
             it.quantity_received, poItem.rows[0].unit_cost, it.po_item_id, act.userId]);

          // Update item stock (weighted avg)
          const itemRow = await client.query(
            `SELECT quantity_on_hand, average_cost FROM medical_items WHERE id=$1::uuid FOR UPDATE`, [poItem.rows[0].item_id]);
          if (itemRow.rows[0]) {
            const curQty  = Number(itemRow.rows[0].quantity_on_hand);
            const curAvg  = Number(itemRow.rows[0].average_cost);
            const recQty  = it.quantity_received;
            const recCost = Number(poItem.rows[0].unit_cost);
            const newQty  = curQty + recQty;
            const newAvg  = newQty > 0 ? (curQty * curAvg + recQty * recCost) / newQty : recCost;
            await client.query(`UPDATE medical_items SET quantity_on_hand=$1, average_cost=$2, last_purchase_price=$3, quantity_on_order=GREATEST(0, quantity_on_order-$4) WHERE id=$5::uuid`,
              [newQty, newAvg, recCost, recQty, poItem.rows[0].item_id]);
          }

          // Record movement
          const before = Number(itemRow.rows[0]?.quantity_on_hand ?? 0);
          await client.query(`
            INSERT INTO medical_stock_movements (item_id, movement_type, quantity, quantity_before, quantity_after, unit_cost, total_cost, reference_type, reference_id, performed_by, notes)
            VALUES ($1::uuid,'entree',$2,$3,$4,$5,$6,'po',$7::uuid,$8::uuid,$9)`,
            [poItem.rows[0].item_id, it.quantity_received, before, before + it.quantity_received,
             poItem.rows[0].unit_cost, it.quantity_received * Number(poItem.rows[0].unit_cost),
             req.params.id, act.userId, notes??null]);

          await client.query(`UPDATE medical_purchase_order_items SET quantity_received = quantity_received + $1 WHERE id=$2::uuid`,
            [it.quantity_received, it.po_item_id]);

          const remaining = await client.query(
            `SELECT quantity_ordered - quantity_received AS diff FROM medical_purchase_order_items WHERE id=$1::uuid`, [it.po_item_id]);
          if (Number(remaining.rows[0]?.diff ?? 1) > 0) allReceived = false;
        }

        const newStatus = allReceived ? 'recue' : 'partiellement_recue';
        await client.query(`UPDATE medical_purchase_orders SET status=$1, received_date=$2, received_by=$3::uuid, updated_by=$3::uuid WHERE id=$4::uuid`,
          [newStatus, received_date ?? new Date().toISOString().split('T')[0], act.userId, req.params.id]);

        await client.query("COMMIT");
        res.json({ ok: true, status: newStatus });
      } catch (err) { await client.query("ROLLBACK"); throw err; }
      finally { client.release(); }
    } catch (err) { next(err); }
  }
);

export default router;
