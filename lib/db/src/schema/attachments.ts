/**
 * Domain — Attachments (Generic / Polymorphic)
 * Any file can be attached to any clinical entity (Lab, Imaging, Consultation,
 * Admission, Prescription, Surgical request, Encounter, Patient).
 * Storage keys reference object storage (Replit App Storage / S3-compatible).
 */
import {
  pgTable, uuid, text, integer, boolean, timestamp, index,
} from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sourceModuleEnum } from "./enums";
import { sitesTable } from "./infrastructure";
import { usersTable } from "./users";

// ─── Enum: Attachment entity types ────────────────────────────────────────────

export const attachmentEntityTypeEnum = pgEnum("attachment_entity_type", [
  "patient",
  "encounter",
  "admission",
  "consultation",
  "lab_order",
  "imaging_order",
  "prescription",
  "surgical_request",
  "invoice",
]);

// ─── Enum: Attachment categories ─────────────────────────────────────────────

export const attachmentCategoryEnum = pgEnum("attachment_category", [
  "report",          // Compte rendu, rapport d'analyse
  "image",           // Radiographie, scanner, IRM
  "consent",         // Consentement éclairé signé
  "identity",        // Pièce d'identité, carte CNAS
  "prescription",    // Ordonnance numérisée
  "result",          // Résultat de labo ou imagerie
  "administrative",  // Document administratif
  "other",
]);

// ─── Attachments ──────────────────────────────────────────────────────────────

export const attachmentsTable = pgTable("attachments", {
  id:         uuid("id").primaryKey().defaultRandom(),

  // Polymorphic entity link
  entityType: attachmentEntityTypeEnum("entity_type").notNull(),
  entityId:   uuid("entity_id").notNull(),

  // Module that created this attachment
  module:     sourceModuleEnum("module").notNull(),

  // File metadata
  fileName:   text("file_name").notNull(),
  fileSize:   integer("file_size"),               // bytes
  mimeType:   text("mime_type").notNull(),
  category:   attachmentCategoryEnum("category").default("other").notNull(),

  // Storage
  storageKey: text("storage_key").notNull(),       // Object storage key (path)
  storageUrl: text("storage_url"),                 // Signed URL (short-lived, regenerated on read)

  // Display
  title:       text("title"),
  description: text("description"),
  pageCount:   integer("page_count"),              // For PDFs

  // Access control
  isPrivate:   boolean("is_private").default(false).notNull(),

  // Site
  siteId: uuid("site_id").references(() => sitesTable.id, { onDelete: "set null" }),

  // Audit — no soft delete (mark replaced instead)
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy:  uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdByName: text("created_by_name"),
  deletedAt:  timestamp("deleted_at", { withTimezone: true }),
  deletedBy:  uuid("deleted_by").references(() => usersTable.id, { onDelete: "set null" }),
}, (t) => [
  index("att_entity_idx").on(t.entityType, t.entityId),
  index("att_module_idx").on(t.module),
  index("att_category_idx").on(t.category),
  index("att_site_idx").on(t.siteId),
  index("att_created_at_idx").on(t.createdAt),
  index("att_deleted_at_idx").on(t.deletedAt),
]);

// ─── Insert Schema & Types ────────────────────────────────────────────────────

export const insertAttachmentSchema = createInsertSchema(attachmentsTable).omit({ id: true });
export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type DbAttachment     = typeof attachmentsTable.$inferSelect;
