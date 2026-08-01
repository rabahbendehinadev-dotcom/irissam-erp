import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const patientsTable = pgTable("patients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  fileNumber: text("file_number").notNull().unique(),
  service: text("service").notNull(),
  registeredAt: timestamp("registered_at").defaultNow().notNull(),
  // Identity
  firstName: text("first_name"),
  lastName: text("last_name"),
  maidenName: text("maiden_name"),
  mpiId: text("mpi_id"),
  internalNumber: text("internal_number"),
  gender: text("gender"), // M | F
  dateOfBirth: text("date_of_birth"), // YYYY-MM-DD
  placeOfBirth: text("place_of_birth"),
  nationality: text("nationality"),
  maritalStatus: text("marital_status"),
  // ID documents
  idDocumentType: text("id_document_type"),
  idDocumentNumber: text("id_document_number"),
  socialSecurityNumber: text("social_security_number"),
  // Contact
  phone: text("phone"),
  phoneSecondary: text("phone_secondary"),
  email: text("email"),
  address: text("address"),
  commune: text("commune"),
  wilaya: text("wilaya"),
  postalCode: text("postal_code"),
  country: text("country"),
  // Medical
  bloodType: text("blood_type"),
  rhesus: text("rhesus"), // + | -
  medicalJson: text("medical_json"), // JSON: PatientMedicalInfo
  // Emergency contact
  emergencyContactJson: text("emergency_contact_json"), // JSON: PatientContact
  // Insurance
  insuranceJson: text("insurance_json"), // JSON: PatientInsurance
  // Site
  departmentId: text("department_id"),
  // Status & sync
  status: text("status").default("active").notNull(), // active | inactive | archived | deceased
  syncStatus: text("sync_status").default("synced").notNull(), // synced | pending | conflict | error
  isIncomplete: boolean("is_incomplete").default(false).notNull(),
  potentialDuplicate: boolean("potential_duplicate").default(false).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPatientSchema = createInsertSchema(patientsTable).omit({ id: true });
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Patient = typeof patientsTable.$inferSelect;
