/**
 * Shared startup state — lets the health check reflect whether
 * DB migrations have completed without blocking app.listen().
 *
 * Pattern:
 *   1. app.listen() is called immediately so the port opens fast.
 *   2. runMigrations() runs in parallel.
 *   3. /api/healthz returns 503 while migrating, 200 when ready.
 *      The Replit startup probe keeps retrying until it gets 200.
 *   4. On migration failure the process exits(1); the deployer
 *      reports the build as failed.
 */

export type MigrationStatus = "pending" | "done" | "failed";

let _status: MigrationStatus = "pending";

export function getMigrationStatus(): MigrationStatus {
  return _status;
}

export function setMigrationDone(): void {
  _status = "done";
}

export function setMigrationFailed(): void {
  _status = "failed";
}
