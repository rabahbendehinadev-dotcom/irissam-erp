import { Router } from "express";
import { db } from "@workspace/db";
import { bedsTable } from "@workspace/db/schema";
import { sum, sql } from "drizzle-orm";

const router = Router();

/** GET /beds/summary */
router.get("/summary", async (_req, res, next) => {
  try {
    const rows = await db.select().from(bedsTable);

    const occupied = rows.reduce((acc, r) => acc + r.occupiedBeds, 0);
    const cleaning = rows.reduce((acc, r) => acc + r.cleaningBeds, 0);
    const outOfService = rows.reduce((acc, r) => acc + r.outOfServiceBeds, 0);
    const total = rows.reduce((acc, r) => acc + r.totalBeds, 0);
    const free = total - occupied - cleaning - outOfService;
    const occupancyPercent = total > 0 ? Math.round((occupied / total) * 100) : 0;

    res.json({ occupied, free, cleaning, outOfService, total, occupancyPercent });
  } catch (err) {
    next(err);
  }
});

export default router;
