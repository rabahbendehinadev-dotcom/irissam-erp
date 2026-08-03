import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();
function actor(req: AuthenticatedRequest) { return { userId: req.user!.userId }; }

// ── List ──────────────────────────────────────────────────────────────────
router.get("/", requirePermission("biomed.incident.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { status, severity, equipment_id, limit = "25", page = "1" } = req.query as Record<string,string>;
      const lim = Math.min(Number(limit)||25,100);
      const off = (Math.max(Number(page)||1,1)-1)*lim;
      const conds: string[] = [];
      const vals: unknown[] = [];
      if (status)      { vals.push(status);      conds.push(`i.status=$${vals.length}`); }
      if (severity)    { vals.push(severity);    conds.push(`i.severity=$${vals.length}`); }
      if (equipment_id){ vals.push(equipment_id);conds.push(`i.equipment_id=$${vals.length}::uuid`); }
      const where = conds.length ? "WHERE "+conds.join(" AND ") : "";
      const [rows, cnt] = await Promise.all([
        pool.query(`SELECT i.*, e.name AS equipment_name, e.internal_code,
            u.first_name||' '||u.last_name AS declared_by_name
          FROM biomedical_incidents i
          LEFT JOIN biomedical_equipment e ON e.id = i.equipment_id
          LEFT JOIN users u ON u.id = i.declared_by
          ${where} ORDER BY i.incident_date DESC LIMIT ${lim} OFFSET ${off}`, vals),
        pool.query(`SELECT COUNT(*) FROM biomedical_incidents i ${where}`, vals),
      ]);
      res.json({ data: rows.rows, total: Number(cnt.rows[0].count), page: Number(page), limit: lim });
    } catch (err) { next(err); }
  }
);

// ── Get one ───────────────────────────────────────────────────────────────
router.get("/:id", requirePermission("biomed.incident.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT i.*, e.name AS equipment_name, e.internal_code
         FROM biomedical_incidents i
         LEFT JOIN biomedical_equipment e ON e.id = i.equipment_id
         WHERE i.id=$1::uuid`, [req.params.id]);
      if (!rows[0]) return void res.status(404).json({ error: "Incident non trouvé" });
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

// ── Create ────────────────────────────────────────────────────────────────
router.post("/", requirePermission("biomed.incident.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { equipment_id, severity, title, description, incident_date,
              patient_impact, patient_safety_alert, notes } = req.body;
      if (!title || !description) return void res.status(400).json({ error: "title et description requis" });
      const { rows } = await pool.query(
        `INSERT INTO biomedical_incidents
          (equipment_id, severity, title, description, incident_date,
           patient_impact, patient_safety_alert, notes, declared_by)
         VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9::uuid) RETURNING *`,
        [equipment_id??null, severity??"modere", title, description,
         incident_date??new Date().toISOString(),
         !!patient_impact, !!patient_safety_alert, notes??null, act.userId]);

      // If patient safety alert, mark equipment hors_service
      if (patient_safety_alert && equipment_id) {
        await pool.query(
          `UPDATE biomedical_equipment SET status='hors_service', updated_at=now() WHERE id=$1::uuid`,
          [equipment_id]);
      }
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

// ── Workflow transitions ───────────────────────────────────────────────────
const TRANSITIONS: Record<string, {from: string[], status: string, field?: string}> = {
  analyse:  { from: ["declare"],              status: "en_analyse" },
  correct:  { from: ["en_analyse"],           status: "en_correction" },
  validate: { from: ["en_correction"],        status: "valide",   field: "validated" },
  close:    { from: ["valide","en_analyse"],  status: "clos",     field: "closed" },
};

router.post("/:id/:action", requirePermission("biomed.incident.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const tr = TRANSITIONS[req.params.action];
      if (!tr) return void res.status(404).json({ error: "Action inconnue" });
      const { root_cause, corrective_action, notes } = req.body;
      const extraSets = [];
      const vals: unknown[] = [act.userId, tr.status, req.params.id];
      if (tr.field === "validated") {
        extraSets.push(`validated_by=$1::uuid, validated_at=now()`);
      } else if (tr.field === "closed") {
        extraSets.push(`closed_by=$1::uuid, closed_at=now()`);
      }
      if (root_cause)       { vals.push(root_cause);       extraSets.push(`root_cause=$${vals.length}`); }
      if (corrective_action){ vals.push(corrective_action);extraSets.push(`corrective_action=$${vals.length}`); }
      if (notes)            { vals.push(notes);            extraSets.push(`notes=$${vals.length}`); }
      const extra = extraSets.length ? ", "+extraSets.join(", ") : "";
      const { rows } = await pool.query(
        `UPDATE biomedical_incidents SET status=$2, updated_at=now()${extra}
         WHERE id=$3::uuid AND status=ANY($4::text[]) RETURNING *`,
        [...vals, tr.from]);
      if (!rows[0]) return void res.status(400).json({ error: `Transition ${req.params.action} impossible depuis l'état actuel` });
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

export default router;
