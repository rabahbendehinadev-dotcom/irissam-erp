import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import patientsRouter from "./patients";
import appointmentsRouter from "./appointments";
import directoryRouter from "./directory";
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
import infrastructureRouter   from "./infrastructure";
import emergencyRouter        from "./emergency";
import invoicesRouter         from "./invoices";
import paymentsRouter         from "./payments";
import insuranceRouter        from "./insurance";
import serviceCatalogRouter   from "./service-catalog";
import hrRouter                from "./hr/index";
import medicalStockRouter      from "./medical-stock/index";
import biomedicalRouter        from "./biomedical/index";
import qualityRouter           from "./quality/index";
import executiveDashboardRouter from "./executive-dashboard/index";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requirePermission";
import documentsRouter from "./documents/index";
import payrollRouter    from "./payroll/index";
import storageRouter from "./storage";
import systemRouter from "./system/index.js";
import patientPortalRouter from "./patient-portal/index.js";
import patientPortalAdminRouter from "./patient-portal-admin/index.js";
import doctorPortalRouter from "./doctor-portal/index.js";
import { maintenanceGuard } from "../middleware/maintenanceGuard.js";

const router: IRouter = Router();

// Public routes
router.use(healthRouter);
router.use("/auth", authRouter);

// Global maintenance guard — exempt paths: /auth/*, /healthz, /system/health
// Applied after public routes so auth/health always work.
router.use(maintenanceGuard);

// Protected routes — valid JWT required
router.use("/dashboard",     requireAuth, dashboardRouter);
router.use("/patients",      requireAuth, patientsRouter);
router.use("/appointments",  requireAuth, appointmentsRouter);
router.use("/directory",     requireAuth, directoryRouter);
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
router.use("/infrastructure",      requireAuth, infrastructureRouter);
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
// Medical stock module
router.use("/medical-stock",       requireAuth, medicalStockRouter);
router.use("/biomedical",          requireAuth, biomedicalRouter);
router.use("/quality",             requireAuth, qualityRouter);
router.use("/executive-dashboard", requireAuth, executiveDashboardRouter);
// Notifications — stream does NOT require auth (SSE reconnects can't set headers)
router.use("/notifications",       notificationsRouter);
// GED — Gestion Électronique des Documents
router.use("/documents",           requireAuth, documentsRouter);
// Paie / Payroll
router.use("/payroll",             requireAuth, payrollRouter);
// Object Storage (presigned upload URLs + file serving)
router.use(storageRouter);
// System / Super-Admin Control Center
router.use("/system", systemRouter);
// Patient Portal (separate auth — uses requirePatientAuth, not requireAuth)
router.use("/patient-portal", patientPortalRouter);
// Patient Portal Admin (staff auth — publish/unpublish, account management)
router.use("/patient-portal-admin", requireAuth, patientPortalAdminRouter);
// Doctor Portal — separate layout/UX; auth + doctor_portal.access guard is inside the router
router.use("/doctor-portal", doctorPortalRouter);

export default router;
