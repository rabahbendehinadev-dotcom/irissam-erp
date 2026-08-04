/**
 * startupGuard middleware — unit tests for the four required scenarios.
 *
 * We mock startupState so we can force each status without waiting for
 * actual migrations, then assert the correct HTTP status and body.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

// ── mock the state module before importing the middleware ─────────────────────
let _mockStatus: "pending" | "done" | "failed" = "pending";

vi.mock("../../lib/startupState.js", () => ({
  getMigrationStatus: () => _mockStatus,
}));

// Import AFTER mock is registered
const { startupGuard } = await import("../startupGuard.js");

// ── helpers ───────────────────────────────────────────────────────────────────
function buildApp(): Express {
  const app = express();
  app.use(startupGuard);
  // Simulate a real API route
  app.get("/api/patients", (_req, res) => res.json({ data: [] }));
  app.get("/api/healthz", (_req, res) => res.json({ status: "ok" }));
  app.get("/api", (_req, res) => res.json({ status: "ok" }));
  return app;
}

// ── tests ─────────────────────────────────────────────────────────────────────
describe("startupGuard middleware", () => {
  let app: Express;

  beforeEach(() => {
    app = buildApp();
  });

  // Scenario 1 — pending: protected route blocked
  it("pending → /api/patients returns 503 SYSTEM_STARTING", async () => {
    _mockStatus = "pending";
    const res = await request(app).get("/api/patients");
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("SYSTEM_STARTING");
    expect(res.body.message).toContain("Initialisation");
  });

  // Scenario 2 — pending: health routes still allowed
  it("pending → /api/healthz passes through (503 handled by health.ts, not guard)", async () => {
    _mockStatus = "pending";
    const res = await request(app).get("/api/healthz");
    // Guard lets it through → our stub handler returns 200
    expect(res.status).toBe(200);
  });

  it("pending → /api (base path) passes through", async () => {
    _mockStatus = "pending";
    const res = await request(app).get("/api");
    expect(res.status).toBe(200);
  });

  // Scenario 3 — done: all routes open
  it("done → /api/patients returns 200", async () => {
    _mockStatus = "done";
    const res = await request(app).get("/api/patients");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
  });

  it("done → /api/healthz returns 200", async () => {
    _mockStatus = "done";
    const res = await request(app).get("/api/healthz");
    expect(res.status).toBe(200);
  });

  // Scenario 4 — failed: protected routes blocked; health passes through
  it("failed → /api/patients returns 503 MIGRATION_FAILED", async () => {
    _mockStatus = "failed";
    const res = await request(app).get("/api/patients");
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("MIGRATION_FAILED");
    expect(res.body.message).toContain("Échec");
  });

  it("failed → /api/healthz passes through (health.ts surfaces migration_failed)", async () => {
    _mockStatus = "failed";
    const res = await request(app).get("/api/healthz");
    // Guard lets it through → our stub returns 200 (real health.ts returns 503)
    expect(res.status).toBe(200);
  });

  it("failed → /api (base path) passes through", async () => {
    _mockStatus = "failed";
    const res = await request(app).get("/api");
    expect(res.status).toBe(200);
  });
});
