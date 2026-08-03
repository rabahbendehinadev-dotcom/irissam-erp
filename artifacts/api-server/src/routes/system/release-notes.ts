import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";

const router = Router();

async function auditLog(userId: string, module: string, description: string, ip?: string) {
  try {
    await pool.query(
      "INSERT INTO user_activity_logs (user_id, user_name, user_role, action, module, description, ip) SELECT $1, u.first_name||' '||u.last_name, u.role, 'view'::user_activity_action, $2, $3, $4 FROM users u WHERE u.id=$1",
      [userId, module, description, ip ?? null]
    );
  } catch { /* non-blocking */ }
}

// GET /
router.get(
  "/",
  requireAuth,
  requirePermission("system.release_notes.view"),
  async (_req, res) => {
    try {
      const { rows } = await pool.query(
        "SELECT r.*, u.first_name||' '||u.last_name as published_by_name FROM system_release_notes r LEFT JOIN users u ON u.id=r.published_by ORDER BY r.created_at DESC LIMIT 20"
      );
      res.json({ notes: rows });
    } catch {
      res.status(500).json({ message: "Erreur lors de la récupération des notes de version." });
    }
  }
);

// POST /
router.post(
  "/",
  requireAuth,
  requirePermission("system.settings.manage"),
  async (req: AuthenticatedRequest, res) => {
    const { version, title, body, publishedAt, environment } = req.body ?? {};
    if (!version || !title || !body) {
      res.status(400).json({ message: "version, title et body requis." });
      return;
    }
    try {
      const { rows } = await pool.query(
        `INSERT INTO system_release_notes (version, title, body, environment, published_at, published_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          version,
          title,
          body,
          environment ?? null,
          publishedAt ? new Date(publishedAt) : new Date(),
          req.auth!.userId,
        ]
      );
      await auditLog(req.auth!.userId, "release-notes", `Note de version publiée: ${version}`, req.ip);
      res.status(201).json({ note: rows[0] });
    } catch {
      res.status(500).json({ message: "Erreur lors de la création de la note de version." });
    }
  }
);

export default router;
