import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "./lib/migrations";
import { setMigrationDone, setMigrationFailed } from "./lib/startupState.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Start listening immediately so the port opens and the startup probe can
// reach /api and /api/healthz.  While migrations are running the startupGuard
// middleware blocks every other route with 503 SYSTEM_STARTING, and the health
// endpoints return 503 migrating.  The Replit probe retries until it gets 200.
app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening — running DB migrations in background");
});

// Run migrations after the server is already accepting connections.
runMigrations()
  .then(() => {
    setMigrationDone();
    logger.info("Migrations complete — all routes open");
  })
  .catch((err) => {
    setMigrationFailed();
    // Do NOT exit — keep the process alive so /api/healthz surfaces the error
    // and operators can read logs without a crash loop.
    logger.error(
      { err },
      "Migration failed — service is degraded; all routes blocked except health",
    );
  });
