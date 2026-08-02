/**
 * Domain 13b — Notifications
 * System notifications pushed to staff by role.
 * Supports priority levels, multi-role targeting, and per-user read tracking.
 */
import {
  pgTable, uuid, text, boolean, timestamp, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { notificationPriorityEnum, sourceModuleEnum } from "./enums";
import { sitesTable } from "./infrastructure";
import { usersTable } from "./users";

// ─── Notifications ────────────────────────────────────────────────────────────

export const notificationsTable = pgTable("notifications", {
  id:      uuid("id").primaryKey().defaultRandom(),
  type:    text("type").notNull(),              // alert_type: bed_ready | lab_critical | rx_dispensed | …
  title:   text("title").notNull(),
  message: text("message").notNull(),

  // Targeting
  forRoles: text("for_roles").array().default([]).notNull(), // user_role_enum values

  priority:     notificationPriorityEnum("priority").default("normal").notNull(),
  sourceModule: sourceModuleEnum("source_module").notNull(),
  entityId:     text("entity_id"),              // Related entity ID (bed, lab order, etc.)
  entityType:   text("entity_type"),            // Entity type name

  siteId: uuid("site_id").references(() => sitesTable.id, { onDelete: "set null" }),

  // Read tracking (array of user UUIDs who have read this)
  readBy:      uuid("read_by").array().default([]).notNull(),
  isDismissed: boolean("is_dismissed").default(false).notNull(),

  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy:  uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
}, (t) => [
  index("notif_priority_idx").on(t.priority),
  index("notif_module_idx").on(t.sourceModule),
  index("notif_site_idx").on(t.siteId),
  index("notif_created_at_idx").on(t.createdAt),
  index("notif_dismissed_idx").on(t.isDismissed),
]);

// ─── Insert Schema & Types ────────────────────────────────────────────────────

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type DbNotification     = typeof notificationsTable.$inferSelect;
