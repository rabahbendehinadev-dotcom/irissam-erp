/**
 * PatientService — patient lifecycle with MRN generation and duplicate detection.
 *
 * MRN format: MRN-YYYY-NNNNN  (e.g. MRN-2026-00042)
 *   - YYYY = current year
 *   - NNNNN = zero-padded per-year sequence from the patient_mrn_counters table
 *   - MRNs are permanent and never recycled.
 *
 * Atomicity: the sequence number is acquired with
 *   INSERT ... ON CONFLICT (year) DO UPDATE SET last_value = last_value + 1 RETURNING
 * inside the same transaction as the patient INSERT.  The row-level lock
 * serializes concurrent creates — two simultaneous requests can never read
 * the same value.  Gaps appear if a transaction rolls back; that is accepted.
 * COUNT(*)+1 / MAX()+1 / Math.random() / timestamps are all forbidden here.
 *
 * Duplicate detection: tiered, with normalized (trim/lower/collapse-spaces)
 * comparison — see PatientRepository.findDuplicateCandidates.
 */
import type { InsertPatient } from "@workspace/db";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { repos } from "../repositories";
import { auditService } from "./audit";
import type { TxContext, ActorCtx } from "../repositories/types";
import type { DbPatient, DuplicateCandidateRow } from "../repositories/patient";

export type CreatePatientInput = Omit<InsertPatient, "mrn" | "createdBy" | "updatedBy">;
export type UpdatePatientInput = Partial<Omit<InsertPatient, "mrn" | "id" | "createdBy" | "updatedBy">>;

export class PatientService {

  // ── Create ──────────────────────────────────────────────────────────────────

  async create(input: CreatePatientInput, actor: ActorCtx): Promise<DbPatient> {
    // 1. Duplicate detection (normalized name + date of birth).
    //    MUST run BEFORE the transaction: repository reads use their own pool
    //    connection, and acquiring a second connection while the transaction
    //    below already holds one deadlocks the pool under parallel load
    //    (N transactions hold N connections, each waiting for one more).
    const dupes = await repos.patient.findPotentialDuplicates(
      input.lastName, input.firstName, input.dateOfBirth,
    );
    const hasDuplicates = dupes.length > 0;

    return db.transaction(async (tx) => {
      const ctx: TxContext = { ...actor, tx };

      // 2. Atomically acquire the next per-year sequence number.
      //    INSERT ... ON CONFLICT DO UPDATE takes a row-level lock on the year
      //    row: concurrent transactions queue behind it, so each caller gets a
      //    distinct value.  This runs inside the same transaction as the
      //    patient INSERT below — a rollback releases the lock (leaving a gap,
      //    which is acceptable and expected).
      const year = new Date().getFullYear();
      const counterResult = await tx.execute(sql`
        INSERT INTO patient_mrn_counters (year, last_value)
        VALUES (${year}, 1)
        ON CONFLICT (year) DO UPDATE
          SET last_value = patient_mrn_counters.last_value + 1,
              updated_at = now()
        RETURNING last_value
      `);
      const counterRows =
        (counterResult as unknown as { rows?: Array<{ last_value: number | string }> }).rows
        ?? (counterResult as unknown as Array<{ last_value: number | string }>);
      const nextVal = Number(counterRows[0]?.last_value);
      if (!Number.isInteger(nextVal) || nextVal < 1) {
        throw new Error("patient_mrn_counters returned an invalid sequence value");
      }
      const seq = String(nextVal).padStart(5, "0");

      // 3. All three identifiers derive from the SAME nextval — one counter
      //    read per patient, never reused, never random.
      const mrn        = `MRN-${year}-${seq}`;
      const mpiId      = `MPI-${year}-${seq}`;
      const fileNumber = `${year}-${seq}`;

      // 4. Insert patient
      const patient = await repos.patient.create(
        { ...input, mrn, mpiId, fileNumber, potentialDuplicate: hasDuplicates },
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

  /** Tiered duplicate search — see PatientRepository.findDuplicateCandidates. */
  async findDuplicateCandidates(opts: {
    lastName: string;
    firstName: string;
    dateOfBirth?: string;
    phone?: string;
    idDocumentNumber?: string;
  }): Promise<DuplicateCandidateRow[]> {
    return repos.patient.findDuplicateCandidates(opts);
  }
}

export const patientService = new PatientService();
