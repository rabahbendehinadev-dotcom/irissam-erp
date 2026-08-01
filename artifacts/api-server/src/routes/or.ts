import { Router } from "express";
import { db } from "@workspace/db";
import { operatingRoomsTable } from "@workspace/db/schema";
import { eq, count } from "drizzle-orm";

const router = Router();

/** GET /or/status */
router.get("/status", async (_req, res, next) => {
  try {
    const rows = await db.select().from(operatingRoomsTable);

    const totalRooms = rows.length;
    const available = rows.filter((r) => r.status === "available").length;
    const occupied = rows.filter((r) => r.status === "occupied").length;
    const prep = rows.filter((r) => r.status === "prep").length;

    res.json({ totalRooms, available, occupied, prep });
  } catch (err) {
    next(err);
  }
});

export default router;
