/**
 * Domain 14 — Blood Bank
 * Per-blood-group inventory per site.
 * REPLACES the legacy minimal blood_bank table.
 */
import {
  pgTable, uuid, text, integer, date, timestamp, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { bloodTypeEnum, rhesusEnum } from "./enums";
import { sitesTable } from "./infrastructure";
import { usersTable } from "./users";

// ─── Blood Bank Inventory ─────────────────────────────────────────────────────

export const bloodBankTable = pgTable("blood_bank", {
  id:             uuid("id").primaryKey().defaultRandom(),
  siteId:         uuid("site_id").notNull().references(() => sitesTable.id, { onDelete: "restrict" }),
  bloodType:      bloodTypeEnum("blood_type").notNull(),
  rhesus:         rhesusEnum("rhesus").notNull(),
  unitsAvailable: integer("units_available").default(0).notNull(),
  unitsReserved:  integer("units_reserved").default(0).notNull(),
  expiryDate:     date("expiry_date"),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy:      uuid("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt:      timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  uniqueIndex("blood_bank_site_type_idx").on(t.siteId, t.bloodType, t.rhesus),
  index("blood_bank_site_idx").on(t.siteId),
]);

// ─── Insert Schema & Types ────────────────────────────────────────────────────

export const insertBloodBankSchema = createInsertSchema(bloodBankTable).omit({ id: true });
export type InsertBloodBank = z.infer<typeof insertBloodBankSchema>;
export type DbBloodBank     = typeof bloodBankTable.$inferSelect;
