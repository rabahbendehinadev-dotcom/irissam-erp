import { Router } from "express";
import { db } from "@workspace/db";
import { vehiclesTable } from "@workspace/db/schema";

const router = Router();

/** GET /vehicles/status */
router.get("/status", async (_req, res, next) => {
  try {
    const rows = await db.select().from(vehiclesTable);

    const total = rows.length;
    const inService = rows.filter((r) => r.status === "in_service").length;
    const available = rows.filter((r) => r.status === "available").length;
    const maintenance = rows.filter((r) => r.status === "maintenance").length;

    res.json({ total, inService, available, maintenance });
  } catch (err) {
    next(err);
  }
});

export default router;
