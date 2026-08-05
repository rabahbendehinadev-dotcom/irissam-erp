import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { startupGuard } from "./middleware/startupGuard.js";

const app: Express = express();

// Trust proxy headers forwarded by Traefik / nginx
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const corsOrigin = process.env["CORS_ORIGIN"];
app.use(
  cors(
    corsOrigin && corsOrigin !== "*"
      ? { origin: corsOrigin, credentials: true }
      : { origin: true, credentials: true },
  ),
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Block all API routes while migrations are pending or failed.
// /api and /api/healthz are always allowed so the startup probe can reach them.
app.use(startupGuard);

// ── JSON API ──────────────────────────────────────────────────────────────────
app.use("/api", router);

// ── Static frontend assets (production single-container only) ─────────────────
//
// Path resolution:
//   The esbuild bundle lives at: <workspace>/artifacts/api-server/dist/index.mjs
//   public/ lives at:            <workspace>/public/
//   → 3 directory levels up from the bundle file.
//
// Override via STATIC_ROOT env var if needed (e.g. custom VPS layout).
//
// In Replit dev mode these directories don't exist → section is silently skipped.
//
const _bundleDir = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_ROOT =
  process.env["STATIC_ROOT"] ?? path.resolve(_bundleDir, "..", "..", "..", "public");
const ERP_DIST    = path.join(PUBLIC_ROOT, "erp");
const PORTAL_DIST = path.join(PUBLIC_ROOT, "portal");

// Hashed asset filenames (e.g. main-Abc1De2f.js) are immutable — cache 1 year.
// Non-hashed files (index.html, favicon…) must never be cached by the browser.
function staticOpts(dist: string): Parameters<typeof express.static>[1] {
  return {
    index: false,
    setHeaders(res, filePath) {
      // Vite outputs hashed JS/CSS/font chunks — safe to cache indefinitely
      if (/\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(js|css|woff2?|ttf|eot|svg|png|jpg|webp)$/
            .test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else {
        // index.html and anything else: always revalidate
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      }
    },
  };
}

if (fs.existsSync(PORTAL_DIST)) {
  // Patient Portal at /patient-portal/
  // Asset URLs baked by Vite: /patient-portal/assets/main.js → served from PORTAL_DIST/assets/
  app.use("/patient-portal", express.static(PORTAL_DIST, staticOpts(PORTAL_DIST)));

  // SPA fallback: /patient-portal/any-react-route → portal index.html
  app.use("/patient-portal", (_req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.sendFile(path.join(PORTAL_DIST, "index.html"));
  });

  logger.info({ dir: PORTAL_DIST }, "Serving patient portal static assets");
}

if (fs.existsSync(ERP_DIST)) {
  // Main ERP at /
  // Asset URLs baked by Vite: /assets/main.js → served from ERP_DIST/assets/
  app.use(express.static(ERP_DIST, staticOpts(ERP_DIST)));

  // SPA catch-all: every unmatched route → ERP index.html
  // /api and /patient-portal are already handled above; this only fires for remainder
  app.use((_req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.sendFile(path.join(ERP_DIST, "index.html"));
  });

  logger.info({ dir: ERP_DIST }, "Serving ERP static assets");
}

export default app;
