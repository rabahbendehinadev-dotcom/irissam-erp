import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();
function actor(req: AuthenticatedRequest) { return { userId: req.user!.userId }; }

router.get("/", requirePermission("biomed.spare_parts.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { q, low_stock, limit = "25", page = "1" } = req.query as Record<string,string>;
      const lim = Math.min(Number(limit)||25,100);
      const off = (Math.max(Number(page)||1,1)-1)*lim;
      const conds = ["is_active=TRUE"];
      const vals: unknown[] = [];
      if (q)         { vals.push(`%${q}%`); conds.push(`(name ILIKE $${vals.length} OR code ILIKE $${vals.length} OR reference ILIKE $${vals.length})`); }
      if (low_stock) { conds.push("quantity_on_hand <= min_quantity"); }
      const where = "WHERE "+conds.join(" AND ");
      const [rows, cnt] = await Promise.all([
        pool.query(`SELECT *, (quantity_on_hand <= min_quantity) AS is_low FROM biomedical_spare_parts ${where} ORDER BY name LIMIT ${lim} OFFSET ${off}`, vals),
        pool.query(`SELECT COUNT(*) FROM biomedical_spare_parts ${where}`, vals),
      ]);
      res.json({ data: rows.rows, total: Number(cnt.rows[0].count), page: Number(page), limit: lim });
    } catch (err) { next(err); }
  }
);

router.post("/", requirePermission("biomed.spare_parts.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { code, name, reference, manufacturer_id, supplier_id,
              quantity_on_hand, min_quantity, unit_cost, storage_location, notes } = req.body;
      if (!code||!name) return void res.status(400).json({ error: "code et name requis" });
      const { rows } = await pool.query(
        `INSERT INTO biomedical_spare_parts (code,name,reference,manufacturer_id,supplier_id,
          quantity_on_hand,min_quantity,unit_cost,storage_location,notes)
         VALUES ($1,$2,$3,$4::uuid,$5::uuid,$6,$7,$8,$9,$10) RETURNING *`,
        [code,name,reference??null,manufacturer_id??null,supplier_id??null,
         Number(quantity_on_hand??0),Number(min_quantity??0),unit_cost??null,storage_location??null,notes??null]);
      res.status(201).json(rows[0]);
    } catch (err: any) {
      if (err.code==="23505") return void res.status(409).json({ error: "Code pièce déjà utilisé" });
      next(err);
    }
  }
);

router.post("/:id/movement", requirePermission("biomed.spare_parts.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { movement_type, quantity, work_order_id, unit_cost, notes } = req.body;
      if (!movement_type||!quantity) return void res.status(400).json({ error: "movement_type et quantity requis" });
      const qty = Number(quantity);
      const sign = movement_type === "sortie" ? -1 : 1;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const part = await client.query(`SELECT quantity_on_hand FROM biomedical_spare_parts WHERE id=$1::uuid FOR UPDATE`, [req.params.id]);
        if (!part.rows[0]) { await client.query("ROLLBACK"); return void res.status(404).json({ error: "Pièce non trouvée" }); }
        const newQty = Number(part.rows[0].quantity_on_hand) + sign * qty;
        if (newQty < 0) { await client.query("ROLLBACK"); return void res.status(400).json({ error: "Stock insuffisant" }); }
        await client.query(`UPDATE biomedical_spare_parts SET quantity_on_hand=$1, updated_at=now() WHERE id=$2::uuid`, [newQty, req.params.id]);
        const { rows } = await client.query(
          `INSERT INTO biomedical_spare_part_movements (spare_part_id, work_order_id, movement_type, quantity, unit_cost, notes, performed_by)
           VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7::uuid) RETURNING *`,
          [req.params.id, work_order_id??null, movement_type, qty, unit_cost??null, notes??null, act.userId]);
        await client.query("COMMIT");
        res.status(201).json({ movement: rows[0], new_quantity: newQty });
      } catch (e) { await client.query("ROLLBACK"); throw e; }
      finally { client.release(); }
    } catch (err) { next(err); }
  }
);

router.get("/:id/movements", requirePermission("biomed.spare_parts.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT m.*, wo.order_number FROM biomedical_spare_part_movements m
         LEFT JOIN biomedical_work_orders wo ON wo.id = m.work_order_id
         WHERE m.spare_part_id=$1::uuid ORDER BY m.created_at DESC LIMIT 50`, [req.params.id]);
      res.json({ data: rows });
    } catch (err) { next(err); }
  }
);

export default router;
