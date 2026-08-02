/**
 * Domain 8 — Bloc Opératoire: Operating Rooms, Surgical Requests, OR Slots
 * REPLACES the legacy minimal `operating_rooms` table (name + status only).
 */
import {
  pgTable, uuid, text, integer, boolean, timestamp, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { orStatusEnum, orSlotStatusEnum, surgicalStatusEnum, surgicalUrgencyEnum } from "./enums";
import { sitesTable, floorsTable } from "./infrastructure";
import { usersTable } from "./users";
import { patientsTable } from "./patients";
import { encountersTable } from "./encounters";

// ─── Operating Rooms ──────────────────────────────────────────────────────────

export const operatingRoomsTable = pgTable("operating_rooms", {
  id:        uuid("id").primaryKey().defaultRandom(),
  siteId:    uuid("site_id").references(() => sitesTable.id, { onDelete: "set null" }),
  floorId:   uuid("floor_id").references(() => floorsTable.id, { onDelete: "set null" }),
  floorLabel: text("floor_label"),
  name:      text("name").notNull(),
  shortName: text("short_name").notNull(),
  specialty: text("specialty"),
  status:    orStatusEnum("status").default("libre").notNull(),
  currentSurgicalRequestId: uuid("current_surgical_request_id"),

  // Audit
  updatedAt:  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt:  timestamp("deleted_at", { withTimezone: true }),
  updatedBy:  uuid("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdBy:  uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
}, (t) => [
  index("or_site_idx").on(t.siteId),
  index("or_status_idx").on(t.status),
]);

// ─── Surgical Requests ────────────────────────────────────────────────────────

export const surgicalRequestsTable = pgTable("surgical_requests", {
  id:          uuid("id").primaryKey().defaultRandom(),
  encounterId: uuid("encounter_id").references(() => encountersTable.id, { onDelete: "set null" }),
  patientId:   uuid("patient_id").notNull().references(() => patientsTable.id, { onDelete: "restrict" }),
  patientName: text("patient_name").notNull(),

  intervention:   text("intervention").notNull(),
  surgeonId:      uuid("surgeon_id").references(() => usersTable.id, { onDelete: "set null" }),
  surgeonName:    text("surgeon_name"),
  anesthesistId:  uuid("anesthesist_id").references(() => usersTable.id, { onDelete: "set null" }),
  anesthesistName: text("anesthesist_name"),
  urgencyDegree:  surgicalUrgencyEnum("urgency_degree").default("elective").notNull(),
  preOpPrep:      text("pre_op_prep"),
  consentSigned:  boolean("consent_signed").default(false).notNull(),
  status:         surgicalStatusEnum("status").default("demande").notNull(),

  requestedById:   uuid("requested_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  requestedByName: text("requested_by_name"),
  orRoomId:        uuid("or_room_id").references(() => operatingRoomsTable.id, { onDelete: "set null" }),
  scheduledAt:     timestamp("scheduled_at", { withTimezone: true }),

  // Audit
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt:  timestamp("deleted_at", { withTimezone: true }),
  createdBy:  uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  updatedBy:  uuid("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
}, (t) => [
  index("surg_req_encounter_idx").on(t.encounterId),
  index("surg_req_patient_idx").on(t.patientId),
  index("surg_req_status_idx").on(t.status),
  index("surg_req_or_idx").on(t.orRoomId),
  index("surg_req_scheduled_idx").on(t.scheduledAt),
]);

// ─── OR Slots (Operating Room Schedule) ───────────────────────────────────────

export const orSlotsTable = pgTable("or_slots", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  orRoomId:           uuid("or_room_id").notNull().references(() => operatingRoomsTable.id, { onDelete: "cascade" }),
  surgicalRequestId:  uuid("surgical_request_id").references(() => surgicalRequestsTable.id, { onDelete: "set null" }),
  patientId:          uuid("patient_id").references(() => patientsTable.id, { onDelete: "set null" }),
  patientName:        text("patient_name"),
  intervention:       text("intervention").notNull(),
  surgeon:            text("surgeon"),
  startAt:            timestamp("start_at", { withTimezone: true }).notNull(),
  endAt:              timestamp("end_at", { withTimezone: true }).notNull(),
  status:             orSlotStatusEnum("status").default("planifie").notNull(),

  // Audit
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt:  timestamp("deleted_at", { withTimezone: true }),
  createdBy:  uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
}, (t) => [
  index("or_slots_room_idx").on(t.orRoomId),
  index("or_slots_start_idx").on(t.startAt),
  index("or_slots_status_idx").on(t.status),
  index("or_slots_patient_idx").on(t.patientId),
  index("or_slots_surg_req_idx").on(t.surgicalRequestId),
]);

// ─── Insert Schemas & Types ───────────────────────────────────────────────────

export const insertOperatingRoomSchema    = createInsertSchema(operatingRoomsTable).omit({ id: true });
export const insertSurgicalRequestSchema  = createInsertSchema(surgicalRequestsTable).omit({ id: true });
export const insertOrSlotSchema           = createInsertSchema(orSlotsTable).omit({ id: true });

export type InsertOperatingRoom   = z.infer<typeof insertOperatingRoomSchema>;
export type InsertSurgicalRequest = z.infer<typeof insertSurgicalRequestSchema>;
export type InsertOrSlot          = z.infer<typeof insertOrSlotSchema>;

export type DbOperatingRoom   = typeof operatingRoomsTable.$inferSelect;
export type DbSurgicalRequest = typeof surgicalRequestsTable.$inferSelect;
export type DbOrSlot          = typeof orSlotsTable.$inferSelect;
