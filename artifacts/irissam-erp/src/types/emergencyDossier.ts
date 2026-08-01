// ─── Emergency Dossier Types ─────────────────────────────────────────────────

export interface VitalReading {
  timestamp: string;
  hr?: number;
  bp?: string;
  spo2?: number;
  temp?: number;
  rr?: number;
  gcs?: number;
  painLevel?: number;
  glucose?: number;
  recordedBy: string;
}

export interface GlasgowBreakdown {
  eye: 1 | 2 | 3 | 4;
  verbal: 1 | 2 | 3 | 4 | 5;
  motor: 1 | 2 | 3 | 4 | 5 | 6;
  recordedAt: string;
  recordedBy: string;
}

export interface ABCDEAssessment {
  airway: { status: 'libre' | 'compromis' | 'obstrué'; notes: string };
  breathing: {
    rate: number;
    pattern: 'normal' | 'tachypnée' | 'bradypnée' | 'dyspnée' | 'apnée';
    spo2: number;
    notes: string;
  };
  circulation: { hr: number; bp: string; capRefill: string; notes: string };
  disability: { gcs: number; pupils: string; glucose?: number; notes: string };
  exposure: { temp: number; findings: string; notes: string };
  recordedAt: string;
  recordedBy: string;
}

export interface LabRequest {
  id: string;
  test: string;
  category: string;
  urgency: 'STAT' | 'urgent' | 'routine';
  requestedBy: string;
  requestedAt: string;
  status: 'en_attente' | 'en_cours' | 'disponible' | 'annule';
  result?: string;
  resultAt?: string;
}

export interface ImagingRequest {
  id: string;
  exam: string;
  region: string;
  side?: string;
  urgency: 'STAT' | 'urgent' | 'routine';
  requestedBy: string;
  requestedAt: string;
  status: 'en_attente' | 'en_cours' | 'disponible' | 'annule';
  result?: string;
  resultAt?: string;
}

export interface Prescription {
  id: string;
  drug: string;
  dosage: string;
  route: 'IV' | 'IM' | 'PO' | 'SC' | 'SL' | 'Inhalé' | 'Topique' | 'Nasal';
  frequency: string;
  duration?: string;
  prescribedBy: string;
  prescribedAt: string;
  administeredAt?: string;
  status: 'prescrit' | 'administré' | 'en_cours' | 'annule';
}

export interface Procedure {
  id: string;
  name: string;
  category: string;
  performedBy: string;
  performedAt: string;
  notes?: string;
}

export interface ClinicalNote {
  id: string;
  content: string;
  type: 'medical' | 'nursing';
  author: string;
  role: string;
  createdAt: string;
  isPinned?: boolean;
}

export type FinalDecisionType =
  | 'domicile'
  | 'hospitalisation'
  | 'bloc'
  | 'reanimation'
  | 'transfert'
  | 'deces'
  | null;

export interface FinalDecision {
  decision: FinalDecisionType;
  ward?: string;
  bed?: string;
  transferDestination?: string;
  notes: string;
  decidedBy?: string;
  decidedAt?: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  category: 'admin' | 'clinical' | 'prescription' | 'lab' | 'imaging' | 'nursing' | 'system';
  details: string;
  performedBy: string;
  role: string;
  timestamp: string;
}

export interface DossierTimeline {
  id: string;
  time: string;
  label: string;
  detail?: string;
  icon: 'arrival' | 'vitals' | 'lab' | 'imaging' | 'prescription' | 'procedure' | 'note' | 'decision' | 'doctor' | 'nurse';
  highlight?: boolean;
}

export interface EmergencyDossier {
  patientId: string;
  dossierNumber: string;
  // Medical alerts
  allergies: string[];
  chronicDiseases: string[];
  bloodThinners: boolean;
  pregnant: boolean;
  infectiousDisease?: string;
  bloodType: string;
  // Clinical text
  chiefComplaint: string;
  illnessHistory: string;
  clinicalExam: string;
  provisionalDiagnosis: string;
  // Vitals series
  vitalReadings: VitalReading[];
  glasgowHistory: GlasgowBreakdown[];
  currentAbcde: ABCDEAssessment;
  // Orders & treatment
  labRequests: LabRequest[];
  imagingRequests: ImagingRequest[];
  prescriptions: Prescription[];
  procedures: Procedure[];
  // Notes
  medicalNotes: ClinicalNote[];
  nursingNotes: ClinicalNote[];
  // Decision
  finalDecision: FinalDecision;
  // Audit
  auditLog: AuditEntry[];
}
