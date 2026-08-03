import { Router } from "express";
import recordsRouter from "./records";
import foldersRouter from "./folders";
import versionsRouter from "./versions";
import workflowsRouter from "./workflows";
import sharesRouter from "./shares";
import dashboardRouter from "./dashboard";
import auditRouter from "./audit";

const router = Router();

router.use("/records", recordsRouter);
router.use("/folders", foldersRouter);
router.use("/versions", versionsRouter);
router.use("/workflows", workflowsRouter);
router.use("/shares", sharesRouter);
router.use("/dashboard", dashboardRouter);
router.use("/audit", auditRouter);

export default router;
