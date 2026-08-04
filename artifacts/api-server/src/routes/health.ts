import { Router, type IRouter, type Request, type Response } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getMigrationStatus } from "../lib/startupState.js";

const router: IRouter = Router();

function healthHandler(_req: Request, res: Response): void {
  const status = getMigrationStatus();

  if (status === "pending") {
    res.status(503).json({
      status: "migrating",
      code: "SYSTEM_STARTING",
      message: "Initialisation de la base de données en cours.",
    });
    return;
  }

  if (status === "failed") {
    res.status(503).json({
      status: "migration_failed",
      code: "MIGRATION_FAILED",
      message:
        "Échec de l'initialisation de la base de données. Le service est dégradé.",
    });
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
