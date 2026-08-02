/**
 * Domain 10 — Pharmacy Stock / Inventory
 * Medication stock management (NOT to be confused with prescriptions).
 * REPLACES the legacy medications table (serial PK, no soft delete, no lots).
 */
import {
  pgTable, uuid, text, integer, real, date, timestamp, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sitesTable } from "./infrastructure";
import { usersTable } from "./users";

// ─── Medications (Inventory) ──────────────────────────────────────────────────

export const medicationsTable = pgTable("medications", {
  id:                uuid("id").primaryKey().defaultRandom(),
  name:              text("name").notNull(),
  genericName:       text("generic_name"),
  category:          text("category"),             // antibiotique | antalgique | anesthésique | …
  form:              text("form"),                 // comprimé | ampoule | flacon | …
  unit:              text("unit").default("unités").notNull(),
  quantity:          integer("quantity").default(0).notNull(),
  lowStockThreshold: integer("low_stock_threshold").default(50).notNull(),
  expiryDate:        date("expiry_date"),
  supplier:          text("supplier"),
  location:          text("location"),             // storage location in pharmacy
  price:             real("price"),

  siteId: uuid("site_id").references(() => sitesTable.id, { onDelete: "set null" }),

  // Audit
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt:  timestamp("deleted_at", { withTimezone: true }),
  createdBy:  uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  updatedBy:  uuid("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
  deletedBy:  uuid("deleted_by").references(() => usersTable.id, { onDelete: "set null" }),
}, (t) => [
  index("medications_name_idx").on(t.name),
  index("medications_category_idx").on(t.category),
  index("medications_site_idx").on(t.siteId),
  index("medications_expiry_idx").on(t.expiryDate),
  index("medications_deleted_at_idx").on(t.deletedAt),
]);

// ─── Medication Lots ──────────────────────────────────────────────────────────

export const medicationLotsTable = pgTable("medication_lots", {
  id:           uuid("id").primaryKey().defaultRandom(),
  medicationId: uuid("medication_id").notNull().references(() => medicationsTable.id, { onDelete: "cascade" }),
  lotNumber:    text("lot_number").notNull(),
  quantity:     integer("quantity").default(0).notNull(),
  expiryDate:   date("expiry_date").notNull(),
  receivedAt:   timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  receivedBy:   uuid("received_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("med_lots_medication_idx").on(t.medicationId),
  index("med_lots_expiry_idx").on(t.expiryDate),
]);

// ─── Insert Schemas & Types ───────────────────────────────────────────────────

export const insertMedicationSchema    = createInsertSchema(medicationsTable).omit({ id: true });
export const insertMedicationLotSchema = createInsertSchema(medicationLotsTable).omit({ id: true });

export type InsertMedication    = z.infer<typeof insertMedicationSchema>;
export type InsertMedicationLot = z.infer<typeof insertMedicationLotSchema>;
export type DbMedication        = typeof medicationsTable.$inferSelect;
export type DbMedicationLot     = typeof medicationLotsTable.$inferSelect;
