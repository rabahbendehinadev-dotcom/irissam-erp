import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";

const router = Router();

type HealthStatus = "healthy" | "degraded" | "down" | "unknown";

interface HealthResult {
  status: HealthStatus;
  checkedAt: string;
  responseTime: number;
  message?: string;
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  [key: string]: unknown;
}

async function checkDatabase(): Promise<HealthResult> {
  const start = Date.now();
  try {
    await pool.query("SELECT 1");
    const { rows } = await pool.query<{ count: string }>(
      "SELECT count(*) FROM pg_stat_activity WHERE state = 'active'",
    );
    return {
      status:       "healthy",
      checkedAt:    new Date().toISOString(),
      responseTime: Date.now() - start,
      activeConnections: parseInt(rows[0]?.count ?? "0"),
    };
  } catch (e) {
    return {
      status:       "down",
      checkedAt:    new Date().toISOString(),
      responseTime: Date.now() - start,
      message:      "Database unreachable",
    };
  }
}

async function checkStorage(): Promise<HealthResult> {
  const start   = Date.now();
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  return {
    status:       bucketId ? "healthy" : "degraded",
    checkedAt:    new Date().toISOString(),
    responseTime: Date.now() - start,
    configured:   !!bucketId,
    message:      bucketId ? "Object storage configured" : "OBJECT_STORAGE_BUCKET_ID not set",
  };
}

async function checkNotifications(): Promise<HealthResult> {
  const start = Date.now();
  try {
    const { rows } = await pool.query<{ count: string }>(
      "SELECT count(*) FROM system_jobs WHERE type = 'notification' AND status IN ('pending','running')",
    );
    const pending = parseInt(rows[0]?.count ?? "0");
    return {
      status:       "healthy",
      checkedAt:    new Date().toISOString(),
      responseTime: Date.now() - start,
      pendingJobs:  pending,
    };
  } catch {
    return { status: "unknown", checkedAt: new Date().toISOString(), responseTime: Date.now() - start };
  }
}

async function checkEmail(): Promise<HealthResult> {
  const start = Date.now();
  try {
    const { rows } = await pool.query<{ configured: boolean; last_test_at: Date | null }>(
      "SELECT configured, last_test_at FROM system_integrations WHERE type = 'smtp' LIMIT 1",
    );
    const row = rows[0];
    return {
      status:       row?.configured ? "healthy" : "degraded",
      checkedAt:    new Date().toISOString(),
      responseTime: Date.now() - start,
      configured:   !!row?.configured,
      lastTestAt:   row?.last_test_at?.toISOString() ?? null,
    };
  } catch {
    return { status: "unknown", checkedAt: new Date().toISOString(), responseTime: Date.now() - start };
  }
}

async function checkBackgroundJobs(): Promise<HealthResult> {
  const start = Date.now();
  try {
    const { rows } = await pool.query<{ status: string; count: string }>(
      "SELECT status, count(*)::int as count FROM system_jobs GROUP BY status",
    );
    const byStatus: Record<string, number> = {};
    for (const r of rows) byStatus[r.status] = parseInt(r.count);
    const failed24h = byStatus.failed ?? 0;
    return {
      status:       failed24h > 10 ? "degraded" : "healthy",
      checkedAt:    new Date().toISOString(),
      responseTime: Date.now() - start,
      pending:      byStatus.pending  ?? 0,
      running:      byStatus.running  ?? 0,
      failed24h,
      completed:    byStatus.completed ?? 0,
    };
  } catch {
    return { status: "unknown", checkedAt: new Date().toISOString(), responseTime: Date.now() - start };
  }
}

// ── GET /health — public basic health check ────────────────────────────────
router.get("/", (_req, res) => {
  res.json({ status: "healthy", checkedAt: new Date().toISOString(), service: "IRISSAM API" });
});

// ── GET /health/overview — aggregate overview ──────────────────────────────
router.get(
  "/overview",
  requireAuth,
  requirePermission("system.view"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const [db, storage, notif, email, jobs] = await Promise.allSettled([
        checkDatabase(),
        checkStorage(),
        checkNotifications(),
        checkEmail(),
        checkBackgroundJobs(),
      ]);

      const q = async (sql: string, params: unknown[] = []) => {
        try { return (await pool.query(sql, params)).rows; }
        catch { return []; }
      };

      const [sessions, pendingJobs, failedJobs, lastBackup, lastMig] = await Promise.all([
        q("SELECT count(DISTINCT user_id)::int as active_users, count(*)::int as active_sessions FROM user_sessions WHERE expires_at > now() AND revoked_at IS NULL"),
        q("SELECT count(*)::int as cnt FROM system_jobs WHERE status IN ('pending','running')"),
        q("SELECT count(*)::int as cnt FROM system_jobs WHERE status='failed' AND created_at > now()-interval '24 hours'"),
        q("SELECT max(completed_at) as last FROM system_backups WHERE status='completed'"),
        q("SELECT name FROM __migrations ORDER BY id DESC LIMIT 1"),
      ]);

      res.json({
        database:       db.status === "fulfilled" ? db.value : { status: "unknown" },
        storage:        storage.status === "fulfilled" ? storage.value : { status: "unknown" },
        notifications:  notif.status === "fulfilled" ? notif.value : { status: "unknown" },
        email:          email.status === "fulfilled" ? email.value : { status: "unknown" },
        backgroundJobs: jobs.status === "fulfilled" ? jobs.value : { status: "unknown" },
        activeUsers:    sessions[0]?.active_users    ?? 0,
        activeSessions: sessions[0]?.active_sessions ?? 0,
        pendingJobs:    pendingJobs[0]?.cnt           ?? 0,
        failedJobs24h:  failedJobs[0]?.cnt            ?? 0,
        lastBackup:     lastBackup[0]?.last ?? null,
        lastMigration:  lastMig[0]?.name   ?? null,
        systemVersion:  process.env.npm_package_version ?? "1.0.0",
        uptimeSeconds:  Math.floor(process.uptime()),
        checkedAt:      new Date().toISOString(),
      });
    } catch {
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

// ── GET /health/database ───────────────────────────────────────────────────
router.get("/database", requireAuth, requirePermission("system.health.view"), async (_req, res) => {
  res.json(await checkDatabase());
});

// ── GET /health/storage ────────────────────────────────────────────────────
router.get("/storage", requireAuth, requirePermission("system.health.view"), async (_req, res) => {
  res.json(await checkStorage());
});

// ── GET /health/notifications ──────────────────────────────────────────────
router.get("/notifications", requireAuth, requirePermission("system.health.view"), async (_req, res) => {
  res.json(await checkNotifications());
});

// ── GET /health/email ──────────────────────────────────────────────────────
router.get("/email", requireAuth, requirePermission("system.health.view"), async (_req, res) => {
  res.json(await checkEmail());
});

// ── GET /health/background-jobs ────────────────────────────────────────────
router.get("/background-jobs", requireAuth, requirePermission("system.health.view"), async (_req, res) => {
  res.json(await checkBackgroundJobs());
});

export default router;
