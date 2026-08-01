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
  // Extended fields for full patient page
  firstName: text("first_name"),
  lastName: text("last_name"),
  mpiId: text("mpi_id"),
  internalNumber: text("internal_number"),
  gender: text("gender"), // M | F
  dateOfBirth: text("date_of_birth"), // YYYY-MM-DD
  phone: text("phone"),
  bloodType: text("blood_type"),
  status: text("status").default("active").notNull(), // active | inactive | archived | deceased
  syncStatus: text("sync_status").default("synced").notNull(), // synced | pending | conflict | error
  isIncomplete: boolean("is_incomplete").default(false).notNull(),
  potentialDuplicate: boolean("potential_duplicate").default(false).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPatientSchema = createInsertSchema(patientsTable).omit({ id: true });
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Patient = typeof patientsTable.$inferSelect;
