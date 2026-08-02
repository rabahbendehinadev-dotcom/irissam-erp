/**
 * /alerts routes — direct DB queries on alertsTable.
 *
 * Schema alignment (alertsTable):
 *  - No `isActive` column → use isNull(deletedAt) for active alerts
 *  - No `detail` / `description` / `category` / `patientId` columns
 *    → use `message`, `module` as substitutes; entityId in place of patientId
 *  - id: UUID (not integer)
 *  - severity: auditSeverityEnum ("info" | "warning" | "critical")
 *
 * Normalization: DB values are mapped to the frontend's AlertSeverity / AlertCategory
 * union types so the UI never receives an unknown string that would crash the config lookup.
 */
import { Router } from "express";
import { db, alertsTable } from "@workspace/db";
import { desc, eq, isNull } from "drizzle-orm";

const router = Router();

// ── Severity normalisation ────────────────────────────────────────────────────
// DB uses auditSeverityEnum: "info" | "warning" | "critical"
// Frontend AlertSeverity:    "low"  | "medium"  | "high" | "critical"
type FeSeverity = "critical" | "high" | "medium" | "low";
const SEVERITY_MAP: Record<string, FeSeverity> = {
  critical: "critical",
  warning:  "high",
  info:     "low",
};

// ── Category normalisation ────────────────────────────────────────────────────
// DB module / type values → Frontend AlertCategory
type FeCategory = "lab" | "stock" | "medication" | "capacity" | "equipment" | "schedule";
const CATEGORY_MAP: Record<string, FeCategory> = {
  laboratoire:    "lab",
  imagerie:       "lab",
  pharmacie:      "medication",
  hospitalisation:"capacity",
  reanimation:    "capacity",
  icu:            "capacity",
  bloc:           "schedule",
  chirurgie:      "schedule",
  schedule:       "schedule",
  stock:          "stock",
  materiel:       "equipment",
  equipment:      "equipment",
  medication:     "medication",
};

function mapAlert(a: typeof alertsTable.$inferSelect) {
  const rawSeverity = (a.severity as string) ?? "info";
  const rawCategory = (a.module ?? a.type ?? "") as string;
  return {
    id:          a.id,
    siteId:      null,
    patientId:   (a.entityId as string | null) ?? null,
    category:    CATEGORY_MAP[rawCategory] ?? "lab",
    title:       a.title,
    description: a.message ?? null,
    detail:      a.message ?? null,
    severity:    SEVERITY_MAP[rawSeverity] ?? "low",
    isActive:    true,
    isRead:      a.isRead,
    createdAt:   a.createdAt.toISOString(),
    updatedAt:   (a as any).updatedAt instanceof Date
                   ? (a as any).updatedAt.toISOString()
                   : null,
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
