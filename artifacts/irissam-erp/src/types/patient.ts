export type PatientGender = 'M' | 'F';
export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export type PatientStatus = 'active' | 'inactive' | 'archived' | 'deceased';
export type SyncStatus = 'synced' | 'pending' | 'conflict' | 'error';
export type AdmissionStatus = 'active' | 'discharged' | 'transferred' | 'deceased';
export type AppointmentStatus = 'confirmed' | 'pending' | 'cancelled' | 'completed' | 'no_show';
export type MaritalStatus = 'celibataire' | 'marie' | 'divorce' | 'veuf';
export type IdDocumentType = 'cni' | 'passeport' | 'permis' | 'autre';
export type InsuranceType = 'cnas' | 'casnos' | 'mutuelle' | 'militaire' | 'gratuite' | 'payant';
export type TimelineEventType = 'creation' | 'update' | 'document' | 'appointment' | 'admission' | 'result' | 'discharge' | 'consultation';

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
}

export interface Admission {
  id: string;
  patientId: string;
  patient: Patient;
  departmentId: string;
  bedNumber?: string;
  admittedAt: string;
  dischargedAt?: string;
  status: AdmissionStatus;
  diagnosis?: string;
  attendingDoctorId?: string;
}

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
