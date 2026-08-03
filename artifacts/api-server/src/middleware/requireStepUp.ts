import type { Response, NextFunction } from "express";
import crypto from "node:crypto";
import { pool } from "@workspace/db";
import type { AuthenticatedRequest } from "./requireAuth.js";

/**
 * Step-up authentication middleware.
 * Expects an X-Step-Up-Token header containing a raw step-up token
 * previously issued by POST /api/system/step-up-auth.
 * The token is single-use (marked used on first consumption).
 */
export function requireStepUp(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const rawToken = req.headers["x-step-up-token"] as string | undefined;
  if (!rawToken) {
    res.status(403).json({
      code: "STEP_UP_REQUIRED",
      message: "Authentification renforcée requise pour cette opération.",
    });
    return;
  }

  const hash = crypto.createHash("sha256").update(rawToken).digest("hex");

  pool
    .query<{ id: string }>(
      `SELECT id FROM system_step_up_tokens
       WHERE token_hash = $1
         AND user_id    = $2
         AND expires_at > now()
         AND used_at   IS NULL`,
      [hash, req.auth!.userId],
    )
    .then(({ rows }) => {
      if (!rows.length) {
        res.status(403).json({
          code: "STEP_UP_EXPIRED",
          message: "Token d'authentification renforcée invalide ou expiré.",
        });
        return;
      }
      // Mark token as used (single-use)
      pool
        .query("UPDATE system_step_up_tokens SET used_at = now() WHERE id = $1", [rows[0].id])
        .catch(() => {});
      next();
    })
    .catch(() => {
      res.status(500).json({ message: "Erreur de validation step-up." });
    });
}
