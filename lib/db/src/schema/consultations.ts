import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const consultationsTable = pgTable("consultations", {
  id: serial("id").primaryKey(),
  number: text("number").notNull(),
  patientId: integer("patient_id"),
  patientName: text("patient_name").notNull(),
  patientMpi: text("patient_mpi").notNull(),
  doctorName: text("doctor_name").notNull(),
  specialty: text("specialty").notNull(),
  serviceName: text("service_name").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  duration: integer("duration"),
  type: text("type").notNull().default("consultation_externe"), // consultation_externe | urgence | hospitalier | teleconsultation
  origin: text("origin").notNull().default("rdv"), // hospitalisation | urgence | rdv | walk_in
  reason: text("reason").notNull(),
  status: text("status").notNull().default("en_attente"), // en_attente | en_cours | terminee | planifiee | annulee
  syncStatus: text("sync_status").default("synced").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertConsultationSchema = createInsertSchema(consultationsTable).omit({ id: true });
export type InsertConsultation = z.infer<typeof insertConsultationSchema>;
export type Consultation = typeof consultationsTable.$inferSelect;
