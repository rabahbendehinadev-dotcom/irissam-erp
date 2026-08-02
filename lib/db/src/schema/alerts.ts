/**
 * Domain — System Alerts
 * Application-level alerts shown in the top bar.
 * Extended from legacy: added UUID PK, site linkage, soft-delete.
 */
import {
  pgTable, uuid, text, boolean, timestamp, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { auditSeverityEnum } from "./enums";
import { sitesTable } from "./infrastructure";
import { usersTable } from "./users";

// ─── Alerts ───────────────────────────────────────────────────────────────────

export const alertsTable = pgTable("alerts", {
  id:       uuid("id").primaryKey().defaultRandom(),
  siteId:   uuid("site_id").references(() => sitesTable.id, { onDelete: "set null" }),
  type:     text("type").notNull(),            // info | warning | critical | error
  severity: auditSeverityEnum("severity").default("info").notNull(),
  title:    text("title").notNull(),
  message:  text("message").notNull(),
  module:   text("module"),                   // source module
  entityId: text("entity_id"),
  isRead:   boolean("is_read").default(false).notNull(),

  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt:  timestamp("deleted_at", { withTimezone: true }),
  readBy:     uuid("read_by").references(() => usersTable.id, { onDelete: "set null" }),
  readAt:     timestamp("read_at", { withTimezone: true }),
}, (t) => [
  index("alerts_site_idx").on(t.siteId),
  index("alerts_is_read_idx").on(t.isRead),
  index("alerts_severity_idx").on(t.severity),
  index("alerts_created_at_idx").on(t.createdAt),
]);

// ─── Insert Schema & Types ────────────────────────────────────────────────────

export const insertAlertSchema = createInsertSchema(alertsTable).omit({ id: true });
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type DbAlert     = typeof alertsTable.$inferSelect;
