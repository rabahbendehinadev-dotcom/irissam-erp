import type { Response, NextFunction } from "express";
import { pool } from "@workspace/db";
import type { AuthenticatedRequest } from "./requireAuth.js";

interface MaintenanceConfig {
  enabled: boolean;
  message: string;
  messageAr: string;
  messageEn: string;
  allowedRoles: string[];
  allowedIps: string[];
  fetchedAt: number;
}

let cache: MaintenanceConfig | null = null;
const CACHE_TTL_MS = 30_000; // 30 seconds
// Verrouillage demandé par le propriétaire : aucun compte ne doit pouvoir
// entrer avant sa demande explicite de réouverture.
const FORCE_MAINTENANCE = true;
const FORCED_MAINTENANCE: Omit<MaintenanceConfig, "fetchedAt"> = {
  enabled: true,
  message: "Maintenance en cours. Veuillez réessayer ultérieurement.",
  messageAr: "النظام في وضع الصيانة. يرجى المحاولة لاحقاً.",
  messageEn: "System is under maintenance. Please try again later.",
  allowedRoles: [],
  allowedIps: [],
};

export function invalidateMaintenanceCache(): void {
  cache = null;
}

export async function getMaintenanceConfig(): Promise<MaintenanceConfig | null> {
  if (FORCE_MAINTENANCE) {
    return { ...FORCED_MAINTENANCE, fetchedAt: Date.now() };
  }

  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache;
  try {
    const { rows } = await pool.query<{
      enabled: boolean;
      message: string;
      message_ar: string;
      message_en: string;
      allowed_roles: string[];
      allowed_ips: string[];
    }>("SELECT enabled, message, message_ar, message_en, allowed_roles, allowed_ips FROM system_maintenance LIMIT 1");
    if (rows[0]) {
      cache = {
        enabled:      rows[0].enabled,
        message:      rows[0].message,
        messageAr:    rows[0].message_ar,
        messageEn:    rows[0].message_en,
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
 * When system_maintenance.enabled = true, every application request receives
 * HTTP 503. Health checks remain available so the service can be monitored.
 * Authentication endpoints are exempt here so they can return the maintenance
 * response themselves (including the public login status endpoint).
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

      res.status(503).json({
        code:    "SYSTEM_MAINTENANCE",
        message: config.message,
        message_ar: config.messageAr,
        message_en: config.messageEn,
      });
    })
    .catch(() => next()); // Never block requests on cache/DB errors
}
