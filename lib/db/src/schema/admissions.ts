import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const admissionsTable = pgTable("admissions", {
  id: serial("id").primaryKey(),
  patientName: text("patient_name").notNull(),
  service: text("service").notNull(),
  admittedAt: timestamp("admitted_at").defaultNow().notNull(),
  dischargedAt: timestamp("discharged_at"), // null = still admitted
});

export const insertAdmissionSchema = createInsertSchema(admissionsTable).omit({ id: true });
export type InsertAdmission = z.infer<typeof insertAdmissionSchema>;
export type Admission = typeof admissionsTable.$inferSelect;
