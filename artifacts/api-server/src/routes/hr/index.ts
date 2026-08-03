/**
 * /api/hr — Master HR router
 * All sub-routers are mounted here with requireAuth already applied at the
 * routes/index.ts level.
 */
import { Router } from "express";
import employeesRouter   from "./employees";
import contractsRouter   from "./contracts";
import positionsRouter   from "./positions";
import planningRouter    from "./planning";
import attendanceRouter  from "./attendance";
import leavesRouter      from "./leaves";
import absencesRouter    from "./absences";
import overtimeRouter    from "./overtime";
import badgesRouter      from "./badges";
import dashboardRouter   from "./dashboard";

const router = Router();

router.use("/dashboard",   dashboardRouter);
router.use("/employees",   employeesRouter);
router.use("/contracts",   contractsRouter);
router.use("/positions",   positionsRouter);
router.use("/planning",    planningRouter);
router.use("/attendance",  attendanceRouter);
router.use("/leaves",      leavesRouter);
router.use("/absences",    absencesRouter);
router.use("/overtime",    overtimeRouter);
router.use("/badges",      badgesRouter);

export default router;
