/**
 * PatientService — patient lifecycle with MRN generation and duplicate detection.
 *
 * MRN format: MRN-YYYY-NNNNN  (e.g. MRN-2026-00042)
 *   - YYYY = current year
 *   - NNNNN = zero-padded sequential number (total patients + 1)
 *   - MRNs are permanent and never recycled.
 *
 * Duplicate detection: same lastName + firstName + dateOfBirth.
 * When duplicates are found the new patient is created with potentialDuplicate=true
 * and existing matches are also flagged.
 */
import type { InsertPatient } from "@workspace/db";
import { db } from "@workspace/db";
import { repos } from "../repositories";
import { auditService } from "./audit";
import type { TxContext, ActorCtx } from "../repositories/types";
import type { DbPatient } from "../repositories/patient";

export type CreatePatientInput = Omit<InsertPatient, "mrn" | "createdBy" | "updatedBy">;
export type UpdatePatientInput = Partial<Omit<InsertPatient, "mrn" | "id" | "createdBy" | "updatedBy">>;

export class PatientService {

  // ── MRN generation ──────────────────────────────────────────────────────────

  async generateMrn(): Promise<string> {
    const year  = new Date().getFullYear();
    const total = await repos.patient.countAll();
    const seq   = String(total + 1).padStart(5, "0");
    return `MRN-${year}-${seq}`;
  }

  // ── Create ──────────────────────────────────────────────────────────────────

  async create(input: CreatePatientInput, actor: ActorCtx): Promise<DbPatient> {
    return db.transaction(async (tx) => {
      const ctx: TxContext = { ...actor, tx };

      // 1. Duplicate detection
      const dupes = await repos.patient.findPotentialDuplicates(
        input.lastName, input.firstName, input.dateOfBirth,
      );
      const hasDuplicates = dupes.length > 0;

      // 2. Generate MRN
      const mrn = await this.generateMrn();

      // 3. Insert patient
      const patient = await repos.patient.create(
        { ...input, mrn, potentialDuplicate: hasDuplicates },
        ctx,
      );

      // 4. Flag existing matches as potential duplicates
      if (hasDuplicates) {
        await Promise.all(dupes.map((d) =>
          repos.patient.markPotentialDuplicate(d.id, true, ctx),
        ));
      }

      // 5. Audit
      await auditService.log({
        module:       "system",
        action:       "created",
        resourceType: "patient",
        resourceId:   patient.id,
        newValue:     { mrn: patient.mrn, name: `${patient.lastName} ${patient.firstName}` },
        patientId:    patient.id,
        siteId:       input.siteId ?? undefined,
      }, actor, ctx);

      return patient;
    });
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  async update(id: string, input: UpdatePatientInput, actor: ActorCtx): Promise<DbPatient> {
    return db.transaction(async (tx) => {
      const ctx: TxContext = { ...actor, tx };

      const existing = await repos.patient.findById(id, ctx);
      if (!existing) throw new Error(`Patient ${id} not found`);

      const updated = await repos.patient.update(id, input, ctx);
      if (!updated) throw new Error(`Patient ${id} could not be updated`);

      await auditService.log({
        module:       "system",
        action:       "updated",
        resourceType: "patient",
        resourceId:   id,
        oldValue:     { lastName: existing.lastName, firstName: existing.firstName },
        newValue:     input as Record<string, unknown>,
        patientId:    id,
        siteId:       existing.siteId ?? undefined,
      }, actor, ctx);

      return updated;
    });
  }

  // ── Soft-delete ─────────────────────────────────────────────────────────────

  async delete(id: string, actor: ActorCtx): Promise<void> {
    return db.transaction(async (tx) => {
      const ctx: TxContext = { ...actor, tx };
      const ok = await repos.patient.softDelete(id, ctx);
      if (!ok) throw new Error(`Patient ${id} not found or already deleted`);

      await auditService.log({
        module:       "system",
        action:       "deleted",
        resourceType: "patient",
        resourceId:   id,
        patientId:    id,
        severity:     "warning",
      }, actor, ctx);
    });
  }

  // ── Read ─────────────────────────────────────────────────────────────────────

  async findById(id: string): Promise<DbPatient | null> {
    return repos.patient.findById(id);
  }

  async findByMrn(mrn: string): Promise<DbPatient | null> {
    return repos.patient.findByMrn(mrn);
  }

  async search(opts: Parameters<typeof repos.patient.search>[0]) {
    return repos.patient.search(opts);
  }

  async findDuplicates(lastName: string, firstName: string, dateOfBirth: string) {
    return repos.patient.findPotentialDuplicates(lastName, firstName, dateOfBirth);
  }
}

export const patientService = new PatientService();
