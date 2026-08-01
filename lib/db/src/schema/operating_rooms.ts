import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// status: 'available' | 'occupied' | 'prep' | 'maintenance'
export const operatingRoomsTable = pgTable("operating_rooms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").default("available").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOperatingRoomSchema = createInsertSchema(operatingRoomsTable).omit({ id: true });
export type InsertOperatingRoom = z.infer<typeof insertOperatingRoomSchema>;
export type OperatingRoom = typeof operatingRoomsTable.$inferSelect;
