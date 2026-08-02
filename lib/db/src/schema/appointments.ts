/**
 * Domain 11b — Appointments
 * Full appointment scheduling with proper FKs.
 * REPLACES the legacy appointments table (serial PK + denormalized text fields).
 */
import {
  pgTable, uuid, text, integer, timestamp, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { appointmentStatusEnum, consultationTypeEnum } from "./enums";
import { sitesTable, departmentsTable } from "./infrastructure";
import { usersTable } from "./users";
import { patientsTable } from "./patients";

// ─── Appointments ─────────────────────────────────────────────────────────────

export const appointmentsTable = pgTable("appointments", {
  id:          uuid("id").primaryKey().defaultRandom(),
  patientId:   uuid("patient_id").references(() => patientsTable.id, { onDelete: "restrict" }),
  patientName: text("patient_name").notNull(),
  patientMpi:  text("patient_mpi"),

  doctorId:       uuid("doctor_id").references(() => usersTable.id, { onDelete: "set null" }),
  doctorName:     text("doctor_name").notNull(),
  departmentId:   uuid("department_id").references(() => departmentsTable.id, { onDelete: "set null" }),
  departmentName: text("department_name").notNull(),

  scheduledAt:     timestamp("scheduled_at", { withTimezone: true }).notNull(),
  duration:        integer("duration").default(30).notNull(),   // minutes
  status:          appointmentStatusEnum("status").default("pending").notNull(),
  type:            consultationTypeEnum("type").default("consultation_externe").notNull(),
  cancelledReason: text("cancelled_reason"),
  notes:           text("notes"),

  siteId: uuid("site_id").references(() => sitesTable.id, { onDelete: "set null" }),

  // Audit
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt:  timestamp("deleted_at", { withTimezone: true }),
  createdBy:  uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  updatedBy:  uuid("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
}, (t) => [
  index("appts_patient_idx").on(t.patientId),
  index("appts_doctor_idx").on(t.doctorId),
  index("appts_dept_idx").on(t.departmentId),
  index("appts_status_idx").on(t.status),
  index("appts_scheduled_at_idx").on(t.scheduledAt),
  index("appts_site_idx").on(t.siteId),
  index("appts_deleted_at_idx").on(t.deletedAt),
]);

// ─── Insert Schemas & Types ───────────────────────────────────────────────────

export const insertAppointmentSchema = createInsertSchema(appointmentsTable).omit({ id: true });
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type DbAppointment     = typeof appointmentsTable.$inferSelect;
