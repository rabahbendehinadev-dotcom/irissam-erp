/**
 * ConsultationService — consultation lifecycle.
 *
 * Number format: CONS-YYYY-NNNNN (e.g. CONS-2026-00042), generated via the
 * atomic per-year counter table consultation_number_counters (migration 039)
 * — same pattern as patient MRNs.  The counter increment runs on the SAME
 * transaction connection (tx) as the INSERT: never a pool read inside a
 * transaction (pool reads inside db.transaction deadlock under parallel
 * load), and never COUNT(*)+1 (races + collides with soft-deleted numbers).
 *
 * Key schema alignment (consultations.ts):
 *  - No `date` column: use scheduledAt / startedAt timestamps
 *  - patientId: UUID (not integer)
 *  - startedAt / endedAt / scheduledAt: timestamps
 *  - no deletedBy column
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { repos } from "../repositories";
import { auditService } from "./audit";
import type { TxContext, ActorCtx } from "../repositories/types";
import type { DbConsultation } from "../repositories/consultation";
import type { InsertConsultation } from "@workspace/db";

export type CreateConsultationInput = Omit<InsertConsultation, "number" | "createdBy" | "updatedBy">;

/**
 * Champs modifiables après création (PATCH).
 * Le rattachement patient/encounter/médecin d'une consultation est IMMUABLE
 * — protection IDOR : on ne « déplace » jamais une consultation vers un autre
 * patient.  Toute correction passe par une nouvelle consultation.
 */
export interface UpdateConsultationFields {
  status?:    DbConsultation["status"];
  notes?:     string | null;
  diagnosis?: string | null;
}

/**
 * Levée quand l'encounter change d'état entre la validation de la route et
 * l'INSERT (fenêtre TOCTOU) — la route la traduit en 400, jamais en 500.
 */
export class EncounterStateError extends Error {}

export class ConsultationService {

  async list(opts: Parameters<typeof repos.consultation.list>[0] = {}) {
    return repos.consultation.list(opts);
  }

  async findById(id: string): Promise<DbConsultation | null> {
    return repos.consultation.findById(id);
  }

  async create(input: CreateConsultationInput, actor: ActorCtx): Promise<DbConsultation> {
    return db.transaction(async (tx) => {
      const ctx: TxContext = { ...actor, tx };

      // Re-vérification DANS la transaction (fenêtre TOCTOU) : l'encounter
      // doit encore appartenir au même patient et être ouvert au moment de
      // l'INSERT.  FOR SHARE verrouille la ligne → une clôture concurrente
      // attend la fin de cette transaction ou nous fait échouer proprement.
      // Placée AVANT l'incrément du compteur pour ne pas brûler de numéro.
      if (input.encounterId) {
        const encResult = await tx.execute(sql`
          SELECT patient_id, status FROM encounters
          WHERE id = ${input.encounterId} AND deleted_at IS NULL
          FOR SHARE
        `);
        const encRows =
          (encResult as unknown as { rows?: Array<{ patient_id: string; status: string }> }).rows
          ?? (encResult as unknown as Array<{ patient_id: string; status: string }>);
        const enc = encRows[0];
        if (!enc || enc.patient_id !== input.patientId || enc.status !== "open") {
          throw new EncounterStateError(
            "L'encounter n'est plus ouvert pour ce patient — création annulée",
          );
        }
      }

      // Compteur atomique par année : INSERT ... ON CONFLICT DO UPDATE prend
      // un verrou de ligne sur l'année → les transactions concurrentes se
      // sérialisent et chacune reçoit une valeur distincte.  Exécuté sur la
      // connexion de LA transaction (tx.execute) — jamais le pool.
      const year = new Date().getFullYear();
      const counterResult = await tx.execute(sql`
        INSERT INTO consultation_number_counters (year, last_value)
        VALUES (${year}, 1)
        ON CONFLICT (year) DO UPDATE
          SET last_value = consultation_number_counters.last_value + 1,
              updated_at = now()
        RETURNING last_value
      `);
      const counterRows =
        (counterResult as unknown as { rows?: Array<{ last_value: number | string }> }).rows
        ?? (counterResult as unknown as Array<{ last_value: number | string }>);
      const nextVal = Number(counterRows[0]?.last_value);
      if (!Number.isInteger(nextVal) || nextVal < 1) {
        throw new Error("consultation_number_counters returned an invalid sequence value");
      }
      const number = `CONS-${year}-${String(nextVal).padStart(5, "0")}`;

      const consultation = await repos.consultation.create({ ...input, number }, ctx);

      await auditService.log({
        module:       "consultations",
        action:       "created",
        resourceType: "consultation",
        resourceId:   consultation.id,
        newValue:     {
          number,
          status:      consultation.status,
          doctorId:    consultation.doctorId,
          serviceName: consultation.serviceName,
          encounterId: consultation.encounterId,
        },
        patientId:    input.patientId ?? undefined,
        encounterId:  input.encounterId ?? undefined,
      }, actor, ctx);

      return consultation;
    });
  }

  /**
   * Mise à jour des champs modifiables (status / notes / diagnosis).
   *
   * - Transitions de statut horodatées côté serveur : passage à `en_cours`
   *   fixe startedAt (si absent) ; passage à `terminee` fixe endedAt et
   *   calcule la durée réelle.
   * - Audit : `status_changed` quand seul le statut change,
   *   `updated` dès qu'un champ clinique (notes/diagnosis) est modifié —
   *   avec oldValue/newValue et le patientId réel de la consultation.
   */
  async update(
    id: string,
    changes: UpdateConsultationFields,
    actor: ActorCtx,
  ): Promise<DbConsultation | null> {
    const existing = await repos.consultation.findById(id);
    if (!existing) return null;

    const data: Partial<InsertConsultation> = {};
    if (changes.status    !== undefined) data.status    = changes.status;
    if (changes.notes     !== undefined) data.notes     = changes.notes;
    if (changes.diagnosis !== undefined) data.diagnosis = changes.diagnosis;

    // Horodatage réel des transitions de statut
    if (changes.status === "en_cours" && !existing.startedAt) {
      data.startedAt = new Date();
    }
    if (changes.status === "terminee" && !existing.endedAt) {
      const endedAt = new Date();
      data.endedAt = endedAt;
      if (existing.startedAt && existing.duration == null) {
        data.duration = Math.max(
          1,
          Math.round((endedAt.getTime() - existing.startedAt.getTime()) / 60000),
        );
      }
    }

    const ctx: TxContext = { ...actor };
    const updated = await repos.consultation.update(id, data, ctx);
    if (!updated) return null;

    const clinicalEdit = changes.notes !== undefined || changes.diagnosis !== undefined;
    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    if (changes.status !== undefined) {
      oldValue.status = existing.status;
      newValue.status = updated.status;
    }
    if (changes.notes !== undefined) {
      oldValue.notes = existing.notes;
      newValue.notes = updated.notes;
    }
    if (changes.diagnosis !== undefined) {
      oldValue.diagnosis = existing.diagnosis;
      newValue.diagnosis = updated.diagnosis;
    }

    await auditService.log({
      module:       "consultations",
      action:       clinicalEdit ? "updated" : "status_changed",
      resourceType: "consultation",
      resourceId:   id,
      oldValue,
      newValue,
      patientId:    existing.patientId ?? undefined,
      encounterId:  existing.encounterId ?? undefined,
    }, actor);

    return updated;
  }
}

export const consultationService = new ConsultationService();
