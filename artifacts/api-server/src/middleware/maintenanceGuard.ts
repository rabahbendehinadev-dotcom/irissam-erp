import type { Response, NextFunction } from "express";
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
 * Maintenance-mode guard.
 * When system_maintenance.enabled = true, non-allowed users receive HTTP 503.
 * Always allows: /auth/* endpoints, /healthz, /system/health.
 */
export function maintenanceGuard(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  // Always pass through exempt paths
  const path = req.path;
  const isExempt =
    path.startsWith("/auth") ||
    path === "/healthz" ||
    path.startsWith("/system/health");

  if (isExempt) { next(); return; }

  getMaintenanceConfig()
    .then((config) => {
      if (!config?.enabled) { next(); return; }

      const role = req.auth?.role ?? "";
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
