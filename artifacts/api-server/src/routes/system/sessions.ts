import { Router } from "express";
import crypto from "node:crypto";
import { pool } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { requireStepUp } from "../../middleware/requireStepUp.js";

const router = Router();

async function auditLog(userId: string, module: string, description: string, ip?: string) {
  try {
    await pool.query(
      "INSERT INTO user_activity_logs (user_id, user_name, user_role, action, module, description, ip) SELECT $1, u.first_name||' '||u.last_name, u.role, 'view'::user_activity_action, $2, $3, $4 FROM users u WHERE u.id=$1",
      [userId, module, description, ip ?? null]
    );
  } catch { /* non-blocking */ }
}

// GET / — active sessions
router.get(
  "/",
  requireAuth,
  requirePermission("system.sessions.view"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const rawToken = req.headers.authorization?.split(" ")[1] ?? "";
      const currentHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      const { rows } = await pool.query(
        `SELECT s.id, s.user_id, u.first_name||' '||u.last_name as user_name, u.email as user_email, u.role as user_role,
                s.ip, s.user_agent, s.created_at, s.expires_at, s.revoked_at, s.token_hash
         FROM user_sessions s
         LEFT JOIN users u ON u.id=s.user_id
         WHERE s.expires_at > now() AND s.revoked_at IS NULL
         ORDER BY s.created_at DESC LIMIT 100`
      );

      const sessions = rows.map((s) => {
        const { token_hash, ...rest } = s;
        return { ...rest, isCurrentSession: token_hash === currentHash };
      });

      res.json({ sessions });
    } catch {
      res.status(500).json({ message: "Erreur lors de la récupération des sessions." });
    }
  }
);

// POST /:id/revoke
router.post(
  "/:id/revoke",
  requireAuth,
  requirePermission("system.sessions.revoke"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { rows } = await pool.query(
        "UPDATE user_sessions SET revoked_at=now() WHERE id=$1 RETURNING id",
        [req.params.id]
      );
      if (!rows[0]) {
        res.status(404).json({ message: "Session introuvable." });
        return;
      }
      await auditLog(req.auth!.userId, "sessions", `Session révoquée: ${req.params.id}`, req.ip);
      res.json({ revoked: true });
    } catch {
      res.status(500).json({ message: "Erreur lors de la révocation de la session." });
    }
  }
);

// POST /revoke-all-for-user
router.post(
  "/revoke-all-for-user",
  requireAuth,
  requirePermission("system.sessions.revoke"),
  requireStepUp,
  async (req: AuthenticatedRequest, res) => {
    const { userId } = req.body ?? {};
    if (!userId) {
      res.status(400).json({ message: "userId requis." });
      return;
    }
    try {
      const rawToken = req.headers.authorization?.split(" ")[1] ?? "";
      const currentHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      const result = await pool.query(
        "UPDATE user_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL AND token_hash != $2",
        [userId, currentHash]
      );
      await auditLog(
        req.auth!.userId,
        "sessions",
        `Toutes les sessions révoquées pour l'utilisateur: ${userId}`,
        req.ip
      );
      res.json({ revoked: result.rowCount ?? 0 });
    } catch {
      res.status(500).json({ message: "Erreur lors de la révocation des sessions." });
    }
  }
);

// POST /block-account
router.post(
  "/block-account",
  requireAuth,
  requirePermission("system.security.manage"),
  requireStepUp,
  async (req: AuthenticatedRequest, res) => {
    const { userId } = req.body ?? {};
    if (!userId) {
      res.status(400).json({ message: "userId requis." });
      return;
    }
    try {
      await pool.query(
        "UPDATE users SET account_status='suspended' WHERE id=$1",
        [userId]
      );
      await auditLog(req.auth!.userId, "sessions", `Compte suspendu: ${userId}`, req.ip);
      res.json({ blocked: true });
    } catch {
      res.status(500).json({ message: "Erreur lors de la suspension du compte." });
    }
  }
);

// POST /require-password-reset
router.post(
  "/require-password-reset",
  requireAuth,
  requirePermission("system.security.manage"),
  async (req: AuthenticatedRequest, res) => {
    const { userId } = req.body ?? {};
    if (!userId) {
      res.status(400).json({ message: "userId requis." });
      return;
    }
    try {
      await pool.query(
        "UPDATE users SET force_password_change=true WHERE id=$1",
        [userId]
      );
      await auditLog(
        req.auth!.userId,
        "sessions",
        `Réinitialisation du mot de passe requise pour: ${userId}`,
        req.ip
      );
      res.json({ required: true });
    } catch {
      res.status(500).json({ message: "Erreur lors de la mise à jour." });
    }
  }
);

export default router;
