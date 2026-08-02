/**
 * Domain 1 — Infrastructure: Sites, Buildings, Floors, Departments, Services
 * Supports multi-site / multi-building / multi-floor from the ground up.
 */
import {
  pgTable, uuid, text, integer, boolean, timestamp, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Sites ────────────────────────────────────────────────────────────────────

export const sitesTable = pgTable("sites", {
  id:         uuid("id").primaryKey().defaultRandom(),
  name:       text("name").notNull(),
  code:       text("code").notNull(),
  address:    text("address"),
  city:       text("city"),
  wilaya:     text("wilaya"),
  postalCode: text("postal_code"),
  phone:      text("phone"),
  email:      text("email"),
  isActive:   boolean("is_active").default(true).notNull(),
  // Audit
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt:  timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  uniqueIndex("sites_code_idx").on(t.code),
]);

// ─── Buildings ────────────────────────────────────────────────────────────────

export const buildingsTable = pgTable("buildings", {
  id:          uuid("id").primaryKey().defaultRandom(),
  siteId:      uuid("site_id").notNull().references(() => sitesTable.id, { onDelete: "restrict" }),
  name:        text("name").notNull(),
  code:        text("code").notNull(),
  floorsCount: integer("floors_count").default(1).notNull(),
  // Audit
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt:   timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  index("buildings_site_idx").on(t.siteId),
]);

// ─── Floors ───────────────────────────────────────────────────────────────────

export const floorsTable = pgTable("floors", {
  id:         uuid("id").primaryKey().defaultRandom(),
  buildingId: uuid("building_id").notNull().references(() => buildingsTable.id, { onDelete: "restrict" }),
  name:       text("name").notNull(),
  level:      integer("level").notNull(),
  // Audit
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt:  timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  index("floors_building_idx").on(t.buildingId),
]);

// ─── Departments ──────────────────────────────────────────────────────────────

export const departmentsTable = pgTable("departments", {
  id:           uuid("id").primaryKey().defaultRandom(),
  siteId:       uuid("site_id").notNull().references(() => sitesTable.id, { onDelete: "restrict" }),
  buildingId:   uuid("building_id").references(() => buildingsTable.id, { onDelete: "set null" }),
  floorId:      uuid("floor_id").references(() => floorsTable.id, { onDelete: "set null" }),
  name:         text("name").notNull(),
  code:         text("code").notNull(),
  color:        text("color").default("#6366F1").notNull(),
  // headDoctorId references usersTable — set via ALTER after users table is created
  headDoctorId: uuid("head_doctor_id"),
  capacity:     integer("capacity").default(0).notNull(),
  isActive:     boolean("is_active").default(true).notNull(),
  // Audit
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt:    timestamp("deleted_at", { withTimezone: true }),
  createdBy:    uuid("created_by"),
  updatedBy:    uuid("updated_by"),
}, (t) => [
  index("departments_site_idx").on(t.siteId),
  index("departments_building_idx").on(t.buildingId),
  uniqueIndex("departments_site_code_idx").on(t.siteId, t.code),
]);

// ─── Services (Wards / Specialties) ───────────────────────────────────────────

export const servicesTable = pgTable("services", {
  id:           uuid("id").primaryKey().defaultRandom(),
  siteId:       uuid("site_id").references(() => sitesTable.id, { onDelete: "restrict" }),
  departmentId: uuid("department_id").references(() => departmentsTable.id, { onDelete: "set null" }),
  name:         text("name").notNull(),
  code:         text("code").notNull(),
  specialty:    text("specialty"),
  isActive:     boolean("is_active").default(true).notNull(),
  // Audit
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt:    timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  index("services_site_idx").on(t.siteId),
  index("services_dept_idx").on(t.departmentId),
]);

// ─── Insert Schemas ───────────────────────────────────────────────────────────

export const insertSiteSchema       = createInsertSchema(sitesTable).omit({ id: true });
export const insertBuildingSchema   = createInsertSchema(buildingsTable).omit({ id: true });
export const insertFloorSchema      = createInsertSchema(floorsTable).omit({ id: true });
export const insertDepartmentSchema = createInsertSchema(departmentsTable).omit({ id: true });
export const insertServiceSchema    = createInsertSchema(servicesTable).omit({ id: true });

export type InsertSite       = z.infer<typeof insertSiteSchema>;
export type InsertBuilding   = z.infer<typeof insertBuildingSchema>;
export type InsertFloor      = z.infer<typeof insertFloorSchema>;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type InsertService    = z.infer<typeof insertServiceSchema>;

export type Site       = typeof sitesTable.$inferSelect;
export type Building   = typeof buildingsTable.$inferSelect;
export type Floor      = typeof floorsTable.$inferSelect;
export type Department = typeof departmentsTable.$inferSelect;
export type Service    = typeof servicesTable.$inferSelect;
