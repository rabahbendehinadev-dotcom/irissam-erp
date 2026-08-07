import type { Response, NextFunction } from "express";
import { pool } from "@workspace/db";
import type { AuthenticatedRequest } from "./requireAuth";

/**
 * Returns middleware that enforces a single granular permission.
 *
 *   router.post("/patients", requireAuth, requirePermission("patients.create"), handler)
 *
 * The permission is checked against the JWT payload (req.auth.permissions).
 * Super-admin role bypasses the check for every permission.
 * All rejections are recorded in user_activity_logs.
 */
export function requirePermission(permission: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.auth) {
      res.status(401).json({ message: "Authentication required." });
      return;
    }

    // super_admin bypasses all permission checks
    if (req.auth.role === "super_admin") {
      next();
      return;
    }

    if (req.auth.permissions.includes(permission)) {
      next();
      return;
    }

    // Log the denied access attempt (best-effort — never blocks the 403 response)
    logDenied(req.auth.userId, req.auth.role, permission, req.ip).catch(() => {});

    res.status(403).json({
      message: "Permission insuffisante.",
      required: permission,
    });
  };
}

/**
 * Returns middleware that requires ANY one of the listed permissions.
 */
export function requireAnyPermission(permissions: string[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.auth) {
      res.status(401).json({ message: "Authentication required." });
      return;
    }

    if (req.auth.role === "super_admin") { next(); return; }

    const hasAny = permissions.some((p) => req.auth!.permissions.includes(p));
    if (hasAny) { next(); return; }

    logDenied(req.auth.userId, req.auth.role, permissions.join("|"), req.ip).catch(() => {});

    res.status(403).json({
      message: "Permission insuffisante.",
      required: permissions,
    });
  };
}

/**
 * Returns middleware that requires ALL listed permissions.
 */
export function requireAllPermissions(permissions: string[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.auth) {
      res.status(401).json({ message: "Authentication required." });
      return;
    }

    if (req.auth.role === "super_admin") { next(); return; }

    const hasAll = permissions.every((p) => req.auth!.permissions.includes(p));
    if (hasAll) { next(); return; }

    logDenied(req.auth.userId, req.auth.role, permissions.join("+"), req.ip).catch(() => {});

    res.status(403).json({
      message: "Permission insuffisante.",
      required: permissions,
    });
  };
}

/**
 * Programmatic permission check for routes whose required permission depends
 * on the request body (e.g. PATCH /prescriptions/:id/status).
 */
export function hasPermission(req: AuthenticatedRequest, permission: string): boolean {
  if (!req.auth) return false;
  if (req.auth.role === "super_admin") return true;
  return req.auth.permissions.includes(permission);
}

/**
 * Rejects with 403 AND records the denial in user_activity_logs — same
 * behaviour as the requirePermission middleware, usable inside a handler.
 */
export function denyWithAudit(req: AuthenticatedRequest, res: Response, permission: string): void {
  if (req.auth) logDenied(req.auth.userId, req.auth.role, permission, req.ip).catch(() => {});
  res.status(403).json({ message: "Permission insuffisante.", required: permission });
}

async function logDenied(
  userId: string,
  role: string,
  permission: string,
  ip?: string,
): Promise<void> {
  try {
    const { rows } = await pool.query<{ first_name: string; last_name: string }>(
      `SELECT first_name, last_name FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    const name = rows[0] ? `${rows[0].first_name} ${rows[0].last_name}` : userId;

    // `module` est un enum source_module — cast explicite requis, et tous les
    // préfixes de permission n'y existent pas (ex. appointments, patients) :
    // on retombe sur 'system' quand le label n'existe pas. La permission
    // complète reste dans la description.
    await pool.query(
      `INSERT INTO user_activity_logs
         (user_id, user_name, user_role, action, module, description, ip)
       SELECT $1, $2, $3,
         'access_denied'::user_activity_action,
         CASE WHEN EXISTS (
                SELECT 1 FROM pg_enum
                WHERE enumtypid = 'source_module'::regtype
                  AND enumlabel = split_part($4, '.', 1)
              )
              THEN split_part($4, '.', 1)::source_module
              ELSE 'system'::source_module END,
         'Accès refusé : permission manquante ' || $4,
         $5
       WHERE EXISTS (
         SELECT 1 FROM pg_enum
         WHERE enumtypid = 'user_activity_action'::regtype
           AND enumlabel = 'access_denied'
       )`,
      [userId, name, role, permission, ip ?? null],
    );
  } catch {
    // Never block the 403 response for a logging failure
  }
}
