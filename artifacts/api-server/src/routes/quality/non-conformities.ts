import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();

const NC_WORKFLOW: Record<string, string> = {
  detectee: "analysee", analysee: "corrigee", corrigee: "validee", validee: "archivee",
};

router.get("/non-conformities", requirePermission("quality.nc.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { q, status, nc_type, severity, limit = "20", page = "1" } = req.query as Record<string,string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const conds: string[] = []; const params: unknown[] = []; let pi = 1;
      if (q)        { conds.push(`(title ILIKE $${pi} OR reference ILIKE $${pi} OR department ILIKE $${pi})`); params.push(`%${q}%`); pi++; }
      if (status)   { conds.push(`status = $${pi++}::quality_nc_status`); params.push(status); }
      if (nc_type)  { conds.push(`nc_type = $${pi++}::quality_nc_type`); params.push(nc_type); }
      if (severity) { conds.push(`severity = $${pi++}::quality_severity`); params.push(severity); }
      const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
      const [{ rows }, { rows: [{ count }] }] = await Promise.all([
        pool.query(`SELECT * FROM quality_non_conformities ${where} ORDER BY created_at DESC LIMIT $${pi} OFFSET $${pi+1}`, [...params, limit, offset]),
        pool.query(`SELECT COUNT(*) FROM quality_non_conformities ${where}`, params),
      ]);
      res.json({ data: rows, total: parseInt(count), page: parseInt(page) });
    } catch (err) { next(err); }
  }
);

router.post("/non-conformities", requirePermission("quality.nc.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const {
        title, description, nc_type = "processus", severity = "modere",
        detected_date, department, process_ref, standard_clause, due_date, incident_id,
      } = req.body;
      if (!title) { res.status(400).json({ error: "title requis" }); return; }
      const userId = req.auth?.userId;
      const { rows: [nc] } = await pool.query(`
        INSERT INTO quality_non_conformities
          (title, description, nc_type, severity, detected_date, department,
           process_ref, standard_clause, due_date, incident_id, detected_by)
        VALUES ($1,$2,$3::quality_nc_type,$4::quality_severity,$5,$6,$7,$8,$9,$10,$11)
        RETURNING *`,
        [title, description, nc_type, severity, detected_date || new Date().toISOString().split("T")[0],
         department, process_ref, standard_clause, due_date || null, incident_id || null, userId]);
      res.status(201).json(nc);
    } catch (err) { next(err); }
  }
);

router.patch("/non-conformities/:id", requirePermission("quality.nc.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const allowed = ["title","description","severity","department","process_ref","standard_clause",
                       "due_date","root_cause","immediate_correction"];
      const sets: string[] = []; const params: unknown[] = []; let pi = 1;
      for (const k of allowed) {
        if (req.body[k] !== undefined) { sets.push(`${k} = $${pi++}`); params.push(req.body[k]); }
      }
      if (!sets.length) { res.status(400).json({ error: "Aucun champ" }); return; }
      params.push(req.params.id);
      const { rows: [nc] } = await pool.query(
        `UPDATE quality_non_conformities SET ${sets.join(",")} WHERE id = $${pi} RETURNING *`, params);
      if (!nc) { res.status(404).json({ error: "Introuvable" }); return; }
      res.json(nc);
    } catch (err) { next(err); }
  }
);

router.post("/non-conformities/:id/advance", requirePermission("quality.nc.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows: [nc] } = await client.query(
        "SELECT * FROM quality_non_conformities WHERE id = $1 FOR UPDATE", [req.params.id]);
      if (!nc) { await client.query("ROLLBACK"); res.status(404).json({ error: "Introuvable" }); return; }
      const next = NC_WORKFLOW[nc.status];
      if (!next) { await client.query("ROLLBACK"); res.status(400).json({ error: "NC déjà archivée" }); return; }
      const userId = req.auth?.userId;
      const tsMap: Record<string, [string, string]> = {
        analysee: ["analysed_at","analysed_by"],
        corrigee: ["corrected_at","corrected_by"],
        validee:  ["validated_at","validated_by"],
        archivee: ["archived_at","archived_by"],
      };
      const [tsCol, byCol] = tsMap[next] ?? [];
      const extraSets = tsCol ? `, ${tsCol} = now(), ${byCol} = '${userId}'` : "";
      const { rows: [updated] } = await client.query(
        `UPDATE quality_non_conformities SET status = $1::quality_nc_status${extraSets} WHERE id = $2 RETURNING *`,
        [next, req.params.id]);
      await client.query("COMMIT");
      res.json(updated);
    } catch (err) { await client.query("ROLLBACK"); next(err); }
    finally { client.release(); }
  }
);

export default router;
