/**
 * /api/medical-stock/suppliers — Suppliers CRUD
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();
function actor(req: AuthenticatedRequest) {
  return { userId: req.auth?.userId ?? "system" };
}

router.get("/suppliers", requirePermission("stock.suppliers.view"),
  async (req, res, next): Promise<void> => {
    try {
      const { q, is_active, limit = "50", offset = "0" } = req.query as Record<string,string>;
      const conds = ["s.deleted_at IS NULL"];
      const params: unknown[] = [];
      let pi = 1;
      if (q)         { conds.push(`(s.name ILIKE $${pi} OR s.code ILIKE $${pi})`); params.push(`%${q}%`); pi++; }
      if (is_active) { conds.push(`s.is_active = $${pi++}`); params.push(is_active === 'true'); }
      const [rows, tot] = await Promise.all([
        pool.query(`
          SELECT s.*,
            (SELECT COUNT(*) FROM medical_purchase_orders po WHERE po.supplier_id = s.id AND po.deleted_at IS NULL) AS po_count
          FROM medical_suppliers s WHERE ${conds.join(" AND ")}
          ORDER BY s.name LIMIT $${pi} OFFSET $${pi+1}`, [...params, parseInt(limit), parseInt(offset)]),
        pool.query(`SELECT COUNT(*) AS total FROM medical_suppliers s WHERE ${conds.join(" AND ")}`, params)
      ]);
      res.json({ data: rows.rows, total: parseInt(tot.rows[0].total) });
    } catch (err) { next(err); }
  }
);

router.get("/suppliers/:id", requirePermission("stock.suppliers.view"),
  async (req, res, next): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM medical_suppliers WHERE id=$1::uuid AND deleted_at IS NULL`, [req.params.id]);
      if (!rows[0]) return void res.status(404).json({ error: "Fournisseur non trouvé" });
      const pos = await pool.query(
        `SELECT id, po_number, status, order_date, net_amount FROM medical_purchase_orders
         WHERE supplier_id=$1::uuid AND deleted_at IS NULL ORDER BY order_date DESC LIMIT 10`, [req.params.id]);
      res.json({ ...rows[0], recent_orders: pos.rows });
    } catch (err) { next(err); }
  }
);

router.post("/suppliers", requirePermission("stock.suppliers.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { code, name, address, city, country = 'DZ', phone, fax, email, website,
              contact_name, contact_phone, tax_id, registration_no, payment_terms_days = 30,
              currency = 'DZD', bank_name, bank_account, notes, rating } = req.body;
      if (!code || !name) return void res.status(400).json({ error: "code et name requis" });
      const dup = await pool.query(`SELECT id FROM medical_suppliers WHERE code=$1 AND deleted_at IS NULL`, [code]);
      if (dup.rows[0]) return void res.status(409).json({ error: "Code fournisseur déjà utilisé" });
      const { rows } = await pool.query(`
        INSERT INTO medical_suppliers (
          code, name, address, city, country, phone, fax, email, website,
          contact_name, contact_phone, tax_id, registration_no, payment_terms_days,
          currency, bank_name, bank_account, notes, rating, created_by, updated_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::uuid,$20::uuid) RETURNING *`,
        [code, name, address??null, city??null, country, phone??null, fax??null, email??null, website??null,
         contact_name??null, contact_phone??null, tax_id??null, registration_no??null, payment_terms_days,
         currency, bank_name??null, bank_account??null, notes??null, rating??null, act.userId]);
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

router.patch("/suppliers/:id", requirePermission("stock.suppliers.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const fields = ["name","address","city","country","phone","fax","email","website",
        "contact_name","contact_phone","tax_id","registration_no","payment_terms_days",
        "currency","bank_name","bank_account","notes","rating","is_active"];
      const sets: string[] = []; const vals: unknown[] = []; let pi = 1;
      for (const k of fields) {
        if (k in req.body) { sets.push(`${k}=$${pi++}`); vals.push(req.body[k]); }
      }
      if (!sets.length) return void res.status(400).json({ error: "Aucun champ" });
      sets.push(`updated_by=$${pi++}`, `updated_at=NOW()`);
      vals.push(act.userId, req.params.id);
      const { rows } = await pool.query(
        `UPDATE medical_suppliers SET ${sets.join(",")} WHERE id=$${pi}::uuid AND deleted_at IS NULL RETURNING *`, vals);
      if (!rows[0]) return void res.status(404).json({ error: "Fournisseur non trouvé" });
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

router.delete("/suppliers/:id", requirePermission("stock.suppliers.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const used = await pool.query(
        `SELECT 1 FROM medical_purchase_orders WHERE supplier_id=$1::uuid AND deleted_at IS NULL LIMIT 1`, [req.params.id]);
      if (used.rows[0]) return void res.status(409).json({ error: "Fournisseur lié à des commandes existantes" });
      await pool.query(
        `UPDATE medical_suppliers SET deleted_at=NOW(), updated_by=$1::uuid WHERE id=$2::uuid`,
        [act.userId, req.params.id]);
      res.json({ ok: true });
    } catch (err) { next(err); }
  }
);

export default router;
