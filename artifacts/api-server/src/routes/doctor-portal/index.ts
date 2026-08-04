/**
 * Doctor Portal router — /api/doctor-portal/*
 *
 * Global guard: requireAuth + doctor_portal.access permission.
 * Individual sub-routes add their own fine-grained permission checks.
 *
 * Data scoping: every query is filtered to the requesting doctor's own patients
 * (appointment / encounter / admission / emergency assignment).
 */
import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";

import dashboardRouter     from "./dashboard.js";
import agendaRouter        from "./agenda.js";
import patientsRouter      from "./patients.js";
import consultationsRouter from "./consultations.js";
import labOrdersRouter     from "./lab-orders.js";
import imagingOrdersRouter from "./imaging-orders.js";
import prescriptionsRouter from "./prescriptions.js";
import resultsRouter       from "./results.js";
import hospitalizedRouter  from "./hospitalized.js";
import emergenciesRouter   from "./emergencies.js";
import clinicalNotesRouter from "./clinical-notes.js";
import tasksRouter         from "./tasks.js";
import messagesRouter      from "./messages.js";
import profileRouter       from "./profile.js";

const router = Router();

// Every request to /api/doctor-portal/* must be authenticated
// and must have the doctor_portal.access permission.
router.use(requireAuth);
router.use(requirePermission("doctor_portal.access"));

router.use("/dashboard",      dashboardRouter);
router.use("/agenda",         agendaRouter);
router.use("/patients",       patientsRouter);
router.use("/consultations",  consultationsRouter);
router.use("/lab-orders",     labOrdersRouter);
router.use("/imaging-orders", imagingOrdersRouter);
router.use("/prescriptions",  prescriptionsRouter);
router.use("/results",        resultsRouter);
router.use("/hospitalized",   hospitalizedRouter);
router.use("/emergencies",    emergenciesRouter);
router.use("/clinical-notes", clinicalNotesRouter);
router.use("/tasks",          tasksRouter);
router.use("/messages",       messagesRouter);
router.use("/profile",        profileRouter);

export default router;
