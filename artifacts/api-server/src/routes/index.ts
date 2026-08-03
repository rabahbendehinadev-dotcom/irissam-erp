import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import patientsRouter from "./patients";
import appointmentsRouter from "./appointments";
import alertsRouter from "./alerts";
import authRouter from "./auth";
import bedsRouter from "./beds";
import orRouter from "./or";
import bloodBankRouter from "./blood-bank";
import vehiclesRouter from "./vehicles";
import medicationsRouter from "./medications";
import consultationsRouter from "./consultations";
import admissionsRouter from "./admissions";
import encountersRouter from "./encounters";
import auditLogsRouter from "./audit-logs";
import labOrdersRouter from "./lab-orders";
import imagingOrdersRouter from "./imaging-orders";
import prescriptionsRouter from "./prescriptions";
import icuRouter              from "./icu";
import surgicalRequestsRouter from "./surgical-requests";
import operatingRoomsRouter   from "./operating-rooms";
import notificationsRouter    from "./notifications";
import occupancyBedsRouter    from "./occupancy-beds";
import emergencyRouter        from "./emergency";
import invoicesRouter         from "./invoices";
import paymentsRouter         from "./payments";
import insuranceRouter        from "./insurance";
import serviceCatalogRouter   from "./service-catalog";
import hrRouter                from "./hr/index";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requirePermission";

const router: IRouter = Router();

// Public routes
router.use(healthRouter);
router.use("/auth", authRouter);

// Protected routes — valid JWT required
router.use("/dashboard",     requireAuth, dashboardRouter);
router.use("/patients",      requireAuth, patientsRouter);
router.use("/appointments",  requireAuth, appointmentsRouter);
router.use("/alerts",        requireAuth, alertsRouter);
router.use("/beds",          requireAuth, bedsRouter);
router.use("/or",            requireAuth, orRouter);
router.use("/blood-bank",    requireAuth, bloodBankRouter);
router.use("/vehicles",      requireAuth, vehiclesRouter);
router.use("/medications",   requireAuth, medicationsRouter);
router.use("/consultations", requireAuth, consultationsRouter);
router.use("/admissions",    requireAuth, admissionsRouter);
router.use("/encounters",    requireAuth, encountersRouter);
router.use("/audit-logs",    requireAuth, auditLogsRouter);
// Clinical order routes
router.use("/lab-orders",      requireAuth, labOrdersRouter);
router.use("/imaging-orders",  requireAuth, imagingOrdersRouter);
router.use("/prescriptions",   requireAuth, prescriptionsRouter);
// Occupancy + ICU + Bloc + Notifications
router.use("/occupancy-beds",      requireAuth, occupancyBedsRouter);
router.use("/icu",                 requireAuth, icuRouter);
router.use("/surgical-requests",   requireAuth, surgicalRequestsRouter);
router.use("/operating-rooms",     requireAuth, operatingRoomsRouter);
// Emergency department
router.use("/emergencies",         requireAuth, emergencyRouter);
// Billing
router.use("/invoices",            requireAuth, invoicesRouter);
router.use("/payments",            requireAuth, paymentsRouter);
router.use("/insurance",           requireAuth, insuranceRouter);
router.use("/service-catalog",     requireAuth, serviceCatalogRouter);
// HR module
router.use("/hr",                  requireAuth, hrRouter);
// Notifications — stream does NOT require auth (SSE reconnects can't set headers)
router.use("/notifications",       notificationsRouter);

export default router;
