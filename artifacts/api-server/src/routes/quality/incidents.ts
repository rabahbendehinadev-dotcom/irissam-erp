import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();

const WORKFLOW: Record<string, string> = {
  declare:       "qualification",
  qualification: "investigation",
  investigation: "analyse",
  analyse:       "cause_racine",
  cause_racine:  "correction",
  correction:    "validation",
  validation:    "clos",
};

// GET /quality/incidents
router.get("/incidents", requirePermission("quality.incidents.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { q, status, severity, incident_type, limit = "20", page = "1" } = req.query as Record<string,string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const conds: string[] = []; const params: unknown[] = []; let pi = 1;
      if (q)             { conds.push(`(i.title ILIKE $${pi} OR i.reference ILIKE $${pi} OR i.department ILIKE $${pi})`); params.push(`%${q}%`); pi++; }
      if (status)        { conds.push(`i.status = $${pi++}::quality_incident_status`); params.push(status); }
      if (severity)      { conds.push(`i.severity = $${pi++}::quality_severity`); params.push(severity); }
      if (incident_type) { conds.push(`i.incident_type = $${pi++}::quality_incident_type`); params.push(incident_type); }
      const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
      const [{ rows }, { rows: [{ count }] }] = await Promise.all([
        pool.query(`SELECT i.*, p.first_name||' '||p.last_name AS patient_name FROM quality_incidents i LEFT JOIN patients p ON p.id = i.patient_id ${where} ORDER BY i.created_at DESC LIMIT $${pi} OFFSET $${pi+1}`, [...params, limit, offset]),
        pool.query(`SELECT COUNT(*) FROM quality_incidents i ${where}`, params),
      ]);
      res.json({ data: rows, total: parseInt(count), page: parseInt(page) });
    } catch (err) { next(err); }
  }
);

// GET /quality/incidents/:id
router.get("/incidents/:id", requirePermission("quality.incidents.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { rows: [inc] } = await pool.query(
        `SELECT i.*, p.first_name||' '||p.last_name AS patient_name
         FROM quality_incidents i LEFT JOIN patients p ON p.id = i.patient_id
         WHERE i.id = $1`, [req.params.id]);
      if (!inc) { res.status(404).json({ error: "Incident introuvable" }); return; }
      const { rows: capas } = await pool.query(
        "SELECT id, reference, title, capa_type, status, due_date FROM quality_corrective_actions WHERE incident_id = $1", [req.params.id]);
      const { rows: ncs } = await pool.query(
        "SELECT id, reference, title, status FROM quality_non_conformities WHERE incident_id = $1", [req.params.id]);
      res.json({ ...inc, capas, ncs });
    } catch (err) { next(err); }
  }
);

// POST /quality/incidents
router.post("/incidents", requirePermission("quality.incidents.create"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const {
        title, description, incident_type = "evenement_indesirable", severity = "modere",
        occurrence_date, location, department, patient_id,
        admission_id, source_module, source_ref_id, immediate_action, is_sentinel_event = false,
      } = req.body;
      if (!title || !occurrence_date) { res.status(400).json({ error: "title et occurrence_date requis" }); return; }
      const userId = req.auth?.userId;
      const { rows: [inc] } = await pool.query(`
        INSERT INTO quality_incidents
          (title, description, incident_type, severity, occurrence_date, location, department,
           patient_id, admission_id, source_module, source_ref_id, immediate_action,
           is_sentinel_event, declared_by, declared_at)
        VALUES ($1,$2,$3::quality_incident_type,$4::quality_severity,$5,$6,$7,
                $8,$9,$10,$11,$12,$13,$14,now())
        RETURNING *`,
        [title, description, incident_type, severity, occurrence_date, location, department,
         patient_id || null, admission_id || null, source_module || null, source_ref_id || null,
         immediate_action, is_sentinel_event, userId]);
      res.status(201).json(inc);
    } catch (err) { next(err); }
  }
);

// PATCH /quality/incidents/:id — update fields
router.patch("/incidents/:id", requirePermission("quality.incidents.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const allowed = ["title","description","severity","location","department","immediate_action",
                       "recommendations","lessons_learned","root_cause","corrective_summary",
                       "is_sentinel_event","notified_authority"];
      const sets: string[] = []; const params: unknown[] = []; let pi = 1;
      for (const k of allowed) {
        if (req.body[k] !== undefined) { sets.push(`${k} = $${pi++}`); params.push(req.body[k]); }
      }
      if (!sets.length) { res.status(400).json({ error: "Aucun champ à modifier" }); return; }
      params.push(req.params.id);
      const { rows: [inc] } = await pool.query(
        `UPDATE quality_incidents SET ${sets.join(",")} WHERE id = $${pi} RETURNING *`, params);
      if (!inc) { res.status(404).json({ error: "Introuvable" }); return; }
      res.json(inc);
    } catch (err) { next(err); }
  }
);

// POST /quality/incidents/:id/advance — advance workflow
router.post("/incidents/:id/advance", requirePermission("quality.incidents.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows: [inc] } = await client.query(
        "SELECT * FROM quality_incidents WHERE id = $1 FOR UPDATE", [req.params.id]);
      if (!inc) { await client.query("ROLLBACK"); res.status(404).json({ error: "Introuvable" }); return; }
      const nextStatus = WORKFLOW[inc.status];
      if (!nextStatus) { await client.query("ROLLBACK"); res.status(400).json({ error: "Incident déjà clos" }); return; }
      const userId = req.auth?.userId;
      const tsCol = nextStatus.replace("cause_racine","analysed") // mapping status → column name
        .replace("qualification","qualified").replace("investigation","investigated")
        .replace("analyse","analysed").replace("correction","corrected")
        .replace("validation","validated").replace("clos","closed");
      const byCol = tsCol.replace(/_at$/,"_by");
      // Simple update — set status and timestamp column if it exists
      const { rows: [updated] } = await client.query(
        `UPDATE quality_incidents SET status = $1::quality_incident_status, updated_at = now()
         WHERE id = $2 RETURNING *`, [nextStatus, req.params.id]);
      // Try to update lifecycle columns (ignore if column doesn't exist)
      const atCol = nextStatus === "clos" ? "closed_at"
        : nextStatus === "validation" ? "validated_at"
        : nextStatus === "correction" ? null
        : nextStatus === "cause_racine" ? "analysed_at"
        : nextStatus === "analyse" ? "investigated_at"
        : nextStatus === "investigation" ? "qualified_at"
        : null;
      if (atCol) {
        const byColName = atCol.replace("_at","_by");
        await client.query(
          `UPDATE quality_incidents SET ${atCol} = now(), ${byColName} = $1 WHERE id = $2`,
          [userId, req.params.id]).catch(() => {/* column may not exist */});
      }
      await client.query("COMMIT");
      res.json(updated);
    } catch (err) { await client.query("ROLLBACK"); next(err); }
    finally { client.release(); }
  }
);

export default router;
