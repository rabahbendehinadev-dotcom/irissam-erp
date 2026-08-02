/**
 * /blood-bank routes
 *
 * Schema alignment (bloodBankTable):
 *  - unitsAvailable: integer (not `totalBags` / `availableBags`)
 *  - unitsReserved:  integer
 *  - No urgentRequests / expiringSoon columns
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { bloodBankTable } from "@workspace/db/schema";

const router = Router();

/** GET /blood-bank  OR  /blood-bank/summary */
router.get(["/", "/summary"], async (_req, res, next) => {
  try {
    const rows = await db.select().from(bloodBankTable);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDays = new Date(today);
    thirtyDays.setDate(thirtyDays.getDate() + 30);

    const totalUnits     = rows.reduce((acc, r) => acc + r.unitsAvailable, 0);
    const reservedUnits  = rows.reduce((acc, r) => acc + r.unitsReserved, 0);
    const availableUnits = Math.max(0, totalUnits - reservedUnits);
    const expiringSoon   = rows.filter((r) => {
      if (!r.expiryDate) return false;
      const exp = new Date(r.expiryDate);
      return exp > today && exp <= thirtyDays;
    }).length;

    res.json({
      totalUnits,
      availableUnits,
      reservedUnits,
      expiringSoon,
      // Legacy aliases kept for frontend widgets
      totalBags:     totalUnits,
      available:     availableUnits,
      urgentRequests: 0,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
