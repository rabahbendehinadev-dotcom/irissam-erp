/**
 * /api/medical-stock/manufacturers — Manufacturers CRUD
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();
function actor(req: AuthenticatedRequest) {
  return { userId: req.auth?.userId ?? "system" };
}

router.get("/manufacturers", requirePermission("stock.view"),
  async (req, res, next): Promise<void> => {
    try {
      const { q, limit = "50", offset = "0" } = req.query as Record<string,string>;
      const conds = ["m.deleted_at IS NULL"];
      const params: unknown[] = [];
      let pi = 1;
      if (q) { conds.push(`(m.name ILIKE $${pi} OR m.code ILIKE $${pi})`); params.push(`%${q}%`); pi++; }
      const [rows, tot] = await Promise.all([
        pool.query(`
          SELECT m.*,
            (SELECT COUNT(*) FROM medical_items i WHERE i.manufacturer_id = m.id AND i.deleted_at IS NULL) AS items_count
          FROM medical_manufacturers m WHERE ${conds.join(" AND ")}
          ORDER BY m.name LIMIT $${pi} OFFSET $${pi+1}`, [...params, parseInt(limit), parseInt(offset)]),
        pool.query(`SELECT COUNT(*) AS total FROM medical_manufacturers m WHERE ${conds.join(" AND ")}`, params)
      ]);
      res.json({ data: rows.rows, total: parseInt(tot.rows[0].total) });
    } catch (err) { next(err); }
  }
);

router.post("/manufacturers", requirePermission("stock.manufacturers.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { code, name, country, phone, email, website, contact, notes } = req.body;
      if (!code || !name) return void res.status(400).json({ error: "code et name requis" });
      const dup = await pool.query(`SELECT id FROM medical_manufacturers WHERE code=$1 AND deleted_at IS NULL`, [code]);
      if (dup.rows[0]) return void res.status(409).json({ error: "Code fabricant déjà utilisé" });
      const { rows } = await pool.query(`
        INSERT INTO medical_manufacturers (code, name, country, phone, email, website, contact, notes, created_by, updated_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::uuid,$9::uuid) RETURNING *`,
        [code, name, country??null, phone??null, email??null, website??null, contact??null, notes??null, act.userId]);
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

router.patch("/manufacturers/:id", requirePermission("stock.manufacturers.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { name, country, phone, email, website, contact, notes, is_active } = req.body;
      const { rows } = await pool.query(`
        UPDATE medical_manufacturers SET name=$1, country=$2, phone=$3, email=$4,
          website=$5, contact=$6, notes=$7, is_active=$8, updated_by=$9::uuid, updated_at=NOW()
        WHERE id=$10::uuid AND deleted_at IS NULL RETURNING *`,
        [name, country??null, phone??null, email??null, website??null, contact??null, notes??null,
         is_active??true, act.userId, req.params.id]);
      if (!rows[0]) return void res.status(404).json({ error: "Fabricant non trouvé" });
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

router.delete("/manufacturers/:id", requirePermission("stock.manufacturers.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const used = await pool.query(
        `SELECT 1 FROM medical_items WHERE manufacturer_id=$1::uuid AND deleted_at IS NULL LIMIT 1`, [req.params.id]);
      if (used.rows[0]) return void res.status(409).json({ error: "Fabricant lié à des articles existants" });
      await pool.query(
        `UPDATE medical_manufacturers SET deleted_at=NOW(), updated_by=$1::uuid WHERE id=$2::uuid`,
        [act.userId, req.params.id]);
      res.json({ ok: true });
    } catch (err) { next(err); }
  }
);

export default router;
