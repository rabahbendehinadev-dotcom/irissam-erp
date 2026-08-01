import { pgTable, serial, date, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dailyStatsTable = pgTable("daily_stats", {
  id: serial("id").primaryKey(),
  date: date("date").notNull().unique(),
  consultations: integer("consultations").default(0).notNull(),
  rendezVous: integer("rendez_vous").default(0).notNull(),
  admissions: integer("admissions").default(0).notNull(),
  sorties: integer("sorties").default(0).notNull(),
  analyses: integer("analyses").default(0).notNull(),
  imaging: integer("imaging").default(0).notNull(),
  invoices: integer("invoices").default(0).notNull(),
  revenueDA: integer("revenue_da").default(0).notNull(),
});

export const insertDailyStatSchema = createInsertSchema(dailyStatsTable).omit({ id: true });
export type InsertDailyStat = z.infer<typeof insertDailyStatSchema>;
export type DailyStat = typeof dailyStatsTable.$inferSelect;
