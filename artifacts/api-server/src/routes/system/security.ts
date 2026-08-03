import { Router } from "express";
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

// GET / — security overview
router.get(
  "/",
  requireAuth,
  requirePermission("system.security.view"),
  async (_req, res) => {
    try {
      const [
        failedLoginsRes,
        lockedAccountsRes,
        suspiciousIpsRes,
        permDeniedRes,
        recentEventsRes,
      ] = await Promise.all([
        pool.query(
          "SELECT count(*)::int as count FROM user_activity_logs WHERE description ILIKE '%échoué%' AND timestamp > now()-interval '24 hours'"
        ),
        pool.query(
          "SELECT id, first_name, last_name, email, locked_until, account_status FROM users WHERE locked_until > now() OR account_status='suspended' ORDER BY locked_until DESC NULLS LAST LIMIT 50"
        ),
        pool.query(
          "SELECT ip, count(*)::int as attempts FROM user_activity_logs WHERE (description ILIKE '%denied%' OR description ILIKE '%échoué%' OR action='access_denied') AND timestamp > now()-interval '1 hour' AND ip IS NOT NULL GROUP BY ip HAVING count(*) > 3 ORDER BY attempts DESC LIMIT 20"
        ),
        pool.query(
          "SELECT count(*)::int as count FROM user_activity_logs WHERE action='access_denied' AND timestamp > now()-interval '24 hours'"
        ),
        pool.query(
          "SELECT l.*, u.first_name||' '||u.last_name as user_display FROM user_activity_logs l LEFT JOIN users u ON u.id=l.user_id WHERE l.action IN ('access_denied') OR l.description ILIKE '%échoué%' OR l.description ILIKE '%verrouillé%' ORDER BY l.timestamp DESC LIMIT 50"
        ),
      ]);

      res.json({
        failed_logins_24h: failedLoginsRes.rows[0]?.count ?? 0,
        locked_accounts: lockedAccountsRes.rows,
        suspicious_ips: suspiciousIpsRes.rows,
        permission_denied_24h: permDeniedRes.rows[0]?.count ?? 0,
        recent_events: recentEventsRes.rows,
        checkedAt: new Date().toISOString(),
      });
    } catch {
      res.status(500).json({ message: "Erreur lors de la récupération de l'aperçu sécurité." });
    }
  }
);

// POST /unlock-account
router.post(
  "/unlock-account",
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
        "UPDATE users SET locked_until=null, failed_login_attempts=0, account_status=CASE WHEN account_status='suspended' THEN 'active' ELSE account_status END WHERE id=$1",
        [userId]
      );
      await auditLog(req.auth!.userId, "security", `Compte déverrouillé: ${userId}`, req.ip);
      res.json({ unlocked: true });
    } catch {
      res.status(500).json({ message: "Erreur lors du déverrouillage du compte." });
    }
  }
);

// POST /suspend-account
router.post(
  "/suspend-account",
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
      await auditLog(req.auth!.userId, "security", `Compte suspendu: ${userId}`, req.ip);
      res.json({ suspended: true });
    } catch {
      res.status(500).json({ message: "Erreur lors de la suspension du compte." });
    }
  }
);

// POST /block-ip
router.post(
  "/block-ip",
  requireAuth,
  requirePermission("system.security.manage"),
  async (req: AuthenticatedRequest, res) => {
    const { ip, reason } = req.body ?? {};
    if (!ip) {
      res.status(400).json({ message: "ip requise." });
      return;
    }
    try {
      await pool.query(
        "UPDATE system_settings SET blocked_ips=array_append(blocked_ips,$1) WHERE NOT ($1=ANY(COALESCE(blocked_ips,'{}')))",
        [ip]
      );
      await pool.query(
        "INSERT INTO system_logs (level, module, message, context) VALUES ('warn', 'security', $1, $2)",
        [`IP bloquée: ${ip}`, JSON.stringify({ ip, reason: reason ?? null, blockedBy: req.auth!.userId })]
      ).catch(() => {});
      await auditLog(req.auth!.userId, "security", `IP bloquée: ${ip} - ${reason ?? ""}`, req.ip);
      res.json({ blocked: true });
    } catch {
      res.status(500).json({ message: "Erreur lors du blocage de l'IP." });
    }
  }
);

// POST /add-allowlist-ip
router.post(
  "/add-allowlist-ip",
  requireAuth,
  requirePermission("system.security.manage"),
  async (req: AuthenticatedRequest, res) => {
    const { ip } = req.body ?? {};
    if (!ip) {
      res.status(400).json({ message: "ip requise." });
      return;
    }
    try {
      await pool.query(
        "UPDATE system_settings SET allowlisted_ips=array_append(allowlisted_ips,$1) WHERE NOT ($1=ANY(COALESCE(allowlisted_ips,'{}')))",
        [ip]
      );
      await auditLog(req.auth!.userId, "security", `IP ajoutée à la liste blanche: ${ip}`, req.ip);
      res.json({ added: true });
    } catch {
      res.status(500).json({ message: "Erreur lors de l'ajout à la liste blanche." });
    }
  }
);

// POST /require-password-change
router.post(
  "/require-password-change",
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
        "security",
        `Changement de mot de passe requis pour: ${userId}`,
        req.ip
      );
      res.json({ required: true });
    } catch {
      res.status(500).json({ message: "Erreur lors de la mise à jour." });
    }
  }
);

export default router;
