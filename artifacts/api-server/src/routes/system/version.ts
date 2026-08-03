import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../../middleware/requireAuth.js";

const router = Router();

// GET /
router.get("/", requireAuth, async (_req, res) => {
  try {
    const lastMig = await pool.query(
      "SELECT name FROM __migrations ORDER BY id DESC LIMIT 1"
    );
    res.json({
      appVersion: process.env.npm_package_version ?? "1.0.0",
      buildId: process.env.BUILD_ID ?? "local",
      gitCommit: process.env.GIT_COMMIT ?? "unknown",
      buildDate: process.env.BUILD_DATE ?? new Date().toISOString(),
      apiVersion: "v1",
      environment: process.env.NODE_ENV ?? "development",
      lastMigration: lastMig.rows[0]?.name ?? "none",
      nodeVersion: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
    });
  } catch {
    res.status(500).json({ message: "Erreur lors de la récupération des informations de version." });
  }
});

export default router;
