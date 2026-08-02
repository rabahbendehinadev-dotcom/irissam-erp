/**
 * ConsultationService — consultation lifecycle.
 *
 * Number format: CONS-YYYY-NNNNN (e.g. CONS-2026-00042)
 *
 * Key schema alignment (consultations.ts):
 *  - No `date` column: use scheduledAt / startedAt timestamps
 *  - patientId: UUID (not integer)
 *  - startedAt / endedAt / scheduledAt: timestamps
 *  - no deletedBy column
 */
import { db } from "@workspace/db";
import { repos } from "../repositories";
import { auditService } from "./audit";
import type { TxContext, ActorCtx } from "../repositories/types";
import type { DbConsultation } from "../repositories/consultation";
import type { InsertConsultation } from "@workspace/db";

export type CreateConsultationInput = Omit<InsertConsultation, "number" | "createdBy" | "updatedBy">;

export class ConsultationService {

  async generateNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const total = await repos.consultation.countAll();
    const seq = String(total + 1).padStart(5, "0");
    return `CONS-${year}-${seq}`;
  }

  async list(opts: Parameters<typeof repos.consultation.list>[0] = {}) {
    return repos.consultation.list(opts);
  }

  async findById(id: string): Promise<DbConsultation | null> {
    return repos.consultation.findById(id);
  }

  async create(input: CreateConsultationInput, actor: ActorCtx): Promise<DbConsultation> {
    return db.transaction(async (tx) => {
      const ctx: TxContext = { ...actor, tx };
      const number = await this.generateNumber();
      const consultation = await repos.consultation.create({ ...input, number }, ctx);
      await auditService.log({
        module:       "consultations",
        action:       "created",
        resourceType: "consultation",
        resourceId:   consultation.id,
        newValue:     { number, status: consultation.status },
        patientId:    input.patientId ?? undefined,
        encounterId:  input.encounterId ?? undefined,
      }, actor, ctx);
      return consultation;
    });
  }

  async updateStatus(id: string, status: string, actor: ActorCtx): Promise<DbConsultation | null> {
    const ctx: TxContext = { ...actor };
    const updated = await repos.consultation.update(id, { status: status as any }, ctx);
    if (updated) {
      await auditService.log({
        module:       "consultations",
        action:       "status_changed",
        resourceType: "consultation",
        resourceId:   id,
        newValue:     { status },
      }, actor);
    }
    return updated;
  }
}

export const consultationService = new ConsultationService();
