import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bedsTable = pgTable("beds", {
  id: serial("id").primaryKey(),
  service: text("service").notNull(),
  totalBeds: integer("total_beds").default(0).notNull(),
  occupiedBeds: integer("occupied_beds").default(0).notNull(),
  cleaningBeds: integer("cleaning_beds").default(0).notNull(),
  outOfServiceBeds: integer("out_of_service_beds").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBedSchema = createInsertSchema(bedsTable).omit({ id: true });
export type InsertBed = z.infer<typeof insertBedSchema>;
export type Bed = typeof bedsTable.$inferSelect;
