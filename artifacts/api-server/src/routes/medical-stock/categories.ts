/**
 * /api/medical-stock/categories  — item categories (hierarchical)
 * /api/medical-stock/units        — units of measure
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();
function actor(req: AuthenticatedRequest) {
  return { userId: req.auth?.userId ?? "system" };
}

// ── Categories ─────────────────────────────────────────────────────────────

router.get("/categories", requirePermission("stock.view"),
  async (_req, res, next): Promise<void> => {
    try {
      const { rows } = await pool.query(`
        SELECT c.*, p.name AS parent_name,
          COUNT(i.id) AS items_count
        FROM medical_categories c
        LEFT JOIN medical_categories p ON p.id = c.parent_id
        LEFT JOIN medical_items i ON i.category_id = c.id AND i.deleted_at IS NULL
        WHERE c.deleted_at IS NULL
        GROUP BY c.id, p.name
        ORDER BY c.sort_order, c.name`);
      res.json({ data: rows });
    } catch (err) { next(err); }
  }
);

router.post("/categories", requirePermission("stock.categories.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { code, name, description, parent_id, color, icon, sort_order = 0 } = req.body;
      if (!code || !name) return void res.status(400).json({ error: "code et name requis" });
      const dup = await pool.query(`SELECT id FROM medical_categories WHERE code=$1 AND deleted_at IS NULL`, [code]);
      if (dup.rows[0]) return void res.status(409).json({ error: "Code catégorie déjà utilisé" });
      const { rows } = await pool.query(`
        INSERT INTO medical_categories (code, name, description, parent_id, color, icon, sort_order, created_by, updated_by)
        VALUES ($1,$2,$3,$4::uuid,$5,$6,$7,$8::uuid,$8::uuid) RETURNING *`,
        [code, name, description ?? null, parent_id ?? null, color ?? '#3B82F6', icon ?? null, sort_order, act.userId]);
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

router.patch("/categories/:id", requirePermission("stock.categories.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { name, description, color, icon, sort_order, is_active } = req.body;
      const { rows } = await pool.query(`
        UPDATE medical_categories
        SET name=$1, description=$2, color=$3, icon=$4, sort_order=$5, is_active=$6,
            updated_by=$7::uuid, updated_at=NOW()
        WHERE id=$8::uuid AND deleted_at IS NULL RETURNING *`,
        [name, description ?? null, color, icon ?? null, sort_order ?? 0, is_active ?? true, act.userId, req.params.id]);
      if (!rows[0]) return void res.status(404).json({ error: "Catégorie non trouvée" });
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

router.delete("/categories/:id", requirePermission("stock.categories.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const used = await pool.query(
        `SELECT 1 FROM medical_items WHERE category_id=$1::uuid AND deleted_at IS NULL LIMIT 1`, [req.params.id]);
      if (used.rows[0]) return void res.status(409).json({ error: "Catégorie utilisée par des articles" });
      await pool.query(
        `UPDATE medical_categories SET deleted_at=NOW(), updated_by=$1::uuid WHERE id=$2::uuid`,
        [act.userId, req.params.id]);
      res.json({ ok: true });
    } catch (err) { next(err); }
  }
);

// ── Units ──────────────────────────────────────────────────────────────────

router.get("/units", requirePermission("stock.view"),
  async (_req, res, next): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT u.*, b.name AS base_unit_name FROM medical_units u
         LEFT JOIN medical_units b ON b.id = u.base_unit_id
         WHERE u.is_active ORDER BY u.name`);
      res.json({ data: rows });
    } catch (err) { next(err); }
  }
);

router.post("/units", requirePermission("stock.categories.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { code, name, symbol, base_unit_id, factor } = req.body;
      if (!code || !name || !symbol) return void res.status(400).json({ error: "code, name, symbol requis" });
      const { rows } = await pool.query(`
        INSERT INTO medical_units (code, name, symbol, base_unit_id, factor)
        VALUES ($1,$2,$3,$4::uuid,$5) RETURNING *`,
        [code, name, symbol, base_unit_id ?? null, factor ?? 1]);
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

export default router;
