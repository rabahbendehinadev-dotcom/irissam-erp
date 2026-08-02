/**
 * Domain — Daily Statistics (Dashboard)
 * Aggregated daily counters for the main dashboard charts.
 * Kept as-is — populated by a scheduled job / trigger.
 */
import { pgTable, serial, integer, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Daily Stats ──────────────────────────────────────────────────────────────

export const dailyStatsTable = pgTable("daily_stats", {
  id:                serial("id").primaryKey(),
  statDate:          date("stat_date").notNull(),
  totalPatients:     integer("total_patients").default(0).notNull(),
  newAdmissions:     integer("new_admissions").default(0).notNull(),
  discharges:        integer("discharges").default(0).notNull(),
  emergencyVisits:   integer("emergency_visits").default(0).notNull(),
  consultations:     integer("consultations").default(0).notNull(),
  surgeries:         integer("surgeries").default(0).notNull(),
  icuOccupancy:      integer("icu_occupancy").default(0).notNull(),
  bedOccupancyRate:  integer("bed_occupancy_rate").default(0).notNull(),
  createdAt:         timestamp("created_at").defaultNow().notNull(),
});

export const insertDailyStatsSchema = createInsertSchema(dailyStatsTable).omit({ id: true });
export type InsertDailyStats = z.infer<typeof insertDailyStatsSchema>;
export type DailyStats       = typeof dailyStatsTable.$inferSelect;
