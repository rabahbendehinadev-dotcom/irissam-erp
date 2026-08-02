/**
 * Domain — General Vehicles (non-medical transport)
 * Kept for backward-compat with existing dashboard routes.
 * Medical ambulances use the `ambulances` table in emergency.ts.
 * @deprecated For ambulance management, use ambulancesTable from emergency.ts
 */
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Vehicles (legacy — dashboard read-only) ──────────────────────────────────
// This table is kept for the existing /api/vehicles/status dashboard route.
// New code should use ambulancesTable from emergency.ts.

export const vehiclesTable = pgTable("vehicles", {
  id:           serial("id").primaryKey(),
  registration: text("registration").notNull(),
  type:         text("type").default("ambulance").notNull(),
  status:       text("status").default("available").notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
});

export const insertVehicleSchema = createInsertSchema(vehiclesTable).omit({ id: true });
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle       = typeof vehiclesTable.$inferSelect;
