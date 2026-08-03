import { Router } from 'express';
import { requirePermission } from '../../middleware/requirePermission.js';

import periodsRouter        from './periods.js';
import runsRouter           from './runs.js';
import componentsRouter     from './components.js';
import advancesRouter       from './advances.js';
import loansRouter          from './loans.js';
import payslipsRouter       from './payslips.js';
import paymentOrdersRouter  from './payment-orders.js';
import bankExportRouter     from './bank-export.js';
import dashboardRouter      from './dashboard.js';
import reportsRouter        from './reports.js';
import settingsRouter       from './settings.js';

const router = Router();

// All routes require payroll.view at minimum
router.use(requirePermission('payroll.view'));

router.use(dashboardRouter);
router.use(periodsRouter);
router.use(runsRouter);
router.use(componentsRouter);
router.use(advancesRouter);
router.use(loansRouter);
router.use(payslipsRouter);
router.use(paymentOrdersRouter);
router.use(bankExportRouter);
router.use(reportsRouter);
router.use(settingsRouter);

export default router;
