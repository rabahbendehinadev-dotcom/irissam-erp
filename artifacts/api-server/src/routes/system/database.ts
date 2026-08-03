import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { requireStepUp } from "../../middleware/requireStepUp.js";

const router = Router();

async function auditLog(userId: string, desc: string, ip?: string) {
  try {
    await pool.query(
      `INSERT INTO user_activity_logs (user_id, user_name, user_role, action, module, description, ip)
       SELECT $1, u.first_name||' '||u.last_name, u.role, 'view'::user_activity_action, 'system', $2, $3
       FROM users u WHERE u.id=$1`,
      [userId, desc, ip ?? null],
    );
  } catch { /* non-blocking */ }
}

// ── GET / — full DB stats bundle ────────────────────────────────────────────
router.get(
  "/",
  requireAuth,
  requirePermission("system.database.view"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const [version, size, connections, longQueries, tableSizes, migrationsApplied, vacuumInfo] =
        await Promise.all([
          pool.query<{ version: string }>("SELECT version()").then(r => r.rows[0]?.version ?? "unknown"),
          pool.query<{ size: string }>("SELECT pg_size_pretty(pg_database_size(current_database())) AS size")
            .then(r => r.rows[0]?.size ?? "unknown"),
          pool.query<{ state: string; count: string }>(
            "SELECT COALESCE(state,'idle') as state, count(*)::int as count FROM pg_stat_activity GROUP BY state",
          ).then(r => r.rows),
          pool.query<{ pid: number; usename: string; state: string; query_start: Date; duration: string; query_preview: string }>(
            `SELECT pid, COALESCE(usename,'unknown') as usename, COALESCE(state,'idle') as state,
                    query_start, age(now(), query_start)::text as duration,
                    LEFT(query, 200) as query_preview
             FROM pg_stat_activity
             WHERE state != 'idle'
               AND query_start IS NOT NULL
               AND query_start < now() - interval '30 seconds'
             ORDER BY query_start LIMIT 20`,
          ).then(r => r.rows),
          pool.query<{ relname: string; size: string; live_rows: number }>(
            `SELECT relname,
                    pg_size_pretty(pg_total_relation_size(quote_ident(relname))) AS size,
                    n_live_tup::int AS live_rows
             FROM pg_stat_user_tables
             ORDER BY pg_total_relation_size(quote_ident(relname)) DESC
             LIMIT 20`,
          ).then(r => r.rows),
          pool.query<{ count: string }>("SELECT count(*)::int as count FROM __migrations").then(r => r.rows[0]?.count ?? 0),
          pool.query<{ last_vacuum: Date; last_analyze: Date }>(
            "SELECT max(last_vacuum) as last_vacuum, max(last_analyze) as last_analyze FROM pg_stat_user_tables",
          ).then(r => r.rows[0]),
        ]);

      res.json({
        name:              process.env.PGDATABASE ?? "irissam",
        version,
        size,
        connections,
        longRunningQueries: longQueries,
        tableSizes,
        migrationsApplied,
        lastVacuum:        vacuumInfo?.last_vacuum  ?? null,
        lastAnalyze:       vacuumInfo?.last_analyze ?? null,
        checkedAt:         new Date().toISOString(),
      });
    } catch {
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

// ── GET /slow-queries ────────────────────────────────────────────────────────
router.get(
  "/slow-queries",
  requireAuth,
  requirePermission("system.database.view"),
  async (_req, res) => {
    try {
      const { rows } = await pool.query<{
        pid: number; usename: string; state: string; query_start: Date; duration: string; query_preview: string;
      }>(
        `SELECT pid, COALESCE(usename,'unknown') as usename, COALESCE(state,'active') as state,
                query_start, age(now(), query_start)::text as duration,
                LEFT(query, 200) as query_preview
         FROM pg_stat_activity
         WHERE state = 'active'
           AND query_start < now() - interval '5 seconds'
         ORDER BY query_start LIMIT 50`,
      );
      res.json({ queries: rows, checkedAt: new Date().toISOString() });
    } catch {
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

// ── GET /locks ───────────────────────────────────────────────────────────────
router.get(
  "/locks",
  requireAuth,
  requirePermission("system.database.view"),
  async (_req, res) => {
    try {
      const { rows } = await pool.query(
        "SELECT pid, locktype, mode, granted FROM pg_locks WHERE NOT granted LIMIT 20",
      );
      res.json({ locks: rows, checkedAt: new Date().toISOString() });
    } catch {
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

// ── POST /cancel-query ────────────────────────────────────────────────────────
router.post(
  "/cancel-query",
  requireAuth,
  requirePermission("system.database.manage"),
  requireStepUp,
  async (req: AuthenticatedRequest, res) => {
    const pid = parseInt(String(req.body?.pid ?? ""), 10);
    if (!pid || pid < 1) {
      res.status(400).json({ message: "PID invalide." });
      return;
    }
    try {
      const { rows } = await pool.query<{ pg_cancel_backend: boolean }>(
        "SELECT pg_cancel_backend($1::int)",
        [pid],
      );
      const cancelled = rows[0]?.pg_cancel_backend ?? false;
      await auditLog(req.auth!.userId, `Annulation de la requête PID ${pid} — résultat: ${cancelled}`, req.ip);
      res.json({ cancelled, pid });
    } catch {
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

// ── POST /analyze ─────────────────────────────────────────────────────────────
router.post(
  "/analyze",
  requireAuth,
  requirePermission("system.database.manage"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { rows } = await pool.query<{ schemaname: string; relname: string }>(
        `SELECT schemaname, relname FROM pg_stat_user_tables
         WHERE last_analyze < now() - interval '1 day' OR last_analyze IS NULL
         LIMIT 10`,
      );
      let analyzed = 0;
      for (const r of rows) {
        try {
          await pool.query(`ANALYZE ${r.schemaname}.${r.relname}`);
          analyzed++;
        } catch { /* skip tables that fail */ }
      }
      await auditLog(req.auth!.userId, `ANALYZE déclenché sur ${analyzed} table(s)`, req.ip);
      res.json({ analyzed, tables: rows.map(r => `${r.schemaname}.${r.relname}`) });
    } catch {
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

// ── GET /migrations ───────────────────────────────────────────────────────────
router.get(
  "/migrations",
  requireAuth,
  requirePermission("system.database.view"),
  async (_req, res) => {
    try {
      const { rows } = await pool.query<{ id: number; name: string; applied_at: Date; duration_ms: number }>(
        "SELECT id, name, applied_at, duration_ms FROM __migrations ORDER BY id",
      );
      res.json({ migrations: rows });
    } catch {
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

// ── GET /export ────────────────────────────────────────────────────────────────
router.get(
  "/export",
  requireAuth,
  requirePermission("system.database.view"),
  async (_req, res) => {
    try {
      const [size, connections, tableCount, migrationsApplied] = await Promise.all([
        pool.query("SELECT pg_size_pretty(pg_database_size(current_database())) AS size").then(r => r.rows[0]?.size),
        pool.query("SELECT count(*) FROM pg_stat_activity WHERE state = 'active'").then(r => r.rows[0]?.count),
        pool.query("SELECT count(*) FROM pg_stat_user_tables").then(r => r.rows[0]?.count),
        pool.query("SELECT count(*) FROM __migrations").then(r => r.rows[0]?.count),
      ]);
      res.json({
        exportedAt:    new Date().toISOString(),
        databaseSize:  size,
        activeConnections: connections,
        totalTables:   tableCount,
        migrationsApplied,
      });
    } catch {
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

export default router;
