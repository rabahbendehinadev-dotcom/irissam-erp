/**
 * Domain 2 — Users & Authentication
 * Staff accounts with role-based access. Sessions tracked for audit.
 */
import {
  pgTable, uuid, text, timestamp, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userRoleEnum, staffStatusEnum } from "./enums";
import { sitesTable } from "./infrastructure";

// ─── Users (Staff) ────────────────────────────────────────────────────────────

export const usersTable = pgTable("users", {
  id:           uuid("id").primaryKey().defaultRandom(),
  siteId:       uuid("site_id").references(() => sitesTable.id, { onDelete: "set null" }),
  departmentId: uuid("department_id"),  // FK to departments — no circular import
  firstName:    text("first_name").notNull(),
  lastName:     text("last_name").notNull(),
  email:        text("email").notNull(),
  role:         userRoleEnum("role").notNull(),
  specialty:    text("specialty"),
  status:       staffStatusEnum("status").default("actif").notNull(),
  hashedPassword: text("hashed_password").notNull(),
  lastLoginAt:  timestamp("last_login_at", { withTimezone: true }),
  // Audit
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt:    timestamp("deleted_at", { withTimezone: true }),
  createdBy:    uuid("created_by"),  // self-ref: set after table creation
  updatedBy:    uuid("updated_by"),
  deletedBy:    uuid("deleted_by"),
}, (t) => [
  uniqueIndex("users_email_idx").on(t.email),
  index("users_site_idx").on(t.siteId),
  index("users_role_idx").on(t.role),
  index("users_status_idx").on(t.status),
]);

// ─── User Sessions ────────────────────────────────────────────────────────────

export const userSessionsTable = pgTable("user_sessions", {
  id:         uuid("id").primaryKey().defaultRandom(),
  userId:     uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tokenHash:  text("token_hash").notNull(),
  expiresAt:  timestamp("expires_at", { withTimezone: true }).notNull(),
  ip:         text("ip"),
  userAgent:  text("user_agent"),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("sessions_token_idx").on(t.tokenHash),
  index("sessions_user_idx").on(t.userId),
  index("sessions_expires_idx").on(t.expiresAt),
]);

// ─── Insert Schemas & Types ───────────────────────────────────────────────────

export const insertUserSchema    = createInsertSchema(usersTable).omit({ id: true, hashedPassword: true });
export const insertSessionSchema = createInsertSchema(userSessionsTable).omit({ id: true });

export type InsertUser    = z.infer<typeof insertUserSchema>;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type DbUser        = typeof usersTable.$inferSelect;
export type DbSession     = typeof userSessionsTable.$inferSelect;
