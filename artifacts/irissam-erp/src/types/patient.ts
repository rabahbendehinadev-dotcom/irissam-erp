export type PatientGender = 'M' | 'F';
export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export type PatientStatus = 'active' | 'inactive' | 'archived' | 'deceased';
export type SyncStatus = 'synced' | 'pending' | 'conflict' | 'error';
// AdmissionStatus moved to ./admission
export type AppointmentStatus = 'confirmed' | 'pending' | 'cancelled' | 'completed' | 'no_show' | 'in_progress';
export type MaritalStatus = 'celibataire' | 'marie' | 'divorce' | 'veuf';
export type IdDocumentType = 'cni' | 'passeport' | 'permis' | 'autre';
export type InsuranceType = 'cnas' | 'casnos' | 'mutuelle' | 'militaire' | 'gratuite' | 'payant';
export type TimelineEventType =
  | 'vaccination'
  | 'creation' | 'update' | 'document' | 'document_update'
  | 'appointment' | 'admission' | 'result' | 'discharge' | 'consultation'
  | 'prescription' | 'laboratory' | 'imaging' | 'hospitalization'
  | 'emergency' | 'invoice' | 'payment';

export interface PatientMedicalInfo {
  allergies: string[];
  chronicDiseases: string[];
  majorHistory: string[];
  disability?: string;
  criticalNotes?: string;
}

export interface PatientContact {
  name: string;
  relation: string;
  phone: string;
  address?: string;
}

export interface PatientInsurance {
  type: InsuranceType;
  organizationName?: string;
  memberNumber?: string;
  validUntil?: string;
}

export interface Patient {
  id: string;
  mpiId: string;
  fileNumber: string;
  internalNumber: string;

  // Identity
  firstName: string;
  lastName: string;
  maidenName?: string;
  gender: PatientGender;
  dateOfBirth: string;
  placeOfBirth?: string;
  nationality: string;
  maritalStatus?: MaritalStatus;
  photoUrl?: string;

  // IDs
  idDocumentType?: IdDocumentType;
  idDocumentNumber?: string;
  socialSecurityNumber?: string;

  // Contact
  phone: string;
  phoneSecondary?: string;
  email?: string;
  address?: string;
  commune?: string;
  wilaya?: string;
  postalCode?: string;
  country: string;

  // Medical
  bloodType?: BloodType;
  rhesus?: '+' | '-';
  medical: PatientMedicalInfo;

  // Emergency contact
  emergencyContact?: PatientContact;

  // Insurance
  insurance?: PatientInsurance;

  // Site
  siteId: string;
  departmentId?: string;

  // Status & sync
  status: PatientStatus;
  syncStatus: SyncStatus;
  isIncomplete: boolean;
  potentialDuplicate: boolean;

  // Audit
  createdAt: string;
  updatedAt: string;
  createdById: string;
}

export interface PatientTimelineEvent {
  id: string;
  patientId: string;
  type: TimelineEventType;
  title: string;
  description?: string;
  createdAt: string;
  userId: string;
  userName: string;
  siteId: string;
  siteName: string;
  doctor?: string;
  service?: string;
}

// Admission moved to ./admission (full type)

export interface Appointment {
  id: string;
  patientId: string;
  patient: Patient;
  doctorId: string;
  doctorName: string;
  departmentId: string;
  departmentName: string;
  scheduledAt: string;
  duration: number;
  status: AppointmentStatus;
  notes?: string;
}
