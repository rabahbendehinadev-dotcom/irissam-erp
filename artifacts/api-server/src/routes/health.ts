import { Router, type IRouter, type Request, type Response } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getMigrationStatus } from "../lib/startupState.js";

const router: IRouter = Router();

router.get("/healthz", (_req: Request, res: Response) => {
  const status = getMigrationStatus();

  if (status === "pending") {
    // Migrations still running — tell the startup probe to retry.
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
});

export default router;
