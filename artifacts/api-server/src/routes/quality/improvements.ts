import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();

router.get("/improvements", requirePermission("quality.dashboard.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { status, priority, limit = "20", page = "1" } = req.query as Record<string,string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const conds: string[] = []; const params: unknown[] = []; let pi = 1;
      if (status)   { conds.push(`status = $${pi++}`); params.push(status); }
      if (priority) { conds.push(`priority = $${pi++}`); params.push(priority); }
      const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
      const [{ rows }, { rows: [{ count }] }] = await Promise.all([
        pool.query(`SELECT * FROM quality_improvements ${where} ORDER BY created_at DESC LIMIT $${pi} OFFSET $${pi+1}`, [...params, limit, offset]),
        pool.query(`SELECT COUNT(*) FROM quality_improvements ${where}`, params),
      ]);
      res.json({ data: rows, total: parseInt(count), page: parseInt(page) });
    } catch (err) { next(err); }
  }
);

router.post("/improvements", requirePermission("quality.dashboard.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const {
        title, description, source, priority = "normale",
        responsible_name, department, expected_benefit, due_date,
      } = req.body;
      if (!title) { res.status(400).json({ error: "title requis" }); return; }
      const userId = req.auth?.userId;
      const { rows: [imp] } = await pool.query(`
        INSERT INTO quality_improvements
          (title, description, source, priority, responsible_id, responsible_name,
           department, expected_benefit, due_date)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [title, description, source, priority, userId, responsible_name,
         department, expected_benefit, due_date || null]);
      res.status(201).json(imp);
    } catch (err) { next(err); }
  }
);

router.patch("/improvements/:id", requirePermission("quality.capa.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const allowed = ["title","description","status","priority","responsible_name",
                       "department","expected_benefit","actual_benefit","due_date"];
      const sets: string[] = []; const params: unknown[] = []; let pi = 1;
      for (const k of allowed) {
        if (req.body[k] !== undefined) { sets.push(`${k} = $${pi++}`); params.push(req.body[k]); }
      }
      if (req.body.status === "realise") { sets.push(`completed_at = now()`); }
      if (!sets.length) { res.status(400).json({ error: "Aucun champ" }); return; }
      params.push(req.params.id);
      const { rows: [imp] } = await pool.query(
        `UPDATE quality_improvements SET ${sets.join(",")} WHERE id = $${pi} RETURNING *`, params);
      if (!imp) { res.status(404).json({ error: "Introuvable" }); return; }
      res.json(imp);
    } catch (err) { next(err); }
  }
);

export default router;
