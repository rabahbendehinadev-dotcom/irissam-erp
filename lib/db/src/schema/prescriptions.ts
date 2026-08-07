/**
 * Domain 9c — Prescriptions
 * Clinical prescriptions linked to an encounter.
 * Distinct from medications (pharmacy stock inventory).
 */
import {
  pgTable, uuid, text, timestamp, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { prescriptionStatusEnum, sourceModuleEnum } from "./enums";
import { usersTable } from "./users";
import { patientsTable } from "./patients";
import { encountersTable } from "./encounters";
import { medicationsTable } from "./medications";

// ─── Prescriptions ────────────────────────────────────────────────────────────

export const prescriptionsTable = pgTable("prescriptions", {
  id:          uuid("id").primaryKey().defaultRandom(),
  encounterId: uuid("encounter_id").references(() => encountersTable.id, { onDelete: "restrict" }),
  patientId:   uuid("patient_id").references(() => patientsTable.id, { onDelete: "restrict" }),
  patientName: text("patient_name").notNull(),
  visitId:     text("visit_id"),

  /** Lien réel vers le stock pharmacie — nullable pour les anciennes lignes texte. */
  medicationId: uuid("medication_id").references(() => medicationsTable.id, { onDelete: "set null" }),

  drug:      text("drug").notNull(),
  dosage:    text("dosage").notNull(),
  route:     text("route").notNull(),    // oral | IV | IM | SC | topique | inhalé
  frequency: text("frequency").notNull(),
  duration:  text("duration"),

  prescribedById:   uuid("prescribed_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  prescribedByName: text("prescribed_by_name").notNull(),
  prescribedAt:     timestamp("prescribed_at", { withTimezone: true }).defaultNow().notNull(),

  status: prescriptionStatusEnum("status").default("prescrit").notNull(),

  // Preparation (pharmacie)
  preparedById:   uuid("prepared_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  preparedByName: text("prepared_by_name"),
  preparedAt:     timestamp("prepared_at", { withTimezone: true }),

  // Dispensing
  dispensedById:   uuid("dispensed_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  dispensedByName: text("dispensed_by_name"),
  dispensedAt:     timestamp("dispensed_at", { withTimezone: true }),
  dispenserComment: text("dispenser_comment"),

  sourceModule: sourceModuleEnum("source_module").notNull(),
  notes:        text("notes"),

  // Audit
  updatedAt:  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt:  timestamp("deleted_at", { withTimezone: true }),
  createdBy:  uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  updatedBy:  uuid("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
}, (t) => [
  index("rx_encounter_idx").on(t.encounterId),
  index("rx_patient_idx").on(t.patientId),
  index("rx_medication_idx").on(t.medicationId),
  index("rx_status_idx").on(t.status),
  index("rx_prescribed_at_idx").on(t.prescribedAt),
  index("rx_deleted_at_idx").on(t.deletedAt),
]);

// ─── Insert Schemas & Types ───────────────────────────────────────────────────

export const insertPrescriptionSchema = createInsertSchema(prescriptionsTable).omit({ id: true });
export type InsertPrescription = z.infer<typeof insertPrescriptionSchema>;
export type DbPrescription     = typeof prescriptionsTable.$inferSelect;
