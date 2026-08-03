import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { requireStepUp } from "../../middleware/requireStepUp.js";
import { invalidateMaintenanceCache } from "../../middleware/maintenanceGuard.js";

const router = Router();

async function auditLog(userId: string, module: string, description: string, ip?: string) {
  try {
    await pool.query(
      "INSERT INTO user_activity_logs (user_id, user_name, user_role, action, module, description, ip) SELECT $1, u.first_name||' '||u.last_name, u.role, 'view'::user_activity_action, $2, $3, $4 FROM users u WHERE u.id=$1",
      [userId, module, description, ip ?? null]
    );
  } catch { /* non-blocking */ }
}

const DEFAULT_MAINTENANCE = {
  enabled: false,
  message: "Maintenance en cours. Veuillez réessayer ultérieurement.",
  message_ar: "النظام في وضع الصيانة. يرجى المحاولة لاحقاً.",
  message_en: "System is under maintenance. Please try again later.",
  allowed_roles: ["super_admin"],
  allowed_ips: [],
};

// GET /
router.get(
  "/",
  requireAuth,
  requirePermission("system.maintenance.view"),
  async (_req, res) => {
    try {
      const { rows } = await pool.query("SELECT * FROM system_maintenance LIMIT 1");
      res.json({ maintenance: rows[0] ?? DEFAULT_MAINTENANCE });
    } catch {
      res.status(500).json({ message: "Erreur lors de la récupération du mode maintenance." });
    }
  }
);

// PATCH / — requireStepUp unconditionally (guarding enable action)
router.patch(
  "/",
  requireAuth,
  requirePermission("system.maintenance.manage"),
  requireStepUp,
  async (req: AuthenticatedRequest, res) => {
    const { enabled, message, message_ar, message_en, start_at, end_at, allowed_roles, allowed_ips } = req.body ?? {};
    try {
      // Get or create row
      let { rows } = await pool.query("SELECT id FROM system_maintenance LIMIT 1");
      if (!rows[0]) {
        const insert = await pool.query(
          `INSERT INTO system_maintenance (enabled, message, message_ar, message_en, allowed_roles, allowed_ips, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [
            DEFAULT_MAINTENANCE.enabled,
            DEFAULT_MAINTENANCE.message,
            DEFAULT_MAINTENANCE.message_ar,
            DEFAULT_MAINTENANCE.message_en,
            DEFAULT_MAINTENANCE.allowed_roles,
            DEFAULT_MAINTENANCE.allowed_ips,
            req.auth!.userId,
          ]
        );
        rows = insert.rows;
      }
      const existingId = rows[0].id;

      const updates: string[] = ["updated_by=$1", "updated_at=now()"];
      const params: any[] = [req.auth!.userId];

      if (enabled !== undefined) { params.push(enabled); updates.push(`enabled=$${params.length}`); }
      if (message !== undefined) { params.push(message); updates.push(`message=$${params.length}`); }
      if (message_ar !== undefined) { params.push(message_ar); updates.push(`message_ar=$${params.length}`); }
      if (message_en !== undefined) { params.push(message_en); updates.push(`message_en=$${params.length}`); }
      if (start_at !== undefined) { params.push(start_at); updates.push(`start_at=$${params.length}`); }
      if (end_at !== undefined) { params.push(end_at); updates.push(`end_at=$${params.length}`); }
      if (allowed_roles !== undefined) { params.push(allowed_roles); updates.push(`allowed_roles=$${params.length}`); }
      if (allowed_ips !== undefined) { params.push(allowed_ips); updates.push(`allowed_ips=$${params.length}`); }

      params.push(existingId);
      const { rows: updated } = await pool.query(
        `UPDATE system_maintenance SET ${updates.join(",")} WHERE id=$${params.length} RETURNING *`,
        params
      );

      // Invalidate cache
      invalidateMaintenanceCache();

      // Sync feature flag
      if (enabled !== undefined) {
        await pool.query(
          "UPDATE system_feature_flags SET enabled=$1 WHERE key='maintenance_mode'",
          [enabled]
        ).catch(() => {});
      }

      const label = enabled === true ? "activé" : enabled === false ? "désactivé" : "modifié";
      await auditLog(req.auth!.userId, "maintenance", `Mode maintenance ${label}`, req.ip);

      res.json({ maintenance: updated[0] });
    } catch {
      res.status(500).json({ message: "Erreur lors de la mise à jour du mode maintenance." });
    }
  }
);

export default router;
