export type ConsultationType =
  | 'programmee' | 'sans_rdv' | 'controle' | 'specialisee'
  | 'ambulatoire' | 'teleconsultation' | 'urgences' | 'hospitalisation';

export type ConsultationStatus =
  | 'planifiee' | 'en_attente' | 'en_cours' | 'suspendue'
  | 'terminee' | 'annulee' | 'patient_absent';

export type ConsultationOrigin = 'rdv' | 'urgence' | 'admission' | 'sans_rdv' | 'hospitalisation' | 'controle';
export type ConsultationPriority = 'normale' | 'urgente' | 'tres_urgente';

export type LabOrderStatus = 'brouillon' | 'demandee' | 'prelevee' | 'en_cours' | 'validee' | 'annulee';
export type ImagingOrderStatus = 'brouillon' | 'demandee' | 'planifiee' | 'realisee' | 'interpretee' | 'annulee';
export type DiagnosisKind = 'principal' | 'secondaire';
export type DiagnosisStatus = 'provisoire' | 'confirme';
export type GravityLevel = 'leger' | 'modere' | 'grave' | 'critique';
export type DocumentType =
  | 'certificat_medical' | 'arret_travail' | 'lettre_orientation'
  | 'lettre_reference' | 'compte_rendu' | 'certificat_aptitude' | 'autre';

export interface VitalSigns {
  weight?: number;             // kg
  height?: number;             // cm
  temperature?: number;        // °C
  systolicBP?: number;         // mmHg
  diastolicBP?: number;        // mmHg
  heartRate?: number;          // bpm
  respiratoryRate?: number;    // /min
  oxygenSaturation?: number;   // %
  bloodGlucose?: number;       // mmol/L
  painLevel?: number;          // 0-10
  bmi?: number;                // computed
  waistCircumference?: number; // cm
  glasgowScore?: number;       // 3-15
  consciousnessState?: string; // alerte | voix | douleur | inconscient
  oxygenAdministered?: boolean;
  oxygenFlowRate?: number;     // L/min
  clinicalComment?: string;
  pregnancy?: boolean;
  nursingNotes?: string;
}

export interface Diagnosis {
  id: string;
  kind: DiagnosisKind;
  status: DiagnosisStatus;
  icd10Code?: string;
  label: string;
  gravity?: GravityLevel;
  comments?: string;
  confirmedAt?: string;
}

export interface PrescriptionItem {
  id: string;
  medication: string;
  form: string;
  dosage: string;
  route: string;
  frequency: string;
  duration: string;
  quantity: string;
  instructions?: string;
  timing?: string;
  renewable: boolean;
  notes?: string;
  allergyWarning?: string;
}

export interface LabOrder {
  id: string;
  analysisType: string;
  priority: 'normale' | 'urgente' | 'tres_urgente';
  laboratory: string;
  instructions?: string;
  fastingRequired: boolean;
  requestedDate?: string;
  clinicalReason: string;
  status: LabOrderStatus;
}

export interface ImagingOrder {
  id: string;
  examType: string;
  anatomicZone: string;
  priority: 'normale' | 'urgente' | 'tres_urgente';
  imagingService: string;
  clinicalReason: string;
  clinicalQuestion?: string;
  withContrast: boolean;
  contraindications?: string;
  requestedDate?: string;
  status: ImagingOrderStatus;
}

export interface MedicalDocument {
  id: string;
  type: DocumentType;
  date: string;
  doctorName: string;
  content: string;
  duration?: string;
  signaturePlaceholder: boolean;
}

export interface ClinicalExam {
  template: string;
  generalState?: string;
  consciousness?: string;
  hydration?: string;
  cardiovascular?: string;
  respiratory?: string;
  abdominal?: string;
  neurological?: string;
  skin?: string;
  other?: string;
}

export interface FollowUpPlan {
  recommendedTreatment?: string;
  medicalAdvice?: string;
  diet?: string;
  rest?: string;
  monitoring?: string;
  controlDate?: string;
  newAppointment?: boolean;
  specialistReferral?: string;
  admissionRecommended?: boolean;
  hospitalizationRecommended?: boolean;
  returnToEmergencyIfWorse: boolean;
}

export interface ConsultationVersion {
  version: number;
  modifiedBy: string;
  modifiedAt: string;
  reason: string;
  snapshot: string; // JSON snapshot of previous state
}

/** A single immutable audit entry generated locally on every clinical action. */
export interface AuditEntry {
  id: string;
  /** ISO-8601 timestamp */
  at: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  /** e.g. "Chrome 126 / Windows 11" */
  device: string;
  /** pending = not yet sent to API; synced = confirmed by server */
  syncStatus: 'pending' | 'synced';
}

export interface Consultation {
  id: string;
  number: string;           // CON-2026-0001
  patientId: string;
  patientName: string;
  patientMpi: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  serviceId: string;
  serviceName: string;
  siteId: string;
  siteName: string;
  appointmentId?: string;
  admissionId?: string;
  date: string;
  scheduledAt: string;
  startedAt?: string;
  endedAt?: string;
  duration?: number;        // minutes
  type: ConsultationType;
  origin: ConsultationOrigin;
  reason: string;           // motif principal
  status: ConsultationStatus;
  syncStatus: 'synced' | 'pending' | 'conflict' | 'error';
  priority?: ConsultationPriority;
  companion?: string;

  // Clinical sections (filled during workspace)
  vitalSigns?: VitalSigns;
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  symptoms?: string[];
  onsetDate?: string;
  onsetDuration?: string;
  intensity?: string;
  aggravatingFactors?: string;
  relievingFactors?: string;
  familyContext?: string;
  professionalContext?: string;
  freeNotes?: string;
  clinicalExam?: ClinicalExam;
  diagnoses?: Diagnosis[];
  prescriptions?: PrescriptionItem[];
  labOrders?: LabOrder[];
  imagingOrders?: ImagingOrder[];
  documents?: MedicalDocument[];
  followUp?: FollowUpPlan;

  // Audit
  versions?: ConsultationVersion[];
  auditLog?: AuditEntry[];
  createdAt: string;
  updatedAt: string;
  createdById: string;
  completedById?: string;
}
