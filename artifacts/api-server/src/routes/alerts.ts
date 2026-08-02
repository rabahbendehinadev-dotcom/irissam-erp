/**
 * /alerts routes — direct DB queries on alertsTable.
 *
 * Schema alignment (alertsTable):
 *  - No `isActive` column → use isNull(deletedAt) for active alerts
 *  - No `detail` / `description` / `category` / `patientId` columns
 *    → use `message`, `module` as substitutes; entityId in place of patientId
 *  - id: UUID (not integer)
 *  - severity: auditSeverityEnum ("info" | "warning" | "critical")
 */
import { Router } from "express";
import { db, alertsTable } from "@workspace/db";
import { desc, eq, isNull } from "drizzle-orm";

const router = Router();

function mapAlert(a: typeof alertsTable.$inferSelect) {
  return {
    id:          a.id,
    type:        a.type,
    title:       a.title,
    detail:      a.message,               // legacy alias
    description: a.message,              // legacy alias
    message:     a.message,
    severity:    a.severity,
    category:    a.module ?? a.type,     // legacy alias → nearest equivalent
    module:      a.module ?? undefined,
    entityId:    a.entityId ?? undefined,
    isRead:      a.isRead,
    createdAt:   a.createdAt.toISOString(),
  };
}

/** GET /alerts — active (non-deleted) alerts, newest first */
router.get("/", async (_req, res, next) => {
  try {
    const alerts = await db
      .select()
      .from(alertsTable)
      .where(isNull(alertsTable.deletedAt))
      .orderBy(desc(alertsTable.createdAt));

    res.json(alerts.map(mapAlert));
  } catch (err) {
    next(err);
  }
});

/** POST /alerts/:id/read — mark a single alert as read */
router.post("/:id/read", async (req, res, next) => {
  try {
    const id = req.params.id;

    const [updated] = await db
      .update(alertsTable)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(alertsTable.id, id))
      .returning({ id: alertsTable.id, isRead: alertsTable.isRead });

    if (!updated) {
      res.status(404).json({ error: "Alert not found" });
      return;
    }

    res.json({ id: updated.id, isRead: updated.isRead });
  } catch (err) {
    next(err);
  }
});

/** POST /alerts/read-all — mark all non-deleted alerts as read */
router.post("/read-all", async (_req, res, next) => {
  try {
    await db
      .update(alertsTable)
      .set({ isRead: true, readAt: new Date() })
      .where(isNull(alertsTable.deletedAt));

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
