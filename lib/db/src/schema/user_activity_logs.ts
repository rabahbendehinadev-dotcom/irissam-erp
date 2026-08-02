/**
 * Domain — User Activity Logs
 * Tracks UI-level user interactions: Login, Logout, Print, Export, Download,
 * Search, View, Filter, Navigate, etc.
 *
 * DISTINCT from audit_logs which tracks data mutations (created/updated/deleted).
 * This table answers "who did what, when" — not "what data changed".
 *
 * Append-only. No soft delete. No updates.
 */
import {
  pgTable, uuid, text, timestamp, jsonb, index,
} from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sourceModuleEnum } from "./enums";
import { sitesTable } from "./infrastructure";
import { usersTable } from "./users";

// ─── Enum: User activity action types ────────────────────────────────────────

export const userActivityActionEnum = pgEnum("user_activity_action", [
  // Session
  "login",
  "logout",
  "session_expired",
  "password_changed",
  // Navigation
  "navigate",
  "view",            // Opened a record / page
  "search",          // Performed a search query
  "filter",          // Applied filters to a list
  // Output
  "print",           // Printed a document (CR, ordonnance, fiche…)
  "export",          // Exported data (CSV, Excel…)
  "download",        // Downloaded an attachment
  "generate_pdf",    // Generated a PDF
  // Access
  "access_denied",   // Tried to access a restricted resource
  "impersonate",     // Admin acting as another user
]);

// ─── User Activity Logs ───────────────────────────────────────────────────────

export const userActivityLogsTable = pgTable("user_activity_logs", {
  id:        uuid("id").primaryKey().defaultRandom(),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),

  // Actor
  userId:    uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  userName:  text("user_name").notNull(),
  userRole:  text("user_role").notNull(),

  // Action
  action:    userActivityActionEnum("action").notNull(),

  // Context
  module:        sourceModuleEnum("module").notNull(),
  resourceType:  text("resource_type"),   // "patient" | "consultation" | "lab_order" | …
  resourceId:    text("resource_id"),     // UUID of the resource being acted on
  resourceLabel: text("resource_label"),  // Human-readable label for the resource

  // Details
  description: text("description"),       // Free-text summary: "Printed CR for Mohamed Ali"
  searchQuery: text("search_query"),      // For search actions
  metadata:    jsonb("metadata"),         // Extra context: { format: "pdf", pages: 3 } etc.

  // Request context
  ip:          text("ip"),
  userAgent:   text("user_agent"),
  sessionId:   text("session_id"),        // References user_sessions.id (text, not FK, for perf)

  // Site
  siteId: uuid("site_id").references(() => sitesTable.id, { onDelete: "set null" }),
}, (t) => [
  index("ual_timestamp_idx").on(t.timestamp),
  index("ual_user_idx").on(t.userId),
  index("ual_action_idx").on(t.action),
  index("ual_module_idx").on(t.module),
  index("ual_resource_idx").on(t.resourceType, t.resourceId),
  index("ual_session_idx").on(t.sessionId),
  index("ual_site_idx").on(t.siteId),
]);

// ─── Insert Schema & Types ────────────────────────────────────────────────────

export const insertUserActivityLogSchema = createInsertSchema(userActivityLogsTable).omit({ id: true });
export type InsertUserActivityLog = z.infer<typeof insertUserActivityLogSchema>;
export type DbUserActivityLog     = typeof userActivityLogsTable.$inferSelect;
