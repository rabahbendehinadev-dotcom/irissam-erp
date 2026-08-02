/**
 * Domain 5 — Emergency Department
 * emergency_visits, emergency_rooms, emergency_vitals, ambulances
 * REPLACES the legacy minimal vehicles table for ambulance tracking.
 */
import {
  pgTable, uuid, text, integer, boolean, timestamp, real,
  index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import {
  emergencyPriorityEnum, emergencyPatientStatusEnum,
  erRoomTypeEnum, erRoomStatusEnum, ambulanceStatusEnum, visitCloseReasonEnum,
} from "./enums";
import { sitesTable } from "./infrastructure";
import { usersTable } from "./users";
import { patientsTable } from "./patients";
import { encountersTable } from "./encounters";

// ─── Emergency Rooms ──────────────────────────────────────────────────────────

export const emergencyRoomsTable = pgTable("emergency_rooms", {
  id:         uuid("id").primaryKey().defaultRandom(),
  siteId:     uuid("site_id").references(() => sitesTable.id, { onDelete: "set null" }),
  floorId:    uuid("floor_id"),
  name:       text("name").notNull(),
  shortName:  text("short_name").notNull(),
  type:       erRoomTypeEnum("type").notNull(),
  capacity:   integer("capacity").default(1).notNull(),
  occupied:   integer("occupied").default(0).notNull(),
  status:     erRoomStatusEnum("status").default("libre").notNull(),
  // Audit
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt:  timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  index("er_rooms_site_idx").on(t.siteId),
  index("er_rooms_status_idx").on(t.status),
]);

// ─── Emergency Visits ─────────────────────────────────────────────────────────

export const emergencyVisitsTable = pgTable("emergency_visits", {
  id:          uuid("id").primaryKey().defaultRandom(),
  encounterId: uuid("encounter_id").notNull().references(() => encountersTable.id, { onDelete: "restrict" }),
  patientId:   uuid("patient_id").notNull().references(() => patientsTable.id, { onDelete: "restrict" }),

  priority: emergencyPriorityEnum("priority").default("non_classe").notNull(),
  status:   emergencyPatientStatusEnum("status").default("attente_triage").notNull(),

  // Staff assignment
  assignedDoctorId:   uuid("assigned_doctor_id").references(() => usersTable.id, { onDelete: "set null" }),
  assignedDoctorName: text("assigned_doctor_name"),
  assignedNurseId:    uuid("assigned_nurse_id").references(() => usersTable.id, { onDelete: "set null" }),
  assignedNurseName:  text("assigned_nurse_name"),
  assignedRoomId:     uuid("assigned_room_id").references(() => emergencyRoomsTable.id, { onDelete: "set null" }),
  assignedRoomName:   text("assigned_room_name"),

  // Clinical
  chiefComplaint: text("chief_complaint").notNull(),
  mechanism:      text("mechanism"),
  triageNotes:    text("triage_notes"),
  byAmbulance:    boolean("by_ambulance").default(false).notNull(),
  isMinor:        boolean("is_minor").default(false).notNull(),
  tags:           text("tags").array().default([]).notNull(),

  // Linked records
  linkedAdmissionId:        uuid("linked_admission_id"),  // FK set after admissions table
  linkedSurgicalRequestId:  uuid("linked_surgical_request_id"),
  linkedIcuAdmissionId:     uuid("linked_icu_admission_id"),

  // Timestamps
  arrivalTime:   timestamp("arrival_time", { withTimezone: true }).defaultNow().notNull(),
  triageTime:    timestamp("triage_time", { withTimezone: true }),
  careStartTime: timestamp("care_start_time", { withTimezone: true }),
  closedAt:      timestamp("closed_at", { withTimezone: true }),
  closeReason:   visitCloseReasonEnum("close_reason"),

  // Audit
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt:  timestamp("deleted_at", { withTimezone: true }),
  createdBy:  uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  updatedBy:  uuid("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
}, (t) => [
  uniqueIndex("ev_encounter_idx").on(t.encounterId),  // 1 visit per encounter
  index("ev_patient_idx").on(t.patientId),
  index("ev_status_idx").on(t.status),
  index("ev_priority_idx").on(t.priority),
  index("ev_arrival_idx").on(t.arrivalTime),
  index("ev_deleted_at_idx").on(t.deletedAt),
]);

// ─── Emergency Vitals ─────────────────────────────────────────────────────────

export const emergencyVitalsTable = pgTable("emergency_vitals", {
  id:          uuid("id").primaryKey().defaultRandom(),
  encounterId: uuid("encounter_id").notNull().references(() => encountersTable.id, { onDelete: "cascade" }),
  visitId:     uuid("visit_id").notNull().references(() => emergencyVisitsTable.id, { onDelete: "cascade" }),

  // Vitals (all optional — taken at different stages)
  heartRate:        integer("heart_rate"),          // bpm
  bloodPressure:    text("blood_pressure"),          // "120/80"
  spo2:             real("spo2"),                   // %
  temperature:      real("temperature"),             // °C
  respiratoryRate:  integer("respiratory_rate"),     // /min
  gcs:              integer("gcs"),                  // Glasgow 3–15
  painLevel:        integer("pain_level"),           // 0–10
  glucose:          real("glucose"),                 // mmol/L

  notes:       text("notes"),
  recordedBy:  uuid("recorded_by").references(() => usersTable.id, { onDelete: "set null" }),
  recordedAt:  timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("vitals_encounter_idx").on(t.encounterId),
  index("vitals_visit_idx").on(t.visitId),
  index("vitals_recorded_at_idx").on(t.recordedAt),
]);

// ─── Ambulances ───────────────────────────────────────────────────────────────
// REPLACES the legacy minimal `vehicles` table.

export const ambulancesTable = pgTable("ambulances", {
  id:       uuid("id").primaryKey().defaultRandom(),
  siteId:   uuid("site_id").references(() => sitesTable.id, { onDelete: "set null" }),
  callSign: text("call_sign").notNull(),
  type:     text("type").default("ambulance").notNull(),
  status:   ambulanceStatusEnum("status").default("disponible").notNull(),
  crew:     text("crew"),
  crewCount: integer("crew_count").default(2).notNull(),

  // Current assignment
  currentPatientId:       uuid("current_patient_id").references(() => patientsTable.id, { onDelete: "set null" }),
  currentPatientName:     text("current_patient_name"),
  currentPatientPriority: emergencyPriorityEnum("current_patient_priority"),
  chiefComplaint:         text("chief_complaint"),
  location:               text("location"),
  dispatchedAt:           timestamp("dispatched_at", { withTimezone: true }),
  etaMinutes:             integer("eta_minutes"),

  // Audit
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt:  timestamp("deleted_at", { withTimezone: true }),
  createdBy:  uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
}, (t) => [
  uniqueIndex("ambulances_call_sign_idx").on(t.callSign),
  index("ambulances_site_idx").on(t.siteId),
  index("ambulances_status_idx").on(t.status),
]);

// ─── Insert Schemas & Types ───────────────────────────────────────────────────

export const insertEmergencyRoomSchema   = createInsertSchema(emergencyRoomsTable).omit({ id: true });
export const insertEmergencyVisitSchema  = createInsertSchema(emergencyVisitsTable).omit({ id: true });
export const insertEmergencyVitalsSchema = createInsertSchema(emergencyVitalsTable).omit({ id: true });
export const insertAmbulanceSchema       = createInsertSchema(ambulancesTable).omit({ id: true });

export type InsertEmergencyRoom   = z.infer<typeof insertEmergencyRoomSchema>;
export type InsertEmergencyVisit  = z.infer<typeof insertEmergencyVisitSchema>;
export type InsertEmergencyVitals = z.infer<typeof insertEmergencyVitalsSchema>;
export type InsertAmbulance       = z.infer<typeof insertAmbulanceSchema>;

export type DbEmergencyRoom   = typeof emergencyRoomsTable.$inferSelect;
export type DbEmergencyVisit  = typeof emergencyVisitsTable.$inferSelect;
export type DbEmergencyVitals = typeof emergencyVitalsTable.$inferSelect;
export type DbAmbulance       = typeof ambulancesTable.$inferSelect;
