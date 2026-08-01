/**
 * Module 2 — Admissions / Préadmissions
 * Types complets pour la gestion des admissions hospitalières.
 */

// ─── Enumerations ───────────────────────────────────────────────────────────

export type AdmissionType =
  | 'hospitalisation'
  | 'ambulatoire'
  | 'preadmission'
  | 'urgence'
  | 'maternite'
  | 'chirurgie';

export type AdmissionStatus =
  | 'active'       // hospitalisé en cours
  | 'preadmission' // préadmis, non encore admis
  | 'ambulatoire'  // pris en charge sans hospitalisation
  | 'transferred'  // transféré vers autre service/hôpital
  | 'discharged'   // sorti
  | 'cancelled';   // annulé

export type AdmissionPriority =
  | 'normal'
  | 'urgent'
  | 'tres_urgent'
  | 'vital';

export type BedStatus =
  | 'libre'
  | 'occupe'
  | 'nettoyage'
  | 'maintenance';

export type DischargeType =
  | 'domicile'
  | 'transfert_interne'
  | 'transfert_externe'
  | 'deces'
  | 'fugue'
  | 'contre_avis';

export type AdmissionTimelineEventType =
  | 'admission'
  | 'transfer'
  | 'bed_change'
  | 'discharge'
  | 'status_change'
  | 'note'
  | 'exam_ordered'
  | 'exam_result'
  | 'preadmission_converted';

// ─── Structures physiques ────────────────────────────────────────────────────
// Note: Building and Floor are re-exported from @/types/hospital

export interface HospitalRoom {
  id: string;
  floorId: string;
  number: string;
  type: 'standard' | 'soins_intensifs' | 'isolement' | 'maternite' | 'pediatrie';
  capacity: number;  // number of beds
  serviceId: string;
}

export interface Bed {
  id: string;
  number: string;      // e.g. '101-A', '201-B'
  roomId: string;
  roomNumber: string;
  floorId: string;
  floorLabel: string;
  buildingId: string;
  buildingName: string;
  buildingCode: string;
  status: BedStatus;
  serviceId?: string;
  patientId?: string;
  patientName?: string;  // denormalized
  admissionId?: string;
  notes?: string;
}

// ─── Admission ───────────────────────────────────────────────────────────────

export interface Admission {
  id: string;
  admissionNumber: string;    // ADM-2026-0001
  patientId: string;
  patientMpiId: string;
  patientName: string;        // denormalized for display
  patientDob?: string;
  patientPhone?: string;

  type: AdmissionType;
  status: AdmissionStatus;
  priority: AdmissionPriority;

  serviceId: string;
  serviceName: string;
  doctorId: string;
  doctorName: string;

  motif: string;              // chief complaint / reason
  diagnosis?: string;

  // Bed assignment
  bedId?: string;
  bedNumber?: string;
  roomNumber?: string;
  floorLabel?: string;
  buildingName?: string;

  // Dates
  admissionDate: string;      // ISO date YYYY-MM-DD
  admissionTime: string;      // HH:MM
  expectedDischargeDate?: string;
  actualDischargeDate?: string;
  actualDischargeTime?: string;

  // Discharge / transfer
  dischargeType?: DischargeType;
  dischargeNotes?: string;
  transferTo?: string;        // service or external hospital name
  transferDate?: string;

  // Pre-admission specific
  preadmissionDate?: string;  // planned admission date
  preadmissionConvertedAt?: string;

  siteId: string;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  notes?: string;
}

// ─── Timeline ────────────────────────────────────────────────────────────────

export interface AdmissionTimelineEvent {
  id: string;
  admissionId: string;
  type: AdmissionTimelineEventType;
  description: string;
  date: string;         // ISO timestamp
  userId: string;
  userName: string;
  meta?: Record<string, string>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Structure représentant un service hospitalier (pour les selects) */
export interface HospitalService {
  id: string;
  name: string;
  code: string;
  buildingId?: string;
}

/** Médecin attaché à un service */
export interface Doctor {
  id: string;
  name: string;
  speciality: string;
  serviceId: string;
}
