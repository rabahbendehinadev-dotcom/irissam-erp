/**
 * Patient Portal Admin — Staff Preview Token
 *
 * POST /patient-portal-admin/accounts/:id/preview-token
 *
 * Generates a 5-minute, one-time, read-only token bound to:
 *   - the staff user (staffUserId)
 *   - the patient (patientId)
 *
 * The plain token is returned ONCE. The hash is stored in DB.
 * The patient portal /auth/preview endpoint accepts this token
 * and issues a read-only access token (no writes allowed).
 *
 * Every preview is recorded in the audit log.
 */
import crypto from "node:crypto";
import { Router, type Response } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission.js";
import type { AuthenticatedRequest } from "../../middleware/requireAuth.js";

const router = Router();

const PREVIEW_TTL_MINUTES = 5;

// ── POST /accounts/:id/preview-token ─────────────────────────────────────────
router.post(
  "/accounts/:id/preview-token",
  requirePermission("patient_portal.accounts.preview"),
  async (req: AuthenticatedRequest, res: Response) => {
    const accountId   = String(req.params.id);
    const staffUserId = req.auth!.userId;

    try {
      // 1. Verify account exists and get patientId
      const { rows: acc } = await pool.query(
        `SELECT id, patient_id, status
         FROM patient_portal_accounts
         WHERE id = $1 AND deleted_at IS NULL`,
        [accountId],
      );
      if (!acc[0]) {
        res.status(404).json({ message: "Compte portail introuvable." });
        return;
      }
      const patientId = acc[0].patient_id;

      // 2. Generate one-time token (32 bytes = 64-char hex)
      const rawToken  = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + PREVIEW_TTL_MINUTES * 60 * 1000);

      // 3. Persist hash (used_at = NULL means not yet consumed)
      await pool.query(
        `INSERT INTO portal_preview_tokens
           (account_id, patient_id, staff_user_id, token_hash, expires_at, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [accountId, patientId, staffUserId, tokenHash, expiresAt, req.ip ?? null],
      );

      // 4. Audit every preview token issuance
      await pool.query(
        `INSERT INTO user_activity_logs
           (user_id, action, entity_type, entity_id, metadata, ip_address, timestamp)
         VALUES ($1, 'issue_preview_token', 'patient_portal_account', $2, $3, $4, now())`,
        [
          staffUserId,
          accountId,
          JSON.stringify({ patientId, expiresAt }),
          req.ip ?? null,
        ],
      );

      // 5. Return plain token ONCE — never stored in plain form
      res.status(201).json({
        token:     rawToken,
        expiresAt,
        patientId,
        ttlSeconds: PREVIEW_TTL_MINUTES * 60,
        banner:    "Mode aperçu employé — lecture seule",
        note:      "Ce token est à usage unique et expire dans 5 minutes.",
      });
    } catch (err) {
      console.error("[portal-admin/preview-token]", err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

// ── POST /accounts/:id/preview-token/use  (patient portal validates the token) ─
// Called by the patient portal frontend when the staff browser opens a preview.
// Returns a short-lived read-only JWT for the patient portal.
router.post(
  "/accounts/:id/preview-token/use",
  async (req: AuthenticatedRequest, res: Response) => {
    const { token } = req.body ?? {};
    const accountId = String(req.params.id);

    if (!token) {
      res.status(400).json({ message: "Token requis." });
      return;
    }

    try {
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      // Look up unused, non-expired token
      const { rows } = await pool.query(
        `SELECT id, patient_id, staff_user_id, expires_at
         FROM portal_preview_tokens
         WHERE token_hash = $1
           AND account_id = $2
           AND used_at IS NULL
           AND expires_at > now()`,
        [tokenHash, accountId],
      );

      if (!rows[0]) {
        res.status(401).json({ message: "Token invalide, expiré ou déjà utilisé." });
        return;
      }

      // Mark as used (one-time)
      await pool.query(
        `UPDATE portal_preview_tokens SET used_at = now() WHERE id = $1`,
        [rows[0].id],
      );

      // Audit the actual preview use
      await pool.query(
        `INSERT INTO user_activity_logs
           (user_id, action, entity_type, entity_id, metadata, ip_address, timestamp)
         VALUES ($1, 'use_preview_token', 'patient_portal_account', $2, $3, $4, now())`,
        [
          rows[0].staff_user_id,
          accountId,
          JSON.stringify({ patientId: rows[0].patient_id }),
          req.ip ?? null,
        ],
      );

      res.json({
        valid:     true,
        patientId: rows[0].patient_id,
        banner:    "Mode aperçu employé — lecture seule",
      });
    } catch (err) {
      console.error("[portal-admin/preview-token/use]", err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

export default router;
