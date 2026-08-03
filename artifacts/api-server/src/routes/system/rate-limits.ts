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
  requirePermission("system.settings.view"),
  async (_req, res) => {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM system_rate_limit_policies ORDER BY name"
      );
      res.json({ policies: rows });
    } catch {
      res.status(500).json({ message: "Erreur lors de la récupération des politiques de rate limiting." });
    }
  }
);

// PATCH /:id
router.patch(
  "/:id",
  requireAuth,
  requirePermission("system.settings.manage"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { rows: existing } = await pool.query(
        "SELECT id, name, is_login_policy, enabled FROM system_rate_limit_policies WHERE id=$1",
        [req.params.id]
      );
      if (!existing[0]) {
        res.status(404).json({ message: "Politique introuvable." });
        return;
      }
      const policy = existing[0];

      // Guard: cannot disable login policy in production
      if (
        policy.is_login_policy === true &&
        req.body?.enabled === false &&
        process.env.NODE_ENV === "production"
      ) {
        res.status(403).json({
          message: "Impossible de désactiver la politique de rate limiting pour la connexion en production.",
        });
        return;
      }

      const allowed = [
        "name", "endpoint_pattern", "limit_count", "window_seconds",
        "role_overrides", "enabled", "action_on_exceeded", "alert_threshold",
      ];

      const updates: string[] = ["updated_by=$1", "updated_at=now()"];
      const params: any[] = [req.auth!.userId];

      for (const field of allowed) {
        if (field in req.body) {
          params.push(req.body[field]);
          const isJson = field === "role_overrides";
          updates.push(`${field}=$${params.length}${isJson ? "::jsonb" : ""}`);
        }
      }

      if (updates.length === 2) {
        res.status(400).json({ message: "Aucun champ valide à mettre à jour." });
        return;
      }

      params.push(req.params.id);
      const { rows } = await pool.query(
        `UPDATE system_rate_limit_policies SET ${updates.join(",")} WHERE id=$${params.length} RETURNING *`,
        params
      );

      await auditLog(
        req.auth!.userId,
        "rate-limits",
        `Politique de rate limiting mise à jour: ${policy.name}`,
        req.ip
      );
      res.json({ policy: rows[0] });
    } catch {
      res.status(500).json({ message: "Erreur lors de la mise à jour de la politique." });
    }
  }
);

export default router;
