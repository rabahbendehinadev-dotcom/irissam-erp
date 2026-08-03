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

// GET / — list feature flags
router.get(
  "/",
  requireAuth,
  requirePermission("system.feature_flags.view"),
  async (_req, res) => {
    try {
      const { rows } = await pool.query(
        "SELECT f.*, u.first_name||' '||u.last_name as updated_by_name FROM system_feature_flags f LEFT JOIN users u ON u.id=f.updated_by ORDER BY f.key"
      );
      res.json({ flags: rows });
    } catch {
      res.status(500).json({ message: "Erreur lors de la récupération des feature flags." });
    }
  }
);

// POST / — create feature flag
router.post(
  "/",
  requireAuth,
  requirePermission("system.feature_flags.manage"),
  async (req: AuthenticatedRequest, res) => {
    const { key, name, description, enabled = false, environment, siteId, rolloutPercentage, allowedRoles } = req.body ?? {};
    if (!key || !name) {
      res.status(400).json({ message: "key et name requis." });
      return;
    }
    try {
      const { rows } = await pool.query(
        `INSERT INTO system_feature_flags (key, name, description, enabled, environment, site_id, rollout_percentage, allowed_roles, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          key,
          name,
          description ?? null,
          enabled,
          environment ?? null,
          siteId ?? null,
          rolloutPercentage ?? 100,
          allowedRoles ?? null,
          req.auth!.userId,
        ]
      );
      await auditLog(req.auth!.userId, "feature-flags", `Feature flag créé: ${key}`, req.ip);
      res.status(201).json({ flag: rows[0] });
    } catch (err: any) {
      if (err?.code === "23505") {
        res.status(409).json({ message: "Un flag avec cette clé existe déjà." });
        return;
      }
      res.status(500).json({ message: "Erreur lors de la création du feature flag." });
    }
  }
);

// PATCH /:id — update feature flag
router.patch(
  "/:id",
  requireAuth,
  requirePermission("system.feature_flags.manage"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { rows: existing } = await pool.query(
        "SELECT id, key, enabled FROM system_feature_flags WHERE id=$1",
        [req.params.id]
      );
      if (!existing[0]) {
        res.status(404).json({ message: "Feature flag introuvable." });
        return;
      }
      const old = existing[0];

      const { enabled, name, description, environment, siteId, rolloutPercentage, allowedRoles } = req.body ?? {};

      const updates: string[] = ["updated_by=$1", "updated_at=now()"];
      const params: any[] = [req.auth!.userId];

      if (enabled !== undefined) { params.push(enabled); updates.push(`enabled=$${params.length}`); }
      if (name !== undefined) { params.push(name); updates.push(`name=$${params.length}`); }
      if (description !== undefined) { params.push(description); updates.push(`description=$${params.length}`); }
      if (environment !== undefined) { params.push(environment); updates.push(`environment=$${params.length}`); }
      if (siteId !== undefined) { params.push(siteId); updates.push(`site_id=$${params.length}`); }
      if (rolloutPercentage !== undefined) { params.push(rolloutPercentage); updates.push(`rollout_percentage=$${params.length}`); }
      if (allowedRoles !== undefined) { params.push(allowedRoles); updates.push(`allowed_roles=$${params.length}`); }

      params.push(req.params.id);
      const { rows } = await pool.query(
        `UPDATE system_feature_flags SET ${updates.join(",")} WHERE id=$${params.length} RETURNING *`,
        params
      );

      if (enabled !== undefined && enabled !== old.enabled) {
        await auditLog(
          req.auth!.userId,
          "feature-flags",
          `Flag ${old.key} changed enabled: ${old.enabled}→${enabled}`,
          req.ip
        );
      } else {
        await auditLog(req.auth!.userId, "feature-flags", `Feature flag modifié: ${old.key}`, req.ip);
      }

      res.json({ flag: rows[0] });
    } catch {
      res.status(500).json({ message: "Erreur lors de la mise à jour du feature flag." });
    }
  }
);

export default router;
