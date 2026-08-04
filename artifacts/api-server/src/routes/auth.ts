/**
 * Auth routes — fully backed by PostgreSQL.
 *
 * Endpoints
 *   POST /auth/login           → { user, accessToken }  +  HttpOnly cookie (refreshToken)
 *   POST /auth/refresh          → { accessToken }        +  new HttpOnly cookie
 *   POST /auth/logout           → 204                    +  clears cookie
 *   GET  /auth/me               → { user }               (requires Bearer access token)
 *   POST /auth/change-password  → 204                    (requires Bearer)
 *   POST /auth/forgot-password  → 200                    (stub — email not implemented)
 *   POST /auth/reset-password   → 200                    (stub)
 *
 * Security measures
 *   • bcrypt cost 12 for all password hashes
 *   • Access tokens expire in 15 min; refresh tokens in 7 days
 *   • Refresh token stored HttpOnly SameSite=Strict cookie; only its SHA-256 hash is in the DB
 *   • Refresh rotation: old session revoked, new one issued on every /refresh call
 *   • Brute-force: MAX_ATTEMPTS failed logins → lock for LOCK_MINUTES
 *   • All auth events written to user_activity_logs
 */

import crypto from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { pool } from "@workspace/db";
import type { AuthenticatedRequest } from "../middleware/requireAuth";

const router = Router();

// ─── Constants ────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  throw new Error("[auth] SESSION_SECRET must be set before starting the server.");
}

const ACCESS_TOKEN_TTL  = "15m";                     // short-lived
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60 * 1000;  // 7 days in ms
const REFRESH_COOKIE    = "irissam_rt";
const MAX_ATTEMPTS      = 20;
const LOCK_MINUTES      = 15;
const DUMMY_HASH        = "$2b$12$invalidhashpadding0000000000000000000000000000000000";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DbUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  hashed_password: string;
  account_status: string;
  failed_login_attempts: number;
  locked_until: Date | null;
  site_id: string | null;
  department_id: string | null;
  language: string;
  force_password_change: boolean;
  mfa_enabled: boolean;
}

export interface JwtPayload {
  userId: string;
  role: string;
  permissions: string[];
  siteId: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

async function loadPermissions(userId: string): Promise<string[]> {
  const { rows } = await pool.query<{ name: string }>(
    `SELECT DISTINCT p.name
     FROM user_roles ur
     JOIN role_permissions rp ON rp.role_id = ur.role_id
     JOIN permissions p        ON p.id       = rp.permission_id
     WHERE ur.user_id = $1`,
    [userId],
  );
  return rows.map((r) => r.name);
}

async function getUserPermissionRoleName(userId: string): Promise<string | null> {
  const { rows } = await pool.query<{ name: string }>(
    `SELECT r.name FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1
     ORDER BY r.created_at LIMIT 1`,
    [userId],
  );
  return rows[0]?.name ?? null;
}

async function logActivity(
  userId: string | null,
  userName: string,
  userRole: string,
  action: string,
  description: string,
  ip?: string,
): Promise<void> {
  // user_activity_logs uses a user_activity_action enum; for auth events we cast to text
  // to avoid enum-cast issues when new values aren't yet in the enum.
  try {
    await pool.query(
      `INSERT INTO user_activity_logs
         (user_id, user_name, user_role, action, module, description, ip)
       SELECT $1, $2, $3, a.action_val::user_activity_action, 'auth', $4, $5
       FROM (SELECT $6::text AS action_val) a
       WHERE EXISTS (
         SELECT 1 FROM pg_enum
         WHERE enumtypid = 'user_activity_action'::regtype
           AND enumlabel = $6
       )`,
      [userId, userName, userRole, description, ip ?? null, action],
    );
  } catch {
    // Non-critical — never block the auth flow for a log write failure
  }
}

function toPublicUser(u: DbUser, permissions: string[], rbacRole: string | null) {
  return {
    id: u.id,
    firstName: u.first_name,
    lastName: u.last_name,
    email: u.email,
    role: (rbacRole ?? u.role) as string,
    siteId: u.site_id,
    departmentId: u.department_id,
    isActive: u.account_status === "active",
    language: u.language,
    forcePasswordChange: u.force_password_change,
    mfaEnabled: u.mfa_enabled,
    permissions,
    lastLogin: new Date(),
  };
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly:  true,
    secure:    process.env.NODE_ENV === "production",
    sameSite:  "strict",
    maxAge:    REFRESH_TOKEN_TTL,
    path:      "/api/auth",
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
}

// ─── POST /auth/login ─────────────────────────────────────────────────────────

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  const ip = req.ip;

  if (!email || !password) {
    res.status(400).json({ message: "Email et mot de passe requis." });
    return;
  }

  // Fetch user
  const { rows } = await pool.query<DbUser>(
    `SELECT id, first_name, last_name, email, role, hashed_password,
            account_status, failed_login_attempts, locked_until,
            site_id, department_id, language, force_password_change, mfa_enabled
     FROM users
     WHERE email = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [email.toLowerCase().trim()],
  );

  const user = rows[0] ?? null;

  // Constant-time dummy compare when user not found (prevent timing attacks)
  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    res.status(401).json({ message: "Identifiants invalides." });
    return;
  }

  // Check account status
  if (user.account_status !== "active") {
    await bcrypt.compare(password, DUMMY_HASH);
    await logActivity(user.id, `${user.first_name} ${user.last_name}`, user.role,
      "failed_login", `Compte ${user.account_status}`, ip);
    res.status(401).json({ message: "Ce compte est désactivé. Contactez l'administrateur." });
    return;
  }

  // Check brute-force lock
  if (user.locked_until && user.locked_until > new Date()) {
    await bcrypt.compare(password, DUMMY_HASH);
    const minutes = Math.ceil((user.locked_until.getTime() - Date.now()) / 60000);
    res.status(429).json({ message: `Compte temporairement bloqué. Réessayez dans ${minutes} min.` });
    return;
  }

  // Verify password
  const valid = await bcrypt.compare(password, user.hashed_password);

  if (!valid) {
    const newAttempts = user.failed_login_attempts + 1;
    const locked = newAttempts >= MAX_ATTEMPTS;

    await pool.query(
      `UPDATE users SET
         failed_login_attempts = $1,
         locked_until          = $2,
         updated_at            = now()
       WHERE id = $3`,
      [newAttempts, locked ? new Date(Date.now() + LOCK_MINUTES * 60000) : null, user.id],
    );

    await logActivity(user.id, `${user.first_name} ${user.last_name}`, user.role,
      "failed_login",
      locked
        ? `Compte bloqué après ${MAX_ATTEMPTS} tentatives`
        : `Mot de passe incorrect (tentative ${newAttempts}/${MAX_ATTEMPTS})`,
      ip);

    if (locked) {
      res.status(429).json({ message: `Compte bloqué après ${MAX_ATTEMPTS} tentatives. Réessayez dans ${LOCK_MINUTES} min.` });
    } else {
      res.status(401).json({ message: "Identifiants invalides." });
    }
    return;
  }

  // ── Success — reset failure counters ──────────────────────────────────────
  await pool.query(
    `UPDATE users SET
       failed_login_attempts = 0,
       locked_until          = NULL,
       last_login_at         = now(),
       updated_at            = now()
     WHERE id = $1`,
    [user.id],
  );

  // Load RBAC permissions
  const [permissions, rbacRole] = await Promise.all([
    loadPermissions(user.id),
    getUserPermissionRoleName(user.id),
  ]);

  // Issue access token (short-lived, embeds permissions)
  const payload: JwtPayload = {
    userId: user.id,
    role: rbacRole ?? user.role,
    permissions,
    siteId: user.site_id,
  };
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });

  // Issue refresh token (random, stored as SHA-256 hash)
  const rawRefresh    = generateRefreshToken();
  const refreshHash   = hashToken(rawRefresh);
  const expiresAt     = new Date(Date.now() + REFRESH_TOKEN_TTL);

  await pool.query(
    `INSERT INTO user_sessions (user_id, token_hash, expires_at, ip, user_agent, session_type)
     VALUES ($1, $2, $3, $4, $5, 'refresh')`,
    [user.id, refreshHash, expiresAt, ip ?? null, req.headers["user-agent"] ?? null],
  );

  await logActivity(user.id, `${user.first_name} ${user.last_name}`, rbacRole ?? user.role,
    "login", "Connexion réussie", ip);

  setRefreshCookie(res, rawRefresh);
  res.json({ user: toPublicUser(user, permissions, rbacRole), accessToken });
});

// ─── POST /auth/refresh ───────────────────────────────────────────────────────

router.post("/refresh", async (req: Request, res: Response) => {
  const rawToken = (req.cookies as Record<string, string>)?.[REFRESH_COOKIE];
  if (!rawToken) {
    res.status(401).json({ message: "Refresh token manquant." });
    return;
  }

  const tokenHash = hashToken(rawToken);

  // Find valid (non-revoked, non-expired) session
  const { rows: sessions } = await pool.query<{
    id: string; user_id: string; expires_at: Date; revoked_at: Date | null;
  }>(
    `SELECT id, user_id, expires_at, revoked_at
     FROM user_sessions
     WHERE token_hash = $1 AND session_type = 'refresh'
     LIMIT 1`,
    [tokenHash],
  );

  const session = sessions[0];
  if (!session || session.revoked_at || session.expires_at < new Date()) {
    clearRefreshCookie(res);
    res.status(401).json({ message: "Session invalide ou expirée. Veuillez vous reconnecter." });
    return;
  }

  // Load user
  const { rows: users } = await pool.query<DbUser>(
    `SELECT id, first_name, last_name, email, role, hashed_password,
            account_status, failed_login_attempts, locked_until,
            site_id, department_id, language, force_password_change, mfa_enabled
     FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [session.user_id],
  );
  const user = users[0];
  if (!user || user.account_status !== "active") {
    clearRefreshCookie(res);
    res.status(401).json({ message: "Utilisateur introuvable ou désactivé." });
    return;
  }

  // ── Rotation: revoke old session, issue new one ───────────────────────────
  const rawNew      = generateRefreshToken();
  const newHash     = hashToken(rawNew);
  const newExpires  = new Date(Date.now() + REFRESH_TOKEN_TTL);
  const newSessionId = crypto.randomUUID();

  await pool.query(
    `UPDATE user_sessions SET revoked_at = now(), rotated_to = $1 WHERE id = $2`,
    [newSessionId, session.id],
  );
  await pool.query(
    `INSERT INTO user_sessions (id, user_id, token_hash, expires_at, ip, user_agent, session_type)
     VALUES ($1, $2, $3, $4, $5, $6, 'refresh')`,
    [newSessionId, user.id, newHash, newExpires, req.ip ?? null, req.headers["user-agent"] ?? null],
  );

  // New access token
  const [permissions, rbacRole] = await Promise.all([
    loadPermissions(user.id),
    getUserPermissionRoleName(user.id),
  ]);
  const payload: JwtPayload = {
    userId: user.id,
    role: rbacRole ?? user.role,
    permissions,
    siteId: user.site_id,
  };
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });

  setRefreshCookie(res, rawNew);
  res.json({ accessToken, user: toPublicUser(user, permissions, rbacRole) });
});

// ─── POST /auth/logout ────────────────────────────────────────────────────────

router.post("/logout", async (req: AuthenticatedRequest, res: Response) => {
  const rawToken = (req.cookies as Record<string, string>)?.[REFRESH_COOKIE];
  if (rawToken) {
    const tokenHash = hashToken(rawToken);
    await pool.query(
      `UPDATE user_sessions SET revoked_at = now() WHERE token_hash = $1`,
      [tokenHash],
    );
  }

  // Invalidate all pending step-up tokens for this user on logout.
  // req.auth may be null (no requireAuth on logout) — decode the Bearer token directly.
  const bearerToken = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : null;
  const stepUpUserId: string | null = (() => {
    if (req.auth?.userId) return req.auth.userId;
    if (!bearerToken || !JWT_SECRET) return null;
    try {
      const p = jwt.decode(bearerToken) as { userId?: string } | null;
      return p?.userId ?? null;
    } catch { return null; }
  })();
  if (stepUpUserId) {
    pool.query(
      `UPDATE system_step_up_tokens SET used_at = now()
       WHERE user_id = $1 AND used_at IS NULL`,
      [stepUpUserId],
    ).catch(() => {});
  }

  if (req.auth?.userId) {
    const { rows } = await pool.query<{ first_name: string; last_name: string; role: string }>(
      `SELECT first_name, last_name, role FROM users WHERE id = $1`,
      [req.auth.userId],
    );
    const u = rows[0];
    if (u) {
      await logActivity(req.auth.userId, `${u.first_name} ${u.last_name}`, req.auth.role,
        "logout", "Déconnexion", req.ip);
    }
  }

  clearRefreshCookie(res);
  res.status(204).end();
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

router.get("/me", async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Token manquant." });
    return;
  }

  const token = authHeader.slice(7);
  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    res.status(401).json({ message: "Token invalide ou expiré." });
    return;
  }

  // Guard against legacy mock IDs (e.g. "user-1") that crash PostgreSQL's UUID parser
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(payload.userId ?? "")) {
    res.status(401).json({ message: "Token invalide." });
    return;
  }

  const { rows } = await pool.query<DbUser>(
    `SELECT id, first_name, last_name, email, role,
            '' AS hashed_password,
            account_status, failed_login_attempts, locked_until,
            site_id, department_id, language, force_password_change, mfa_enabled
     FROM users WHERE id = $1 AND deleted_at IS NULL AND account_status = 'active'
     LIMIT 1`,
    [payload.userId],
  );
  const user = rows[0];
  if (!user) {
    res.status(401).json({ message: "Utilisateur introuvable." });
    return;
  }

  // Return fresh permissions (token may be old)
  const [permissions, rbacRole] = await Promise.all([
    loadPermissions(user.id),
    getUserPermissionRoleName(user.id),
  ]);

  res.json({ user: toPublicUser(user, permissions, rbacRole) });
});

// ─── POST /auth/change-password ───────────────────────────────────────────────

router.post("/change-password", async (req: AuthenticatedRequest, res: Response) => {
  // Must have a valid Bearer token
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Authentification requise." });
    return;
  }
  let userId: string;
  try {
    const p = jwt.verify(authHeader.slice(7), JWT_SECRET) as JwtPayload;
    userId = p.userId;
  } catch {
    res.status(401).json({ message: "Token invalide ou expiré." });
    return;
  }

  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    res.status(400).json({ message: "Mot de passe actuel et nouveau mot de passe requis." });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ message: "Le nouveau mot de passe doit contenir au moins 8 caractères." });
    return;
  }

  const { rows } = await pool.query<{ hashed_password: string; first_name: string; last_name: string; role: string }>(
    `SELECT hashed_password, first_name, last_name, role FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [userId],
  );
  const user = rows[0];
  if (!user) {
    res.status(404).json({ message: "Utilisateur introuvable." });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.hashed_password);
  if (!valid) {
    res.status(401).json({ message: "Mot de passe actuel incorrect." });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await pool.query(
    `UPDATE users SET
       hashed_password       = $1,
       force_password_change = FALSE,
       version               = version + 1,
       updated_at            = now()
     WHERE id = $2`,
    [newHash, userId],
  );

  // Revoke all existing refresh sessions (force re-login)
  await pool.query(
    `UPDATE user_sessions SET revoked_at = now()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );

  await logActivity(userId, `${user.first_name} ${user.last_name}`, user.role,
    "password_changed", "Mot de passe modifié", req.ip);

  clearRefreshCookie(res);
  res.status(204).end();
});

// ─── POST /auth/forgot-password (stub) ───────────────────────────────────────

router.post("/forgot-password", async (_req: Request, res: Response) => {
  // Email sending not yet implemented; return generic success to avoid user enumeration
  res.json({ message: "Si cette adresse existe, un email de réinitialisation a été envoyé." });
});

// ─── POST /auth/reset-password (stub) ────────────────────────────────────────

router.post("/reset-password", async (_req: Request, res: Response) => {
  res.status(501).json({ message: "La réinitialisation par token n'est pas encore implémentée." });
});

export default router;
