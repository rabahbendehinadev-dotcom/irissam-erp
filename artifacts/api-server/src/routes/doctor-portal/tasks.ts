/**
 * Doctor Portal — Clinical Tasks
 * GET  /tasks      — list (assigned to me)
 * POST /tasks      — create
 * PATCH /tasks/:id — update status
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission.js";
import type { AuthenticatedRequest } from "../../middleware/requireAuth.js";

const router = Router();

router.get("/", requirePermission("doctor_portal.tasks.manage"), async (req, res) => {
  const doctorId = (req as AuthenticatedRequest).auth!.userId;
  const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
  const params: unknown[] = [doctorId];
  const conds = ["ct.assigned_to=$1"];
  if (status) { params.push(status); conds.push(`ct.status=$${params.length}`); }
  params.push(Number(limit), (Number(page)-1)*Number(limit));
  try {
    // Auto-mark overdue tasks
    await pool.query(
      `UPDATE clinical_tasks SET status='overdue', updated_at=now()
       WHERE assigned_to=$1 AND status IN ('open','in_progress') AND due_at < now()`,
      [doctorId]
    );
    const result = await pool.query(
      `SELECT ct.*, p.first_name||' '||p.last_name AS patient_name, p.mrn
       FROM clinical_tasks ct JOIN patients p ON p.id=ct.patient_id
       WHERE ${conds.join(" AND ")}
       ORDER BY CASE ct.priority
         WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4
       END, ct.due_at ASC NULLS LAST
       LIMIT $${params.length-1} OFFSET $${params.length}`,
      params
    );
    res.json({ tasks: result.rows });
  } catch (err) {
    console.error("[dp/tasks GET]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.post("/", requirePermission("doctor_portal.tasks.manage"), async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth!;
  const { patientId, encounterId, type, title, notes, dueAt, priority, assignedTo } = req.body as Record<string, string>;
  if (!patientId || !title) { res.status(400).json({ message: "patientId et title requis" }); return; }
  try {
    const result = await pool.query(
      `INSERT INTO clinical_tasks
         (patient_id, encounter_id, created_by, assigned_to, type, title, notes, due_at, priority)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [patientId, encounterId ?? null, auth.userId, assignedTo ?? auth.userId,
       type ?? "general", title, notes ?? null, dueAt ?? null, priority ?? "medium"]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("[dp/tasks POST]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.patch("/:id", requirePermission("doctor_portal.tasks.manage"), async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth!;
  const { status, notes } = req.body as Record<string, string>;
  const allowed = ["open","in_progress","completed","cancelled"];
  if (status && !allowed.includes(status)) { res.status(400).json({ message: "Statut invalide" }); return; }
  try {
    const result = await pool.query(
      `UPDATE clinical_tasks SET
         status=COALESCE($1, status),
         notes=COALESCE($2, notes),
         updated_at=now()
       WHERE id=$3 AND assigned_to=$4 RETURNING *`,
      [status ?? null, notes ?? null, req.params.id, auth.userId]
    );
    if (!result.rowCount) { res.status(404).json({ message: "Tâche introuvable" }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

export default router;
