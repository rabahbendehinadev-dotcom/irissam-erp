import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const appointmentsTable = pgTable("appointments", {
  id: serial("id").primaryKey(),
  patientName: text("patient_name").notNull(),
  service: text("service").notNull(),
  doctorName: text("doctor_name").notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  status: text("status").notNull().default("pending"), // confirmed | pending | cancelled
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAppointmentSchema = createInsertSchema(appointmentsTable).omit({ id: true });
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointmentsTable.$inferSelect;
