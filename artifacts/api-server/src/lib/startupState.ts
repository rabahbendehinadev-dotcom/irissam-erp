/**
 * Shared startup state — lets the health check and the startupGuard middleware
 * reflect whether DB migrations have completed without blocking app.listen().
 *
 * Lifecycle:
 *   1. app.listen() is called immediately so the port opens fast.
 *   2. runMigrations() runs in the background.
 *   3. While pending: /api and /api/healthz respond (503 migrating);
 *      every other route is blocked with 503 SYSTEM_STARTING.
 *   4. On success: status → "done", all routes open normally.
 *   5. On failure: status → "failed", service stays alive so the health
 *      check surfaces the error — NO process.exit(1).
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
