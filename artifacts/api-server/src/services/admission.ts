/**
 * AdmissionService — full admission lifecycle.
 *
 * admit()      → atomic: create encounter + admission + occupy bed
 * discharge()  → atomic: update admission + FREE BED (Task #63) + close encounter
 * transfer()   → atomic: free old bed + occupy new bed
 *
 * Admission number format: ADM-YYYY-NNNNN (e.g. ADM-2026-00001)
 *
 * Key schema alignment (admissions.ts):
 *  - type (admissionTypeEnum), not admissionType
 *  - motif (text not null), not chiefComplaint
 *  - serviceName / doctorName (not null)
 *  - admissionDate (date YYYY-MM-DD) + admissionTime (HH:MM)
 *  - actualDischargeDate + actualDischargeTime for discharge
 *  - dischargeType / dischargeNotes
 *  - patientMpiId (not patientMrn)
 *  - admissionNumber (not null, generated here)
 */
import { db } from "@workspace/db";
import { repos } from "../repositories";
import { encounterService } from "./encounter";
import { auditService } from "./audit";
import type { TxContext, ActorCtx } from "../repositories/types";
import type { DbAdmission } from "../repositories/admission";

// ─── Number generation ────────────────────────────────────────────────────────

async function generateAdmissionNumber(): Promise<string> {
  const year  = new Date().getFullYear();
  const total = await repos.admission.countAll();
  const seq   = String(total + 1).padStart(5, "0");
  return `ADM-${year}-${seq}`;
}

function todayIso(): string { return new Date().toISOString().slice(0, 10); }
function nowHHMM(): string  { return new Date().toTimeString().slice(0, 5); }

// ─── Input types ─────────────────────────────────────────────────────────────

export interface AdmitInput {
  // Patient
  patientId:    string;
  patientName:  string;
  patientMpiId?: string;
  patientDob?:   string;
  patientPhone?: string;

  // Clinical
  motif:               string;   // required by schema (not null)
  type?:               string;   // admissionTypeEnum default "standard"
  serviceName:         string;   // required by schema (not null)
  doctorId?:           string;
  doctorName:          string;   // required by schema (not null)
  diagnosis?:          string;
  notes?:              string;
  expectedDischargeDate?: string;

  // Optional — reuse an existing encounter (e.g. from Urgences)
  encounterId?: string;

  // Bed assignment
  bedId:        string;
  bedNumber?:   string;
  roomNumber?:  string;
  floorLabel?:  string;
  buildingName?: string;

  siteId?: string;
}

export interface DischargeInput {
  dischargeType:   string;
  dischargeNotes?: string;
}

// ─── AdmissionService ─────────────────────────────────────────────────────────

export class AdmissionService {

  async admit(input: AdmitInput, actor: ActorCtx): Promise<{ encounter: any; admission: DbAdmission; bed: any }> {
    return db.transaction(async (tx) => {
      const ctx: TxContext = { ...actor, tx };

      // 1. Reuse existing encounter or create a new one
      let encounter: { id: string };
      if (input.encounterId) {
        // Use the provided encounter ID (e.g. patient arrived from Urgences)
        const existing = await repos.encounter.findById(input.encounterId, ctx);
        if (!existing) {
          throw new Error(`Encounter ${input.encounterId} introuvable`);
        }
        encounter = existing;
      } else {
        encounter = await encounterService.create({
          patientId:       input.patientId,
          patientName:     input.patientName,
          patientMrn:      input.patientMpiId,
          type:            "admission",
          status:          "open",
          chiefComplaint:  input.motif,
          sourceModule:    "admissions",
          primaryDoctorId:   input.doctorId,
          primaryDoctorName: input.doctorName,
          siteId:          input.siteId,
        }, actor, ctx);
      }

      // 2. Occupy bed (fails if not "disponible")
      const bed = await repos.occupancyBed.occupy(input.bedId, {
        patientId:   input.patientId,
        patientName: input.patientName,
        encounterId: encounter.id,
      }, ctx);

      if (!bed) {
        throw new Error(`Lit ${input.bedId} non disponible (déjà occupé ou introuvable)`);
      }

      // 3. Generate admission number
      const admissionNumber = await generateAdmissionNumber();

      // 4. Create admission record
      const admission = await repos.admission.create({
        admissionNumber,
        encounterId:    encounter.id,
        patientId:      input.patientId,
        patientName:    input.patientName,
        patientMpiId:   input.patientMpiId,
        patientDob:     input.patientDob,
        patientPhone:   input.patientPhone,
        type:           (input.type ?? "standard") as any,
        status:         "active",
        serviceName:    input.serviceName,
        doctorId:       input.doctorId,
        doctorName:     input.doctorName,
        motif:          input.motif,
        diagnosis:      input.diagnosis,
        notes:          input.notes,
        bedId:          input.bedId,
        bedNumber:      input.bedNumber ?? bed.number,
        roomNumber:     input.roomNumber ?? bed.roomNumber,
        floorLabel:     input.floorLabel,
        buildingName:   input.buildingName,
        admissionDate:  todayIso(),
        admissionTime:  nowHHMM(),
        expectedDischargeDate: input.expectedDischargeDate,
        siteId:         input.siteId,
      }, ctx);

      await auditService.log({
        module:       "admissions",
        action:       "admitted",
        resourceType: "admission",
        resourceId:   admission.id,
        newValue:     { admissionNumber, bedNumber: bed.number, encounterId: encounter.id },
        patientId:    input.patientId,
        encounterId:  encounter.id,
        siteId:       input.siteId,
      }, actor, ctx);

      return { encounter, admission, bed };
    });
  }

  // ── Discharge ─────────────────────────────────────────────────────────────────

  /**
   * Discharge atomically:
   * 1. Mark admission discharged
   * 2. Free bed (Task #63 — automatic)
   * 3. Close encounter
   */
  async discharge(admissionId: string, input: DischargeInput, actor: ActorCtx): Promise<DbAdmission> {
    return db.transaction(async (tx) => {
      const ctx: TxContext = { ...actor, tx };

      const admission = await repos.admission.findById(admissionId, ctx);
      if (!admission) throw new Error(`Admission ${admissionId} introuvable`);
      if (admission.status === "discharged") throw new Error("Patient déjà sorti");

      // 1. Mark discharged
      const discharged = await repos.admission.discharge(admissionId, {
        dischargeType:       input.dischargeType,
        dischargeNotes:      input.dischargeNotes,
        actualDischargeDate: todayIso(),
        actualDischargeTime: nowHHMM(),
      }, ctx);
      if (!discharged) throw new Error("La sortie a échoué");

      // 2. Free bed (Task #63)
      if (admission.bedId) {
        await repos.occupancyBed.free(admission.bedId, ctx);
      }

      // 3. Close encounter
      if (admission.encounterId) {
        await encounterService.close(
          admission.encounterId,
          `Sortie: ${input.dischargeType}`,
          actor,
          ctx,
        );
      }

      await auditService.log({
        module:       "admissions",
        action:       "discharged",
        resourceType: "admission",
        resourceId:   admissionId,
        oldValue:     { status: "active" },
        newValue:     { status: "discharged", dischargeType: input.dischargeType },
        patientId:    admission.patientId,
        encounterId:  admission.encounterId ?? undefined,
        siteId:       admission.siteId ?? undefined,
      }, actor, ctx);

      return discharged;
    });
  }

  // ── Transfer bed ──────────────────────────────────────────────────────────────

  async transferBed(admissionId: string, newBedId: string, actor: ActorCtx): Promise<DbAdmission> {
    return db.transaction(async (tx) => {
      const ctx: TxContext = { ...actor, tx };

      const admission = await repos.admission.findById(admissionId, ctx);
      if (!admission) throw new Error(`Admission ${admissionId} introuvable`);

      if (admission.bedId) {
        await repos.occupancyBed.free(admission.bedId, ctx);
      }

      const newBed = await repos.occupancyBed.occupy(newBedId, {
        patientId:   admission.patientId,
        patientName: admission.patientName,
        encounterId: admission.encounterId ?? "",
      }, ctx);

      if (!newBed) throw new Error(`Nouveau lit ${newBedId} non disponible`);

      const updated = await repos.admission.update(admissionId, {
        bedId:      newBedId,
        bedNumber:  newBed.number,
        roomNumber: newBed.roomNumber ?? undefined,
      }, ctx);
      if (!updated) throw new Error("Mise à jour de l'admission échouée");

      await auditService.log({
        module:       "admissions",
        action:       "bed_transferred",
        resourceType: "admission",
        resourceId:   admissionId,
        oldValue:     { bedId: admission.bedId },
        newValue:     { bedId: newBedId, bedNumber: newBed.number },
        patientId:    admission.patientId,
        encounterId:  admission.encounterId ?? undefined,
        siteId:       admission.siteId ?? undefined,
      }, actor, ctx);

      return updated;
    });
  }

  // ── Read ──────────────────────────────────────────────────────────────────────

  async findById(id: string): Promise<DbAdmission | null> {
    return repos.admission.findById(id);
  }

  async list(opts: Parameters<typeof repos.admission.list>[0]) {
    return repos.admission.list(opts);
  }
}

export const admissionService = new AdmissionService();
