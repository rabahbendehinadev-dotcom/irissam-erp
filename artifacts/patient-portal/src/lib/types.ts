/**
 * Patient Portal — shared TypeScript types mirroring the API responses.
 */

// ─── Auth ──────────────────────────────────────────────────────────────────
export interface PatientMe {
  accountId: string;
  patientId: string;
  email: string;
  firstName: string;
  lastName: string;
  mrn: string;
  dateOfBirth: string;
  phone: string;
  preferredLanguage: "fr" | "ar" | "en";
  notifEmail: boolean;
  notifSms: boolean;
  notifPush: boolean;
  lastLogin: string | null;
}

// ─── Dashboard ─────────────────────────────────────────────────────────────
export interface DashboardData {
  nextAppointment: {
    id: string;
    scheduledAt: string;
    doctorName: string;
    departmentName: string;
    status: string;
  } | null;
  lastLabResult: {
    id: string;
    orderNumber: string;
    publishedAt: string;
    testType: string;
    status: string;
  } | null;
  lastImaging: {
    id: string;
    orderNumber: string;
    publishedAt: string;
    studyType: string;
    status: string;
  } | null;
  lastPrescription: {
    id: string;
    drug: string;
    prescribedAt: string;
    publishedAt: string;
  } | null;
  balance: {
    total: string;
    patientTotal: string;
    paid: string;
    balance: string;
  };
  insurance: {
    insurerName: string;
    expiryDate: string | null;
    active: boolean;
    coveragePercent: string;
  } | null;
  unreadNotifications: number;
}

// ─── Profile ────────────────────────────────────────────────────────────────
export interface PatientProfile {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  mrn: string;
  phone: string;
  email: string;
  address: string | null;
  city: string | null;
  bloodType: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  preferredLanguage: string;
  allergies: string[] | null;
  chronicConditions: string[] | null;
  notifEmail: boolean;
  notifSms: boolean;
  notifPush: boolean;
}

// ─── Appointments ──────────────────────────────────────────────────────────
export interface Appointment {
  id: string;
  scheduledAt: string;
  duration: number;
  status: string;
  reason: string | null;
  notes: string | null;
  doctorName: string;
  departmentName: string;
  type: string;
}

// ─── Lab Results ────────────────────────────────────────────────────────────
export interface LabResult {
  id: string;
  orderNumber: string;
  testType: string;
  status: string;
  publishedAt: string;
  patientVisibleNote: string | null;
  requestingDoctorName: string | null;
}

export interface LabResultDetail extends LabResult {
  results: unknown;
  resultSummary: string | null;
}

// ─── Imaging ────────────────────────────────────────────────────────────────
export interface ImagingResult {
  id: string;
  orderNumber: string;
  studyType: string;
  status: string;
  publishedAt: string;
  patientVisibleNote: string | null;
  requestingDoctorName: string | null;
}

export interface ImagingDetail extends ImagingResult {
  reportText: string | null;
  conclusion: string | null;
}

// ─── Prescriptions ──────────────────────────────────────────────────────────
export interface Prescription {
  id: string;
  drug: string;
  dosage: string | null;
  route: string | null;
  frequency: string | null;
  duration: string | null;
  prescribedByName: string | null;
  prescribedAt: string;
  publishedAt: string;
  instructions: string | null;
}

// ─── Documents ──────────────────────────────────────────────────────────────
export interface Document {
  id: string;
  title: string;
  category: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
  description: string | null;
}

// ─── Invoices & Payments ────────────────────────────────────────────────────
export interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  totalAmount: string;
  patientShare: string;
  paidAmount: string;
  dueAmount: string;
  insuranceCoveragePercent: string | null;
  issuedAt: string;
  dueDate: string | null;
}

export interface Payment {
  id: string;
  amount: string;
  method: string;
  paidAt: string;
  receiptNumber: string | null;
  invoiceNumber: string;
}

// ─── Insurance ──────────────────────────────────────────────────────────────
export interface InsurancePolicy {
  id: string;
  insurerName: string;
  memberNumberMasked: string;
  expiryDate: string | null;
  active: boolean;
  coveragePercent: string;
  ceilingAmount: string | null;
  remainingCeiling: string | null;
  coverageType: string;
}

export interface InsuranceClaim {
  id: string;
  claimNumber: string;
  status: string;
  totalAmount: string;
  coveredAmount: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

// ─── Hospitalizations ───────────────────────────────────────────────────────
export interface Hospitalization {
  id: string;
  encounterNumber: string;
  encounterType: string;
  status: string;
  admittedAt: string;
  actualDischargeDate: string | null;
  serviceName: string | null;
  roomNumber: string | null;
  bedNumber: string | null;
  doctorName: string | null;
  dischargeNotes: string | null;
  diagnosis: string | null;
}

// ─── Notifications ──────────────────────────────────────────────────────────
export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
}

// ─── Messages ───────────────────────────────────────────────────────────────
export interface Message {
  id: string;
  type: string;
  subject: string | null;
  body: string;
  status: string;
  createdAt: string;
  repliedAt: string | null;
  staffReply: string | null;
}

// ─── Consents ───────────────────────────────────────────────────────────────
export interface Consent {
  id: string;
  consentType: string;
  version: string;
  status: "pending" | "signed" | "refused";
  contentText: string;
  signedAt: string | null;
  refusedAt: string | null;
  expiresAt: string | null;
}

// ─── Sessions ───────────────────────────────────────────────────────────────
export interface Session {
  id: string;
  deviceName: string | null;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  lastSeen: string;
  isCurrent: boolean;
}

// ─── Appointment Request ─────────────────────────────────────────────────────
export interface AppointmentRequest {
  id: string;
  requestType: string;
  preferredDate: string | null;
  preferredTime: string | null;
  specialtyRequested: string | null;
  reason: string;
  status: string;
  createdAt: string;
  assignedDoctorName: string | null;
  confirmedAt: string | null;
  scheduledDate: string | null;
}
