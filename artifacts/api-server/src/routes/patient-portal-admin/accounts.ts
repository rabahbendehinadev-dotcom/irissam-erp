/**
 * Patient Portal Admin — Account Management routes (staff-only).
 *
 * GET  /patient-portal-admin/accounts/stats
 * GET  /patient-portal-admin/accounts
 * POST /patient-portal-admin/accounts               — create
 * GET  /patient-portal-admin/accounts/:id
 * POST /patient-portal-admin/accounts/:id/generate-otp
 * POST /patient-portal-admin/accounts/:id/suspend
 * POST /patient-portal-admin/accounts/:id/reactivate
 * POST /patient-portal-admin/accounts/:id/unlock
 * POST /patient-portal-admin/accounts/:id/revoke-sessions
 * POST /patient-portal-admin/accounts/:id/force-password-change
 * GET  /patient-portal-admin/accounts/:id/audit
 *
 * Patient Detail integration:
 * GET  /patient-portal-admin/by-patient/:patientId
 */
import { Router, type Response } from "express";
import crypto from "node:crypto";
import { hmacOtp } from "../../lib/otpUtils.js";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission.js";
import type { AuthenticatedRequest } from "../../middleware/requireAuth.js";

const router = Router();

const OTP_EXPIRY_MINUTES = 30;

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// The patient portal's activate endpoint compares OTP as plain text.
// Store plain OTP — activation is short-lived (30 min) and single-use.
// hashToken is available if needed for activation tokens (longer-lived).
function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function auditAction(
  req: AuthenticatedRequest,
  action: string,
  entityType: string,
  entityId: string,
  meta?: Record<string, unknown>,
) {
  // Écrit dans audit_logs (les colonnes entity_type/entity_id/ip_address n'existent
  // pas dans user_activity_logs et son enum action ne couvre pas ces actions —
  // l'ancien INSERT échouait silencieusement).
  try {
    const userName = [req.auth?.firstName, req.auth?.lastName].filter(Boolean).join(" ").trim()
      || req.auth?.userId || "system";
    await pool.query(
      `INSERT INTO audit_logs (module, action, user_id, user_name, user_role, patient_id, resource_type, resource_id, new_value, severity, ip)
       VALUES ('system',$1,$2,$3,$4,$5,$6,$7,$8,'info',$9)`,
      [
        action,
        req.auth?.userId ?? null,
        userName,
        req.auth?.role ?? "unknown",
        (meta?.patientId as string | undefined) ?? null,
        entityType,
        entityId,
        meta ? JSON.stringify(meta) : null,
        req.ip ?? null,
      ],
    );
  } catch (err) { console.error("[portal-admin/accounts/audit]", err); }
}

// ── GET /accounts/stats ───────────────────────────────────────────────────────
router.get(
  "/stats",
  requirePermission("patient_portal.accounts.view"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status='active')                         AS active,
          COUNT(*) FILTER (WHERE status='pending_activation')             AS pending,
          COUNT(*) FILTER (WHERE status='suspended')                      AS suspended,
          COUNT(*) FILTER (WHERE locked_until > now())                    AS locked,
          COUNT(*)                                                          AS total,
          COUNT(*) FILTER (WHERE last_login_at > now() - interval '24h') AS logged_in_today
        FROM patient_portal_accounts
        WHERE deleted_at IS NULL
      `);
      res.json(rows[0]);
    } catch (err) {
      console.error("[portal-admin/accounts/stats]", err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

// ── GET /accounts (list) ──────────────────────────────────────────────────────
router.get(
  "/",
  requirePermission("patient_portal.accounts.view"),
  async (req: AuthenticatedRequest, res: Response) => {
    const { status, search, limit = "50", offset = "0" } = req.query as Record<string, string>;
    try {
      const vals: unknown[] = [];
      const where: string[] = ["ppa.deleted_at IS NULL"];

      if (status) { vals.push(status); where.push(`ppa.status=$${vals.length}`); }
      if (search) {
        vals.push(`%${search}%`);
        where.push(`(p.first_name ILIKE $${vals.length} OR p.last_name ILIKE $${vals.length} OR p.mpi_id ILIKE $${vals.length} OR ppa.email ILIKE $${vals.length})`);
      }

      vals.push(parseInt(limit, 10));
      vals.push(parseInt(offset, 10));

      const { rows } = await pool.query(
        `SELECT
           ppa.id, ppa.patient_id, ppa.email, ppa.phone, ppa.status,
           ppa.last_login_at, ppa.failed_login_attempts,
           ppa.locked_until, ppa.created_at, ppa.force_password_change,
           (ppa.locked_until > now()) AS is_locked,
           p.first_name, p.last_name, p.mpi_id,
           (SELECT COUNT(*) FROM patient_portal_sessions ps WHERE ps.account_id=ppa.id AND ps.expires_at>now() AND ps.revoked_at IS NULL) AS active_sessions,
           (SELECT COUNT(*) FROM lab_orders lo WHERE lo.patient_id=ppa.patient_id AND lo.published_to_patient=TRUE AND lo.deleted_at IS NULL) +
           (SELECT COUNT(*) FROM imaging_orders io WHERE io.patient_id=ppa.patient_id AND io.published_to_patient=TRUE AND io.deleted_at IS NULL) +
           (SELECT COUNT(*) FROM prescriptions rx WHERE rx.patient_id=ppa.patient_id AND rx.published_to_patient=TRUE AND rx.deleted_at IS NULL) AS published_results,
           (SELECT COUNT(*) FROM document_records dr WHERE dr.patient_id=ppa.patient_id AND dr.published_to_patient=TRUE AND dr.deleted_at IS NULL) AS published_documents,
           (ppa.otp_hash IS NOT NULL AND ppa.otp_exp > now()) AS has_active_otp,
           CASE WHEN ppa.otp_hash IS NOT NULL AND ppa.otp_exp > now() THEN ppa.otp_exp ELSE NULL END AS otp_expires_at
         FROM patient_portal_accounts ppa
         JOIN patients p ON p.id = ppa.patient_id
         WHERE ${where.join(" AND ")}
         ORDER BY ppa.created_at DESC
         LIMIT $${vals.length - 1} OFFSET $${vals.length}`,
        vals,
      );

      res.json({ accounts: rows });
    } catch (err) {
      console.error("[portal-admin/accounts]", err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

// ── GET /by-patient/:patientId  (Patient Detail tab) ──────────────────────────
router.get(
  "/by-patient/:patientId",
  requirePermission("patient_portal.accounts.view"),
  async (req: AuthenticatedRequest, res: Response) => {
    const { patientId } = req.params;
    try {
      const { rows } = await pool.query(
        `SELECT
           ppa.id, ppa.patient_id, ppa.email, ppa.phone, ppa.status,
           ppa.last_login_at, ppa.created_at, ppa.force_password_change,
           (ppa.locked_until > now()) AS is_locked,
           (ppa.otp_hash IS NOT NULL AND ppa.otp_exp > now()) AS has_active_otp,
           CASE WHEN ppa.otp_hash IS NOT NULL AND ppa.otp_exp > now() THEN ppa.otp_exp ELSE NULL END AS otp_expires_at,
           (SELECT COUNT(*) FROM patient_portal_sessions ps WHERE ps.account_id=ppa.id AND ps.expires_at>now() AND ps.revoked_at IS NULL) AS active_sessions,
           (SELECT COUNT(*) FROM lab_orders lo WHERE lo.patient_id=ppa.patient_id AND lo.published_to_patient=TRUE AND lo.deleted_at IS NULL) +
           (SELECT COUNT(*) FROM imaging_orders io WHERE io.patient_id=ppa.patient_id AND io.published_to_patient=TRUE AND io.deleted_at IS NULL) +
           (SELECT COUNT(*) FROM prescriptions rx WHERE rx.patient_id=ppa.patient_id AND rx.published_to_patient=TRUE AND rx.deleted_at IS NULL) AS published_results,
           (SELECT COUNT(*) FROM document_records dr WHERE dr.patient_id=ppa.patient_id AND dr.published_to_patient=TRUE AND dr.deleted_at IS NULL) AS published_documents,
           (SELECT COUNT(*) FROM patient_portal_notifications ppn JOIN patient_portal_accounts a2 ON a2.id=ppn.account_id WHERE a2.patient_id=ppa.patient_id AND ppn.is_read=FALSE) AS unread_notifications
         FROM patient_portal_accounts ppa
         WHERE ppa.patient_id=$1 AND ppa.deleted_at IS NULL`,
        [patientId],
      );
      res.json({ account: rows[0] ?? null });
    } catch (err) {
      console.error("[portal-admin/by-patient]", err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

// ── GET /accounts/:id ─────────────────────────────────────────────────────────
router.get(
  "/:id",
  requirePermission("patient_portal.accounts.view"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { rows } = await pool.query(
        `SELECT ppa.*, p.first_name, p.last_name, p.mpi_id, p.phone AS patient_phone, p.email AS patient_email,
                (ppa.locked_until > now()) AS is_locked,
                (ppa.otp_hash IS NOT NULL AND ppa.otp_exp > now()) AS has_active_otp,
                CASE WHEN ppa.otp_hash IS NOT NULL AND ppa.otp_exp > now() THEN ppa.otp_exp ELSE NULL END AS otp_expires_at
         FROM patient_portal_accounts ppa
         JOIN patients p ON p.id = ppa.patient_id
         WHERE ppa.id=$1 AND ppa.deleted_at IS NULL`,
        [String(req.params.id)],
      );
      if (!rows[0]) { res.status(404).json({ message: "Compte introuvable." }); return; }
      // Strip all sensitive hash fields — NEVER expose to frontend
      const { password_hash, activation_token, reset_token, otp_code, otp_hash, otp_exp, mfa_secret, ...safe } = rows[0];
      // has_active_otp and otp_expires_at are computed, remain in safe
      res.json({ account: safe });
    } catch (err) {
      console.error("[portal-admin/accounts/:id]", err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

// ── POST /accounts  — create ──────────────────────────────────────────────────
router.post(
  "/",
  requirePermission("patient_portal.accounts.create"),
  async (req: AuthenticatedRequest, res: Response) => {
    const { patientId, email, sendOtp = true } = req.body as {
      patientId?: string;
      email?: string;
      sendOtp?: boolean;
    };

    if (!patientId) { res.status(400).json({ message: "patientId requis." }); return; }

    try {
      // 1. Verify patient exists
      const { rows: pRows } = await pool.query(
        `SELECT id, first_name, last_name, phone, email AS patient_email FROM patients WHERE id=$1`,
        [patientId],
      );
      if (!pRows[0]) { res.status(404).json({ message: "Patient introuvable." }); return; }
      const patient = pRows[0];

      // 2. Check no existing account (UNIQUE patient_id constraint)
      const { rows: existing } = await pool.query(
        `SELECT id FROM patient_portal_accounts WHERE patient_id=$1 AND deleted_at IS NULL`,
        [patientId],
      );
      if (existing[0]) {
        res.status(409).json({ message: "Ce patient possède déjà un compte portail." });
        return;
      }

      const accountEmail = email || patient.patient_email;
      const accountPhone = patient.phone;

      // 3. Generate OTP (stored plain — activate route compares plain text, single-use + 30 min expiry)
      const otp = generateOtp();
      const otpExp = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      // 4. Create account
      const { rows: created } = await pool.query(
        `INSERT INTO patient_portal_accounts
           (patient_id, email, phone, status, otp_hash, otp_exp, otp_attempts, force_password_change)
         VALUES ($1, $2, $3, 'pending_activation', $4, $5, 0, TRUE)
         RETURNING id`,
        [patientId, accountEmail, accountPhone, hmacOtp(otp), otpExp],
      );

      await auditAction(req, "create_portal_account", "patient_portal_account", created[0].id, {
        patientId,
        createdBy: req.auth?.userId,
      });

      // 5. Return OTP once (in production: also SMS/email)
      res.status(201).json({
        accountId: created[0].id,
        otp,                       // shown once — hash stored
        otpExpiresAt: otpExp,
        email: accountEmail,
        phone: accountPhone,
        message: "Compte créé. Communiquez le code OTP au patient pour qu'il active son compte.",
      });
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException & { code?: string })?.code === "23505") {
        res.status(409).json({ message: "Ce patient possède déjà un compte portail." });
        return;
      }
      console.error("[portal-admin/accounts/create]", err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

// ── POST /accounts/:id/generate-otp ──────────────────────────────────────────
router.post(
  "/:id/generate-otp",
  requirePermission("patient_portal.accounts.activate"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, status, patient_id FROM patient_portal_accounts WHERE id=$1 AND deleted_at IS NULL`,
        [String(req.params.id)],
      );
      if (!rows[0]) { res.status(404).json({ message: "Compte introuvable." }); return; }

      const otp = generateOtp();
      const otpExp = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      await pool.query(
        `UPDATE patient_portal_accounts
         SET otp_hash=$1, otp_exp=$2, otp_attempts=0, updated_at=now()
         WHERE id=$3`,
        [hmacOtp(otp), otpExp, String(req.params.id)],
      );

      await auditAction(req, "generate_portal_otp", "patient_portal_account", String(req.params.id));

      res.json({ otp, otpExpiresAt: otpExp, message: "Code OTP généré. Communiquez-le au patient." });
    } catch (err) {
      console.error("[portal-admin/generate-otp]", err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

// ── POST /accounts/:id/suspend ────────────────────────────────────────────────
router.post(
  "/:id/suspend",
  requirePermission("patient_portal.accounts.suspend"),
  async (req: AuthenticatedRequest, res: Response) => {
    const { reason } = req.body as { reason?: string };
    try {
      const { rows } = await pool.query(
        `UPDATE patient_portal_accounts SET status='suspended', updated_at=now()
         WHERE id=$1 AND deleted_at IS NULL RETURNING id`,
        [String(req.params.id)],
      );
      if (!rows[0]) { res.status(404).json({ message: "Compte introuvable." }); return; }

      // Revoke all active sessions
      await pool.query(
        `UPDATE patient_portal_sessions SET revoked_at=now() WHERE account_id=$1 AND revoked_at IS NULL`,
        [String(req.params.id)],
      );

      await auditAction(req, "suspend_portal_account", "patient_portal_account", String(req.params.id), { reason });
      res.json({ message: "Compte suspendu. Toutes les sessions ont été révoquées." });
    } catch (err) {
      console.error("[portal-admin/suspend]", err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

// ── POST /accounts/:id/reactivate ─────────────────────────────────────────────
router.post(
  "/:id/reactivate",
  requirePermission("patient_portal.accounts.suspend"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { rows } = await pool.query(
        `UPDATE patient_portal_accounts SET status='active', updated_at=now()
         WHERE id=$1 AND deleted_at IS NULL RETURNING id`,
        [String(req.params.id)],
      );
      if (!rows[0]) { res.status(404).json({ message: "Compte introuvable." }); return; }
      await auditAction(req, "reactivate_portal_account", "patient_portal_account", String(req.params.id));
      res.json({ message: "Compte réactivé." });
    } catch (err) {
      console.error("[portal-admin/reactivate]", err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

// ── POST /accounts/:id/unlock ─────────────────────────────────────────────────
router.post(
  "/:id/unlock",
  requirePermission("patient_portal.accounts.unlock"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { rows } = await pool.query(
        `UPDATE patient_portal_accounts
         SET locked_until=NULL, failed_login_attempts=0, updated_at=now()
         WHERE id=$1 AND deleted_at IS NULL RETURNING id`,
        [String(req.params.id)],
      );
      if (!rows[0]) { res.status(404).json({ message: "Compte introuvable." }); return; }
      await auditAction(req, "unlock_portal_account", "patient_portal_account", String(req.params.id));
      res.json({ message: "Compte déverrouillé." });
    } catch (err) {
      console.error("[portal-admin/unlock]", err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

// ── POST /accounts/:id/revoke-sessions ───────────────────────────────────────
router.post(
  "/:id/revoke-sessions",
  requirePermission("patient_portal.accounts.revoke_sessions"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { rows } = await pool.query(
        `SELECT id FROM patient_portal_accounts WHERE id=$1 AND deleted_at IS NULL`,
        [String(req.params.id)],
      );
      if (!rows[0]) { res.status(404).json({ message: "Compte introuvable." }); return; }

      const { rowCount } = await pool.query(
        `UPDATE patient_portal_sessions SET revoked_at=now()
         WHERE account_id=$1 AND revoked_at IS NULL`,
        [String(req.params.id)],
      );

      await auditAction(req, "revoke_portal_sessions", "patient_portal_account", String(req.params.id), { count: rowCount });
      res.json({ message: `${rowCount} session(s) révoquée(s).`, count: rowCount });
    } catch (err) {
      console.error("[portal-admin/revoke-sessions]", err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

// ── POST /accounts/:id/force-password-change ──────────────────────────────────
router.post(
  "/:id/force-password-change",
  requirePermission("patient_portal.accounts.suspend"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { rows } = await pool.query(
        `UPDATE patient_portal_accounts SET force_password_change=TRUE, updated_at=now()
         WHERE id=$1 AND deleted_at IS NULL RETURNING id`,
        [String(req.params.id)],
      );
      if (!rows[0]) { res.status(404).json({ message: "Compte introuvable." }); return; }
      await auditAction(req, "force_portal_password_change", "patient_portal_account", String(req.params.id));
      res.json({ message: "Le patient devra changer son mot de passe à la prochaine connexion." });
    } catch (err) {
      console.error("[portal-admin/force-password]", err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

// ── GET /accounts/:id/audit ───────────────────────────────────────────────────
router.get(
  "/:id/audit",
  requirePermission("patient_portal.accounts.view_audit"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { rows: acc } = await pool.query(
        `SELECT id, patient_id FROM patient_portal_accounts WHERE id=$1 AND deleted_at IS NULL`,
        [String(req.params.id)],
      );
      if (!acc[0]) { res.status(404).json({ message: "Compte introuvable." }); return; }

      const { rows: logs } = await pool.query(
        `SELECT pal.id, pal.action, pal.success, pal.ip_address, pal.user_agent, pal.created_at
         FROM patient_portal_access_logs pal
         WHERE pal.account_id=$1
         ORDER BY pal.created_at DESC
         LIMIT 200`,
        [String(req.params.id)],
      );

      res.json({ logs });
    } catch (err) {
      console.error("[portal-admin/audit]", err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

export default router;
