import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { pool } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/requireAuth.js";

const router = Router();

/**
 * POST /api/system/step-up-auth
 * Re-verifies the current user's password and issues a short-lived step-up token.
 * The token must be sent as the X-Step-Up-Token header on protected operations.
 * Valid for 15 minutes, single-use.
 */
router.post("/step-up-auth", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { password } = req.body ?? {};
  if (!password || typeof password !== "string") {
    res.status(400).json({ message: "Mot de passe requis." });
    return;
  }

  try {
    const { rows } = await pool.query<{ hashed_password: string }>(
      "SELECT hashed_password FROM users WHERE id = $1 AND account_status = 'active' LIMIT 1",
      [req.auth!.userId],
    );

    if (!rows[0]) {
      res.status(401).json({ message: "Utilisateur introuvable ou compte inactif." });
      return;
    }

    const valid = await bcrypt.compare(password, rows[0].hashed_password);
    if (!valid) {
      res.status(401).json({ message: "Mot de passe incorrect." });
      return;
    }

    const raw      = "su_" + crypto.randomBytes(32).toString("hex");
    const hash     = crypto.createHash("sha256").update(raw).digest("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await pool.query(
      `INSERT INTO system_step_up_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [req.auth!.userId, hash, expiresAt],
    );

    // Log audit
    try {
      await pool.query(
        `INSERT INTO user_activity_logs (user_id, user_name, user_role, action, module, description, ip)
         SELECT $1, u.first_name||' '||u.last_name, u.role, 'view'::user_activity_action,
                'system', 'Step-up authentication réussie', $2
         FROM users u WHERE u.id = $1`,
        [req.auth!.userId, req.ip ?? null],
      );
    } catch { /* non-blocking */ }

    res.json({ token: raw, expiresAt, expiresInSeconds: 900 });
  } catch {
    res.status(500).json({ message: "Erreur serveur." });
  }
});

export default router;
