import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// status: 'available' | 'in_service' | 'maintenance'
export const vehiclesTable = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  registration: text("registration").notNull(),
  type: text("type").default("ambulance").notNull(), // ambulance | medical_transport | etc.
  status: text("status").default("available").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertVehicleSchema = createInsertSchema(vehiclesTable).omit({ id: true });
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehiclesTable.$inferSelect;
