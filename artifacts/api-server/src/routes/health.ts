import { Router, type IRouter, type Request, type Response } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getMigrationStatus } from "../lib/startupState.js";

const router: IRouter = Router();

function healthHandler(_req: Request, res: Response): void {
  const status = getMigrationStatus();

  if (status === "pending") {
    // Migrations still running — tell the startup probe to keep retrying.
    res.status(503).json({ status: "migrating", message: "DB migrations in progress" });
    return;
  }

  if (status === "failed") {
    // Migrations failed — process will exit(1) shortly; surface it clearly.
    res.status(503).json({ status: "error", message: "DB migration failed" });
    return;
  }

  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
}

// /api/healthz — the path configured in artifact.toml
router.get("/healthz", healthHandler);

// /api — the artifact base path.
// The Replit startup probe actually hits this path (the artifact's paths[0])
// regardless of the configured health.startup.path, so we must handle it too.
router.get("/", healthHandler);

export default router;
