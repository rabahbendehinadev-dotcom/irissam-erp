/**
 * /or routes — Operating Room status.
 *
 * Schema alignment (operatingRoomsTable):
 *  Status enum values (French): libre | reserve | en_preparation | en_intervention |
 *                                nettoyage | hors_service | maintenance
 *  (NOT "available" / "occupied" / "prep" — those were legacy English values)
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { operatingRoomsTable } from "@workspace/db/schema";

const router = Router();

/** GET /or/status */
router.get("/status", async (_req, res, next) => {
  try {
    const rows = await db.select().from(operatingRoomsTable);

    const totalRooms = rows.length;
    const available  = rows.filter((r) => r.status === "libre").length;
    const occupied   = rows.filter((r) => r.status === "en_intervention").length;
    const prep       = rows.filter((r) => r.status === "en_preparation").length;
    const cleaning   = rows.filter((r) => r.status === "nettoyage").length;

    res.json({
      totalRooms,
      available,
      occupied,
      prep,
      cleaning,
      // Legacy aliases kept for frontend widgets
      libre:           available,
      enIntervention:  occupied,
      enPreparation:   prep,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
