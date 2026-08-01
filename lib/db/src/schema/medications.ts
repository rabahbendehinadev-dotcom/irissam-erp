import { pgTable, serial, text, integer, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const medicationsTable = pgTable("medications", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  quantity: integer("quantity").default(0).notNull(),
  unit: text("unit").default("unités").notNull(),
  lowStockThreshold: integer("low_stock_threshold").default(50).notNull(),
  expiryDate: date("expiry_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMedicationSchema = createInsertSchema(medicationsTable).omit({ id: true });
export type InsertMedication = z.infer<typeof insertMedicationSchema>;
export type Medication = typeof medicationsTable.$inferSelect;
