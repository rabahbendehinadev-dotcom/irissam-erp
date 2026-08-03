import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";

const router = Router();

// ── GET / ─────────────────────────────────────────────────────────────────────
router.get("/", requireAuth, requirePermission("system.jobs.view"), async (req, res) => {
  const { status, type, date_from, date_to } = req.query as Record<string, string>;
  const params: unknown[] = [];
  const where: string[] = [];

  if (status) { params.push(status); where.push(`j.status = $${params.length}::system_job_status`); }
  if (type)   { params.push(type);   where.push(`j.type   = $${params.length}::system_job_type`);   }
  if (date_from) { params.push(date_from); where.push(`j.created_at >= $${params.length}`); }
  if (date_to)   { params.push(date_to);   where.push(`j.created_at <= $${params.length}`); }

  const sql = `
    SELECT j.*, u.first_name||' '||u.last_name AS creator_name
    FROM system_jobs j
    LEFT JOIN users u ON u.id = j.created_by
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY j.created_at DESC LIMIT 100`;

  try {
    const { rows } = await pool.query(sql, params);
    res.json({ jobs: rows });
  } catch {
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// ── GET /:id ──────────────────────────────────────────────────────────────────
router.get("/:id", requireAuth, requirePermission("system.jobs.view"), async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT j.*, u.first_name||' '||u.last_name AS creator_name FROM system_jobs j LEFT JOIN users u ON u.id=j.created_by WHERE j.id=$1",
      [req.params.id],
    );
    if (!rows[0]) { res.status(404).json({ message: "Job introuvable." }); return; }
    res.json({ job: rows[0] });
  } catch {
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// ── POST /:id/retry ────────────────────────────────────────────────────────────
router.post("/:id/retry", requireAuth, requirePermission("system.jobs.retry"), async (req: AuthenticatedRequest, res) => {
  try {
    const { rows: existing } = await pool.query("SELECT status FROM system_jobs WHERE id=$1", [req.params.id]);
    if (!existing[0]) { res.status(404).json({ message: "Job introuvable." }); return; }
    if (!["failed","cancelled"].includes(existing[0].status)) {
      res.status(400).json({ message: `Impossible de relancer un job avec le statut "${existing[0].status}".` });
      return;
    }
    const { rows } = await pool.query(
      `UPDATE system_jobs SET status='pending', attempts=0, error_message=null, failed_at=null, updated_at=now()
       WHERE id=$1 RETURNING *`,
      [req.params.id],
    );
    res.json({ job: rows[0] });
  } catch {
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// ── POST /:id/cancel ───────────────────────────────────────────────────────────
router.post("/:id/cancel", requireAuth, requirePermission("system.jobs.cancel"), async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "UPDATE system_jobs SET status='cancelled', updated_at=now() WHERE id=$1 RETURNING *",
      [_req.params.id],
    );
    if (!rows[0]) { res.status(404).json({ message: "Job introuvable." }); return; }
    res.json({ job: rows[0] });
  } catch {
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// ── POST /queue/pause ─────────────────────────────────────────────────────────
router.post("/queue/pause", requireAuth, requirePermission("system.jobs.cancel"), (_req, res) => {
  res.json({ paused: true, message: "Queue mise en pause. (Moteur de queue persistant à implémenter.)" });
});

// ── POST /queue/resume ────────────────────────────────────────────────────────
router.post("/queue/resume", requireAuth, requirePermission("system.jobs.cancel"), (_req, res) => {
  res.json({ resumed: true, message: "Queue reprise." });
});

export default router;
