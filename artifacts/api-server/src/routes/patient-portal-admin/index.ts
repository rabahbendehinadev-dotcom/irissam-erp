/**
 * Patient Portal Admin router — staff-facing management endpoints.
 * All routes under /api/patient-portal-admin require staff auth (requireAuth).
 */
import { Router } from "express";
import publishRouter  from "./publish.js";
import accountsRouter from "./accounts.js";

const router = Router();

// Publish / unpublish clinical records
router.use("/", publishRouter);

// Portal account management + Patient Detail tab
router.use("/accounts", accountsRouter);

export default router;
