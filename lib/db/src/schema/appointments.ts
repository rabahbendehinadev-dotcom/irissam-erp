import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const appointmentsTable = pgTable("appointments", {
  id: serial("id").primaryKey(),
  patientName: text("patient_name").notNull(),
  service: text("service").notNull(),
  doctorName: text("doctor_name").notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  status: text("status").notNull().default("pending"), // confirmed | pending | cancelled | completed | no_show
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Extended fields for full appointments page
  patientFirstName: text("patient_first_name"),
  patientLastName: text("patient_last_name"),
  patientId: integer("patient_id"),
  departmentName: text("department_name"),
  duration: integer("duration").default(30).notNull(),
  notes: text("notes"),
});

export const insertAppointmentSchema = createInsertSchema(appointmentsTable).omit({ id: true });
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointmentsTable.$inferSelect;
