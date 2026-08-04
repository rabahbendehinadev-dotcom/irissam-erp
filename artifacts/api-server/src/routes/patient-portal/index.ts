/**
 * Patient Portal — Main Router
 * Mounted at /patient-portal
 *
 * Auth routes are public (no JWT required — they issue tokens).
 * All other routes require requirePatientAuth.
 */
import { Router } from "express";
import authRouter             from "./auth.js";
import dashboardRouter        from "./dashboard.js";
import profileRouter          from "./profile.js";
import appointmentsRouter     from "./appointments.js";
import apptRequestsRouter     from "./appointment-requests.js";
import labResultsRouter       from "./lab-results.js";
import imagingRouter          from "./imaging.js";
import prescriptionsRouter    from "./prescriptions.js";
import documentsRouter        from "./documents.js";
import invoicesRouter         from "./invoices.js";
import paymentsRouter         from "./payments.js";
import insuranceRouter        from "./insurance.js";
import hospitalizationsRouter from "./hospitalizations.js";
import notificationsRouter    from "./notifications.js";
import messagesRouter         from "./messages.js";
import consentsRouter         from "./consents.js";
import sessionsRouter         from "./sessions.js";
import privacyRouter          from "./privacy.js";

const router = Router();

// ── Auth (public) ──────────────────────────────────────────────────────────────
router.use("/auth", authRouter);

// ── Patient-authenticated routes ───────────────────────────────────────────────
router.use("/dashboard",             dashboardRouter);
router.use("/profile",               profileRouter);
router.use("/appointments",          appointmentsRouter);
router.use("/appointment-requests",  apptRequestsRouter);
router.use("/lab-results",           labResultsRouter);
router.use("/imaging",               imagingRouter);
router.use("/prescriptions",         prescriptionsRouter);
router.use("/documents",             documentsRouter);
router.use("/invoices",              invoicesRouter);
router.use("/payments",              paymentsRouter);
router.use("/insurance",             insuranceRouter);
router.use("/hospitalizations",      hospitalizationsRouter);
router.use("/notifications",         notificationsRouter);
router.use("/messages",              messagesRouter);
router.use("/consents",              consentsRouter);
router.use("/sessions",              sessionsRouter);
router.use("/privacy",               privacyRouter);

export default router;
