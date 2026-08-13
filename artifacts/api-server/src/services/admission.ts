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
import { eq } from "drizzle-orm";
import { occupancyBedsTable } from "@workspace/db/schema";
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
  priority?:           string;   // admissionPriorityEnum default "normal"
  serviceId?:          string;   // FK departments.id (optional, resolved by route)
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

export interface TransferInput {
  newBedId: string;
  motif:    string;   // motif du transfert — obligatoire (mouvement ADT)
  notes?:   string;
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
        type:           (input.type ?? "hospitalisation") as any,
        priority:       (input.priority ?? "normal") as any,
        status:         "active",
        serviceId:      input.serviceId,
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

      // 4b. Lier le lit à l'admission (chaîne ADT complète — utilisée par les
      // bed-cards et par le durcissement "still linked" du transfert/annulation)
      await tx.update(occupancyBedsTable)
        .set({ admissionId: admission.id, updatedAt: new Date() })
        .where(eq(occupancyBedsTable.id, input.bedId));

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

  /**
   * Transfert de lit (mouvement ADT interne) — UNE transaction atomique :
   * 1. validations : admission active, lit cible ≠ lit actuel, lit cible
   *    rattaché à la structure réelle (chambre + service — hiérarchie stricte)
   * 2. occupation du nouveau lit (claim-first : échoue s'il n'est plus disponible)
   * 3. libération de l'ancien lit → nettoyage, uniquement s'il est encore lié
   *    à cette admission (durcissement identique à cancel())
   * 4. admission réalignée sur la chaîne complète du nouveau lit
   *    (lit/chambre/étage/bâtiment/service hérités — plus de dénorm périmée)
   * 5. mouvement ADT complet (de → vers + motif) journalisé dans l'historique
   *    patient (audit_logs, lié patientId + encounterId)
   */
  async transferBed(admissionId: string, input: TransferInput, actor: ActorCtx): Promise<DbAdmission> {
    return db.transaction(async (tx) => {
      const ctx: TxContext = { ...actor, tx };

      const admission = await repos.admission.findById(admissionId, ctx);
      if (!admission) throw new Error(`Admission ${admissionId} introuvable`);
      if (admission.status !== "active") {
        throw new Error("Transfert impossible — l'admission n'est pas active");
      }
      if (admission.bedId === input.newBedId) {
        throw new Error("Le patient occupe déjà ce lit");
      }

      // Lit cible : structure réelle obligatoire (Bâtiment → Étage → Chambre → Lit)
      const [target] = await tx
        .select({
          number:    occupancyBedsTable.number,
          roomId:    occupancyBedsTable.roomId,
          serviceId: occupancyBedsTable.serviceId,
        })
        .from(occupancyBedsTable)
        .where(eq(occupancyBedsTable.id, input.newBedId))
        .limit(1);
      if (!target) throw new Error(`Lit de destination introuvable`);
      if (!target.roomId || !target.serviceId) {
        throw new Error("Lit de destination non affecté à une chambre/un service — rattachez-le d'abord via Gestion des lits");
      }

      // 1. Occuper le nouveau lit (WHERE status='disponible' — verrou anti-course)
      const newBed = await repos.occupancyBed.occupy(input.newBedId, {
        patientId:   admission.patientId,
        patientName: admission.patientName,
        encounterId: admission.encounterId ?? undefined,
        admissionId: admission.id,
      }, ctx);
      if (!newBed) throw new Error(`Lit ${target.number} non disponible (occupé entre-temps)`);

      // 2. Libérer l'ancien lit → nettoyage, uniquement s'il est encore lié
      //    à cette admission (il peut avoir été réassigné depuis)
      const oldBedId = admission.bedId;
      if (oldBedId) {
        const [oldBed] = await tx
          .select({
            patientId:   occupancyBedsTable.patientId,
            encounterId: occupancyBedsTable.encounterId,
            admissionId: occupancyBedsTable.admissionId,
          })
          .from(occupancyBedsTable)
          .where(eq(occupancyBedsTable.id, oldBedId))
          .limit(1);
        const stillLinked = !!oldBed && (
          oldBed.admissionId === admission.id ||
          (admission.encounterId != null && oldBed.encounterId === admission.encounterId) ||
          (oldBed.patientId != null && oldBed.patientId === admission.patientId)
        );
        if (stillLinked) {
          await repos.occupancyBed.free(oldBedId, ctx, { nextStatus: "nettoyage" });
        }
      }

      // 3. Réaligner l'admission sur la chaîne réelle du nouveau lit
      const updated = await repos.admission.update(admissionId, {
        bedId:        input.newBedId,
        bedNumber:    newBed.number,
        roomNumber:   newBed.roomNumber,
        floorLabel:   newBed.floorLabel,
        buildingName: newBed.buildingName,
        serviceId:    newBed.serviceId ?? admission.serviceId,
        serviceName:  newBed.serviceName ?? admission.serviceName,
      }, ctx);
      if (!updated) throw new Error("Mise à jour de l'admission échouée");

      // 4. Mouvement ADT complet dans l'historique patient
      await auditService.log({
        module:       "admissions",
        action:       "bed_transferred",
        resourceType: "admission",
        resourceId:   admissionId,
        oldValue: {
          bedId:        oldBedId,
          bedNumber:    admission.bedNumber,
          roomNumber:   admission.roomNumber,
          floorLabel:   admission.floorLabel,
          buildingName: admission.buildingName,
          serviceId:    admission.serviceId,
          serviceName:  admission.serviceName,
        },
        newValue: {
          bedId:        input.newBedId,
          bedNumber:    newBed.number,
          roomNumber:   newBed.roomNumber,
          floorLabel:   newBed.floorLabel,
          buildingName: newBed.buildingName,
          serviceId:    newBed.serviceId,
          serviceName:  newBed.serviceName,
          motif:        input.motif,
          ...(input.notes ? { notes: input.notes } : {}),
        },
        patientId:    admission.patientId,
        encounterId:  admission.encounterId ?? undefined,
        siteId:       admission.siteId ?? undefined,
      }, actor, ctx);

      return updated;
    });
  }

  // ── Cancel ────────────────────────────────────────────────────────────────────

  /**
   * Annulation transactionnelle : statut → cancelled, lit libéré, encounter
   * clôturé et audit — même garantie d'atomicité que discharge/transferBed.
   * (Revue UAT Phase 2 : l'ancienne route ne libérait ni lit ni encounter.)
   */
  async cancel(admissionId: string, actor: ActorCtx): Promise<DbAdmission> {
    return db.transaction(async (tx) => {
      const ctx: TxContext = { ...actor, tx };

      const admission = await repos.admission.findById(admissionId, ctx);
      if (!admission) throw new Error(`Admission ${admissionId} introuvable`);
      if (admission.status === "discharged") throw new Error("Patient déjà sorti — annulation impossible");
      if (admission.status === "cancelled")  throw new Error("Admission déjà annulée");

      const updated = await repos.admission.update(admissionId, { status: "cancelled" }, ctx);
      if (!updated) throw new Error("L'annulation a échoué");

      if (admission.bedId) {
        // Durcissement (données héritées) : un lit peut avoir été réassigné à un
        // autre patient depuis — ne le libérer que s'il est encore rattaché à
        // CETTE admission (même encounter ou même patient).
        const [bed] = await tx
          .select({ patientId: occupancyBedsTable.patientId, encounterId: occupancyBedsTable.encounterId })
          .from(occupancyBedsTable)
          .where(eq(occupancyBedsTable.id, admission.bedId))
          .limit(1);
        const stillLinked = !!bed && (
          (admission.encounterId != null && bed.encounterId === admission.encounterId) ||
          (bed.patientId != null && bed.patientId === admission.patientId)
        );
        if (stillLinked) {
          await repos.occupancyBed.free(admission.bedId, ctx);
        }
      }

      if (admission.encounterId) {
        await encounterService.close(admission.encounterId, "Admission annulée", actor, ctx);
      }

      await auditService.log({
        module:       "admissions",
        action:       "cancelled",
        resourceType: "admission",
        resourceId:   admissionId,
        oldValue:     { status: admission.status },
        newValue:     { status: "cancelled" },
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
