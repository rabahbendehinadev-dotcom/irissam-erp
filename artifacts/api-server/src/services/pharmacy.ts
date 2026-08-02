/**
 * PharmacyService — medication CRUD + stock deduction on dispense.
 *
 * Dispense flow (atomic transaction):
 *   1. Load prescription → validate status is "prescrit"
 *   2. Deduct stock (one medication per prescription record in this schema)
 *   3. Mark prescription as "delivre" (NOT "dispensée")
 *   4. Audit log
 *
 * Task #60 compliance: pharmacist-only enforcement is done in route middleware
 * (req.auth.role === "pharmacist"). This service does not check roles.
 */
import { db } from "@workspace/db";
import { repos } from "../repositories";
import { auditService } from "./audit";
import type { TxContext, ActorCtx } from "../repositories/types";
import type { DbMedication } from "../repositories/medication";
import type { DbPrescription } from "../repositories/prescription";

export class PharmacyService {

  // ── Medication CRUD ──────────────────────────────────────────────────────────

  async createMedication(
    input: Parameters<typeof repos.medication.create>[0],
    actor: ActorCtx,
  ): Promise<DbMedication> {
    const med = await repos.medication.create(input, { ...actor });
    await auditService.log({
      module:       "pharmacie",
      action:       "created",
      resourceType: "medication",
      resourceId:   med.id,
      newValue:     { name: med.name, quantity: med.quantity },
      siteId:       med.siteId ?? undefined,
    }, actor);
    return med;
  }

  async updateMedication(
    id: string,
    input: Parameters<typeof repos.medication.update>[1],
    actor: ActorCtx,
  ): Promise<DbMedication> {
    const existing = await repos.medication.findById(id);
    if (!existing) throw new Error(`Médicament ${id} introuvable`);

    const updated = await repos.medication.update(id, input, { ...actor });
    if (!updated) throw new Error(`Mise à jour du médicament ${id} échouée`);

    await auditService.log({
      module:       "pharmacie",
      action:       "updated",
      resourceType: "medication",
      resourceId:   id,
      oldValue:     { name: existing.name, quantity: existing.quantity },
      newValue:     input as Record<string, unknown>,
      siteId:       existing.siteId ?? undefined,
    }, actor);
    return updated;
  }

  async deleteMedication(id: string, actor: ActorCtx): Promise<void> {
    const ok = await repos.medication.softDelete(id, { ...actor });
    if (!ok) throw new Error(`Médicament ${id} introuvable ou déjà supprimé`);

    await auditService.log({
      module:    "pharmacie",
      action:    "deleted",
      resourceType: "medication",
      resourceId:   id,
      severity:  "warning",
    }, actor);
  }

  // ── Dispense ─────────────────────────────────────────────────────────────────

  /**
   * Dispense a prescription (single drug record).
   * Deducts `quantity` units from the linked medication stock.
   * Marks prescription status as "delivre".
   */
  async dispense(
    prescriptionId: string,
    medicationId: string,
    quantity: number,
    actor: ActorCtx,
  ): Promise<DbPrescription> {
    return db.transaction(async (tx) => {
      const ctx: TxContext = { ...actor, tx };

      // 1. Load prescription
      const prescription = await repos.prescription.findById(prescriptionId, ctx);
      if (!prescription) throw new Error(`Prescription ${prescriptionId} introuvable`);
      if (prescription.status !== "prescrit") {
        throw new Error(`Prescription déjà ${prescription.status}`);
      }

      // 2. Deduct stock (atomic SQL check: stock >= quantity)
      if (medicationId && quantity > 0) {
        const updated = await repos.medication.deductStock(medicationId, quantity, ctx);
        if (!updated) {
          throw new Error(
            `Stock insuffisant pour le médicament ${medicationId} (quantité demandée: ${quantity})`,
          );
        }
      }

      // 3. Mark as delivered
      const dispensed = await repos.prescription.markDispensed(prescriptionId, ctx);
      if (!dispensed) throw new Error("Échec du délivrement");

      // 4. Audit
      await auditService.log({
        module:       "pharmacie",
        action:       "dispensed",
        resourceType: "prescription",
        resourceId:   prescriptionId,
        newValue:     { medicationId, quantity, dispensedBy: actor.userId },
        patientId:    prescription.patientId ?? undefined,
        encounterId:  prescription.encounterId ?? undefined,
      }, actor, ctx);

      return dispensed;
    });
  }
}

export const pharmacyService = new PharmacyService();
