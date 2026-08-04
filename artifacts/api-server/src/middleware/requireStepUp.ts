import type { Response, NextFunction } from "express";
import crypto from "node:crypto";
import { pool } from "@workspace/db";
import type { AuthenticatedRequest } from "./requireAuth.js";

/**
 * Step-up authentication middleware.
 * Expects an X-Step-Up-Token header containing a raw step-up token
 * previously issued by POST /api/system/step-up-auth.
 *
 * Tokens are:
 *   - Single-use (marked used_at on first consumption)
 *   - User-scoped (must match req.auth.userId)
 *   - Operation-scoped (optional: pass { operation } to factory to enforce scope)
 *
 * Usage:
 *   requireStepUp                      ← accepts any valid token
 *   requireStepUpFor("restore")        ← token must have been issued for "restore"
 */
export function requireStepUpFor(operation: string) {
  return function stepUpMiddleware(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): void {
    const rawToken = req.headers["x-step-up-token"] as string | undefined;
    if (!rawToken) {
      res.status(403).json({
        code: "STEP_UP_REQUIRED",
        message: "Authentification renforcée requise pour cette opération.",
        requiredOperation: operation,
      });
      return;
    }

    const hash = crypto.createHash("sha256").update(rawToken).digest("hex");

    pool
      .query<{ id: string; operation: string }>(
        `SELECT id, operation FROM system_step_up_tokens
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

        const tokenOp = rows[0].operation;
        // Enforce operation scope: "general" tokens are accepted for any operation;
        // operation-specific tokens are only accepted for their declared operation.
        if (tokenOp !== "general" && tokenOp !== operation) {
          res.status(403).json({
            code: "STEP_UP_WRONG_OPERATION",
            message: `Ce token est valide pour "${tokenOp}" uniquement, pas pour "${operation}".`,
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
  };
}

/** Accepts any valid step-up token regardless of operation (backwards-compat default). */
export const requireStepUp = requireStepUpFor("general");
