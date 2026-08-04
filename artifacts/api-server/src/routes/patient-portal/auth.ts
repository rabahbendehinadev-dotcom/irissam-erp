/**
 * Patient Portal — Authentication
 * Completely separate from staff auth.
 *
 * POST /patient-portal/auth/activate        – activate account via token/OTP
 * POST /patient-portal/auth/login           – email+password login
 * POST /patient-portal/auth/refresh         – refresh access token
 * POST /patient-portal/auth/logout          – revoke session
 * GET  /patient-portal/auth/me              – current account info
 * POST /patient-portal/auth/forgot-password – request reset
 * POST /patient-portal/auth/reset-password  – apply reset
 * POST /patient-portal/auth/verify-otp      – verify OTP code
 */
import crypto from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { pool } from "@workspace/db";
import { requirePatientAuth, type PatientRequest } from "../../middleware/requirePatientAuth.js";

const router = Router();

const JWT_SECRET          = process.env.SESSION_SECRET!;
const ACCESS_TTL          = "30m";
const REFRESH_TTL_MS      = 30 * 24 * 60 * 60 * 1000; // 30 days
const PORTAL_COOKIE       = "irissam_pt";
const MAX_ATTEMPTS        = 5;
const LOCK_MINUTES        = 15;
const OTP_EXPIRY_MINUTES  = 10;
const DUMMY_HASH          = "$2b$12$invalidhashpadding0000000000000000000000000000000000";

function hashToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}
function generateRefreshToken() {
  return crypto.randomBytes(48).toString("base64url");
}
function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
function signAccessToken(accountId: string, patientId: string) {
  return jwt.sign({ accountId, patientId, role: "patient" }, JWT_SECRET, { expiresIn: ACCESS_TTL });
}

async function auditLog(accountId: string | null, patientId: string | null, action: string, ip: string | undefined, success = true, meta?: object) {
  try {
    await pool.query(
      `INSERT INTO patient_portal_access_logs (account_id, patient_id, action, ip, success, meta)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [accountId, patientId, action, ip ?? null, success, meta ? JSON.stringify(meta) : null],
    );
  } catch { /* non-blocking */ }
}

// ── POST /activate ─────────────────────────────────────────────────────────────
router.post("/activate", async (req: Request, res: Response) => {
  const { token, otp, newPassword, mrn, dateOfBirth, phone } = req.body ?? {};
  if (!newPassword) {
    res.status(400).json({ message: "Nouveau mot de passe requis." });
    return;
  }

  try {
    let account: { id: string; patient_id: string; status: string } | undefined;

    if (token) {
      const { rows } = await pool.query(
        `SELECT a.id, a.patient_id, a.status
         FROM patient_portal_accounts a
         WHERE a.activation_token = $1
           AND a.activation_token_exp > now()
           AND a.status = 'pending_activation'
           AND a.deleted_at IS NULL`,
        [hashToken(token)],
      );
      account = rows[0];
    } else if (otp && mrn) {
      const { rows } = await pool.query(
        `SELECT a.id, a.patient_id, a.status
         FROM patient_portal_accounts a
         JOIN patients p ON p.id = a.patient_id
         WHERE a.otp_code = $1
           AND a.otp_exp > now()
           AND a.otp_attempts < 5
           AND a.status = 'pending_activation'
           AND p.mpi_id = $2
           AND a.deleted_at IS NULL`,
        [otp, mrn],
      );
      account = rows[0];
      if (!account) {
        // Increment OTP attempts
        await pool.query(
          `UPDATE patient_portal_accounts SET otp_attempts = otp_attempts + 1
           WHERE otp_code = $1`,
          [otp],
        );
      }
    } else if (mrn && dateOfBirth && phone) {
      const { rows } = await pool.query(
        `SELECT a.id, a.patient_id, a.status
         FROM patient_portal_accounts a
         JOIN patients p ON p.id = a.patient_id
         WHERE p.mpi_id = $1
           AND p.date_of_birth = $2::date
           AND (p.phone = $3 OR p.phone_secondary = $3)
           AND a.status = 'pending_activation'
           AND a.deleted_at IS NULL`,
        [mrn, dateOfBirth, phone],
      );
      account = rows[0];
    }

    if (!account) {
      await auditLog(null, null, "activate", req.ip, false, { reason: "invalid_token_or_otp" });
      res.status(400).json({ message: "Lien d'activation invalide ou expiré." });
      return;
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      `UPDATE patient_portal_accounts
       SET status='active', password_hash=$1, activation_token=NULL,
           activation_token_exp=NULL, otp_code=NULL, otp_exp=NULL,
           otp_attempts=0, force_password_change=FALSE, updated_at=now()
       WHERE id=$2`,
      [hash, account.id],
    );

    await auditLog(account.id, account.patient_id, "activate", req.ip, true);
    res.json({ message: "Compte activé avec succès." });
  } catch (err) {
    console.error("[portal/activate]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// ── POST /login ────────────────────────────────────────────────────────────────
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ message: "Email et mot de passe requis." });
    return;
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, patient_id, password_hash, status, failed_login_attempts, locked_until
       FROM patient_portal_accounts
       WHERE lower(email)=lower($1) AND deleted_at IS NULL`,
      [email],
    );

    const account = rows[0];

    if (!account) {
      await bcrypt.compare(password, DUMMY_HASH).catch(() => {});
      await auditLog(null, null, "login", req.ip, false, { email });
      res.status(401).json({ message: "Email ou mot de passe incorrect." });
      return;
    }

    // Brute-force check
    if (account.locked_until && new Date(account.locked_until) > new Date()) {
      await auditLog(account.id, account.patient_id, "login", req.ip, false, { reason: "locked" });
      res.status(403).json({ message: "Compte temporairement verrouillé. Réessayez plus tard.", code: "ACCOUNT_LOCKED" });
      return;
    }

    if (account.status === "suspended") {
      res.status(403).json({ message: "Compte suspendu. Contactez l'hôpital.", code: "SUSPENDED" });
      return;
    }
    if (account.status === "archived") {
      res.status(403).json({ message: "Compte archivé.", code: "ARCHIVED" });
      return;
    }
    if (account.status === "pending_activation") {
      res.status(403).json({ message: "Compte en attente d'activation.", code: "PENDING_ACTIVATION" });
      return;
    }

    const valid = await bcrypt.compare(password, account.password_hash ?? DUMMY_HASH);
    if (!valid) {
      const attempts = account.failed_login_attempts + 1;
      const lockUpdate = attempts >= MAX_ATTEMPTS
        ? `locked_until=now()+interval '${LOCK_MINUTES} minutes', status='locked',`
        : "";
      await pool.query(
        `UPDATE patient_portal_accounts
         SET ${lockUpdate} failed_login_attempts=$1, updated_at=now()
         WHERE id=$2`,
        [attempts, account.id],
      );
      await auditLog(account.id, account.patient_id, "login", req.ip, false, { reason: "wrong_password" });
      res.status(401).json({ message: "Email ou mot de passe incorrect." });
      return;
    }

    // Reset attempts + update last login
    await pool.query(
      `UPDATE patient_portal_accounts
       SET failed_login_attempts=0, last_login_at=now(), locked_until=NULL,
           status=CASE WHEN status='locked' THEN 'active' ELSE status END, updated_at=now()
       WHERE id=$1`,
      [account.id],
    );

    // Issue refresh token
    const raw = generateRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    await pool.query(
      `INSERT INTO patient_portal_sessions
         (account_id, patient_id, refresh_token_hash, ip, user_agent, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [account.id, account.patient_id, hashToken(raw), req.ip ?? null, req.headers["user-agent"] ?? null, expiresAt],
    );

    res.cookie(PORTAL_COOKIE, raw, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      expires: expiresAt,
      path: "/",
    });

    const accessToken = signAccessToken(account.id, account.patient_id);
    await auditLog(account.id, account.patient_id, "login", req.ip, true);
    res.json({ accessToken, expiresIn: 1800 });
  } catch (err) {
    console.error("[portal/login]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// ── POST /refresh ──────────────────────────────────────────────────────────────
router.post("/refresh", async (req: Request, res: Response) => {
  const raw = req.cookies?.[PORTAL_COOKIE];
  if (!raw) {
    res.status(401).json({ message: "Session expirée.", code: "TOKEN_EXPIRED" });
    return;
  }

  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.account_id, s.patient_id, a.status
       FROM patient_portal_sessions s
       JOIN patient_portal_accounts a ON a.id = s.account_id
       WHERE s.refresh_token_hash=$1
         AND s.revoked_at IS NULL
         AND s.expires_at > now()
         AND a.deleted_at IS NULL`,
      [hashToken(raw)],
    );

    const session = rows[0];
    if (!session) {
      res.clearCookie(PORTAL_COOKIE, { path: "/" });
      res.status(401).json({ message: "Session invalide ou expirée.", code: "TOKEN_EXPIRED" });
      return;
    }

    if (session.status !== "active") {
      res.clearCookie(PORTAL_COOKIE, { path: "/" });
      res.status(403).json({ message: "Compte inactif.", code: "INACTIVE" });
      return;
    }

    // Rotate refresh token
    const newRaw = generateRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    await pool.query(`UPDATE patient_portal_sessions SET revoked_at=now() WHERE id=$1`, [session.id]);
    await pool.query(
      `INSERT INTO patient_portal_sessions
         (account_id, patient_id, refresh_token_hash, ip, user_agent, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [session.account_id, session.patient_id, hashToken(newRaw), req.ip ?? null, req.headers["user-agent"] ?? null, expiresAt],
    );

    res.cookie(PORTAL_COOKIE, newRaw, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      expires: expiresAt,
      path: "/",
    });

    const accessToken = signAccessToken(session.account_id, session.patient_id);
    res.json({ accessToken, expiresIn: 1800 });
  } catch (err) {
    console.error("[portal/refresh]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// ── POST /logout ───────────────────────────────────────────────────────────────
router.post("/logout", async (req: Request, res: Response) => {
  const raw = req.cookies?.[PORTAL_COOKIE];
  if (raw) {
    await pool.query(
      `UPDATE patient_portal_sessions SET revoked_at=now() WHERE refresh_token_hash=$1`,
      [hashToken(raw)],
    ).catch(() => {});
  }
  res.clearCookie(PORTAL_COOKIE, { path: "/" });
  res.status(204).send();
});

// ── GET /me ────────────────────────────────────────────────────────────────────
router.get("/me", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.email, a.phone, a.status, a.email_verified, a.phone_verified,
              a.mfa_enabled, a.force_password_change, a.preferred_language, a.last_login_at,
              p.id AS patient_id, p.first_name, p.last_name, p.mpi_id, p.date_of_birth,
              p.gender, p.phone AS patient_phone, p.email AS patient_email,
              p.address, p.emergency_contact_phone
       FROM patient_portal_accounts a
       JOIN patients p ON p.id = a.patient_id
       WHERE a.id=$1 AND a.deleted_at IS NULL`,
      [req.patient!.accountId],
    );
    if (!rows[0]) {
      res.status(404).json({ message: "Compte introuvable." });
      return;
    }
    res.json({ account: rows[0] });
  } catch (err) {
    console.error("[portal/me]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// ── POST /forgot-password ──────────────────────────────────────────────────────
router.post("/forgot-password", async (req: Request, res: Response) => {
  const { email } = req.body ?? {};
  // Always return 200 to prevent email enumeration
  res.json({ message: "Si un compte existe, un lien de réinitialisation a été envoyé." });

  if (!email) return;
  try {
    const { rows } = await pool.query(
      `SELECT id, patient_id FROM patient_portal_accounts
       WHERE lower(email)=lower($1) AND status='active' AND deleted_at IS NULL`,
      [email],
    );
    if (!rows[0]) return;

    const raw = crypto.randomBytes(32).toString("hex");
    const exp = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await pool.query(
      `UPDATE patient_portal_accounts
       SET reset_token=$1, reset_token_exp=$2, updated_at=now()
       WHERE id=$3`,
      [hashToken(raw), exp, rows[0].id],
    );
    // TODO: send email with reset link containing raw token
    await auditLog(rows[0].id, rows[0].patient_id, "forgot_password", req.ip, true);
  } catch { /* non-blocking */ }
});

// ── POST /reset-password ───────────────────────────────────────────────────────
router.post("/reset-password", async (req: Request, res: Response) => {
  const { token, newPassword } = req.body ?? {};
  if (!token || !newPassword) {
    res.status(400).json({ message: "Token et nouveau mot de passe requis." });
    return;
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, patient_id FROM patient_portal_accounts
       WHERE reset_token=$1 AND reset_token_exp>now() AND deleted_at IS NULL`,
      [hashToken(token)],
    );
    if (!rows[0]) {
      res.status(400).json({ message: "Lien invalide ou expiré." });
      return;
    }
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      `UPDATE patient_portal_accounts
       SET password_hash=$1, reset_token=NULL, reset_token_exp=NULL,
           force_password_change=FALSE, failed_login_attempts=0,
           locked_until=NULL, status='active', updated_at=now()
       WHERE id=$2`,
      [hash, rows[0].id],
    );
    // Revoke all sessions
    await pool.query(
      `UPDATE patient_portal_sessions SET revoked_at=now()
       WHERE account_id=$1 AND revoked_at IS NULL`,
      [rows[0].id],
    );
    await auditLog(rows[0].id, rows[0].patient_id, "reset_password", req.ip, true);
    res.json({ message: "Mot de passe réinitialisé avec succès." });
  } catch (err) {
    console.error("[portal/reset-password]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// ── POST /verify-otp ───────────────────────────────────────────────────────────
router.post("/verify-otp", async (req: Request, res: Response) => {
  const { email, otp } = req.body ?? {};
  if (!email || !otp) {
    res.status(400).json({ message: "Email et OTP requis." });
    return;
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, patient_id, otp_code, otp_exp, otp_attempts
       FROM patient_portal_accounts
       WHERE lower(email)=lower($1) AND deleted_at IS NULL`,
      [email],
    );
    const acc = rows[0];
    if (!acc || acc.otp_attempts >= 5 || !acc.otp_exp || new Date(acc.otp_exp) < new Date()) {
      res.status(400).json({ message: "OTP invalide ou expiré." });
      return;
    }
    if (acc.otp_code !== otp) {
      await pool.query(
        `UPDATE patient_portal_accounts SET otp_attempts=otp_attempts+1 WHERE id=$1`,
        [acc.id],
      );
      res.status(400).json({ message: "OTP incorrect." });
      return;
    }
    await pool.query(
      `UPDATE patient_portal_accounts
       SET otp_code=NULL, otp_exp=NULL, otp_attempts=0, phone_verified=TRUE, updated_at=now()
       WHERE id=$1`,
      [acc.id],
    );
    await auditLog(acc.id, acc.patient_id, "verify_otp", req.ip, true);
    res.json({ message: "OTP vérifié." });
  } catch (err) {
    console.error("[portal/verify-otp]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// ── POST /generate-otp  (staff creates OTP for patient activation) ─────────────
router.post("/generate-otp", async (req: Request, res: Response) => {
  const { patientId, mrn, dateOfBirth, phone } = req.body ?? {};
  try {
    let pid = patientId;
    if (!pid && mrn) {
      const { rows } = await pool.query(
        `SELECT id FROM patients WHERE mpi_id=$1 AND date_of_birth=$2::date
           AND (phone=$3 OR phone_secondary=$3)`,
        [mrn, dateOfBirth, phone],
      );
      pid = rows[0]?.id;
    }
    if (!pid) {
      res.status(404).json({ message: "Patient introuvable." });
      return;
    }

    const otp = generateOtp();
    const exp = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Upsert portal account
    await pool.query(
      `INSERT INTO patient_portal_accounts (patient_id, otp_code, otp_exp, otp_attempts)
       VALUES ($1,$2,$3,0)
       ON CONFLICT (patient_id)
       DO UPDATE SET otp_code=$2, otp_exp=$3, otp_attempts=0, updated_at=now()`,
      [pid, otp, exp],
    );

    // In production: send OTP via SMS/Email
    res.json({ otp, expiresAt: exp, message: "OTP généré." });
  } catch (err) {
    console.error("[portal/generate-otp]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

export default router;
