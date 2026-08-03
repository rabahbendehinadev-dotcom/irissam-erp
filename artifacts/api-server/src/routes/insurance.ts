/**
 * /api/insurance — Insurance / Tiers Payant / CNAS / CASNOS module
 *
 * This file is the hub router. Sub-routers handle each domain area.
 *
 * Registered routes:
 *   /insurance/organizations          — insurance-orgs
 *   /insurance/plans                  — insurance-orgs
 *   /insurance/policies               — insurance-policies
 *   /insurance/coverage-requests      — insurance-coverage-requests
 *   /insurance/claims                 — insurance-claims
 *   /insurance/bordereaux             — insurance-bordereaux
 *   /insurance/payments               — insurance-payments
 *   /insurance/dashboard              — insurance-dashboard
 *   /insurance/reports                — insurance-dashboard
 */
import { Router } from "express";
import orgsRouter             from "./insurance-orgs";
import policiesRouter         from "./insurance-policies";
import coverageRequestsRouter from "./insurance-coverage-requests";
import claimsRouter           from "./insurance-claims";
import bordereauRouter        from "./insurance-bordereaux";
import paymentsRouter         from "./insurance-payments";
import dashboardRouter        from "./insurance-dashboard";

const router = Router();

router.use(orgsRouter);           // /organizations, /plans
router.use(policiesRouter);       // /policies
router.use(coverageRequestsRouter); // /coverage-requests
router.use(claimsRouter);         // /claims
router.use(bordereauRouter);      // /bordereaux
router.use(paymentsRouter);       // /payments
router.use(dashboardRouter);      // /dashboard, /reports

export default router;
