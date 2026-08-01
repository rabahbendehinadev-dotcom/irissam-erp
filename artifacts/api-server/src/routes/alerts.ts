import { Router } from "express";
import { db } from "@workspace/db";
import { alertsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";

const router = Router();

/** GET /alerts */
router.get("/", async (_req, res, next) => {
  try {
    const alerts = await db
      .select()
      .from(alertsTable)
      .where(eq(alertsTable.isActive, true))
      .orderBy(desc(alertsTable.createdAt))
      .limit(5);

    res.json(
      alerts.map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        detail: a.detail,
        createdAt: a.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    next(err);
  }
});

export default router;
