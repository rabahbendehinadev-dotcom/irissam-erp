import { Router } from "express";
import equipmentRouter   from "./equipment.js";
import workOrdersRouter  from "./work-orders.js";
import calibrationsRouter from "./calibrations.js";
import incidentsRouter   from "./incidents.js";
import contractsRouter   from "./contracts.js";
import suppliersRouter   from "./suppliers.js";
import sparePartsRouter  from "./spare-parts.js";
import inspectionsRouter from "./inspections.js";
import disposalsRouter   from "./disposals.js";
import catalogRouter     from "./catalog.js";
import dashboardRouter   from "./dashboard.js";

const router = Router();

router.use("/dashboard",   dashboardRouter);
router.use("/equipment",   equipmentRouter);
router.use("/work-orders", workOrdersRouter);
router.use("/calibrations",calibrationsRouter);
router.use("/incidents",   incidentsRouter);
router.use("/contracts",   contractsRouter);
router.use("/suppliers",   suppliersRouter);
router.use("/spare-parts", sparePartsRouter);
router.use("/inspections", inspectionsRouter);
router.use("/disposals",   disposalsRouter);
router.use("/",            catalogRouter);   // /categories /manufacturers /models /locations

export default router;
