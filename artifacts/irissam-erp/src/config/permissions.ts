import type { UserRole } from '@/types';

/**
 * Permission keys for each feature area.
 * Add new permissions here as modules are built.
 * Structure: domain.action
 */
export type Permission =
  // Dashboard
  | 'dashboard.view'
  // Patients — MPI
  | 'patients.view' | 'patients.create' | 'patients.edit' | 'patients.archive'
  | 'patients.export' | 'patients.view_sensitive' | 'patients.override_duplicate' | 'patients.view_audit'
  // Appointments
  | 'appointments.view' | 'appointments.create' | 'appointments.edit' | 'appointments.cancel'
  // Admissions
  | 'admissions.view' | 'admissions.create' | 'admissions.discharge'
  // Emergencies
  | 'emergencies.view' | 'emergencies.triage'
  // Consultations
  | 'consultations.view' | 'consultations.create' | 'consultations.edit'
  // Operating room
  | 'operating_room.view' | 'operating_room.schedule'
  // Laboratory
  | 'laboratory.view' | 'laboratory.create' | 'laboratory.validate'
  // Imaging
  | 'imaging.view' | 'imaging.request'
  // Pharmacy
  | 'pharmacy.view' | 'pharmacy.dispense' | 'pharmacy.manage_stock'
  // Blood bank
  | 'blood_bank.view' | 'blood_bank.manage'
  // Medical stock
  | 'medical_stock.view' | 'medical_stock.manage'
  // Finance
  | 'finance.view' | 'finance.create_invoice' | 'finance.validate'
  // HR
  | 'hr.view' | 'hr.manage'
  // Doctors
  | 'doctors.view' | 'doctors.manage'
  // Reports
  | 'reports.view' | 'reports.export'
  // Settings
  | 'settings.view' | 'settings.manage'
  // Admin
  | 'admin.users' | 'admin.roles' | 'admin.audit' | 'admin.backup';

/**
 * Role → Permission matrix.
 * Extend this as new modules are built.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  administrateur: [
    'dashboard.view',
    'patients.view', 'patients.create', 'patients.edit', 'patients.archive',
    'patients.export', 'patients.view_sensitive', 'patients.override_duplicate', 'patients.view_audit',
    'appointments.view', 'appointments.create', 'appointments.edit', 'appointments.cancel',
    'admissions.view', 'admissions.create', 'admissions.discharge',
    'emergencies.view', 'emergencies.triage',
    'consultations.view', 'consultations.create', 'consultations.edit',
    'operating_room.view', 'operating_room.schedule',
    'laboratory.view', 'laboratory.create', 'laboratory.validate',
    'imaging.view', 'imaging.request',
    'pharmacy.view', 'pharmacy.dispense', 'pharmacy.manage_stock',
    'blood_bank.view', 'blood_bank.manage',
    'medical_stock.view', 'medical_stock.manage',
    'finance.view', 'finance.create_invoice', 'finance.validate',
    'hr.view', 'hr.manage',
    'doctors.view', 'doctors.manage',
    'reports.view', 'reports.export',
    'settings.view', 'settings.manage',
    'admin.users', 'admin.roles', 'admin.audit', 'admin.backup',
  ],
  directeur: [
    'dashboard.view',
    'patients.view', 'patients.view_sensitive', 'patients.view_audit', 'patients.export',
    'appointments.view',
    'admissions.view',
    'emergencies.view',
    'consultations.view',
    'operating_room.view',
    'laboratory.view',
    'imaging.view',
    'pharmacy.view',
    'blood_bank.view',
    'medical_stock.view',
    'finance.view', 'finance.validate',
    'hr.view',
    'doctors.view',
    'reports.view', 'reports.export',
    'settings.view',
  ],
  medecin: [
    'dashboard.view',
    'patients.view', 'patients.create', 'patients.edit', 'patients.view_sensitive',
    'appointments.view', 'appointments.create', 'appointments.edit', 'appointments.cancel',
    'admissions.view', 'admissions.create', 'admissions.discharge',
    'emergencies.view', 'emergencies.triage',
    'consultations.view', 'consultations.create', 'consultations.edit',
    'operating_room.view',
    'laboratory.view', 'laboratory.create',
    'imaging.view', 'imaging.request',
    'pharmacy.view',
    'blood_bank.view',
  ],
  infirmier: [
    'dashboard.view',
    'patients.view', 'patients.edit',
    'appointments.view',
    'admissions.view',
    'emergencies.view',
    'consultations.view',
    'operating_room.view',
    'laboratory.view',
    'imaging.view',
    'pharmacy.view',
    'blood_bank.view',
  ],
  reception: [
    'dashboard.view',
    'patients.view', 'patients.create', 'patients.edit', 'patients.export', 'patients.override_duplicate',
    'appointments.view', 'appointments.create', 'appointments.edit', 'appointments.cancel',
    'admissions.view', 'admissions.create',
    'emergencies.view',
    'finance.view', 'finance.create_invoice',
  ],
  laboratoire: [
    'dashboard.view',
    'patients.view',
    'laboratory.view', 'laboratory.create', 'laboratory.validate',
    'blood_bank.view', 'blood_bank.manage',
    'imaging.view',
  ],
  radiologie: [
    'dashboard.view',
    'patients.view',
    'imaging.view', 'imaging.request',
    'laboratory.view',
  ],
  pharmacie: [
    'dashboard.view',
    'patients.view',
    'pharmacy.view', 'pharmacy.dispense', 'pharmacy.manage_stock',
    'medical_stock.view', 'medical_stock.manage',
  ],
  finance: [
    'dashboard.view',
    'patients.view',
    'admissions.view',
    'finance.view', 'finance.create_invoice', 'finance.validate',
    'reports.view', 'reports.export',
  ],
  rh: [
    'dashboard.view',
    'hr.view', 'hr.manage',
    'doctors.view',
    'reports.view',
  ],
};
