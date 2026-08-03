/**
 * Auto-migration runner — called once at server startup.
 *
 * Reads SQL files from lib/db/migrations/, checks the __migrations tracking
 * table, and applies any that have not yet been run.  Idempotent: already-
 * applied migrations are skipped.  The server exits (process.exit(1)) if any
 * migration fails so the deployment surface is obvious in logs.
 *
 * Path resolution:
 *   The compiled bundle lives at  artifacts/api-server/dist/index.mjs
 *   → __dirname resolves to      <repo-root>/artifacts/api-server/dist/
 *   → migrations are at          <repo-root>/lib/db/migrations/
 *   → relative path              ../../../lib/db/migrations
 */

import fs   from "node:fs";
import path from "node:path";
import { pool } from "@workspace/db";
import { logger } from "./logger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PoolClient = any;

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../lib/db/migrations");

const MIGRATIONS = [
  "001_clinical_schema.sql",
  "002_seed_indexes.sql",
  "003_schema_additions.sql",
  "004_auth_rbac.sql",
  "005_rbac_seed.sql",
  "006_fix_legacy_constraints.sql",
  "007_safe_uuid_migration.sql",
  "008_billing_extension.sql",
  "009_billing_hardening.sql",
  "010_insurance_module.sql",
  "011_insurance_permissions.sql",
  "012_overpayment_constraints.sql",
  "013_hr_module.sql",
  "014_hr_permissions.sql",
  "015_medical_stock.sql",
  "016_medical_stock_permissions.sql",
  "017_biomedical.sql",
  "018_biomedical_permissions.sql",
  "019_quality_module.sql",
  "020_quality_permissions.sql",
  "021_executive_dashboard.sql",
];

async function ensureTrackingTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS __migrations (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      duration_ms INTEGER
    );
  `);
}

async function appliedSet(client: PoolClient): Promise<Set<string>> {
  const { rows } = await client.query(
    "SELECT name FROM __migrations ORDER BY id",
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Set(rows.map((r: any) => r.name as string));
}

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await ensureTrackingTable(client);
    const applied = await appliedSet(client);

    logger.info({ count: applied.size }, "Migrations already applied");

    for (const name of MIGRATIONS) {
      if (applied.has(name)) {
        logger.debug({ migration: name }, "skipped (already applied)");
        continue;
      }

      const filePath = path.join(MIGRATIONS_DIR, name);
      if (!fs.existsSync(filePath)) {
        logger.warn({ migration: name, path: filePath }, "migration file not found — skipping");
        continue;
      }

      const sql = fs.readFileSync(filePath, "utf8");
      const start = Date.now();
      logger.info({ migration: name }, "applying …");

      try {
        await client.query(sql);
        const ms = Date.now() - start;
        await client.query(
          "INSERT INTO __migrations(name, duration_ms) VALUES($1, $2) ON CONFLICT (name) DO NOTHING",
          [name, ms],
        );
        logger.info({ migration: name, ms }, "applied ✓");
      } catch (err) {
        logger.error({ migration: name, err }, "migration FAILED — aborting startup");
        // Best-effort rollback in case the SQL left an open transaction
        try { await client.query("ROLLBACK"); } catch (_) { /* ignore */ }
        throw err; // propagates to index.ts → process.exit(1)
      }
    }

    logger.info("All migrations up to date");
  } finally {
    client.release();
  }
}
