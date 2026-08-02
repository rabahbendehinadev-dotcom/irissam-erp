/**
 * ClinicalOrderService — lab orders, imaging orders, prescriptions.
 *
 * Task #64 compliance:
 *   - Lab orders with empty `test` field are REJECTED (ClinicalValidationError → 400).
 *   - Imaging orders with empty `exam` field are REJECTED.
 *
 * Key schema alignment:
 *   lab_orders:     test (not testName), urgency (not priority), requestedAt
 *   imaging_orders: exam (not examName), region (not null), urgency, requestedAt
 *   prescriptions:  drug/dosage/route/frequency per record (no items array)
 *                   status "delivre" (not "dispensée")
 */
import type { InsertLabOrder, InsertImagingOrder, InsertPrescription } from "@workspace/db";
import { db } from "@workspace/db";
import { repos } from "../repositories";
import { encounterService } from "./encounter";
import { auditService } from "./audit";
import type { TxContext, ActorCtx } from "../repositories/types";
import type { DbLabOrder } from "../repositories/labOrder";
import type { DbImagingOrder } from "../repositories/imagingOrder";
import type { DbPrescription } from "../repositories/prescription";

// ─── Validation error ─────────────────────────────────────────────────────────

export class ClinicalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClinicalValidationError";
  }
}

// ─── ClinicalOrderService ────────────────────────────────────────────────────

export class ClinicalOrderService {

  // ── Lab orders ──────────────────────────────────────────────────────────────

  async createLabOrder(
    input: Omit<InsertLabOrder, "createdBy" | "updatedBy">,
    actor: ActorCtx,
  ): Promise<DbLabOrder> {
    // Task #64 — reject empty test name
    if (!input.test?.trim()) {
      throw new ClinicalValidationError("Le nom de l'examen biologique est obligatoire.");
    }

    return db.transaction(async (tx) => {
      const ctx: TxContext = { ...actor, tx };

      const order = await repos.labOrder.create(input, ctx);

      if (input.encounterId) {
        await encounterService.linkRecord(
          input.encounterId,
          { recordType: "lab_order", recordId: order.id, summary: input.test.trim() },
          actor, ctx,
        );
      }

      await auditService.log({
        module:       "laboratoire",
        action:       "created",
        resourceType: "lab_order",
        resourceId:   order.id,
        newValue:     { test: order.test, urgency: order.urgency },
        patientId:    input.patientId ?? undefined,
        encounterId:  input.encounterId ?? undefined,
      }, actor, ctx);

      return order;
    });
  }

  async updateLabOrderStatus(id: string, status: string, actor: ActorCtx): Promise<DbLabOrder> {
    const order = await repos.labOrder.updateStatus(id, status, { ...actor });
    if (!order) throw new Error(`Ordre de labo ${id} introuvable`);
    await auditService.log({
      module:       "laboratoire",
      action:       "status_changed",
      resourceType: "lab_order",
      resourceId:   id,
      newValue:     { status },
      patientId:    order.patientId ?? undefined,
      encounterId:  order.encounterId ?? undefined,
    }, actor);
    return order;
  }

  // ── Imaging orders ───────────────────────────────────────────────────────────

  async createImagingOrder(
    input: Omit<InsertImagingOrder, "createdBy" | "updatedBy">,
    actor: ActorCtx,
  ): Promise<DbImagingOrder> {
    // Task #64 — reject empty exam name
    if (!input.exam?.trim()) {
      throw new ClinicalValidationError("Le nom de l'examen d'imagerie est obligatoire.");
    }

    return db.transaction(async (tx) => {
      const ctx: TxContext = { ...actor, tx };

      const order = await repos.imagingOrder.create(input, ctx);

      if (input.encounterId) {
        await encounterService.linkRecord(
          input.encounterId,
          { recordType: "imaging_order", recordId: order.id, summary: `${input.exam.trim()} — ${input.region}` },
          actor, ctx,
        );
      }

      await auditService.log({
        module:       "imagerie",
        action:       "created",
        resourceType: "imaging_order",
        resourceId:   order.id,
        newValue:     { exam: order.exam, region: order.region },
        patientId:    input.patientId ?? undefined,
        encounterId:  input.encounterId ?? undefined,
      }, actor, ctx);

      return order;
    });
  }

  // ── Prescriptions ────────────────────────────────────────────────────────────
  // Note: prescriptions are per-drug records in this schema (drug/dosage/route/frequency).
  // For multi-drug prescriptions, call this once per drug item.

  async createPrescription(
    input: Omit<InsertPrescription, "createdBy" | "updatedBy">,
    actor: ActorCtx,
  ): Promise<DbPrescription> {
    if (!input.drug?.trim()) {
      throw new ClinicalValidationError("Le médicament est obligatoire.");
    }

    return db.transaction(async (tx) => {
      const ctx: TxContext = { ...actor, tx };

      const prescription = await repos.prescription.create(input, ctx);

      if (input.encounterId) {
        await encounterService.linkRecord(
          input.encounterId,
          { recordType: "prescription", recordId: prescription.id, summary: `${input.drug} ${input.dosage}` },
          actor, ctx,
        );
      }

      await auditService.log({
        module:       "pharmacie",
        action:       "created",
        resourceType: "prescription",
        resourceId:   prescription.id,
        newValue:     { drug: input.drug, dosage: input.dosage },
        patientId:    input.patientId ?? undefined,
        encounterId:  input.encounterId ?? undefined,
      }, actor, ctx);

      return prescription;
    });
  }
}

export const clinicalOrderService = new ClinicalOrderService();
