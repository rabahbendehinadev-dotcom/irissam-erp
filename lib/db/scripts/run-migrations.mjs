/**
 * Safe migration runner for IRISSAM Hospital ERP.
 *
 * Strategy:
 *  1. Create __migrations tracking table if absent.
 *  2. For each migration file — skip if already applied.
 *  3. Apply in a single BEGIN…COMMIT transaction (auto-ROLLBACK on error).
 *  4. Record in __migrations on success.
 *
 * Usage: node lib/db/scripts/run-migrations.mjs
 */

import pg from "pg";
import fs  from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "../migrations");

const MIGRATIONS = [
  "001_clinical_schema.sql",
  "002_seed_indexes.sql",
  "003_schema_additions.sql",
];

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function ensureTrackingTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS __migrations (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      duration_ms INTEGER
    );
  `);
}

async function appliedMigrations(client) {
  const { rows } = await client.query(
    "SELECT name FROM __migrations ORDER BY id",
  );
  return new Set(rows.map((r) => r.name));
}

async function applyMigration(client, name, sql) {
  const start = Date.now();
  console.log(`\n▶  Applying ${name} …`);
  try {
    // The SQL files already contain BEGIN/COMMIT — execute as-is
    await client.query(sql);
    const ms = Date.now() - start;
    await client.query(
      "INSERT INTO __migrations(name, duration_ms) VALUES($1, $2) ON CONFLICT (name) DO NOTHING",
      [name, ms],
    );
    console.log(`✅  ${name} — done in ${ms}ms`);
    return true;
  } catch (err) {
    console.error(`❌  ${name} FAILED: ${err.message}`);
    // Try to roll back if the migration left an open transaction
    try { await client.query("ROLLBACK"); } catch (_) {}
    return false;
  }
}

async function main() {
  const client = await pool.connect();
  try {
    // 1. Ensure tracking table
    await ensureTrackingTable(client);

    // 2. Which are already applied?
    const applied = await appliedMigrations(client);
    console.log("Already applied:", applied.size ? [...applied].join(", ") : "(none)");

    // 3. Apply pending migrations
    let anyFailed = false;
    for (const name of MIGRATIONS) {
      if (applied.has(name)) {
        console.log(`⏭  ${name} — already applied, skipping`);
        continue;
      }
      const filePath = path.join(MIGRATIONS_DIR, name);
      const sql = fs.readFileSync(filePath, "utf8");
      const ok = await applyMigration(client, name, sql);
      if (!ok) {
        anyFailed = true;
        break; // stop on first failure
      }
    }

    if (anyFailed) {
      console.error("\n💥  Migration run stopped due to error.");
      process.exit(1);
    }

    // 4. Summary
    const finalApplied = await appliedMigrations(client);
    console.log("\n📋  Migration tracking table contents:");
    const { rows } = await client.query("SELECT * FROM __migrations ORDER BY id");
    rows.forEach((r) =>
      console.log(`  [${r.id}] ${r.name}  (${r.duration_ms}ms)  applied: ${r.applied_at}`),
    );
    console.log("\n✅  All migrations complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
