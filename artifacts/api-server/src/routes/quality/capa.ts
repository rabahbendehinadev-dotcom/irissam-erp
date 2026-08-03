import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();

const CAPA_WORKFLOW: Record<string, string> = {
  ouverte: "en_cours", en_cours: "en_verification", en_verification: "efficace",
};

async function listCapas(req: AuthenticatedRequest, res: any, next: any, table: string) {
  try {
    const { q, status, capa_type, limit = "20", page = "1" } = req.query as Record<string,string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conds: string[] = []; const params: unknown[] = []; let pi = 1;
    if (q)         { conds.push(`(title ILIKE $${pi} OR reference ILIKE $${pi} OR department ILIKE $${pi})`); params.push(`%${q}%`); pi++; }
    if (status)    { conds.push(`status = $${pi++}::quality_capa_status`); params.push(status); }
    if (capa_type) { conds.push(`capa_type = $${pi++}::quality_capa_type`); params.push(capa_type); }
    const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
    const isOverdue = req.query.overdue === "1";
    const overdueClause = isOverdue ? `${where ? "AND" : "WHERE"} due_date < CURRENT_DATE AND status NOT IN ('efficace','inefficace','annulee')` : "";
    const [{ rows }, { rows: [{ count }] }] = await Promise.all([
      pool.query(`SELECT * FROM ${table} ${where} ${overdueClause} ORDER BY due_date ASC, created_at DESC LIMIT $${pi} OFFSET $${pi+1}`, [...params, limit, offset]),
      pool.query(`SELECT COUNT(*) FROM ${table} ${where} ${overdueClause}`, params),
    ]);
    res.json({ data: rows, total: parseInt(count), page: parseInt(page) });
  } catch (err) { next(err); }
}

router.get("/capa", requirePermission("quality.capa.view"),
  (req: AuthenticatedRequest, res, next) => listCapas(req, res, next, "quality_corrective_actions"));

router.post("/capa", requirePermission("quality.capa.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const {
        title, description, capa_type = "corrective", due_date,
        responsible_name, department, incident_id, nc_id,
        estimated_cost,
      } = req.body;
      if (!title || !due_date) { res.status(400).json({ error: "title et due_date requis" }); return; }
      const table = capa_type === "preventive" ? "quality_preventive_actions" : "quality_corrective_actions";
      const userId = req.auth?.userId;
      const { rows: [capa] } = await pool.query(`
        INSERT INTO ${table}
          (title, description, capa_type, due_date, responsible_id, responsible_name,
           department, incident_id, nc_id, estimated_cost)
        VALUES ($1,$2,$3::quality_capa_type,$4,$5,$6,$7,$8,$9,$10)
        RETURNING *`,
        [title, description, capa_type, due_date, userId, responsible_name,
         department, incident_id || null, nc_id || null, estimated_cost || null]);
      res.status(201).json(capa);
    } catch (err) { next(err); }
  }
);

router.patch("/capa/:id", requirePermission("quality.capa.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { capa_type = "corrective" } = req.body;
      const table = capa_type === "preventive" ? "quality_preventive_actions" : "quality_corrective_actions";
      const allowed = ["title","description","due_date","responsible_name","department",
                       "estimated_cost","actual_cost","effectiveness_notes"];
      const sets: string[] = []; const params: unknown[] = []; let pi = 1;
      for (const k of allowed) {
        if (req.body[k] !== undefined) { sets.push(`${k} = $${pi++}`); params.push(req.body[k]); }
      }
      if (!sets.length) { res.status(400).json({ error: "Aucun champ" }); return; }
      params.push(req.params.id);
      const { rows: [c] } = await pool.query(`UPDATE ${table} SET ${sets.join(",")} WHERE id = $${pi} RETURNING *`, params);
      if (!c) { res.status(404).json({ error: "Introuvable" }); return; }
      res.json(c);
    } catch (err) { next(err); }
  }
);

router.post("/capa/:id/advance", requirePermission("quality.capa.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { capa_type = "corrective", mark_ineffective } = req.body;
      const table = capa_type === "preventive" ? "quality_preventive_actions" : "quality_corrective_actions";
      const { rows: [c] } = await client.query(`SELECT * FROM ${table} WHERE id = $1 FOR UPDATE`, [req.params.id]);
      if (!c) { await client.query("ROLLBACK"); res.status(404).json({ error: "Introuvable" }); return; }
      const nextStatus = mark_ineffective ? "inefficace" : CAPA_WORKFLOW[c.status];
      if (!nextStatus) { await client.query("ROLLBACK"); res.status(400).json({ error: "CAPA déjà terminée" }); return; }
      const userId = req.auth?.userId;
      const extra = nextStatus === "en_cours" ? ", started_at = now()"
        : nextStatus === "en_verification" ? ", completed_at = now()"
        : nextStatus === "efficace" ? `, verified_at = now(), verified_by = '${userId}', effectiveness_verified = true`
        : "";
      const { rows: [updated] } = await client.query(
        `UPDATE ${table} SET status = $1::quality_capa_status${extra} WHERE id = $2 RETURNING *`,
        [nextStatus, req.params.id]);
      await client.query("COMMIT");
      res.json(updated);
    } catch (err) { await client.query("ROLLBACK"); next(err); }
    finally { client.release(); }
  }
);

export default router;
