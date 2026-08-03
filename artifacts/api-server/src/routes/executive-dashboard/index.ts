import { Router } from 'express';
import overviewRouter    from './overview.js';
import medicalRouter     from './medical.js';
import capacityRouter    from './capacity.js';
import financeRouter     from './finance.js';
import hrRouter          from './hr.js';
import stockRouter       from './stock.js';
import biomedicalRouter  from './biomedical.js';
import qualityRouter     from './quality.js';
import alertsRouter      from './alerts.js';
import drilldownRouter   from './drilldown.js';
import exportRouter      from './export.js';

const router = Router();

router.use('/overview',    overviewRouter);
router.use('/medical',     medicalRouter);
router.use('/capacity',    capacityRouter);
router.use('/finance',     financeRouter);
router.use('/hr',          hrRouter);
router.use('/stock',       stockRouter);
router.use('/biomedical',  biomedicalRouter);
router.use('/quality',     qualityRouter);
router.use('/alerts',      alertsRouter);
router.use('/drilldown',   drilldownRouter);
router.use('/export',      exportRouter);

export default router;
