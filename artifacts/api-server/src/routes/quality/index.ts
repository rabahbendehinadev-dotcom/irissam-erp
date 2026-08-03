/**
 * /api/quality — Quality Management & Risk Management hub router
 */
import { Router } from "express";
import dashboardRouter    from "./dashboard";
import incidentsRouter    from "./incidents";
import ncRouter           from "./non-conformities";
import capaRouter         from "./capa";
import risksRouter        from "./risks";
import auditsRouter       from "./audits";
import documentsRouter    from "./documents";
import indicatorsRouter   from "./indicators";
import meetingsRouter     from "./meetings";
import checklistsRouter   from "./checklists";
import improvementsRouter from "./improvements";

const router = Router();

router.use(dashboardRouter);
router.use(incidentsRouter);
router.use(ncRouter);
router.use(capaRouter);
router.use(risksRouter);
router.use(auditsRouter);
router.use(documentsRouter);
router.use(indicatorsRouter);
router.use(meetingsRouter);
router.use(checklistsRouter);
router.use(improvementsRouter);

export default router;
