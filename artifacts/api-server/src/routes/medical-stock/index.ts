/**
 * /api/medical-stock — Medical Stock Management hub router
 *
 * Sub-routers:
 *   /medical-stock/dashboard          — dashboard KPIs & charts
 *   /medical-stock/items              — product catalog
 *   /medical-stock/categories         — item categories
 *   /medical-stock/units              — units of measure
 *   /medical-stock/suppliers          — suppliers
 *   /medical-stock/manufacturers      — manufacturers
 *   /medical-stock/batches            — lot/batch tracking
 *   /medical-stock/movements          — stock movements log
 *   /medical-stock/purchase-orders    — purchase orders
 *   /medical-stock/transfers          — inter-service transfers
 *   /medical-stock/adjustments        — stock adjustments
 *   /medical-stock/inventory          — inventory sessions
 *   /medical-stock/consumptions       — consumption records
 *   /medical-stock/reports            — analytics & reports
 */
import { Router } from "express";
import dashboardRouter     from "./dashboard";
import itemsRouter         from "./items";
import categoriesRouter    from "./categories";
import suppliersRouter     from "./suppliers";
import manufacturersRouter from "./manufacturers";
import batchesRouter       from "./batches";
import movementsRouter     from "./movements";
import purchaseOrdersRouter from "./purchase-orders";
import transfersRouter     from "./transfers";
import adjustmentsRouter   from "./adjustments";
import inventoryRouter     from "./inventory";
import consumptionsRouter  from "./consumptions";

const router = Router();

router.use(dashboardRouter);
router.use(itemsRouter);
router.use(categoriesRouter);
router.use(suppliersRouter);
router.use(manufacturersRouter);
router.use(batchesRouter);
router.use(movementsRouter);
router.use(purchaseOrdersRouter);
router.use(transfersRouter);
router.use(adjustmentsRouter);
router.use(inventoryRouter);
router.use(consumptionsRouter);

export default router;
