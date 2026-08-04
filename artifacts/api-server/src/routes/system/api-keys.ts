import { Router } from "express";
import crypto from "node:crypto";
import { pool } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { requireStepUp, requireStepUpFor } from "../../middleware/requireStepUp.js";

const router = Router();

async function auditLog(userId: string, module: string, description: string, ip?: string) {
  try {
    await pool.query(
      "INSERT INTO user_activity_logs (user_id, user_name, user_role, action, module, description, ip) SELECT $1, u.first_name||' '||u.last_name, u.role, 'view'::user_activity_action, $2, $3, $4 FROM users u WHERE u.id=$1",
      [userId, module, description, ip ?? null]
    );
  } catch { /* non-blocking */ }
}

// GET / — list API keys (never return hashed_key)
router.get(
  "/",
  requireAuth,
  requirePermission("system.api_keys.view"),
  async (_req, res) => {
    try {
      const { rows } = await pool.query(
        "SELECT id, name, key_prefix, scopes, site_id, expires_at, last_used_at, created_by, revoked_at, status, created_at FROM system_api_keys ORDER BY created_at DESC"
      );
      res.json({ apiKeys: rows });
    } catch {
      res.status(500).json({ message: "Erreur lors de la récupération des clés API." });
    }
  }
);

// POST / — create API key
router.post(
  "/",
  requireAuth,
  requirePermission("system.api_keys.create"),
  requireStepUpFor("create_api_key"),
  async (req: AuthenticatedRequest, res) => {
    const { name, scopes = [], siteId, expiresAt } = req.body ?? {};
    if (!name || typeof name !== "string") {
      res.status(400).json({ message: "Nom requis." });
      return;
    }
    try {
      const raw = "irk_" + crypto.randomBytes(32).toString("hex");
      const prefix = raw.substring(0, 12);
      const hash = crypto.createHash("sha256").update(raw).digest("hex");

      const { rows } = await pool.query(
        `INSERT INTO system_api_keys (name, key_prefix, hashed_key, scopes, site_id, expires_at, created_by, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
         RETURNING id, name, key_prefix, scopes, site_id, expires_at, created_by, status, created_at`,
        [name, prefix, hash, scopes, siteId ?? null, expiresAt ?? null, req.auth!.userId]
      );

      await auditLog(req.auth!.userId, "api-keys", `Clé API créée: ${name}`, req.ip);

      res.status(201).json({
        key: raw,
        record: rows[0],
      });
    } catch (err: any) {
      if (err?.code === "23505") {
        res.status(409).json({ message: "Une clé avec ce préfixe existe déjà." });
        return;
      }
      res.status(500).json({ message: "Erreur lors de la création de la clé API." });
    }
  }
);

// POST /:id/revoke
router.post(
  "/:id/revoke",
  requireAuth,
  requirePermission("system.api_keys.revoke"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { rows } = await pool.query(
        "UPDATE system_api_keys SET revoked_at=now(), status='revoked' WHERE id=$1 RETURNING id",
        [req.params.id]
      );
      if (!rows[0]) {
        res.status(404).json({ message: "Clé API introuvable." });
        return;
      }
      await auditLog(req.auth!.userId, "api-keys", `Clé API révoquée: ${req.params.id}`, req.ip);
      res.json({ revoked: true });
    } catch {
      res.status(500).json({ message: "Erreur lors de la révocation de la clé API." });
    }
  }
);

export default router;
