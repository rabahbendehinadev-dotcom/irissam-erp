import { Router } from "express";
import { db } from "@workspace/db";
import { alertsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";

const router = Router();

/** GET /alerts — full alert list (dashboard + alerts page) */
router.get("/", async (_req, res, next) => {
  try {
    const alerts = await db
      .select()
      .from(alertsTable)
      .where(eq(alertsTable.isActive, true))
      .orderBy(desc(alertsTable.createdAt));

    res.json(
      alerts.map((a) => ({
        id: `db-${a.id}`,
        type: a.type,
        title: a.title,
        detail: a.detail,
        description: a.description ?? a.detail,
        severity: a.severity,
        category: a.category,
        isRead: a.isRead,
        createdAt: a.createdAt.toISOString(),
        patientId: a.patientId ? `db-${a.patientId}` : null,
      })),
    );
  } catch (err) {
    next(err);
  }
});

/** POST /alerts/:id/read — mark a single alert as read */
router.post("/:id/read", async (req, res, next) => {
  try {
    const rawId = req.params.id.replace(/^db-/, "");
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid alert id" });
      return;
    }

    const [updated] = await db
      .update(alertsTable)
      .set({ isRead: true })
      .where(eq(alertsTable.id, id))
      .returning({ id: alertsTable.id, isRead: alertsTable.isRead });

    if (!updated) {
      res.status(404).json({ error: "Alert not found" });
      return;
    }

    res.json({ id: `db-${updated.id}`, isRead: updated.isRead });
  } catch (err) {
    next(err);
  }
});

/** POST /alerts/read-all — mark all active alerts as read */
router.post("/read-all", async (_req, res, next) => {
  try {
    await db
      .update(alertsTable)
      .set({ isRead: true })
      .where(eq(alertsTable.isActive, true));

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
