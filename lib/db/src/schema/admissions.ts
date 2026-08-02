/**
 * Domain 6 — Admissions & Hospitalization
 * Full admission lifecycle: preadmission → active → transferred / discharged / cancelled.
 * REPLACES the legacy minimal `admissions` table (which only had name+service+dates).
 */
import {
  pgTable, uuid, text, date, timestamp, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import {
  admissionTypeEnum, admissionStatusEnum, admissionPriorityEnum, dischargeTypeEnum,
} from "./enums";
import { sitesTable, departmentsTable } from "./infrastructure";
import { usersTable } from "./users";
import { patientsTable } from "./patients";
import { encountersTable } from "./encounters";
import { occupancyBedsTable } from "./occupancy";

// ─── Admissions ───────────────────────────────────────────────────────────────

export const admissionsTable = pgTable("admissions", {
  id:              uuid("id").primaryKey().defaultRandom(),
  admissionNumber: text("admission_number").notNull(),  // ADM-2026-0001
  encounterId:     uuid("encounter_id").references(() => encountersTable.id, { onDelete: "set null" }),
  patientId:       uuid("patient_id").notNull().references(() => patientsTable.id, { onDelete: "restrict" }),

  // Denormalized patient info (for display without joins)
  patientMpiId: text("patient_mpi_id"),
  patientName:  text("patient_name").notNull(),
  patientDob:   date("patient_dob"),
  patientPhone: text("patient_phone"),

  type:     admissionTypeEnum("type").notNull(),
  status:   admissionStatusEnum("status").default("active").notNull(),
  priority: admissionPriorityEnum("priority").default("normal").notNull(),

  // Service / Doctor
  serviceId:   uuid("service_id").references(() => departmentsTable.id, { onDelete: "set null" }),
  serviceName: text("service_name").notNull(),
  doctorId:    uuid("doctor_id").references(() => usersTable.id, { onDelete: "set null" }),
  doctorName:  text("doctor_name").notNull(),

  motif:     text("motif").notNull(),
  diagnosis: text("diagnosis"),

  // Bed assignment (denormalized for fast access)
  bedId:        uuid("bed_id").references(() => occupancyBedsTable.id, { onDelete: "set null" }),
  bedNumber:    text("bed_number"),
  roomNumber:   text("room_number"),
  floorLabel:   text("floor_label"),
  buildingName: text("building_name"),

  // Dates
  admissionDate:        date("admission_date").notNull(),
  admissionTime:        text("admission_time").notNull(),   // HH:MM
  expectedDischargeDate: date("expected_discharge_date"),
  actualDischargeDate:  date("actual_discharge_date"),
  actualDischargeTime:  text("actual_discharge_time"),

  // Discharge / Transfer
  dischargeType:  dischargeTypeEnum("discharge_type"),
  dischargeNotes: text("discharge_notes"),
  transferTo:     text("transfer_to"),
  transferDate:   date("transfer_date"),

  // Pre-admission
  preadmissionDate:        date("preadmission_date"),
  preadmissionConvertedAt: timestamp("preadmission_converted_at", { withTimezone: true }),

  siteId: uuid("site_id").references(() => sitesTable.id, { onDelete: "set null" }),
  notes:  text("notes"),

  // Audit
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt:  timestamp("deleted_at", { withTimezone: true }),
  createdBy:  uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  updatedBy:  uuid("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
  deletedBy:  uuid("deleted_by").references(() => usersTable.id, { onDelete: "set null" }),
}, (t) => [
  uniqueIndex("admissions_number_idx").on(t.admissionNumber),
  index("admissions_patient_idx").on(t.patientId),
  index("admissions_encounter_idx").on(t.encounterId),
  index("admissions_status_idx").on(t.status),
  index("admissions_date_idx").on(t.admissionDate),
  index("admissions_site_idx").on(t.siteId),
  index("admissions_service_idx").on(t.serviceId),
  index("admissions_bed_idx").on(t.bedId),
  index("admissions_deleted_at_idx").on(t.deletedAt),
]);

// ─── Admission Timeline Events ────────────────────────────────────────────────

export const admissionTimelineEventsTable = pgTable("admission_timeline_events", {
  id:          uuid("id").primaryKey().defaultRandom(),
  admissionId: uuid("admission_id").notNull().references(() => admissionsTable.id, { onDelete: "cascade" }),
  type:        text("type").notNull(),          // AdmissionTimelineEventType
  description: text("description").notNull(),
  date:        timestamp("date", { withTimezone: true }).defaultNow().notNull(),
  userId:      uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  userName:    text("user_name"),
  meta:        text("meta"),                    // JSON string for extra data
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("adm_timeline_admission_idx").on(t.admissionId),
  index("adm_timeline_date_idx").on(t.date),
]);

// ─── Insert Schemas & Types ───────────────────────────────────────────────────

export const insertAdmissionSchema              = createInsertSchema(admissionsTable).omit({ id: true });
export const insertAdmissionTimelineEventSchema = createInsertSchema(admissionTimelineEventsTable).omit({ id: true });

export type InsertAdmission              = z.infer<typeof insertAdmissionSchema>;
export type InsertAdmissionTimelineEvent = z.infer<typeof insertAdmissionTimelineEventSchema>;
export type DbAdmission                  = typeof admissionsTable.$inferSelect;
export type DbAdmissionTimelineEvent     = typeof admissionTimelineEventsTable.$inferSelect;
