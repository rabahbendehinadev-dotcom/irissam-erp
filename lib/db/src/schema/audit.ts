/**
 * Domain 13a — Audit Logs
 * Immutable audit trail for every state-changing operation.
 * Supports severity levels, multi-module, and patient linkage.
 * No soft-delete (audit logs are immutable).
 */
import {
  pgTable, uuid, text, timestamp, jsonb, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { auditSeverityEnum, sourceModuleEnum } from "./enums";
import { usersTable } from "./users";
import { patientsTable } from "./patients";
import { encountersTable } from "./encounters";
import { sitesTable } from "./infrastructure";

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const auditLogsTable = pgTable("audit_logs", {
  id:           uuid("id").primaryKey().defaultRandom(),
  timestamp:    timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),

  module:   sourceModuleEnum("module").notNull(),
  action:   text("action").notNull(),           // created | updated | deleted | status_changed | …
  oldValue: jsonb("old_value"),                 // previous state snapshot
  newValue: jsonb("new_value"),                 // new state snapshot

  userId:   uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  userName: text("user_name").notNull(),
  userRole: text("user_role").notNull(),

  patientId:    uuid("patient_id").references(() => patientsTable.id, { onDelete: "set null" }),
  encounterId:  uuid("encounter_id").references(() => encountersTable.id, { onDelete: "set null" }),
  resourceId:   text("resource_id"),
  resourceType: text("resource_type"),

  ip:       text("ip"),
  siteId:   uuid("site_id").references(() => sitesTable.id, { onDelete: "set null" }),
  severity: auditSeverityEnum("severity").default("info").notNull(),
}, (t) => [
  index("audit_timestamp_idx").on(t.timestamp),
  index("audit_module_idx").on(t.module),
  index("audit_user_idx").on(t.userId),
  index("audit_patient_idx").on(t.patientId),
  index("audit_encounter_idx").on(t.encounterId),
  index("audit_resource_idx").on(t.resourceType, t.resourceId),
  index("audit_severity_idx").on(t.severity),
  index("audit_site_idx").on(t.siteId),
]);

// ─── Insert Schema & Types ────────────────────────────────────────────────────

export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({ id: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type DbAuditLog     = typeof auditLogsTable.$inferSelect;
