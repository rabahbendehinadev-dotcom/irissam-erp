import { Router } from "express";
import { db } from "@workspace/db";
import { bloodBankTable } from "@workspace/db/schema";

const router = Router();

/** GET /blood-bank/summary */
router.get("/summary", async (_req, res, next) => {
  try {
    const rows = await db.select().from(bloodBankTable);

    const totalBags = rows.reduce((acc, r) => acc + r.totalBags, 0);
    const available = rows.reduce((acc, r) => acc + r.availableBags, 0);
    const urgentRequests = rows.reduce((acc, r) => acc + r.urgentRequests, 0);
    const expiringSoon = rows.reduce((acc, r) => acc + r.expiringSoon, 0);

    res.json({ totalBags, available, urgentRequests, expiringSoon });
  } catch (err) {
    next(err);
  }
});

export default router;
