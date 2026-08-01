import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import patientsRouter from "./patients";
import appointmentsRouter from "./appointments";
import alertsRouter from "./alerts";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/dashboard", dashboardRouter);
router.use("/patients", patientsRouter);
router.use("/appointments", appointmentsRouter);
router.use("/alerts", alertsRouter);

export default router;
