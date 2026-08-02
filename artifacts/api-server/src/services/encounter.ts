/**
 * EncounterService — encounter lifecycle with encounter number generation.
 *
 * Encounter number format: ENC-YYYY-NNNNN  (e.g. ENC-2026-00007)
 * Every clinical record (lab, imaging, prescription, consultation) MUST
 * belong to an encounter. Encounters are never hard-deleted.
 */
import type { InsertEncounter } from "@workspace/db";
import { db } from "@workspace/db";
import { repos } from "../repositories";
import { auditService } from "./audit";
import type { TxContext, ActorCtx } from "../repositories/types";
import type { DbEncounter } from "../repositories/encounter";

export type CreateEncounterInput = Omit<InsertEncounter, "encounterNumber" | "createdBy" | "updatedBy">;

export class EncounterService {

  // ── Encounter number generation ─────────────────────────────────────────────

  async generateEncounterNumber(): Promise<string> {
    const year  = new Date().getFullYear();
    const total = await repos.encounter.countAll();
    const seq   = String(total + 1).padStart(5, "0");
    return `ENC-${year}-${seq}`;
  }

  // ── Create ──────────────────────────────────────────────────────────────────

  /**
   * Create an encounter.
   * Caller may pass ctx.tx to run this inside a larger transaction
   * (e.g. AdmissionService creates the encounter + admission atomically).
   */
  async create(input: CreateEncounterInput, actor: ActorCtx, ctx?: TxContext): Promise<DbEncounter> {
    const encounterNumber = await this.generateEncounterNumber();

    const encounter = await repos.encounter.create(
      { ...input, encounterNumber },
      ctx ?? { ...actor },
    );

    await auditService.log({
      module:       input.sourceModule,
      action:       "created",
      resourceType: "encounter",
      resourceId:   encounter.id,
      newValue:     { encounterNumber, type: encounter.type, patientId: encounter.patientId },
      patientId:    encounter.patientId,
      encounterId:  encounter.id,
      siteId:       encounter.siteId ?? undefined,
    }, actor, ctx);

    return encounter;
  }

  // ── Close ───────────────────────────────────────────────────────────────────

  async close(id: string, reason: string, actor: ActorCtx, ctx?: TxContext): Promise<DbEncounter> {
    const encounter = await repos.encounter.close(id, reason, ctx ?? { ...actor });
    if (!encounter) throw new Error(`Encounter ${id} not found`);

    await auditService.log({
      module:       encounter.sourceModule,
      action:       "closed",
      resourceType: "encounter",
      resourceId:   id,
      newValue:     { reason, closedAt: encounter.closedAt },
      patientId:    encounter.patientId,
      encounterId:  id,
      siteId:       encounter.siteId ?? undefined,
    }, actor, ctx);

    return encounter;
  }

  // ── Link a clinical record ──────────────────────────────────────────────────

  async linkRecord(
    encounterId: string,
    record: { recordType: string; recordId: string; summary: string },
    actor: ActorCtx,
    ctx?: TxContext,
  ): Promise<void> {
    await repos.encounter.appendLinkedRecord(encounterId, record, ctx ?? { ...actor });
  }

  // ── Read ─────────────────────────────────────────────────────────────────────

  async findById(id: string): Promise<DbEncounter | null> {
    return repos.encounter.findById(id);
  }

  async findByNumber(encounterNumber: string): Promise<DbEncounter | null> {
    return repos.encounter.findByNumber(encounterNumber);
  }

  async list(opts: Parameters<typeof repos.encounter.list>[0]) {
    return repos.encounter.list(opts);
  }
}

export const encounterService = new EncounterService();
