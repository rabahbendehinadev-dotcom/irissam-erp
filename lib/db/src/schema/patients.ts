import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const patientsTable = pgTable("patients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  fileNumber: text("file_number").notNull().unique(),
  service: text("service").notNull(),
  registeredAt: timestamp("registered_at").defaultNow().notNull(),
});

export const insertPatientSchema = createInsertSchema(patientsTable).omit({ id: true });
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Patient = typeof patientsTable.$inferSelect;
