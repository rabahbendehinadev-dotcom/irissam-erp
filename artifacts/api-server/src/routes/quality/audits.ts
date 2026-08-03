import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();

router.get("/audits", requirePermission("quality.audits.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { q, status, audit_type, limit = "20", page = "1" } = req.query as Record<string,string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const conds: string[] = []; const params: unknown[] = []; let pi = 1;
      if (q)          { conds.push(`(title ILIKE $${pi} OR reference ILIKE $${pi} OR department ILIKE $${pi})`); params.push(`%${q}%`); pi++; }
      if (status)     { conds.push(`status = $${pi++}::quality_audit_status`); params.push(status); }
      if (audit_type) { conds.push(`audit_type = $${pi++}::quality_audit_type`); params.push(audit_type); }
      const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
      const [{ rows }, { rows: [{ count }] }] = await Promise.all([
        pool.query(`SELECT * FROM quality_audits ${where} ORDER BY planned_start_date DESC LIMIT $${pi} OFFSET $${pi+1}`, [...params, limit, offset]),
        pool.query(`SELECT COUNT(*) FROM quality_audits ${where}`, params),
      ]);
      res.json({ data: rows, total: parseInt(count), page: parseInt(page) });
    } catch (err) { next(err); }
  }
);

router.get("/audits/:id", requirePermission("quality.audits.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { rows: [audit] } = await pool.query("SELECT * FROM quality_audits WHERE id = $1", [req.params.id]);
      if (!audit) { res.status(404).json({ error: "Audit introuvable" }); return; }
      const { rows: findings } = await pool.query(
        "SELECT * FROM quality_audit_findings WHERE audit_id = $1 ORDER BY created_at", [req.params.id]);
      res.json({ ...audit, findings });
    } catch (err) { next(err); }
  }
);

router.post("/audits", requirePermission("quality.audits.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const {
        title, audit_type = "interne", scope, objectives, standard_ref, department,
        lead_auditor_name, planned_start_date, planned_end_date,
      } = req.body;
      if (!title || !planned_start_date || !planned_end_date) {
        res.status(400).json({ error: "title, planned_start_date, planned_end_date requis" }); return;
      }
      const userId = req.auth?.userId;
      const { rows: [audit] } = await pool.query(`
        INSERT INTO quality_audits
          (title, audit_type, scope, objectives, standard_ref, department,
           lead_auditor_id, lead_auditor_name, planned_start_date, planned_end_date)
        VALUES ($1,$2::quality_audit_type,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING *`,
        [title, audit_type, scope, objectives, standard_ref, department,
         userId, lead_auditor_name, planned_start_date, planned_end_date]);
      res.status(201).json(audit);
    } catch (err) { next(err); }
  }
);

router.patch("/audits/:id", requirePermission("quality.audits.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const statusMap: Record<string, string> = {
        en_cours: "actual_start_date = CURRENT_DATE,",
        clos:     "actual_end_date = CURRENT_DATE, report_date = CURRENT_DATE,",
      };
      const allowed = ["title","scope","objectives","standard_ref","department",
                       "lead_auditor_name","overall_result","executive_summary","status",
                       "planned_start_date","planned_end_date"];
      const sets: string[] = []; const params: unknown[] = []; let pi = 1;
      for (const k of allowed) {
        if (req.body[k] !== undefined) {
          if (k === "status") sets.push(`${k} = $${pi++}::quality_audit_status`);
          else sets.push(`${k} = $${pi++}`);
          params.push(req.body[k]);
        }
      }
      if (!sets.length) { res.status(400).json({ error: "Aucun champ" }); return; }
      params.push(req.params.id);
      const { rows: [a] } = await pool.query(
        `UPDATE quality_audits SET ${sets.join(",")} WHERE id = $${pi} RETURNING *`, params);
      if (!a) { res.status(404).json({ error: "Introuvable" }); return; }
      res.json(a);
    } catch (err) { next(err); }
  }
);

// POST /audits/:id/findings
router.post("/audits/:id/findings", requirePermission("quality.audits.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const {
        finding_type = "observation", title, description, clause_ref, evidence, department,
      } = req.body;
      if (!title) { res.status(400).json({ error: "title requis" }); return; }
      const { rows: [f] } = await pool.query(`
        INSERT INTO quality_audit_findings (audit_id, finding_type, title, description, clause_ref, evidence, department)
        VALUES ($1,$2::quality_finding_type,$3,$4,$5,$6,$7) RETURNING *`,
        [req.params.id, finding_type, title, description, clause_ref, evidence, department]);
      res.status(201).json(f);
    } catch (err) { next(err); }
  }
);

router.patch("/audits/findings/:fid", requirePermission("quality.audits.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { is_closed } = req.body;
      const extra = is_closed ? ", closed_at = now()" : "";
      const { rows: [f] } = await pool.query(
        `UPDATE quality_audit_findings SET is_closed = $1${extra} WHERE id = $2 RETURNING *`,
        [!!is_closed, req.params.fid]);
      if (!f) { res.status(404).json({ error: "Introuvable" }); return; }
      res.json(f);
    } catch (err) { next(err); }
  }
);

export default router;
