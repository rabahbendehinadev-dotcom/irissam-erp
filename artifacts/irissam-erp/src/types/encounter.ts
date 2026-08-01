/**
 * Encounter — The central clinical entity.
 *
 * Every clinical record (lab, imaging, prescription, procedure, note, decision)
 * belongs to an Encounter. An Encounter belongs to a Patient.
 *
 * Phase 1 of Production Logic: "لا يتم إنشاء أي سجل خارج Encounter"
 *
 * PostgreSQL equivalent:
 *   CREATE TABLE encounters (
 *     id TEXT PRIMARY KEY,
 *     patient_id TEXT NOT NULL REFERENCES patients(id),
 *     type encounter_type NOT NULL,
 *     status encounter_status NOT NULL,
 *     ...
 *   );
 */

export type EncounterType    = 'urgence' | 'consultation' | 'admission' | 'externe';
export type EncounterStatus  = 'open' | 'closed' | 'suspended' | 'cancelled';

export type LinkedRecordType =
  | 'lab_order' | 'imaging_order' | 'prescription' | 'procedure'
  | 'clinical_note' | 'surgical_request' | 'icu_admission'
  | 'admission' | 'invoice' | 'vital_reading';

export interface EncounterLinkedRecord {
  recordType: LinkedRecordType;
  recordId: string;
  summary?: string;       // e.g. "NFS — STAT", "Paracétamol 1g IV"
  createdAt: string;
}

export interface Encounter {
  id: string;                  // enc-{patientId} or enc-{timestamp}-{random}
  patientId: string;
  patientName: string;         // Denormalized for display
  type: EncounterType;
  status: EncounterStatus;
  chiefComplaint: string;

  // Source
  sourceModule: 'urgences' | 'consultations' | 'hospitalisation' | 'externe';
  sourceRecordId: string;      // visit-{id}, consultation-{id}, etc.

  // Linked sub-records (append-only)
  linkedRecords: EncounterLinkedRecord[];

  // Workflow state — mirrors EmergencyPatientStatus for urgence encounters
  workflowStatus?: string;

  // Staff assignment
  primaryDoctorId?: string;
  primaryDoctorName?: string;
  primaryNurseId?: string;
  primaryNurseName?: string;

  // Location
  roomId?: string;
  roomName?: string;
  wardId?: string;
  wardName?: string;

  // Timestamps
  openedAt: string;            // ISO 8601
  closedAt?: string;
  updatedAt: string;

  // Close reason
  closeReason?: string;        // 'domicile' | 'hospitalisation' | 'bloc' | 'reanimation' | 'transfert' | 'deces'

  // Creator
  createdById: string;
  createdByName: string;
}
