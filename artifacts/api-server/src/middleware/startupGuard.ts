/**
 * startupGuard — global middleware that gates all API routes based on the
 * current DB migration state.
 *
 * pending  → only /api and /api/healthz are allowed; every other route
 *            returns 503 SYSTEM_STARTING.
 * failed   → /api and /api/healthz pass through so health.ts can surface
 *            the error; every other route returns 503 MIGRATION_FAILED.
 * done     → all routes pass through normally.
 *
 * Mount this BEFORE app.use("/api", router) in app.ts.
 */

import type { Request, Response, NextFunction } from "express";
import { getMigrationStatus } from "../lib/startupState.js";
import { logger } from "../lib/logger.js";

/** Paths (at app level, full URL path) that are always allowed. */
const ALWAYS_ALLOWED = new Set(["/api", "/api/healthz"]);

export function startupGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const status = getMigrationStatus();

  // Fast path — server is fully ready.
  if (status === "done") {
    next();
    return;
  }

  const path = req.path; // full URL path at app level, e.g. "/api/patients"

  // Always let health-check routes through so the probe (and operators)
  // can observe the current state.
  if (ALWAYS_ALLOWED.has(path)) {
    next();
    return;
  }

  if (status === "pending") {
    logger.debug({ path }, "startupGuard: blocking route — migrations pending");
    res.status(503).json({
      code: "SYSTEM_STARTING",
      message: "Initialisation de la base de données en cours.",
    });
    return;
  }

  // status === "failed"
  logger.warn({ path }, "startupGuard: blocking route — migration failed");
  res.status(503).json({
    code: "MIGRATION_FAILED",
    message:
      "Échec de l'initialisation de la base de données. Le service est dégradé.",
  });
}
