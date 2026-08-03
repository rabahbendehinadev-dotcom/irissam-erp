/**
 * /api/medical-stock/batches — Lot/Batch tracking
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();
function actor(req: AuthenticatedRequest) {
  return { userId: req.auth?.userId ?? "system" };
}

router.get("/batches", requirePermission("stock.batches.view"),
  async (req, res, next): Promise<void> => {
    try {
      const { item_id, status, expiring_in_days, q, limit = "50", offset = "0" } = req.query as Record<string,string>;
      const conds = ["b.deleted_at IS NULL"];
      const params: unknown[] = [];
      let pi = 1;
      if (item_id) { conds.push(`b.item_id=$${pi++}::uuid`); params.push(item_id); }
      if (status)  { conds.push(`b.status=$${pi++}::batch_status`); params.push(status); }
      if (expiring_in_days) { conds.push(`b.expiry_date <= CURRENT_DATE + $${pi++}::int`); params.push(parseInt(expiring_in_days)); }
      if (q) { conds.push(`(b.batch_number ILIKE $${pi} OR b.lot_number ILIKE $${pi} OR i.name ILIKE $${pi})`); params.push(`%${q}%`); pi++; }
      const [rows, tot] = await Promise.all([
        pool.query(`
          SELECT b.*, i.name AS item_name, i.code AS item_code, u.symbol AS unit_symbol,
            s.name AS supplier_name,
            (b.expiry_date - CURRENT_DATE) AS days_until_expiry
          FROM medical_batches b
          JOIN medical_items i ON i.id = b.item_id
          LEFT JOIN medical_units u ON u.id = i.unit_id
          LEFT JOIN medical_suppliers s ON s.id = b.supplier_id
          WHERE ${conds.join(" AND ")}
          ORDER BY b.expiry_date NULLS LAST, b.created_at DESC
          LIMIT $${pi} OFFSET $${pi+1}`, [...params, parseInt(limit), parseInt(offset)]),
        pool.query(`SELECT COUNT(*) AS total FROM medical_batches b JOIN medical_items i ON i.id=b.item_id WHERE ${conds.join(" AND ")}`, params)
      ]);
      res.json({ data: rows.rows, total: parseInt(tot.rows[0].total) });
    } catch (err) { next(err); }
  }
);

router.get("/batches/expiring", requirePermission("stock.batches.view"),
  async (_req, res, next): Promise<void> => {
    try {
      const { rows } = await pool.query(`SELECT * FROM v_expiring_soon ORDER BY expiry_date`);
      res.json({ data: rows });
    } catch (err) { next(err); }
  }
);

router.post("/batches", requirePermission("stock.batches.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { item_id, lot_number, manufacture_date, expiry_date, received_date,
              quantity_received, unit_cost, purchase_price, selling_price,
              supplier_id, manufacturer_id, storage_location, storage_bin, notes } = req.body;
      if (!item_id || !quantity_received)
        return void res.status(400).json({ error: "item_id et quantity_received requis" });
      if (quantity_received <= 0)
        return void res.status(400).json({ error: "La quantité doit être positive" });

      const { rows } = await pool.query(`
        INSERT INTO medical_batches (
          item_id, lot_number, manufacture_date, expiry_date, received_date,
          quantity_received, quantity_on_hand, unit_cost, purchase_price, selling_price,
          supplier_id, manufacturer_id, storage_location, storage_bin, notes,
          created_by, updated_by
        ) VALUES ($1::uuid,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10::uuid,$11::uuid,$12,$13,$14,$15::uuid,$15::uuid)
        RETURNING *`,
        [item_id, lot_number??null, manufacture_date??null, expiry_date??null,
         received_date ?? new Date().toISOString().split('T')[0],
         quantity_received, unit_cost??0, purchase_price??null, selling_price??null,
         supplier_id??null, manufacturer_id??null, storage_location??null, storage_bin??null,
         notes??null, act.userId]);
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

router.patch("/batches/:id", requirePermission("stock.batches.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { status, recall_reason, recall_date, storage_location, storage_bin, notes } = req.body;
      const { rows } = await pool.query(`
        UPDATE medical_batches
        SET status=COALESCE($1::batch_status, status),
            recall_reason=COALESCE($2, recall_reason),
            recall_date=COALESCE($3, recall_date),
            storage_location=COALESCE($4, storage_location),
            storage_bin=COALESCE($5, storage_bin),
            notes=COALESCE($6, notes),
            updated_by=$7::uuid, updated_at=NOW()
        WHERE id=$8::uuid AND deleted_at IS NULL RETURNING *`,
        [status??null, recall_reason??null, recall_date??null, storage_location??null,
         storage_bin??null, notes??null, act.userId, req.params.id]);
      if (!rows[0]) return void res.status(404).json({ error: "Lot non trouvé" });
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

export default router;
