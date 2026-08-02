// ─── Emergency Dossier — Complete Type System ────────────────────────────────

// ── Workflow ──────────────────────────────────────────────────────────────────

export type EmergencyWorkflowStatus =
  | 'arrive'
  | 'en_triage'
  | 'attente_medecin'
  | 'en_prise_en_charge'
  | 'en_soins'
  | 'en_observation'
  | 'attente_resultats'
  | 'decision_attente'
  | 'hospitalise'
  | 'transfere'
  | 'sorti'
  | 'decede'
  | 'cloture';

export interface WorkflowTransition {
  from: EmergencyWorkflowStatus;
  to: EmergencyWorkflowStatus;
  at: string;        // ISO
  by: string;        // user name
  byId: string;
  notes?: string;
}

// ── Vitals & Scores ───────────────────────────────────────────────────────────

export interface VitalReading {
  timestamp: string;
  hr?: number;
  sysBP?: number;
  diasBP?: number;
  bp?: string;       // computed "120/80" for display
  spo2?: number;
  temp?: number;
  rr?: number;
  gcs?: number;
  painLevel?: number;
  glucose?: number;
  weight?: number;   // kg
  height?: number;   // cm
  bmi?: number;      // computed
  oxygenAdministered?: boolean;
  o2Flow?: number;   // L/min
  consciousness?: 'alerte' | 'voix' | 'douleur' | 'inconscient';
  recordedBy: string;
  recordedById?: string;
}

export interface GlasgowBreakdown {
  eye: 1 | 2 | 3 | 4;
  verbal: 1 | 2 | 3 | 4 | 5;
  motor: 1 | 2 | 3 | 4 | 5 | 6;
  recordedAt: string;
  recordedBy: string;
}

export interface ClinicalScores {
  news2: number;
  news2Risk: 'faible' | 'modere' | 'eleve';
  qsofa: number;
  qsofaAlert: boolean;
  shockIndex: number;
  shockLevel: 'normal' | 'leger' | 'modere' | 'severe';
  computedAt: string;
}

// ── ABCDE ─────────────────────────────────────────────────────────────────────

export type ABCDEItemStatus = 'normal' | 'anormal' | 'non_evalue';

export interface ABCDEItem {
  status: ABCDEItemStatus;
  notes: string;
  actionImmédiate?: string;
}

export interface ABCDEAssessment {
  airway: ABCDEItem & { detail?: string };
  breathing: ABCDEItem & { rate?: number; pattern?: string; spo2?: number };
  circulation: ABCDEItem & { hr?: number; bp?: string; capRefill?: string };
  disability: ABCDEItem & { gcs?: number; pupils?: string; glucose?: number };
  exposure: ABCDEItem & { temp?: number; findings?: string };
  recordedAt: string;
  recordedBy: string;
}

// ── Clinical Examination ──────────────────────────────────────────────────────

export type ExamSectionStatus = 'normal' | 'anormal' | 'non_evalue';

export interface ExamSection {
  status: ExamSectionStatus;
  findings: string;
}

export interface ClinicalExamination {
  generalState: ExamSection;
  cardiovascular: ExamSection;
  respiratory: ExamSection;
  neurological: ExamSection;
  abdominal: ExamSection;
  traumatic: ExamSection;
  cutaneous: ExamSection;
  ent: ExamSection;            // ORL
  musculoskeletal: ExamSection;
  other: ExamSection;
  provisionalDiagnosis: string;
  differentialDiagnoses: string[];
  severity: 'non_grave' | 'modere' | 'grave' | 'critique';
  icd10Placeholder: string;
  examinedAt: string;
  examinedBy: string;
}

// ── Lab & Imaging ─────────────────────────────────────────────────────────────

export interface LabRequest {
  id: string;
  test: string;
  category: string;
  urgency: 'STAT' | 'urgent' | 'routine';
  laboratory?: string;
  requestedBy: string;
  requestedById?: string;
  requestedAt: string;
  status: 'demandee' | 'prelevee' | 'en_cours' | 'validee' | 'annulee';
  result?: string;
  isCritical?: boolean;
  resultAt?: string;
}

export interface ImagingRequest {
  id: string;
  exam: string;
  region: string;
  side?: string;
  urgency: 'STAT' | 'urgent' | 'routine';
  withContrast?: boolean;
  contraindications?: string;
  requestedBy: string;
  requestedById?: string;
  requestedAt: string;
  status: 'demandee' | 'planifiee' | 'realisee' | 'interpretee' | 'annulee';
  result?: string;
  resultAt?: string;
}

// ── Prescriptions & Procedures ────────────────────────────────────────────────

export interface Prescription {
  id: string;
  drug: string;
  dosage: string;
  route: 'IV' | 'IM' | 'PO' | 'SC' | 'SL' | 'Inhalé' | 'Topique' | 'Nasal';
  frequency: string;
  duration?: string;
  prescribedBy: string;
  prescribedById?: string;
  prescribedAt: string;
  scheduledAt?: string;
  administeredAt?: string;
  administeredBy?: string;
  comment?: string;
  status: 'prescrit' | 'prepare' | 'administre' | 'refuse' | 'retard' | 'annule';
}

export interface Procedure {
  id: string;
  name: string;
  category: 'oxygene' | 'perfusion' | 'injection' | 'pansement' | 'suture'
    | 'immobilisation' | 'catheter' | 'reanimation' | 'autre';
  performedBy: string;
  performedById?: string;
  performedAt: string;
  result?: string;
  notes?: string;
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export interface NoteVersion {
  content: string;
  editedAt: string;
  editedBy: string;
}

export interface ClinicalNote {
  id: string;
  content: string;
  type: 'medical' | 'nursing' | 'administratif' | 'transmission';
  author: string;
  authorId?: string;
  role: string;
  createdAt: string;
  isPinned?: boolean;
  versions?: NoteVersion[];
}

// ── Observation ───────────────────────────────────────────────────────────────

export interface ObservationEntry {
  startedAt: string;
  motif: string;
  frequency: string;       // e.g. "Toutes les 30 min"
  endedAt?: string;
  responsibleDoctor: string;
  responsibleNurse: string;
  readings: VitalReading[];
  treatments: string[];
  evolution: string;
  alerts: string[];
}

// ── Final Decision ────────────────────────────────────────────────────────────

export type FinalDecisionType =
  | 'domicile' | 'hospitalisation' | 'reanimation'
  | 'bloc' | 'transfert' | 'observation_prolongee' | 'deces' | null;

export interface FinalDecision {
  decision: FinalDecisionType;
  // Domicile
  ordonnance?: string;
  conseils?: string;
  signesAlerte?: string;
  accompagnant?: string;
  controlDate?: string;
  // Hospitalisation
  ward?: string;
  doctorName?: string;
  bedId?: string;       // UUID of the occupancy_beds row (required to reserve the bed)
  bedPlaceholder?: string; // display label (number) for the selected bed
  medicalSummary?: string;
  // Réanimation
  icuMotif?: string;
  icuPriority?: string;
  icuBedId?: string;    // UUID of the occupancy_beds row (type=soins_intensifs)
  icuBed?: string;      // display label for the selected ICU bed
  icuTeamNotified?: boolean;
  // Bloc
  intervention?: string;
  surgeon?: string;
  anesthesist?: string;
  urgencyDegree?: string;
  preOpPrep?: string;
  consentSigned?: boolean;
  // Transfert
  destEtablissement?: string;
  destMotif?: string;
  destDoctor?: string;
  ambulance?: string;
  // Décès
  deathTime?: string;
  declaringDoctor?: string;
  provisionalCause?: string;
  personNotified?: string;
  // General
  notes: string;
  decidedBy?: string;
  decidedById?: string;
  decidedAt?: string;
  linkedRecordId?: string;   // ID of created admission/surgical request
}

// ── Audit ─────────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  action: string;
  category: 'admin' | 'clinical' | 'prescription' | 'lab' | 'imaging' | 'nursing' | 'system' | 'decision';
  details: string;
  performedBy: string;
  performedById?: string;
  role: string;
  timestamp: string;
}

// ── Full Dossier ──────────────────────────────────────────────────────────────

export interface EmergencyDossier {
  patientId: string;
  dossierNumber: string;

  // Workflow
  workflowStatus: EmergencyWorkflowStatus;
  workflowHistory: WorkflowTransition[];
  triageStartTime?: string;
  careStartTime?: string;

  // Medical alerts
  allergies: string[];
  chronicDiseases: string[];
  bloodThinners: boolean;
  pregnant: boolean;
  infectiousDisease?: string;
  rareBloodType?: boolean;
  disability?: string;
  chronicTreatment?: string;
  bloodType: string;

  // Clinical text
  chiefComplaint: string;
  chiefComplaintTime?: string;
  chiefComplaintContext?: string;
  mechanism?: string;
  illnessHistory: string;
  symptomsDuration?: string;
  symptomsIntensity?: string;

  // Vitals history
  vitalReadings: VitalReading[];
  glasgowHistory: GlasgowBreakdown[];
  currentAbcde: ABCDEAssessment;
  scores?: ClinicalScores;

  // Clinical examination
  clinicalExamination: ClinicalExamination;

  // Orders & treatment
  labRequests: LabRequest[];
  imagingRequests: ImagingRequest[];
  prescriptions: Prescription[];
  procedures: Procedure[];

  // Notes
  medicalNotes: ClinicalNote[];
  nursingNotes: ClinicalNote[];
  adminNotes: ClinicalNote[];
  transmissions: ClinicalNote[];

  // Observation
  observation?: ObservationEntry;

  // Decision
  finalDecision: FinalDecision;

  // Audit
  auditLog: AuditEntry[];
}
