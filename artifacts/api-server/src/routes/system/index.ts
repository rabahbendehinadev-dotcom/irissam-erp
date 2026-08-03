import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import stepUpRouter from "./step-up-auth.js";
import healthRouter from "./health.js";
import databaseRouter from "./database.js";
import migrationsRouter from "./migrations.js";
import backupsRouter from "./backups.js";
import jobsRouter from "./jobs.js";
import logsRouter from "./logs.js";
import auditRouter from "./audit.js";
import sessionsRouter from "./sessions.js";
import securityRouter from "./security.js";
import apiKeysRouter from "./api-keys.js";
import webhooksRouter from "./webhooks.js";
import integrationsRouter from "./integrations.js";
import featureFlagsRouter from "./feature-flags.js";
import maintenanceRouter from "./maintenance.js";
import versionRouter from "./version.js";
import settingsRouter from "./settings.js";
import releaseNotesRouter from "./release-notes.js";
import rateLimitsRouter from "./rate-limits.js";

const router = Router();

// step-up auth has its own requireAuth
router.use(stepUpRouter);

// All other routes require auth at this level
router.use(requireAuth);

router.use("/health", healthRouter);
router.use("/database", databaseRouter);
router.use("/migrations", migrationsRouter);
router.use("/backups", backupsRouter);
router.use("/jobs", jobsRouter);
router.use("/logs", logsRouter);
router.use("/audit", auditRouter);
router.use("/sessions", sessionsRouter);
router.use("/security", securityRouter);
router.use("/api-keys", apiKeysRouter);
router.use("/webhooks", webhooksRouter);
router.use("/integrations", integrationsRouter);
router.use("/feature-flags", featureFlagsRouter);
router.use("/maintenance", maintenanceRouter);
router.use("/version", versionRouter);
router.use("/settings", settingsRouter);
router.use("/release-notes", releaseNotesRouter);
router.use("/rate-limits", rateLimitsRouter);

export default router;
