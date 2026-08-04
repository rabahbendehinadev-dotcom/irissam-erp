import type { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { pool } from "@workspace/db";
import type { AuthenticatedRequest } from "./requireAuth.js";

interface MaintenanceConfig {
  enabled: boolean;
  message: string;
  allowedRoles: string[];
  allowedIps: string[];
  fetchedAt: number;
}

let cache: MaintenanceConfig | null = null;
const CACHE_TTL_MS = 30_000; // 30 seconds

export function invalidateMaintenanceCache(): void {
  cache = null;
}

async function getMaintenanceConfig(): Promise<MaintenanceConfig | null> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache;
  try {
    const { rows } = await pool.query<{
      enabled: boolean;
      message: string;
      allowed_roles: string[];
      allowed_ips: string[];
    }>("SELECT enabled, message, allowed_roles, allowed_ips FROM system_maintenance LIMIT 1");
    if (rows[0]) {
      cache = {
        enabled:      rows[0].enabled,
        message:      rows[0].message,
        allowedRoles: rows[0].allowed_roles ?? [],
        allowedIps:   rows[0].allowed_ips   ?? [],
        fetchedAt:    Date.now(),
      };
      return cache;
    }
  } catch {
    // Table may not exist yet during startup migrations
  }
  return null;
}

/**
 * Decode the JWT from the Authorization header without full middleware overhead.
 * Returns the role claim, or empty string if absent/invalid.
 * Full verification is still done later by requireAuth.
 */
function getRoleFromToken(req: AuthenticatedRequest): string {
  // If requireAuth has already run (req.auth populated), use that.
  if (req.auth?.role) return req.auth.role;

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return "";

  const token = authHeader.slice(7);
  const secret = process.env.SESSION_SECRET;
  if (!secret) return "";

  try {
    const payload = jwt.verify(token, secret) as { role?: string };
    return payload.role ?? "";
  } catch {
    // Expired/invalid token — still block during maintenance
    return "";
  }
}

/**
 * Maintenance-mode guard.
 * When system_maintenance.enabled = true, non-allowed users receive HTTP 503.
 * Always allows: /auth/* endpoints, /healthz, /system/health.
 * Allowed roles (e.g. super_admin) bypass maintenance even for other paths.
 */
export function maintenanceGuard(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  // Always pass through exempt paths.
  // When used as global middleware, req.path is the full path e.g. "/patients", "/system/health".
  const path = req.path;
  const isExempt =
    path.startsWith("/auth") ||
    path === "/healthz" ||
    path.startsWith("/health") ||        // health router at root
    path.startsWith("/system/health");   // also catches sub-router path

  if (isExempt) { next(); return; }

  getMaintenanceConfig()
    .then((config) => {
      if (!config?.enabled) { next(); return; }

      const role = getRoleFromToken(req);
      const ip   = (req.ip ?? "").replace("::ffff:", "");

      if (config.allowedRoles.includes(role) || config.allowedIps.includes(ip)) {
        next();
        return;
      }

      res.status(503).json({
        code:    "SYSTEM_MAINTENANCE",
        message: config.message,
      });
    })
    .catch(() => next()); // Never block requests on cache/DB errors
}
