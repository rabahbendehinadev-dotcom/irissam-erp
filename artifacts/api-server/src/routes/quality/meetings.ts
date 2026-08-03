import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();

router.get("/meetings/committees", requirePermission("quality.meetings.view"),
  async (_req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { rows } = await pool.query("SELECT * FROM quality_committees WHERE is_active = true ORDER BY name");
      res.json({ data: rows });
    } catch (err) { next(err); }
  }
);

router.get("/meetings", requirePermission("quality.meetings.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { status, committee_id, limit = "20", page = "1" } = req.query as Record<string,string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const conds: string[] = []; const params: unknown[] = []; let pi = 1;
      if (status)       { conds.push(`m.status = $${pi++}`); params.push(status); }
      if (committee_id) { conds.push(`m.committee_id = $${pi++}::uuid`); params.push(committee_id); }
      const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
      const [{ rows }, { rows: [{ count }] }] = await Promise.all([
        pool.query(`SELECT m.*, c.name AS committee_name FROM quality_meetings m LEFT JOIN quality_committees c ON c.id = m.committee_id ${where} ORDER BY m.meeting_date DESC LIMIT $${pi} OFFSET $${pi+1}`, [...params, limit, offset]),
        pool.query(`SELECT COUNT(*) FROM quality_meetings m ${where}`, params),
      ]);
      res.json({ data: rows, total: parseInt(count), page: parseInt(page) });
    } catch (err) { next(err); }
  }
);

router.get("/meetings/:id", requirePermission("quality.meetings.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { rows: [m] } = await pool.query(
        "SELECT m.*, c.name AS committee_name FROM quality_meetings m LEFT JOIN quality_committees c ON c.id = m.committee_id WHERE m.id = $1",
        [req.params.id]);
      if (!m) { res.status(404).json({ error: "Réunion introuvable" }); return; }
      const { rows: minutes } = await pool.query(
        "SELECT * FROM quality_meeting_minutes WHERE meeting_id = $1 ORDER BY created_at", [req.params.id]);
      res.json({ ...m, minutes });
    } catch (err) { next(err); }
  }
);

router.post("/meetings", requirePermission("quality.meetings.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const {
        committee_id, title, meeting_date, location, agenda, chaired_by_name,
      } = req.body;
      if (!title || !meeting_date) { res.status(400).json({ error: "title et meeting_date requis" }); return; }
      const userId = req.auth?.userId;
      const { rows: [m] } = await pool.query(`
        INSERT INTO quality_meetings (committee_id, title, meeting_date, location, agenda, chaired_by, chaired_by_name)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [committee_id || null, title, meeting_date, location, agenda, userId, chaired_by_name]);
      res.status(201).json(m);
    } catch (err) { next(err); }
  }
);

router.patch("/meetings/:id", requirePermission("quality.meetings.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const allowed = ["title","meeting_date","location","status","agenda","chaired_by_name","quorum_reached"];
      const sets: string[] = []; const params: unknown[] = []; let pi = 1;
      for (const k of allowed) {
        if (req.body[k] !== undefined) { sets.push(`${k} = $${pi++}`); params.push(req.body[k]); }
      }
      if (!sets.length) { res.status(400).json({ error: "Aucun champ" }); return; }
      params.push(req.params.id);
      const { rows: [m] } = await pool.query(`UPDATE quality_meetings SET ${sets.join(",")} WHERE id = $${pi} RETURNING *`, params);
      if (!m) { res.status(404).json({ error: "Introuvable" }); return; }
      res.json(m);
    } catch (err) { next(err); }
  }
);

router.post("/meetings/:id/minutes", requirePermission("quality.meetings.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { section_title, content, decisions, action_items } = req.body;
      if (!content) { res.status(400).json({ error: "content requis" }); return; }
      const userId = req.auth?.userId;
      const { rows: [min] } = await pool.query(`
        INSERT INTO quality_meeting_minutes (meeting_id, section_title, content, decisions, action_items, recorded_by)
        VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [req.params.id, section_title, content, decisions, action_items, userId]);
      res.status(201).json(min);
    } catch (err) { next(err); }
  }
);

export default router;
