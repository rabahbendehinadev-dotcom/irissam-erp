/**
 * Domain 9a — Lab Orders
 * All laboratory test orders linked to an encounter.
 */
import {
  pgTable, uuid, text, boolean, timestamp, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { urgencyLevelEnum, labStatusEnum, sourceModuleEnum } from "./enums";
import { usersTable } from "./users";
import { patientsTable } from "./patients";
import { encountersTable } from "./encounters";

// ─── Lab Orders ───────────────────────────────────────────────────────────────

export const labOrdersTable = pgTable("lab_orders", {
  id:          uuid("id").primaryKey().defaultRandom(),
  encounterId: uuid("encounter_id").references(() => encountersTable.id, { onDelete: "restrict" }),
  patientId:   uuid("patient_id").references(() => patientsTable.id, { onDelete: "restrict" }),
  patientName: text("patient_name").notNull(),
  visitId:     text("visit_id"),               // Legacy visit reference

  test:      text("test").notNull(),
  category:  text("category").notNull(),
  urgency:   urgencyLevelEnum("urgency").default("routine").notNull(),

  requestedById:   uuid("requested_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  requestedByName: text("requested_by_name").notNull(),
  requestedAt:     timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),

  status:      labStatusEnum("status").default("demandee").notNull(),
  result:      text("result"),
  isCritical:  boolean("is_critical").default(false).notNull(),
  resultAt:    timestamp("result_at", { withTimezone: true }),

  validatedById:   uuid("validated_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  validatedByName: text("validated_by_name"),
  laboratory:      text("laboratory"),
  sourceModule:    sourceModuleEnum("source_module").notNull(),

  // Publication portail patient — colonnes déjà présentes en base (migration SQL
  // antérieure) ; on ne fait que les mapper ici. PAS de nouvelle colonne.
  publishedToPatient: boolean("published_to_patient").default(false).notNull(),
  publishedAt:        timestamp("published_at", { withTimezone: true }),

  // Audit
  updatedAt:  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt:  timestamp("deleted_at", { withTimezone: true }),
  createdBy:  uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  updatedBy:  uuid("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
}, (t) => [
  index("lab_orders_encounter_idx").on(t.encounterId),
  index("lab_orders_patient_idx").on(t.patientId),
  index("lab_orders_status_idx").on(t.status),
  index("lab_orders_urgency_idx").on(t.urgency),
  index("lab_orders_requested_at_idx").on(t.requestedAt),
  index("lab_orders_deleted_at_idx").on(t.deletedAt),
]);

// ─── Insert Schemas & Types ───────────────────────────────────────────────────

export const insertLabOrderSchema = createInsertSchema(labOrdersTable).omit({ id: true });
export type InsertLabOrder = z.infer<typeof insertLabOrderSchema>;
export type DbLabOrder     = typeof labOrdersTable.$inferSelect;
