/**
 * Domain 11a — Consultations
 * Full clinical consultations linked to encounters.
 * REPLACES the legacy consultations table (which had serial PK and partial fields).
 */
import {
  pgTable, uuid, text, integer, timestamp, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import {
  consultationTypeEnum, consultationStatusEnum, consultationOriginEnum, syncStatusEnum,
} from "./enums";
import { sitesTable } from "./infrastructure";
import { usersTable } from "./users";
import { patientsTable } from "./patients";
import { encountersTable } from "./encounters";

// ─── Consultations ────────────────────────────────────────────────────────────

export const consultationsTable = pgTable("consultations", {
  id:          uuid("id").primaryKey().defaultRandom(),
  encounterId: uuid("encounter_id").references(() => encountersTable.id, { onDelete: "set null" }),
  number:      text("number").notNull(),          // e.g. "CONS-2026-001"

  patientId:   uuid("patient_id").references(() => patientsTable.id, { onDelete: "restrict" }),
  patientName: text("patient_name").notNull(),
  patientMpi:  text("patient_mpi").notNull(),

  doctorId:    uuid("doctor_id").references(() => usersTable.id, { onDelete: "set null" }),
  doctorName:  text("doctor_name").notNull(),
  specialty:   text("specialty").notNull(),
  serviceId:   uuid("service_id"),
  serviceName: text("service_name").notNull(),

  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  startedAt:   timestamp("started_at", { withTimezone: true }),
  endedAt:     timestamp("ended_at", { withTimezone: true }),
  duration:    integer("duration"),              // minutes

  type:      consultationTypeEnum("type").default("consultation_externe").notNull(),
  origin:    consultationOriginEnum("origin").default("rdv").notNull(),
  reason:    text("reason").notNull(),
  status:    consultationStatusEnum("status").default("en_attente").notNull(),
  diagnosis: text("diagnosis"),
  notes:     text("notes"),

  siteId:     uuid("site_id").references(() => sitesTable.id, { onDelete: "set null" }),
  syncStatus: syncStatusEnum("sync_status").default("synced").notNull(),

  // Audit
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt:  timestamp("deleted_at", { withTimezone: true }),
  createdBy:  uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  updatedBy:  uuid("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
}, (t) => [
  uniqueIndex("consultations_number_idx").on(t.number),
  index("consultations_patient_idx").on(t.patientId),
  index("consultations_encounter_idx").on(t.encounterId),
  index("consultations_doctor_idx").on(t.doctorId),
  index("consultations_status_idx").on(t.status),
  index("consultations_site_idx").on(t.siteId),
  index("consultations_scheduled_at_idx").on(t.scheduledAt),
  index("consultations_deleted_at_idx").on(t.deletedAt),
]);

// ─── Insert Schemas & Types ───────────────────────────────────────────────────

export const insertConsultationSchema = createInsertSchema(consultationsTable).omit({ id: true });
export type InsertConsultation = z.infer<typeof insertConsultationSchema>;
export type DbConsultation     = typeof consultationsTable.$inferSelect;
