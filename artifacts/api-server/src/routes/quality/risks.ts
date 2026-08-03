import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();

router.get("/risks", requirePermission("quality.risks.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { q, status, category, min_criticality, limit = "30", page = "1" } = req.query as Record<string,string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const conds: string[] = []; const params: unknown[] = []; let pi = 1;
      if (q)              { conds.push(`(title ILIKE $${pi} OR reference ILIKE $${pi} OR department ILIKE $${pi})`); params.push(`%${q}%`); pi++; }
      if (status)         { conds.push(`status = $${pi++}::quality_risk_status`); params.push(status); }
      if (category)       { conds.push(`category = $${pi++}::quality_risk_category`); params.push(category); }
      if (min_criticality){ conds.push(`criticality >= $${pi++}`); params.push(parseInt(min_criticality)); }
      const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
      const [{ rows }, { rows: [{ count }] }] = await Promise.all([
        pool.query(`SELECT * FROM quality_risk_register ${where} ORDER BY criticality DESC, created_at DESC LIMIT $${pi} OFFSET $${pi+1}`, [...params, limit, offset]),
        pool.query(`SELECT COUNT(*) FROM quality_risk_register ${where}`, params),
      ]);
      res.json({ data: rows, total: parseInt(count), page: parseInt(page) });
    } catch (err) { next(err); }
  }
);

router.get("/risks/heatmap", requirePermission("quality.risks.view"),
  async (_req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { rows } = await pool.query("SELECT * FROM v_quality_risk_heatmap ORDER BY probability, impact");
      res.json({ data: rows });
    } catch (err) { next(err); }
  }
);

router.get("/risks/:id", requirePermission("quality.risks.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { rows: [risk] } = await pool.query("SELECT * FROM quality_risk_register WHERE id = $1", [req.params.id]);
      if (!risk) { res.status(404).json({ error: "Risque introuvable" }); return; }
      const { rows: assessments } = await pool.query(
        "SELECT * FROM quality_risk_assessments WHERE risk_id = $1 ORDER BY assessed_at DESC", [req.params.id]);
      res.json({ ...risk, assessments });
    } catch (err) { next(err); }
  }
);

router.post("/risks", requirePermission("quality.risks.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const {
        title, description, category = "organisationnel", department, process_ref,
        probability = 3, impact = 3, treatment_strategy, controls_existing, controls_planned,
        owner_name, identified_date, next_review_date,
      } = req.body;
      if (!title) { res.status(400).json({ error: "title requis" }); return; }
      const userId = req.auth?.userId;
      const { rows: [risk] } = await pool.query(`
        INSERT INTO quality_risk_register
          (title, description, category, department, process_ref, probability, impact,
           treatment_strategy, controls_existing, controls_planned, owner_id, owner_name,
           identified_date, next_review_date)
        VALUES ($1,$2,$3::quality_risk_category,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING *`,
        [title, description, category, department, process_ref, probability, impact,
         treatment_strategy, controls_existing, controls_planned, userId, owner_name,
         identified_date || new Date().toISOString().split("T")[0], next_review_date || null]);
      res.status(201).json(risk);
    } catch (err) { next(err); }
  }
);

router.patch("/risks/:id", requirePermission("quality.risks.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const allowed = ["title","description","category","department","probability","impact",
                       "residual_probability","residual_impact","treatment_strategy",
                       "controls_existing","controls_planned","owner_name","next_review_date","status"];
      const sets: string[] = []; const params: unknown[] = []; let pi = 1;
      for (const k of allowed) {
        if (req.body[k] !== undefined) {
          if (k === "category") sets.push(`${k} = $${pi++}::quality_risk_category`);
          else if (k === "status") sets.push(`${k} = $${pi++}::quality_risk_status`);
          else sets.push(`${k} = $${pi++}`);
          params.push(req.body[k]);
        }
      }
      if (!sets.length) { res.status(400).json({ error: "Aucun champ" }); return; }
      params.push(req.params.id);
      const { rows: [r] } = await pool.query(
        `UPDATE quality_risk_register SET ${sets.join(",")} WHERE id = $${pi} RETURNING *`, params);
      if (!r) { res.status(404).json({ error: "Introuvable" }); return; }
      res.json(r);
    } catch (err) { next(err); }
  }
);

router.post("/risks/:id/assess", requirePermission("quality.risks.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { probability, impact, justification, recommended_actions } = req.body;
      if (!probability || !impact) { res.status(400).json({ error: "probability et impact requis" }); return; }
      const userId = req.auth?.userId;
      const { rows: [a] } = await pool.query(`
        INSERT INTO quality_risk_assessments (risk_id, assessed_by, probability, impact, justification, recommended_actions)
        VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [req.params.id, userId, probability, impact, justification, recommended_actions]);
      await pool.query(
        `UPDATE quality_risk_register SET residual_probability = $1, residual_impact = $2,
         last_reviewed_at = now(), status = 'evalue' WHERE id = $3`,
        [probability, impact, req.params.id]);
      res.status(201).json(a);
    } catch (err) { next(err); }
  }
);

export default router;
