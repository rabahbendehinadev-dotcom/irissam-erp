import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bloodBankTable = pgTable("blood_bank", {
  id: serial("id").primaryKey(),
  bloodType: text("blood_type").notNull(), // e.g. 'A+', 'O-'
  totalBags: integer("total_bags").default(0).notNull(),
  availableBags: integer("available_bags").default(0).notNull(),
  urgentRequests: integer("urgent_requests").default(0).notNull(),
  expiringSoon: integer("expiring_soon").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBloodBankSchema = createInsertSchema(bloodBankTable).omit({ id: true });
export type InsertBloodBank = z.infer<typeof insertBloodBankSchema>;
export type BloodBank = typeof bloodBankTable.$inferSelect;
