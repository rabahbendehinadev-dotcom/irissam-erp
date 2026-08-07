/**
 * PharmacyService — medication CRUD + stock deduction on dispense.
 *
 * Dispense flow (atomic transaction):
 *   1. Load prescription → validate status is "prescrit" | "prepare"
 *   2. Deduct stock (guard SQL atomique : quantity >= demandé, sinon
 *      InsufficientStockError — jamais de stock négatif)
 *   3. Mark prescription "delivre" + lien medication_id + nom/commentaire
 *   4. Audit : prescription "dispensed" (stock avant/après) + médicament "updated"
 *
 * RBAC (pharmacy.dispense) is enforced in route middleware, not here.
 */
import { db } from "@workspace/db";
import { repos } from "../repositories";
import { auditService } from "./audit";
import { safeUuid } from "../repositories/types";
import type { TxContext, ActorCtx } from "../repositories/types";
import type { DbMedication } from "../repositories/medication";
import type { DbPrescription } from "../repositories/prescription";

/** Stock insuffisant — le routeur la convertit en 409 (jamais de stock négatif). */
export class InsufficientStockError extends Error {
  constructor(
    public readonly medicationName: string,
    public readonly available: number,
    public readonly requested: number,
  ) {
    super(`Stock insuffisant pour ${medicationName} : ${available} disponible(s), ${requested} demandé(s)`);
    this.name = "InsufficientStockError";
  }
}

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
   * Dispense a prescription (single drug record) — atomic transaction.
   * Deducts `quantity` units from the linked medication stock, marks the
   * prescription "delivre" and persists the medication link + dispenser info.
   */
  async dispense(
    prescriptionId: string,
    medicationId: string,
    quantity: number,
    actor: ActorCtx,
    opts: { dispensedByName?: string | null; dispenserComment?: string | null } = {},
  ): Promise<DbPrescription> {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error("Quantité invalide : entier ≥ 1 requis");
    }

    return db.transaction(async (tx) => {
      const ctx: TxContext = { ...actor, tx };

      // 1. CLAIM — transition conditionnelle prescrit|prepare → delivre.
      //    La garde d'état vit dans le WHERE du claim : sous requêtes
      //    concurrentes, une seule transaction obtient la ligne, l'autre
      //    reçoit null → 409. Aucune double déduction de stock possible.
      const now = new Date();
      const claimed = await repos.prescription.claimForDispense(prescriptionId, {
        medicationId,
        dispensedById:    safeUuid(actor.userId),
        dispensedByName:  opts.dispensedByName?.trim() || actor.userName,
        dispensedAt:      now,
        dispenserComment: opts.dispenserComment?.trim() || null,
      }, ctx);
      if (!claimed) {
        const existing = await repos.prescription.findById(prescriptionId, ctx);
        if (!existing) throw new Error(`Prescription ${prescriptionId} introuvable`);
        if (existing.status === "annule") throw new Error("Prescription annulée — délivrance impossible");
        throw new Error("Prescription déjà délivrée");
      }

      // 2. Stock : lecture puis déduction conditionnelle (quantity >= demandé).
      //    Toute exception ici annule la transaction — claim compris.
      const med = await repos.medication.findById(medicationId, ctx);
      if (!med) throw new Error("Médicament introuvable dans le stock pharmacie");
      if (med.quantity < quantity) {
        throw new InsufficientStockError(med.name, med.quantity, quantity);
      }
      const updatedMed = await repos.medication.deductStock(medicationId, quantity, ctx);
      if (!updatedMed) {
        // Course concurrente : la garde SQL a refusé la déduction.
        throw new InsufficientStockError(med.name, med.quantity, quantity);
      }

      // 4. Audit — prescription délivrée (stock avant/après) + mouvement de stock
      await auditService.log({
        module:       "pharmacie",
        action:       "dispensed",
        resourceType: "prescription",
        resourceId:   prescriptionId,
        newValue:     {
          status: "delivre",
          medicationId,
          medicationName: med.name,
          quantity,
          stockBefore: med.quantity,
          stockAfter:  updatedMed.quantity,
          dispensedBy: opts.dispensedByName?.trim() || actor.userName,
        },
        patientId:    claimed.patientId ?? undefined,
        encounterId:  claimed.encounterId ?? undefined,
      }, actor, ctx);

      await auditService.log({
        module:       "pharmacie",
        action:       "updated",
        resourceType: "medication",
        resourceId:   medicationId,
        oldValue:     { quantity: med.quantity },
        newValue:     { quantity: updatedMed.quantity, motif: `Délivrance prescription ${prescriptionId}` },
        siteId:       med.siteId ?? undefined,
      }, actor, ctx);

      return claimed;
    });
  }
}

export const pharmacyService = new PharmacyService();
