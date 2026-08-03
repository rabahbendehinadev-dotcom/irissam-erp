/**
 * /api/medical-stock/items — Product catalog CRUD
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();

function actor(req: AuthenticatedRequest) {
  return { userId: req.auth?.userId ?? "system", userName: `${req.auth?.userId ?? ""}` };
}

// GET /items
router.get("/items", requirePermission("stock.items.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { q, category_id, item_type, status, limit = "50", offset = "0" } = req.query as Record<string,string>;
      const conds = ["i.deleted_at IS NULL"];
      const params: unknown[] = [];
      let pi = 1;
      if (q) {
        conds.push(`(i.name ILIKE $${pi} OR i.code ILIKE $${pi} OR i.generic_name ILIKE $${pi} OR i.barcode = $${pi})`);
        params.push(`%${q}%`); pi++;
      }
      if (category_id) { conds.push(`i.category_id = $${pi++}::uuid`); params.push(category_id); }
      if (item_type)   { conds.push(`i.item_type = $${pi++}::medical_item_type`); params.push(item_type); }
      if (status === 'low_stock')  conds.push(`i.quantity_on_hand <= i.reorder_point AND i.quantity_on_hand > 0`);
      if (status === 'rupture')    conds.push(`i.quantity_on_hand <= 0`);
      if (status === 'expiring')   conds.push(`EXISTS(SELECT 1 FROM medical_batches b WHERE b.item_id = i.id AND b.status='actif' AND b.expiry_date <= CURRENT_DATE + 90 AND b.deleted_at IS NULL)`);
      if (status === 'active')     conds.push(`i.is_active = TRUE`);
      if (status === 'inactive')   conds.push(`i.is_active = FALSE`);

      const [rows, tot] = await Promise.all([
        pool.query(`
          SELECT i.*,
            cat.name AS category_name,
            u.symbol  AS unit_symbol,
            su.symbol AS purchase_unit_symbol,
            mfr.name  AS manufacturer_name,
            sup.name  AS supplier_name,
            (SELECT MIN(b.expiry_date)
             FROM medical_batches b
             WHERE b.item_id = i.id AND b.status='actif' AND b.deleted_at IS NULL
               AND b.quantity_on_hand > 0) AS nearest_expiry,
            CASE
              WHEN i.quantity_on_hand <= 0 THEN 'rupture'
              WHEN i.quantity_on_hand <= i.min_stock_level THEN 'critique'
              WHEN i.quantity_on_hand <= i.reorder_point THEN 'faible'
              WHEN i.max_stock_level IS NOT NULL AND i.quantity_on_hand > i.max_stock_level THEN 'surstock'
              ELSE 'normal'
            END AS stock_status
          FROM medical_items i
          LEFT JOIN medical_categories cat ON cat.id = i.category_id
          LEFT JOIN medical_units u ON u.id = i.unit_id
          LEFT JOIN medical_units su ON su.id = i.purchase_unit_id
          LEFT JOIN medical_manufacturers mfr ON mfr.id = i.manufacturer_id
          LEFT JOIN medical_suppliers sup ON sup.id = i.default_supplier_id
          WHERE ${conds.join(" AND ")}
          ORDER BY i.name
          LIMIT $${pi} OFFSET $${pi+1}`, [...params, parseInt(limit), parseInt(offset)]),
        pool.query(`SELECT COUNT(*) AS total FROM medical_items i WHERE ${conds.join(" AND ")}`, params)
      ]);
      res.json({ data: rows.rows, total: parseInt(tot.rows[0].total) });
    } catch (err) { next(err); }
  }
);

// GET /items/:id
router.get("/items/:id", requirePermission("stock.items.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { rows } = await pool.query(`
        SELECT i.*,
          cat.name AS category_name,
          u.symbol AS unit_symbol, su.symbol AS purchase_unit_symbol, du.symbol AS dispense_unit_symbol,
          mfr.name AS manufacturer_name, sup.name AS supplier_name
        FROM medical_items i
        LEFT JOIN medical_categories cat ON cat.id = i.category_id
        LEFT JOIN medical_units u  ON u.id  = i.unit_id
        LEFT JOIN medical_units su ON su.id = i.purchase_unit_id
        LEFT JOIN medical_units du ON du.id = i.dispense_unit_id
        LEFT JOIN medical_manufacturers mfr ON mfr.id = i.manufacturer_id
        LEFT JOIN medical_suppliers sup ON sup.id = i.default_supplier_id
        WHERE i.id = $1::uuid AND i.deleted_at IS NULL`, [req.params.id]);
      if (!rows[0]) { res.status(404).json({ error: "Article non trouvé" }); return; }

      // Recent batches
      const batches = await pool.query(
        `SELECT * FROM medical_batches WHERE item_id = $1::uuid AND deleted_at IS NULL ORDER BY expiry_date NULLS LAST LIMIT 20`,
        [req.params.id]);
      // Recent movements
      const movements = await pool.query(
        `SELECT m.*, u.first_name||' '||u.last_name AS by FROM medical_stock_movements m LEFT JOIN users u ON u.id=m.performed_by WHERE m.item_id=$1::uuid ORDER BY m.performed_at DESC LIMIT 20`,
        [req.params.id]);
      res.json({ ...rows[0], batches: batches.rows, movements: movements.rows });
    } catch (err) { next(err); }
  }
);

// POST /items
router.post("/items", requirePermission("stock.items.create"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { code, name, item_type, category_id, unit_id, generic_name, brand_name, description,
              purchase_unit_id, dispense_unit_id, manufacturer_id, default_supplier_id,
              reorder_point = 0, reorder_quantity = 0, min_stock_level = 0, max_stock_level,
              safety_stock = 0, unit_cost = 0, selling_price, requires_prescription = false,
              is_controlled = false, is_narcotic = false, track_by_batch = true, track_expiry = true,
              expiry_warning_days = 90, dci, atc_code, registration_no, storage_conditions,
              temperature_min, temperature_max, is_formulary = false, notes, barcode } = req.body;
      if (!code || !name || !item_type || !unit_id)
        return void res.status(400).json({ error: "code, name, item_type, unit_id requis" });

      const dup = await pool.query(`SELECT id FROM medical_items WHERE code=$1 AND deleted_at IS NULL`, [code]);
      if (dup.rows[0]) return void res.status(409).json({ error: "Code article déjà utilisé", field: "code" });

      const { rows } = await pool.query(`
        INSERT INTO medical_items (
          code, barcode, name, generic_name, brand_name, description, item_type, category_id, unit_id,
          purchase_unit_id, dispense_unit_id, manufacturer_id, default_supplier_id,
          reorder_point, reorder_quantity, min_stock_level, max_stock_level, safety_stock,
          unit_cost, average_cost, selling_price, requires_prescription, is_controlled, is_narcotic,
          track_by_batch, track_expiry, expiry_warning_days, dci, atc_code, registration_no,
          storage_conditions, temperature_min, temperature_max, is_formulary, notes,
          created_by, updated_by
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7::medical_item_type,$8::uuid,$9::uuid,
          $10::uuid,$11::uuid,$12::uuid,$13::uuid,
          $14,$15,$16,$17,$18,
          $19,$19,$20,$21,$22,$23,
          $24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,
          $35::uuid,$35::uuid
        ) RETURNING *`,
        [code, barcode ?? null, name, generic_name ?? null, brand_name ?? null, description ?? null,
         item_type, category_id ?? null, unit_id,
         purchase_unit_id ?? null, dispense_unit_id ?? null, manufacturer_id ?? null, default_supplier_id ?? null,
         reorder_point, reorder_quantity, min_stock_level, max_stock_level ?? null, safety_stock,
         unit_cost, selling_price ?? null, requires_prescription, is_controlled, is_narcotic,
         track_by_batch, track_expiry, expiry_warning_days, dci ?? null, atc_code ?? null,
         registration_no ?? null, storage_conditions ?? null, temperature_min ?? null, temperature_max ?? null,
         is_formulary, notes ?? null, act.userId]);
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

// PATCH /items/:id
router.patch("/items/:id", requirePermission("stock.items.update"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const allowed = ["name","generic_name","brand_name","description","category_id","unit_id",
        "purchase_unit_id","dispense_unit_id","manufacturer_id","default_supplier_id",
        "reorder_point","reorder_quantity","min_stock_level","max_stock_level","safety_stock",
        "unit_cost","selling_price","requires_prescription","is_controlled","is_narcotic",
        "track_by_batch","track_expiry","expiry_warning_days","dci","atc_code","registration_no",
        "storage_conditions","temperature_min","temperature_max","is_formulary","is_active","notes","barcode"];
      const sets: string[] = [];
      const vals: unknown[] = [];
      let pi = 1;
      for (const k of allowed) {
        if (k in req.body) { sets.push(`${k} = $${pi++}`); vals.push(req.body[k]); }
      }
      if (!sets.length) return void res.status(400).json({ error: "Aucun champ à modifier" });
      sets.push(`updated_by = $${pi++}`, `version = version + 1`);
      vals.push(act.userId, req.params.id);
      const { rows } = await pool.query(
        `UPDATE medical_items SET ${sets.join(",")} WHERE id = $${pi}::uuid AND deleted_at IS NULL RETURNING *`, vals);
      if (!rows[0]) return void res.status(404).json({ error: "Article non trouvé" });
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

// DELETE /items/:id (soft)
router.delete("/items/:id", requirePermission("stock.items.delete"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const check = await pool.query(
        `SELECT quantity_on_hand FROM medical_items WHERE id=$1::uuid AND deleted_at IS NULL`, [req.params.id]);
      if (!check.rows[0]) return void res.status(404).json({ error: "Article non trouvé" });
      if (Number(check.rows[0].quantity_on_hand) > 0)
        return void res.status(409).json({ error: "Impossible de supprimer un article avec du stock" });
      await pool.query(
        `UPDATE medical_items SET deleted_at=NOW(), updated_by=$1::uuid WHERE id=$2::uuid`,
        [act.userId, req.params.id]);
      res.json({ ok: true });
    } catch (err) { next(err); }
  }
);

export default router;
