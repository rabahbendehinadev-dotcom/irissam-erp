/**
 * Domain 9b — Imaging Orders (Radiology)
 * Covers the full radiology workflow: ordered → realized → reported → interpreted.
 */
import {
  pgTable, uuid, text, boolean, timestamp, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { urgencyLevelEnum, imagingStatusEnum, sourceModuleEnum } from "./enums";
import { usersTable } from "./users";
import { patientsTable } from "./patients";
import { encountersTable } from "./encounters";

// ─── Imaging Orders ───────────────────────────────────────────────────────────

export const imagingOrdersTable = pgTable("imaging_orders", {
  id:          uuid("id").primaryKey().defaultRandom(),
  encounterId: uuid("encounter_id").references(() => encountersTable.id, { onDelete: "restrict" }),
  patientId:   uuid("patient_id").references(() => patientsTable.id, { onDelete: "restrict" }),
  patientName: text("patient_name").notNull(),
  visitId:     text("visit_id"),

  exam:         text("exam").notNull(),
  region:       text("region").notNull(),
  side:         text("side"),               // gauche | droit | bilateral
  urgency:      urgencyLevelEnum("urgency").default("routine").notNull(),
  withContrast: boolean("with_contrast").default(false).notNull(),

  requestedById:   uuid("requested_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  requestedByName: text("requested_by_name").notNull(),
  requestedAt:     timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),

  status:   imagingStatusEnum("status").default("demandee").notNull(),
  result:   text("result"),
  resultAt: timestamp("result_at", { withTimezone: true }),

  // Report (compte rendu radiologique)
  report:         text("report"),
  reportedById:   uuid("reported_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  reportedByName: text("reported_by_name"),
  reportedAt:     timestamp("reported_at", { withTimezone: true }),

  // Interpretation
  interpretedById:   uuid("interpreted_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  interpretedByName: text("interpreted_by_name"),
  interpretedAt:     timestamp("interpreted_at", { withTimezone: true }),

  sourceModule: sourceModuleEnum("source_module").notNull(),

  // Audit
  updatedAt:  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt:  timestamp("deleted_at", { withTimezone: true }),
  createdBy:  uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  updatedBy:  uuid("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
}, (t) => [
  index("img_orders_encounter_idx").on(t.encounterId),
  index("img_orders_patient_idx").on(t.patientId),
  index("img_orders_status_idx").on(t.status),
  index("img_orders_requested_at_idx").on(t.requestedAt),
  index("img_orders_deleted_at_idx").on(t.deletedAt),
]);

// ─── Insert Schemas & Types ───────────────────────────────────────────────────

export const insertImagingOrderSchema = createInsertSchema(imagingOrdersTable).omit({ id: true });
export type InsertImagingOrder = z.infer<typeof insertImagingOrderSchema>;
export type DbImagingOrder     = typeof imagingOrdersTable.$inferSelect;
