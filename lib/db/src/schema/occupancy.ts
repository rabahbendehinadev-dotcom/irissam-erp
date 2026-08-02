/**
 * Domain 7 — Bed Occupancy: Ward Beds, ICU Beds, ICU Admissions
 * REPLACES the legacy aggregate `beds` table (which only stored counts per service).
 * Now tracks every individual bed with full lifecycle (disponible → occupe → nettoyage → disponible).
 */
import {
  pgTable, uuid, text, timestamp, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import {
  occupancyBedStatusEnum, bedTypeEnum,
  icuBedStatusEnum, icuTypeEnum, icuAdmissionStatusEnum,
} from "./enums";
import { sitesTable, buildingsTable, floorsTable } from "./infrastructure";
import { usersTable } from "./users";
import { patientsTable } from "./patients";
import { encountersTable } from "./encounters";

// ─── Occupancy — Ward Beds ────────────────────────────────────────────────────

export const occupancyBedsTable = pgTable("occupancy_beds", {
  id:            uuid("id").primaryKey().defaultRandom(),
  number:        text("number").notNull(),        // e.g. "101-A"
  roomId:        uuid("room_id"),                 // FK to hospital_rooms (future)
  roomNumber:    text("room_number"),             // denormalized
  floorId:       uuid("floor_id").references(() => floorsTable.id, { onDelete: "set null" }),
  floorLabel:    text("floor_label"),             // denormalized
  buildingId:    uuid("building_id").references(() => buildingsTable.id, { onDelete: "set null" }),
  buildingName:  text("building_name"),           // denormalized
  buildingCode:  text("building_code"),           // denormalized
  siteId:        uuid("site_id").notNull().references(() => sitesTable.id, { onDelete: "restrict" }),

  type:   bedTypeEnum("type").default("standard").notNull(),
  status: occupancyBedStatusEnum("status").default("disponible").notNull(),

  // Current occupant (null when disponible)
  patientId:   uuid("patient_id").references(() => patientsTable.id, { onDelete: "set null" }),
  patientName: text("patient_name"),              // denormalized
  encounterId: uuid("encounter_id").references(() => encountersTable.id, { onDelete: "set null" }),
  admissionId: uuid("admission_id"),              // FK to admissions — set dynamically

  // Occupancy timestamps
  occupiedAt:           timestamp("occupied_at", { withTimezone: true }),
  expectedReleaseAt:    timestamp("expected_release_at", { withTimezone: true }),
  cleaningStartedAt:    timestamp("cleaning_started_at", { withTimezone: true }),
  cleaningCompletedAt:  timestamp("cleaning_completed_at", { withTimezone: true }),

  notes:  text("notes"),

  // Audit
  updatedAt:  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt:  timestamp("deleted_at", { withTimezone: true }),
  updatedBy:  uuid("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdBy:  uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
}, (t) => [
  index("occ_beds_site_idx").on(t.siteId),
  index("occ_beds_status_idx").on(t.status),
  index("occ_beds_patient_idx").on(t.patientId),
  index("occ_beds_encounter_idx").on(t.encounterId),
  index("occ_beds_building_idx").on(t.buildingId),
  index("occ_beds_floor_idx").on(t.floorId),
]);

// ─── ICU Beds ─────────────────────────────────────────────────────────────────

export const icuBedsTable = pgTable("icu_beds", {
  id:           uuid("id").primaryKey().defaultRandom(),
  number:       text("number").notNull(),
  unitName:     text("unit_name").notNull(),        // e.g. "Réanimation cardiaque"
  siteId:       uuid("site_id").notNull().references(() => sitesTable.id, { onDelete: "restrict" }),

  type:   icuTypeEnum("type").default("icu").notNull(),
  status: icuBedStatusEnum("status").default("disponible").notNull(),

  // Current occupant
  patientId:      uuid("patient_id").references(() => patientsTable.id, { onDelete: "set null" }),
  patientName:    text("patient_name"),
  encounterId:    uuid("encounter_id").references(() => encountersTable.id, { onDelete: "set null" }),
  icuAdmissionId: uuid("icu_admission_id"),   // FK to icu_admissions — circular; set dynamically
  priority:       text("priority"),           // P1–P4

  // Timestamps
  occupiedAt:        timestamp("occupied_at", { withTimezone: true }),
  expectedReleaseAt: timestamp("expected_release_at", { withTimezone: true }),
  cleaningStartedAt: timestamp("cleaning_started_at", { withTimezone: true }),

  // Audit
  updatedAt:  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt:  timestamp("deleted_at", { withTimezone: true }),
  updatedBy:  uuid("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdBy:  uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
}, (t) => [
  index("icu_beds_site_idx").on(t.siteId),
  index("icu_beds_status_idx").on(t.status),
  index("icu_beds_patient_idx").on(t.patientId),
]);

// ─── ICU Admissions ───────────────────────────────────────────────────────────

export const icuAdmissionsTable = pgTable("icu_admissions", {
  id:          uuid("id").primaryKey().defaultRandom(),
  encounterId: uuid("encounter_id").references(() => encountersTable.id, { onDelete: "restrict" }),
  patientId:   uuid("patient_id").notNull().references(() => patientsTable.id, { onDelete: "restrict" }),
  patientName: text("patient_name").notNull(),

  motif:        text("motif").notNull(),
  priority:     text("priority").notNull(),         // P1–P4
  icuBedId:     uuid("icu_bed_id").references(() => icuBedsTable.id, { onDelete: "set null" }),
  teamNotified: text("team_notified").default("false").notNull(),  // stored as text for simplicity
  status:       icuAdmissionStatusEnum("status").default("demande").notNull(),

  requestedById:   uuid("requested_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  requestedByName: text("requested_by_name"),

  notes: text("notes"),

  // Audit
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt:  timestamp("deleted_at", { withTimezone: true }),
  createdBy:  uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  updatedBy:  uuid("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
}, (t) => [
  index("icu_adm_encounter_idx").on(t.encounterId),
  index("icu_adm_patient_idx").on(t.patientId),
  index("icu_adm_status_idx").on(t.status),
  index("icu_adm_bed_idx").on(t.icuBedId),
]);

// ─── Bed Stats (Dashboard Aggregate — replaces legacy `beds` table) ───────────
// This table stores per-service aggregates for fast dashboard queries.

export const bedStatsTable = pgTable("bed_stats", {
  id:               uuid("id").primaryKey().defaultRandom(),
  siteId:           uuid("site_id").references(() => sitesTable.id, { onDelete: "cascade" }),
  service:          text("service").notNull(),
  totalBeds:        text("total_beds").default("0").notNull(),
  occupiedBeds:     text("occupied_beds").default("0").notNull(),
  cleaningBeds:     text("cleaning_beds").default("0").notNull(),
  outOfServiceBeds: text("out_of_service_beds").default("0").notNull(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("bed_stats_site_idx").on(t.siteId),
]);

// ─── Insert Schemas & Types ───────────────────────────────────────────────────

export const insertOccupancyBedSchema  = createInsertSchema(occupancyBedsTable).omit({ id: true });
export const insertIcuBedSchema        = createInsertSchema(icuBedsTable).omit({ id: true });
export const insertIcuAdmissionSchema  = createInsertSchema(icuAdmissionsTable).omit({ id: true });
export const insertBedStatsSchema      = createInsertSchema(bedStatsTable).omit({ id: true });

export type InsertOccupancyBed  = z.infer<typeof insertOccupancyBedSchema>;
export type InsertIcuBed        = z.infer<typeof insertIcuBedSchema>;
export type InsertIcuAdmission  = z.infer<typeof insertIcuAdmissionSchema>;
export type InsertBedStats      = z.infer<typeof insertBedStatsSchema>;

export type DbOccupancyBed  = typeof occupancyBedsTable.$inferSelect;
export type DbIcuBed        = typeof icuBedsTable.$inferSelect;
export type DbIcuAdmission  = typeof icuAdmissionsTable.$inferSelect;
export type DbBedStats      = typeof bedStatsTable.$inferSelect;
