import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const alertsTable = pgTable("alerts", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // critical | warning | info  (kept for dashboard backward compat)
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Extended fields for full alerts page
  severity: text("severity").default("medium").notNull(), // critical | high | medium | low
  category: text("category").default("lab").notNull(), // lab | stock | medication | capacity | equipment | schedule
  description: text("description"),
  isRead: boolean("is_read").default(false).notNull(),
  patientId: integer("patient_id"),
});

export const insertAlertSchema = createInsertSchema(alertsTable).omit({ id: true });
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alertsTable.$inferSelect;
