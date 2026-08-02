/**
 * Domain 4 — Encounters (Central Clinical Entity)
 * Every clinical record (lab, imaging, prescription, procedure, note)
 * belongs to an Encounter. An Encounter belongs to a Patient.
 *
 * "لا يتم إنشاء أي سجل خارج Encounter"
 */
import {
  pgTable, uuid, text, timestamp, jsonb, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { encounterTypeEnum, encounterStatusEnum, sourceModuleEnum } from "./enums";
import { sitesTable } from "./infrastructure";
import { usersTable } from "./users";
import { patientsTable } from "./patients";

// ─── Encounters ───────────────────────────────────────────────────────────────

export const encountersTable = pgTable("encounters", {
  id:              uuid("id").primaryKey().defaultRandom(),
  encounterNumber: text("encounter_number").notNull(), // Unique human-readable ID: ENC-2026-00001
  patientId:       uuid("patient_id").notNull().references(() => patientsTable.id, { onDelete: "restrict" }),
  patientName:     text("patient_name").notNull(),     // Denormalized for query speed
  patientMrn:      text("patient_mrn"),                // Denormalized MRN for display

  type:            encounterTypeEnum("type").notNull(),
  status:          encounterStatusEnum("status").default("open").notNull(),
  chiefComplaint:  text("chief_complaint").notNull(),

  // Source
  sourceModule:   sourceModuleEnum("source_module").notNull(),
  sourceRecordId: text("source_record_id"),  // visit-{id}, consultation-{id}, etc.

  // Linked records (append-only array of {recordType, recordId, summary, createdAt})
  linkedRecords:  jsonb("linked_records").default([]).notNull(),

  // Workflow state (mirrors EmergencyPatientStatus for urgence encounters)
  workflowStatus: text("workflow_status"),

  // Staff
  primaryDoctorId:   uuid("primary_doctor_id").references(() => usersTable.id, { onDelete: "set null" }),
  primaryDoctorName: text("primary_doctor_name"),
  primaryNurseId:    uuid("primary_nurse_id").references(() => usersTable.id, { onDelete: "set null" }),
  primaryNurseName:  text("primary_nurse_name"),

  // Location
  roomId:   uuid("room_id"),   // FK to emergency_rooms or occupancy_rooms — set dynamically
  roomName: text("room_name"),
  wardId:   uuid("ward_id"),
  wardName: text("ward_name"),

  // Site
  siteId: uuid("site_id").references(() => sitesTable.id, { onDelete: "set null" }),

  // Timestamps
  openedAt:    timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
  closedAt:    timestamp("closed_at", { withTimezone: true }),
  closeReason: text("close_reason"),  // visitCloseReasonEnum value

  // Audit
  updatedAt:     timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt:     timestamp("deleted_at", { withTimezone: true }),
  createdBy:     uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdByName: text("created_by_name"),
  updatedBy:     uuid("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
}, (t) => [
  uniqueIndex("encounters_number_idx").on(t.encounterNumber),
  index("encounters_patient_idx").on(t.patientId),
  index("encounters_status_idx").on(t.status),
  index("encounters_type_idx").on(t.type),
  index("encounters_site_idx").on(t.siteId),
  index("encounters_opened_at_idx").on(t.openedAt),
  index("encounters_deleted_at_idx").on(t.deletedAt),
]);

// ─── Insert Schemas & Types ───────────────────────────────────────────────────

export const insertEncounterSchema = createInsertSchema(encountersTable).omit({ id: true });
export type InsertEncounter = z.infer<typeof insertEncounterSchema>;
export type DbEncounter     = typeof encountersTable.$inferSelect;
