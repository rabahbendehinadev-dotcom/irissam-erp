/**
 * Domain 11a — Consultations
 * Full clinical consultations linked to encounters.
 * REPLACES the legacy consultations table (which had serial PK and partial fields).
 */
import {
  pgTable, uuid, text, integer, timestamp, index, uniqueIndex, date, boolean,
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
import { medicationsTable } from "./medications";

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

  // Patient de passage (consultation seule, sans dossier patient permanent) :
  // identité minimale portée par la consultation ; patientId reste NULL
  // jusqu'au rattachement éventuel (POST /consultations/:id/attach-patient).
  patientPhone:     text("patient_phone"),
  patientBirthDate: date("patient_birth_date"),
  patientGender:    text("patient_gender"),

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

// ─── Traitements de la consultation ───────────────────────────────────────────
// Soins / actes / traitements renseignés par le médecin pendant la
// consultation. La ligne porte l'utilisateur responsable et l'horodatage.

export const consultationTreatmentsTable = pgTable("consultation_treatments", {
  id:             uuid("id").primaryKey().defaultRandom(),
  consultationId: uuid("consultation_id").notNull().references(() => consultationsTable.id, { onDelete: "cascade" }),
  patientId:      uuid("patient_id").references(() => patientsTable.id, { onDelete: "restrict" }),
  designation:    text("designation").notNull(),
  note:           text("note"),
  performedAt:    timestamp("performed_at", { withTimezone: true }).defaultNow().notNull(),
  recordedBy:     uuid("recorded_by").references(() => usersTable.id, { onDelete: "set null" }),
  recordedByName: text("recorded_by_name").notNull(),
  createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("cons_treatments_consultation_idx").on(t.consultationId),
  index("cons_treatments_patient_idx").on(t.patientId),
]);

// ─── Favoris du praticien ─────────────────────────────────────────────────────
// Personnels (userId) : diagnostics / médicaments fréquents — épinglage +
// compteur d'usage pour éviter la ressaisie. medication_* ne concerne que
// kind = 'medication'. Unicité (user_id, kind, lower(label)) côté SQL (048).

export const doctorFavoritesTable = pgTable("doctor_favorites", {
  id:           uuid("id").primaryKey().defaultRandom(),
  userId:       uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  kind:         text("kind", { enum: ["diagnosis", "medication", "treatment"] }).notNull(),
  label:        text("label").notNull(),
  medicationId: uuid("medication_id").references(() => medicationsTable.id, { onDelete: "set null" }),
  dosage:       text("dosage"),
  frequency:    text("frequency"),
  duration:     text("duration"),
  instructions: text("instructions"),
  pinned:       boolean("pinned").notNull().default(false),
  usageCount:   integer("usage_count").notNull().default(0),
  lastUsedAt:   timestamp("last_used_at", { withTimezone: true }),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("doctor_favorites_user_idx").on(t.userId),
]);

// ─── Insert Schemas & Types ───────────────────────────────────────────────────

export const insertConsultationSchema = createInsertSchema(consultationsTable).omit({ id: true });
export const insertConsultationTreatmentSchema = createInsertSchema(consultationTreatmentsTable).omit({ id: true });
export const insertDoctorFavoriteSchema        = createInsertSchema(doctorFavoritesTable).omit({ id: true });
export type InsertConsultation          = z.infer<typeof insertConsultationSchema>;
export type InsertConsultationTreatment = z.infer<typeof insertConsultationTreatmentSchema>;
export type InsertDoctorFavorite        = z.infer<typeof insertDoctorFavoriteSchema>;
export type DbConsultation              = typeof consultationsTable.$inferSelect;
export type DbConsultationTreatment     = typeof consultationTreatmentsTable.$inferSelect;
export type DbDoctorFavorite            = typeof doctorFavoritesTable.$inferSelect;
