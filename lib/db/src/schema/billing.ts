/**
 * Domain 12 — Billing: Invoices, Invoice Items, Payments
 * Full financial trail for every patient encounter.
 * Supports insurance coverage, partial payments, and dispute tracking.
 */
import {
  pgTable, uuid, text, real, timestamp, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { invoiceStatusEnum, paymentMethodEnum, insuranceTypeEnum } from "./enums";
import { sitesTable } from "./infrastructure";
import { usersTable } from "./users";
import { patientsTable } from "./patients";
import { encountersTable } from "./encounters";
import { admissionsTable } from "./admissions";

// ─── Invoices ─────────────────────────────────────────────────────────────────

export const invoicesTable = pgTable("invoices", {
  id:          uuid("id").primaryKey().defaultRandom(),
  patientId:   uuid("patient_id").notNull().references(() => patientsTable.id, { onDelete: "restrict" }),
  patientName: text("patient_name").notNull(),
  encounterId: uuid("encounter_id").references(() => encountersTable.id, { onDelete: "set null" }),
  admissionId: uuid("admission_id").references(() => admissionsTable.id, { onDelete: "set null" }),

  type:   text("type").default("consultation").notNull(),  // consultation | admission | procedure | pharmacie
  status: invoiceStatusEnum("status").default("pending").notNull(),

  insuranceType:            insuranceTypeEnum("insurance_type"),
  insuranceCoveragePercent: real("insurance_coverage_percent").default(0),

  totalAmount: real("total_amount").default(0).notNull(),
  paidAmount:  real("paid_amount").default(0).notNull(),
  dueAmount:   real("due_amount").default(0).notNull(),
  dueDate:     timestamp("due_date", { withTimezone: true }),

  notes:  text("notes"),
  siteId: uuid("site_id").references(() => sitesTable.id, { onDelete: "set null" }),

  // Audit
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt:  timestamp("deleted_at", { withTimezone: true }),
  createdBy:  uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  updatedBy:  uuid("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
}, (t) => [
  index("invoices_patient_idx").on(t.patientId),
  index("invoices_encounter_idx").on(t.encounterId),
  index("invoices_status_idx").on(t.status),
  index("invoices_site_idx").on(t.siteId),
  index("invoices_deleted_at_idx").on(t.deletedAt),
]);

// ─── Invoice Items ────────────────────────────────────────────────────────────

export const invoiceItemsTable = pgTable("invoice_items", {
  id:          uuid("id").primaryKey().defaultRandom(),
  invoiceId:   uuid("invoice_id").notNull().references(() => invoicesTable.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  category:    text("category"),                 // acte | medicament | imagerie | laboratoire | chambre
  quantity:    real("quantity").default(1).notNull(),
  unitPrice:   real("unit_price").notNull(),
  totalPrice:  real("total_price").notNull(),
  refType:     text("ref_type"),                 // lab_order | imaging_order | prescription | consultation | admission
  refId:       uuid("ref_id"),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("inv_items_invoice_idx").on(t.invoiceId),
]);

// ─── Payments ─────────────────────────────────────────────────────────────────

export const paymentsTable = pgTable("payments", {
  id:         uuid("id").primaryKey().defaultRandom(),
  invoiceId:  uuid("invoice_id").notNull().references(() => invoicesTable.id, { onDelete: "restrict" }),
  amount:     real("amount").notNull(),
  method:     paymentMethodEnum("method").notNull(),
  reference:  text("reference"),
  notes:      text("notes"),
  recordedBy: uuid("recorded_by").references(() => usersTable.id, { onDelete: "set null" }),
  paidAt:     timestamp("paid_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("payments_invoice_idx").on(t.invoiceId),
  index("payments_paid_at_idx").on(t.paidAt),
]);

// ─── Insert Schemas & Types ───────────────────────────────────────────────────

export const insertInvoiceSchema     = createInsertSchema(invoicesTable).omit({ id: true });
export const insertInvoiceItemSchema = createInsertSchema(invoiceItemsTable).omit({ id: true });
export const insertPaymentSchema     = createInsertSchema(paymentsTable).omit({ id: true });

export type InsertInvoice     = z.infer<typeof insertInvoiceSchema>;
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type InsertPayment     = z.infer<typeof insertPaymentSchema>;
export type DbInvoice         = typeof invoicesTable.$inferSelect;
export type DbInvoiceItem     = typeof invoiceItemsTable.$inferSelect;
export type DbPayment         = typeof paymentsTable.$inferSelect;
