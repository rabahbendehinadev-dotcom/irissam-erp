import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();
function actor(req: AuthenticatedRequest) { return { userId: req.user!.userId }; }

router.get("/", requirePermission("biomed.inspection.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { equipment_id, result, limit = "25", page = "1" } = req.query as Record<string,string>;
      const lim = Math.min(Number(limit)||25,100);
      const off = (Math.max(Number(page)||1,1)-1)*lim;
      const conds: string[] = [];
      const vals: unknown[] = [];
      if (equipment_id){ vals.push(equipment_id);conds.push(`i.equipment_id=$${vals.length}::uuid`); }
      if (result)      { vals.push(result);      conds.push(`i.result=$${vals.length}`); }
      const where = conds.length ? "WHERE "+conds.join(" AND ") : "";
      const [rows, cnt] = await Promise.all([
        pool.query(`SELECT i.*, e.name AS equipment_name, e.internal_code,
            u.first_name||' '||u.last_name AS inspector_name
          FROM biomedical_inspections i
          LEFT JOIN biomedical_equipment e ON e.id=i.equipment_id
          LEFT JOIN users u ON u.id=i.inspected_by
          ${where} ORDER BY i.inspection_date DESC LIMIT ${lim} OFFSET ${off}`, vals),
        pool.query(`SELECT COUNT(*) FROM biomedical_inspections i ${where}`, vals),
      ]);
      res.json({ data: rows.rows, total: Number(cnt.rows[0].count), page: Number(page), limit: lim });
    } catch (err) { next(err); }
  }
);

router.post("/", requirePermission("biomed.inspection.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { equipment_id, inspection_date, inspection_type, checklist, result,
              findings, recommendations, next_due_date } = req.body;
      if (!equipment_id||!inspection_date) return void res.status(400).json({ error: "equipment_id et inspection_date requis" });
      const { rows } = await pool.query(
        `INSERT INTO biomedical_inspections
          (equipment_id, inspected_by, inspection_date, next_due_date,
           inspection_type, checklist, result, findings, recommendations)
         VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6::jsonb,$7,$8,$9) RETURNING *`,
        [equipment_id, act.userId, inspection_date, next_due_date??null,
         inspection_type??"reglementaire", JSON.stringify(checklist??[]),
         result??"conforme", findings??null, recommendations??null]);
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

export default router;
