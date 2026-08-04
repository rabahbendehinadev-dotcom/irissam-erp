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

// Start listening immediately so the port opens and the startup probe
// can reach /api/healthz.  While migrations are running the health
// endpoint returns 503 (Replit retries until it gets 200).
app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening — running DB migrations in background");
});

// Run migrations after the server is already accepting connections.
// /api/healthz returns 503 until setMigrationDone() is called.
runMigrations()
  .then(() => {
    setMigrationDone();
    logger.info("Migrations complete — server is fully ready");
  })
  .catch((err) => {
    setMigrationFailed();
    logger.error({ err }, "Migration failed — server degraded, exiting");
    // Give the health check one cycle to surface the error before dying.
    setTimeout(() => process.exit(1), 2000);
  });
