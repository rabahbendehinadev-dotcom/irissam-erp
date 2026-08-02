/**
 * Domain 3 — Patient Registry
 * Complete patient demographics, normalized (no JSON blobs).
 * Supports UUID PK, soft-delete, full audit trail.
 * REPLACES the legacy serial-PK patients table.
 */
import {
  pgTable, uuid, text, boolean, date, timestamp, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import {
  genderEnum, bloodTypeEnum, rhesusEnum, maritalStatusEnum,
  idDocumentTypeEnum, insuranceTypeEnum, patientStatusEnum, syncStatusEnum,
} from "./enums";
import { sitesTable } from "./infrastructure";
import { usersTable } from "./users";

// ─── Patients ─────────────────────────────────────────────────────────────────

export const patientsTable = pgTable("patients", {
  id:             uuid("id").primaryKey().defaultRandom(),
  mpiId:          text("mpi_id").notNull(),           // Master Patient Index
  fileNumber:     text("file_number").notNull(),       // Hospital file number
  internalNumber: text("internal_number"),             // Internal reference

  // Identity
  firstName:      text("first_name").notNull(),
  lastName:       text("last_name").notNull(),
  maidenName:     text("maiden_name"),
  gender:         genderEnum("gender").notNull(),
  dateOfBirth:    date("date_of_birth").notNull(),
  placeOfBirth:   text("place_of_birth"),
  nationality:    text("nationality").default("DZ").notNull(),
  maritalStatus:  maritalStatusEnum("marital_status"),
  photoUrl:       text("photo_url"),

  // Identity documents
  idDocumentType:       idDocumentTypeEnum("id_document_type"),
  idDocumentNumber:     text("id_document_number"),
  socialSecurityNumber: text("social_security_number"),

  // Contact
  phone:          text("phone").notNull(),
  phoneSecondary: text("phone_secondary"),
  email:          text("email"),
  address:        text("address"),
  commune:        text("commune"),
  wilaya:         text("wilaya"),
  postalCode:     text("postal_code"),
  country:        text("country").default("DZ").notNull(),

  // Medical
  bloodType:    bloodTypeEnum("blood_type"),
  rhesus:       rhesusEnum("rhesus"),
  allergies:    text("allergies").array().default([]).notNull(),
  chronicDiseases: text("chronic_diseases").array().default([]).notNull(),
  majorHistory: text("major_history").array().default([]).notNull(),
  disability:   text("disability"),
  criticalNotes: text("critical_notes"),

  // Emergency contact (normalized; one per patient, add table if multiple needed)
  emergencyContactName:     text("emergency_contact_name"),
  emergencyContactRelation: text("emergency_contact_relation"),
  emergencyContactPhone:    text("emergency_contact_phone"),
  emergencyContactAddress:  text("emergency_contact_address"),

  // Insurance
  insuranceType:         insuranceTypeEnum("insurance_type"),
  insuranceOrgName:      text("insurance_org_name"),
  insuranceMemberNumber: text("insurance_member_number"),
  insuranceValidUntil:   date("insurance_valid_until"),

  // Site
  siteId:       uuid("site_id").references(() => sitesTable.id, { onDelete: "set null" }),
  departmentId: uuid("department_id"),

  // Status
  status:             patientStatusEnum("status").default("active").notNull(),
  syncStatus:         syncStatusEnum("sync_status").default("synced").notNull(),
  isIncomplete:       boolean("is_incomplete").default(false).notNull(),
  potentialDuplicate: boolean("potential_duplicate").default(false).notNull(),

  // Audit
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt:  timestamp("deleted_at", { withTimezone: true }),
  createdBy:  uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  updatedBy:  uuid("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
  deletedBy:  uuid("deleted_by").references(() => usersTable.id, { onDelete: "set null" }),
}, (t) => [
  uniqueIndex("patients_mpi_idx").on(t.mpiId),
  uniqueIndex("patients_file_number_idx").on(t.fileNumber),
  index("patients_name_idx").on(t.lastName, t.firstName),
  index("patients_site_idx").on(t.siteId),
  index("patients_status_idx").on(t.status),
  index("patients_dob_idx").on(t.dateOfBirth),
  index("patients_deleted_at_idx").on(t.deletedAt),
]);

// ─── Patient Timeline Events ──────────────────────────────────────────────────

export const patientTimelineEventsTable = pgTable("patient_timeline_events", {
  id:          uuid("id").primaryKey().defaultRandom(),
  patientId:   uuid("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  type:        text("type").notNull(),   // TimelineEventType
  title:       text("title").notNull(),
  description: text("description"),
  siteId:      uuid("site_id").references(() => sitesTable.id, { onDelete: "set null" }),
  siteName:    text("site_name"),
  doctor:      text("doctor"),
  service:     text("service"),
  userId:      uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  userName:    text("user_name"),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("patient_timeline_patient_idx").on(t.patientId),
  index("patient_timeline_type_idx").on(t.type),
  index("patient_timeline_created_idx").on(t.createdAt),
]);

// ─── Insert Schemas & Types ───────────────────────────────────────────────────

export const insertPatientSchema              = createInsertSchema(patientsTable).omit({ id: true });
export const insertPatientTimelineEventSchema = createInsertSchema(patientTimelineEventsTable).omit({ id: true });

export type InsertPatient              = z.infer<typeof insertPatientSchema>;
export type InsertPatientTimelineEvent = z.infer<typeof insertPatientTimelineEventSchema>;
export type DbPatient                  = typeof patientsTable.$inferSelect;
export type DbPatientTimelineEvent     = typeof patientTimelineEventsTable.$inferSelect;
