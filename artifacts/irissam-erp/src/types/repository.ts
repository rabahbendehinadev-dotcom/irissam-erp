// ─── Mock Repository — Cross-module Data Model ───────────────────────────────
// This file defines the unified data model shared across all modules.
// The MockRepository acts as an in-memory PostgreSQL substitute.
// To migrate to a real DB: replace repository mutations with API calls.

import type { EmergencyPatientStatus } from './emergency';

// ─── Audit ────────────────────────────────────────────────────────────────────

export type RepoModule =
  | 'urgences' | 'laboratoire' | 'imagerie' | 'pharmacie'
  | 'hospitalisation' | 'bloc' | 'reanimation' | 'system';

export interface RepoAuditEntry {
  id: string;
  timestamp: string;
  module: RepoModule;
  action: string;
  oldValue?: string;
  newValue?: string;
  userId: string;
  userName: string;
  userRole: string;
  patientId?: string;
  visitId?: string;
  resourceId?: string;
  resourceType?: string;
  ip: string;    // '127.0.0.1' for mock; real IP from server in production
}

// ─── Emergency Visit ──────────────────────────────────────────────────────────

export interface EmergencyVisit {
  id: string;
  patientId: string;
  patientName: string;
  priority: string;
  status: EmergencyPatientStatus;
  assignedDoctorId?: string;
  assignedDoctorName?: string;
  assignedNurseId?: string;
  assignedNurseName?: string;
  assignedRoomId?: string;
  assignedRoomName?: string;
  serviceId?: string;
  serviceName?: string;
  chiefComplaint: string;
  arrivalTime: string;
  triageTime?: string;
  careStartTime?: string;
  closedAt?: string;
  closeReason?: 'domicile' | 'hospitalisation' | 'bloc' | 'reanimation' | 'transfert' | 'deces';
  isLocked: boolean;
  linkedAdmissionId?: string;
  linkedSurgicalRequestId?: string;
  linkedICUAdmissionId?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Lab Order ────────────────────────────────────────────────────────────────

export interface RepoLabOrder {
  id: string;
  visitId: string;
  patientId: string;
  patientName: string;
  test: string;
  category: string;
  urgency: 'STAT' | 'urgent' | 'routine';
  requestedBy: string;
  requestedById: string;
  requestedAt: string;
  status: 'demandee' | 'prelevee' | 'en_cours' | 'validee' | 'annulee';
  result?: string;
  isCritical?: boolean;
  resultAt?: string;
  laboratory?: string;
  sourceModule: 'urgences' | 'consultation' | 'hospitalisation';
}

// ─── Imaging Order ────────────────────────────────────────────────────────────

export interface RepoImagingOrder {
  id: string;
  visitId: string;
  patientId: string;
  patientName: string;
  exam: string;
  region: string;
  side?: string;
  urgency: 'STAT' | 'urgent' | 'routine';
  withContrast?: boolean;
  requestedBy: string;
  requestedById: string;
  requestedAt: string;
  status: 'demandee' | 'planifiee' | 'realisee' | 'interpretee' | 'annulee';
  result?: string;
  resultAt?: string;
  sourceModule: 'urgences' | 'consultation' | 'hospitalisation';
}

// ─── Prescription ─────────────────────────────────────────────────────────────

export interface RepoPrescription {
  id: string;
  visitId: string;
  patientId: string;
  patientName: string;
  drug: string;
  dosage: string;
  route: string;
  frequency: string;
  duration?: string;
  prescribedBy: string;
  prescribedById: string;
  prescribedAt: string;
  status: 'prescrit' | 'administre' | 'annule';
  sourceModule: 'urgences' | 'consultation';
}

// ─── Surgical Request (Bloc) ──────────────────────────────────────────────────

export interface SurgicalRequest {
  id: string;
  visitId: string;
  patientId: string;
  patientName: string;
  intervention: string;
  surgeon?: string;
  anesthesist?: string;
  urgencyDegree: string;
  preOpPrep?: string;
  consentSigned: boolean;
  status: 'demande' | 'planifie' | 'en_cours' | 'termine' | 'annule';
  requestedBy: string;
  requestedById: string;
  createdAt: string;
  scheduledAt?: string;
}

// ─── ICU Admission ────────────────────────────────────────────────────────────

export interface ICUAdmission {
  id: string;
  visitId: string;
  patientId: string;
  patientName: string;
  motif: string;
  priority: string;
  icuBed?: string;
  teamNotified: boolean;
  status: 'demande' | 'accepte' | 'en_cours' | 'transfere' | 'sorti';
  requestedBy: string;
  requestedById: string;
  createdAt: string;
}

// ─── Audit context helper ─────────────────────────────────────────────────────

export interface AuditCtx {
  userId: string;
  userName: string;
  userRole: string;
}
