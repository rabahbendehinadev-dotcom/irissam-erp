import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();

router.get("/checklists", requirePermission("quality.checklists.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { department, category } = req.query as Record<string,string>;
      const conds: string[] = ["is_active = true"]; const params: unknown[] = []; let pi = 1;
      if (department) { conds.push(`department = $${pi++}`); params.push(department); }
      if (category)   { conds.push(`category = $${pi++}`); params.push(category); }
      const where = "WHERE " + conds.join(" AND ");
      const { rows } = await pool.query(`SELECT * FROM quality_checklists ${where} ORDER BY title`, params);
      res.json({ data: rows });
    } catch (err) { next(err); }
  }
);

router.get("/checklists/:id", requirePermission("quality.checklists.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { rows: [cl] } = await pool.query("SELECT * FROM quality_checklists WHERE id = $1", [req.params.id]);
      if (!cl) { res.status(404).json({ error: "Checklist introuvable" }); return; }
      const { rows: items } = await pool.query(
        "SELECT * FROM quality_checklist_items WHERE checklist_id = $1 ORDER BY item_order", [req.params.id]);
      res.json({ ...cl, items });
    } catch (err) { next(err); }
  }
);

router.post("/checklists", requirePermission("quality.checklists.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { title, description, category, department, frequency } = req.body;
      if (!title) { res.status(400).json({ error: "title requis" }); return; }
      const { rows: [cl] } = await pool.query(`
        INSERT INTO quality_checklists (title, description, category, department, frequency)
        VALUES ($1,$2,$3,$4,$5) RETURNING *`, [title, description, category, department, frequency]);
      res.status(201).json(cl);
    } catch (err) { next(err); }
  }
);

router.post("/checklists/:id/items", requirePermission("quality.checklists.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const items: any[] = Array.isArray(req.body) ? req.body : [req.body];
      const { rows: [{ max_order }] } = await pool.query(
        "SELECT COALESCE(MAX(item_order),0) AS max_order FROM quality_checklist_items WHERE checklist_id = $1", [req.params.id]);
      let order = parseInt(max_order);
      const inserted: any[] = [];
      for (const item of items) {
        order++;
        const { rows: [i] } = await pool.query(`
          INSERT INTO quality_checklist_items (checklist_id, item_order, question, category, is_required)
          VALUES ($1,$2,$3,$4,$5) RETURNING *`,
          [req.params.id, item.item_order ?? order, item.question, item.category, item.is_required ?? true]);
        inserted.push(i);
      }
      res.status(201).json(inserted);
    } catch (err) { next(err); }
  }
);

router.patch("/checklists/items/:iid", requirePermission("quality.checklists.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { is_compliant, observation } = req.body;
      const userId = req.auth?.userId;
      const { rows: [item] } = await pool.query(`
        UPDATE quality_checklist_items
        SET is_compliant = $1, observation = $2, checked_at = now(), checked_by = $3
        WHERE id = $4 RETURNING *`,
        [is_compliant, observation, userId, req.params.iid]);
      if (!item) { res.status(404).json({ error: "Introuvable" }); return; }
      res.json(item);
    } catch (err) { next(err); }
  }
);

export default router;
