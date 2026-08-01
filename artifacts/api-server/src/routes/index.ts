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
import { requireAuth } from "../middleware/requireAuth";

const router: IRouter = Router();

// Public routes
router.use(healthRouter);
router.use("/auth", authRouter);

// Protected routes — valid JWT required
router.use("/dashboard", requireAuth, dashboardRouter);
router.use("/patients", requireAuth, patientsRouter);
router.use("/appointments", requireAuth, appointmentsRouter);
router.use("/alerts", requireAuth, alertsRouter);
router.use("/beds", requireAuth, bedsRouter);
router.use("/or", requireAuth, orRouter);
router.use("/blood-bank", requireAuth, bloodBankRouter);
router.use("/vehicles", requireAuth, vehiclesRouter);
router.use("/medications", requireAuth, medicationsRouter);

export default router;
