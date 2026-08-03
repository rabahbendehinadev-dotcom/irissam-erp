import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();
function actor(req: AuthenticatedRequest) { return { userId: req.user!.userId }; }

// ── List ──────────────────────────────────────────────────────────────────
router.get("/", requirePermission("biomed.maintenance.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { status, order_type, equipment_id, assigned_to,
              from_date, to_date, limit = "25", page = "1" } = req.query as Record<string,string>;
      const lim = Math.min(Number(limit) || 25, 100);
      const off = (Math.max(Number(page) || 1, 1) - 1) * lim;
      const conds: string[] = [];
      const vals:  unknown[] = [];
      if (status)      { vals.push(status);      conds.push(`wo.status=$${vals.length}`); }
      if (order_type)  { vals.push(order_type);  conds.push(`wo.order_type=$${vals.length}`); }
      if (equipment_id){ vals.push(equipment_id);conds.push(`wo.equipment_id=$${vals.length}::uuid`); }
      if (assigned_to) { vals.push(assigned_to); conds.push(`wo.assigned_to=$${vals.length}::uuid`); }
      if (from_date)   { vals.push(from_date);   conds.push(`wo.scheduled_date>=$${vals.length}`); }
      if (to_date)     { vals.push(to_date);     conds.push(`wo.scheduled_date<=$${vals.length}`); }
      const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
      const [rows, cnt] = await Promise.all([
        pool.query(`SELECT wo.*, e.name AS equipment_name, e.internal_code,
            u.first_name||' '||u.last_name AS assigned_name
          FROM biomedical_work_orders wo
          LEFT JOIN biomedical_equipment e ON e.id = wo.equipment_id
          LEFT JOIN users u ON u.id = wo.assigned_to
          ${where} ORDER BY wo.created_at DESC LIMIT ${lim} OFFSET ${off}`, vals),
        pool.query(`SELECT COUNT(*) FROM biomedical_work_orders wo ${where}`, vals),
      ]);
      res.json({ data: rows.rows, total: Number(cnt.rows[0].count), page: Number(page), limit: lim });
    } catch (err) { next(err); }
  }
);

// ── Get one ───────────────────────────────────────────────────────────────
router.get("/:id", requirePermission("biomed.maintenance.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const [wo, tasks] = await Promise.all([
        pool.query(`SELECT wo.*, e.name AS equipment_name, e.internal_code, e.location_id,
            u.first_name||' '||u.last_name AS assigned_name
          FROM biomedical_work_orders wo
          LEFT JOIN biomedical_equipment e ON e.id = wo.equipment_id
          LEFT JOIN users u ON u.id = wo.assigned_to
          WHERE wo.id=$1::uuid`, [req.params.id]),
        pool.query(`SELECT * FROM biomedical_work_order_tasks WHERE work_order_id=$1::uuid ORDER BY sort_order`, [req.params.id]),
      ]);
      if (!wo.rows[0]) return void res.status(404).json({ error: "Ordre de travail non trouvé" });
      res.json({ ...wo.rows[0], tasks: tasks.rows });
    } catch (err) { next(err); }
  }
);

// ── Create ────────────────────────────────────────────────────────────────
router.post("/", requirePermission("biomed.maintenance.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { equipment_id, order_type, priority, title, description,
              assigned_to, scheduled_date, estimated_hours, tasks = [] } = req.body;
      if (!equipment_id || !title) return void res.status(400).json({ error: "equipment_id et title requis" });

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const { rows } = await client.query(
          `INSERT INTO biomedical_work_orders (equipment_id, order_type, priority, title, description,
            assigned_to, scheduled_date, estimated_hours, requested_by, created_by)
           VALUES ($1::uuid,$2,$3,$4,$5,$6::uuid,$7,$8,$9::uuid,$9::uuid) RETURNING *`,
          [equipment_id, order_type??"corrective", priority??"normale", title, description??null,
           assigned_to??null, scheduled_date??null, estimated_hours??null, act.userId]);
        const wo = rows[0];
        if (Array.isArray(tasks) && tasks.length > 0) {
          for (let i = 0; i < tasks.length; i++) {
            await client.query(
              `INSERT INTO biomedical_work_order_tasks (work_order_id, task_name, description, sort_order)
               VALUES ($1::uuid,$2,$3,$4)`,
              [wo.id, tasks[i].task_name ?? tasks[i], tasks[i].description??null, i]);
          }
        }
        // Mark equipment as en_maintenance if not already
        await client.query(
          `UPDATE biomedical_equipment SET status='en_maintenance', updated_at=now()
           WHERE id=$1::uuid AND status='actif'`, [equipment_id]);
        await client.query("COMMIT");
        res.status(201).json({ ...wo, tasks });
      } catch (e) { await client.query("ROLLBACK"); throw e; }
      finally { client.release(); }
    } catch (err) { next(err); }
  }
);

// ── Update status ─────────────────────────────────────────────────────────
router.post("/:id/start", requirePermission("biomed.maintenance.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `UPDATE biomedical_work_orders SET status='en_cours', start_date=now(), updated_at=now()
         WHERE id=$1::uuid AND status='ouvert' RETURNING *`, [req.params.id]);
      if (!rows[0]) return void res.status(400).json({ error: "OT ne peut pas être démarré" });
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

router.post("/:id/close", requirePermission("biomed.maintenance.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { actual_hours, resolution_notes, labor_cost, parts_cost, next_maintenance_date } = req.body;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const { rows } = await client.query(
          `UPDATE biomedical_work_orders SET status='termine', end_date=now(),
            actual_hours=$1, resolution_notes=$2, labor_cost=$3, parts_cost=$4,
            closed_by=$5::uuid, closed_at=now(), updated_at=now()
           WHERE id=$6::uuid AND status IN ('ouvert','en_cours','en_attente_pieces') RETURNING *`,
          [actual_hours??null, resolution_notes??null, labor_cost??0, parts_cost??0,
           act.userId, req.params.id]);
        if (!rows[0]) { await client.query("ROLLBACK"); return void res.status(400).json({ error: "OT ne peut pas être fermé" }); }
        // Restore equipment to actif
        await client.query(
          `UPDATE biomedical_equipment SET status='actif', last_maintenance_date=CURRENT_DATE,
            next_maintenance_date=COALESCE($1, CASE WHEN maintenance_interval_days IS NOT NULL
              THEN CURRENT_DATE + maintenance_interval_days ELSE next_maintenance_date END),
            updated_at=now()
           WHERE id=$2::uuid`, [next_maintenance_date??null, rows[0].equipment_id]);
        await client.query("COMMIT");
        res.json(rows[0]);
      } catch (e) { await client.query("ROLLBACK"); throw e; }
      finally { client.release(); }
    } catch (err) { next(err); }
  }
);

// ── Update task ───────────────────────────────────────────────────────────
router.patch("/:id/tasks/:taskId", requirePermission("biomed.maintenance.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { is_completed } = req.body;
      const { rows } = await pool.query(
        `UPDATE biomedical_work_order_tasks SET is_completed=$1,
          completed_by=CASE WHEN $1 THEN $2::uuid ELSE NULL END,
          completed_at=CASE WHEN $1 THEN now() ELSE NULL END
         WHERE id=$3::uuid AND work_order_id=$4::uuid RETURNING *`,
        [!!is_completed, act.userId, req.params.taskId, req.params.id]);
      if (!rows[0]) return void res.status(404).json({ error: "Tâche non trouvée" });
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

export default router;
