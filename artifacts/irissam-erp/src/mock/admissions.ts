/**
 * Mock data — Module 2 Admissions
 * Données de démonstration : structures physiques, lits, admissions.
 */
import { MOCK_PATIENTS } from './patients';
import type { HospitalRoom, Bed, Admission, AdmissionTimelineEvent, HospitalService, Doctor } from '@/types/admission';

// Note: MOCK_BUILDINGS and MOCK_FLOORS come from ./sites (re-exported via mock/index.ts)
// Admission beds reference buildingId 'bat-a/b/c' which map to the extended building set below.

/** Extended buildings for admission module (3 buildings vs 2 in sites.ts) */
export const MOCK_ADM_BUILDINGS = [
  { id: 'bat-a', name: 'Bâtiment A', code: 'A', siteId: 'site-1' },
  { id: 'bat-b', name: 'Bâtiment B', code: 'B', siteId: 'site-1' },
  { id: 'bat-c', name: 'Bâtiment C', code: 'C', siteId: 'site-1' },
];

/** Extended floors for admission module */
export const MOCK_ADM_FLOORS = [
  { id: 'a-rdc', buildingId: 'bat-a', label: 'Rez-de-chaussée' },
  { id: 'a-1',   buildingId: 'bat-a', label: '1er étage' },
  { id: 'a-2',   buildingId: 'bat-a', label: '2ème étage' },
  { id: 'b-rdc', buildingId: 'bat-b', label: 'Rez-de-chaussée' },
  { id: 'b-1',   buildingId: 'bat-b', label: '1er étage' },
  { id: 'b-2',   buildingId: 'bat-b', label: '2ème étage' },
  { id: 'c-rdc', buildingId: 'bat-c', label: 'Rez-de-chaussée' },
  { id: 'c-1',   buildingId: 'bat-c', label: '1er étage' },
];

// ─── Chambres ─────────────────────────────────────────────────────────────────

export const MOCK_ROOMS: HospitalRoom[] = [
  // Bat A - Cardiologie / Médecine interne
  { id: 'r-a01', floorId: 'a-rdc', number: 'A001', type: 'standard',       capacity: 4, serviceId: 'svc-card' },
  { id: 'r-a02', floorId: 'a-rdc', number: 'A002', type: 'standard',       capacity: 4, serviceId: 'svc-card' },
  { id: 'r-a03', floorId: 'a-1',   number: 'A101', type: 'standard',       capacity: 4, serviceId: 'svc-med' },
  { id: 'r-a04', floorId: 'a-1',   number: 'A102', type: 'soins_intensifs',capacity: 2, serviceId: 'svc-med' },
  { id: 'r-a05', floorId: 'a-2',   number: 'A201', type: 'standard',       capacity: 4, serviceId: 'svc-neur' },
  // Bat B - Chirurgie / Pneumologie
  { id: 'r-b01', floorId: 'b-rdc', number: 'B001', type: 'standard',       capacity: 4, serviceId: 'svc-chir' },
  { id: 'r-b02', floorId: 'b-rdc', number: 'B002', type: 'standard',       capacity: 4, serviceId: 'svc-chir' },
  { id: 'r-b03', floorId: 'b-1',   number: 'B101', type: 'standard',       capacity: 4, serviceId: 'svc-pneu' },
  { id: 'r-b04', floorId: 'b-2',   number: 'B201', type: 'isolement',      capacity: 1, serviceId: 'svc-chir' },
  // Bat C - Maternité / Pédiatrie
  { id: 'r-c01', floorId: 'c-rdc', number: 'C001', type: 'maternite',      capacity: 4, serviceId: 'svc-mat' },
  { id: 'r-c02', floorId: 'c-rdc', number: 'C002', type: 'maternite',      capacity: 4, serviceId: 'svc-mat' },
  { id: 'r-c03', floorId: 'c-1',   number: 'C101', type: 'pediatrie',      capacity: 4, serviceId: 'svc-ped' },
  { id: 'r-c04', floorId: 'c-1',   number: 'C102', type: 'pediatrie',      capacity: 4, serviceId: 'svc-ped' },
];

// ─── Lits ─────────────────────────────────────────────────────────────────────

function makeBeds(
  roomId: string, roomNumber: string, floorId: string, floorLabel: string,
  buildingId: string, buildingName: string, buildingCode: string,
  count: number, statuses: Array<'libre' | 'occupe' | 'nettoyage' | 'maintenance'>,
  occupiedBy?: Array<{ patientId?: string; patientName?: string; admissionId?: string }>,
): Bed[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `bed-${roomId}-${i + 1}`,
    number: `${roomNumber}-${String.fromCharCode(65 + i)}`,
    roomId, roomNumber, floorId, floorLabel, buildingId, buildingName, buildingCode,
    status: statuses[i] ?? 'libre',
    ...(occupiedBy?.[i] ?? {}),
  }));
}

const p = (idx: number) => MOCK_PATIENTS[idx];

export const MOCK_BEDS: Bed[] = [
  // A001 - Cardiologie
  ...makeBeds('r-a01', 'A001', 'a-rdc', 'Rez-de-chaussée', 'bat-a', 'Bâtiment A', 'A', 4,
    ['occupe', 'libre', 'occupe', 'nettoyage'],
    [{ patientId: p(0).id, patientName: `${p(0).lastName} ${p(0).firstName}`, admissionId: 'adm-1' }, {}, { patientId: p(1).id, patientName: `${p(1).lastName} ${p(1).firstName}`, admissionId: 'adm-2' }]),
  // A002 - Cardiologie
  ...makeBeds('r-a02', 'A002', 'a-rdc', 'Rez-de-chaussée', 'bat-a', 'Bâtiment A', 'A', 4,
    ['libre', 'libre', 'maintenance', 'libre']),
  // A101 - Médecine interne
  ...makeBeds('r-a03', 'A101', 'a-1', '1er étage', 'bat-a', 'Bâtiment A', 'A', 4,
    ['occupe', 'libre', 'libre', 'libre'],
    [{ patientId: p(3).id, patientName: `${p(3).lastName} ${p(3).firstName}`, admissionId: 'adm-5' }]),
  // A102 - Médecine interne / Soins intensifs
  ...makeBeds('r-a04', 'A102', 'a-1', '1er étage', 'bat-a', 'Bâtiment A', 'A', 2,
    ['occupe', 'libre'],
    [{ patientId: p(5).id, patientName: `${p(5).lastName} ${p(5).firstName}`, admissionId: 'adm-6' }]),
  // A201 - Neurologie
  ...makeBeds('r-a05', 'A201', 'a-2', '2ème étage', 'bat-a', 'Bâtiment A', 'A', 4,
    ['libre', 'libre', 'libre', 'maintenance']),
  // B001 - Chirurgie
  ...makeBeds('r-b01', 'B001', 'b-rdc', 'Rez-de-chaussée', 'bat-b', 'Bâtiment B', 'B', 4,
    ['occupe', 'libre', 'libre', 'libre'],
    [{ patientId: p(6).id, patientName: `${p(6).lastName} ${p(6).firstName}`, admissionId: 'adm-7' }]),
  // B002 - Chirurgie
  ...makeBeds('r-b02', 'B002', 'b-rdc', 'Rez-de-chaussée', 'bat-b', 'Bâtiment B', 'B', 4,
    ['libre', 'nettoyage', 'libre', 'libre']),
  // B101 - Pneumologie
  ...makeBeds('r-b03', 'B101', 'b-1', '1er étage', 'bat-b', 'Bâtiment B', 'B', 4,
    ['occupe', 'libre', 'libre', 'libre'],
    [{ patientId: p(8).id, patientName: `${p(8).lastName} ${p(8).firstName}`, admissionId: 'adm-8' }]),
  // B201 - Isolement
  ...makeBeds('r-b04', 'B201', 'b-2', '2ème étage', 'bat-b', 'Bâtiment B', 'B', 1,
    ['libre']),
  // C001 - Maternité
  ...makeBeds('r-c01', 'C001', 'c-rdc', 'Rez-de-chaussée', 'bat-c', 'Bâtiment C', 'C', 4,
    ['occupe', 'occupe', 'libre', 'libre'],
    [{ patientId: p(10).id, patientName: `${p(10).lastName} ${p(10).firstName}`, admissionId: 'adm-9' },
     { patientId: p(11).id, patientName: `${p(11).lastName} ${p(11).firstName}`, admissionId: 'adm-10' }]),
  // C002 - Maternité
  ...makeBeds('r-c02', 'C002', 'c-rdc', 'Rez-de-chaussée', 'bat-c', 'Bâtiment C', 'C', 4,
    ['libre', 'libre', 'nettoyage', 'libre']),
  // C101 - Pédiatrie
  ...makeBeds('r-c03', 'C101', 'c-1', '1er étage', 'bat-c', 'Bâtiment C', 'C', 4,
    ['libre', 'libre', 'libre', 'maintenance']),
  // C102 - Pédiatrie
  ...makeBeds('r-c04', 'C102', 'c-1', '1er étage', 'bat-c', 'Bâtiment C', 'C', 4,
    ['libre', 'libre', 'libre', 'libre']),
];

// ─── Services ─────────────────────────────────────────────────────────────────

export const MOCK_SERVICES: HospitalService[] = [
  { id: 'svc-card', name: 'Cardiologie',          code: 'CARD', buildingId: 'bat-a' },
  { id: 'svc-med',  name: 'Médecine interne',     code: 'MED',  buildingId: 'bat-a' },
  { id: 'svc-neur', name: 'Neurologie',            code: 'NEUR', buildingId: 'bat-a' },
  { id: 'svc-chir', name: 'Chirurgie générale',   code: 'CHIR', buildingId: 'bat-b' },
  { id: 'svc-pneu', name: 'Pneumologie',           code: 'PNEU', buildingId: 'bat-b' },
  { id: 'svc-mat',  name: 'Maternité',             code: 'MAT',  buildingId: 'bat-c' },
  { id: 'svc-ped',  name: 'Pédiatrie',             code: 'PED',  buildingId: 'bat-c' },
  { id: 'svc-urg',  name: 'Urgences',              code: 'URG',  buildingId: 'bat-a' },
  { id: 'svc-rea',  name: 'Réanimation',           code: 'REA',  buildingId: 'bat-b' },
];

// ─── Médecins ──────────────────────────────────────────────────────────────────

export const MOCK_DOCTORS: Doctor[] = [
  { id: 'dr-1', name: 'Dr. Hamidou Karim',    speciality: 'Cardiologue',          serviceId: 'svc-card' },
  { id: 'dr-2', name: 'Dr. Meziane Farid',    speciality: 'Médecine interne',     serviceId: 'svc-med' },
  { id: 'dr-3', name: 'Dr. Tahir Mohamed',    speciality: 'Neurologue',           serviceId: 'svc-neur' },
  { id: 'dr-4', name: 'Dr. Bensalah Nadia',   speciality: 'Chirurgien',           serviceId: 'svc-chir' },
  { id: 'dr-5', name: 'Dr. Ghezali Leila',    speciality: 'Pneumologue',          serviceId: 'svc-pneu' },
  { id: 'dr-6', name: 'Dr. Kheloufi Souad',   speciality: 'Gynécologue-obstétricien', serviceId: 'svc-mat' },
  { id: 'dr-7', name: 'Dr. Belkacemi Riad',   speciality: 'Pédiatre',             serviceId: 'svc-ped' },
  { id: 'dr-8', name: 'Dr. Amrani Yacine',    speciality: 'Urgentiste',           serviceId: 'svc-urg' },
  { id: 'dr-9', name: 'Dr. Rahmani Omar',     speciality: 'Réanimateur',          serviceId: 'svc-rea' },
];

// ─── Admissions ───────────────────────────────────────────────────────────────

function pName(idx: number) { return `${MOCK_PATIENTS[idx].lastName} ${MOCK_PATIENTS[idx].firstName}`; }

export const MOCK_ADMISSIONS: Admission[] = [
  // ── ACTIVE ──
  {
    id: 'adm-1', admissionNumber: 'ADM-2026-0001',
    patientId: p(0).id, patientMpiId: p(0).mpiId, patientName: pName(0),
    type: 'hospitalisation', status: 'active', priority: 'urgent',
    serviceId: 'svc-card', serviceName: 'Cardiologie',
    doctorId: 'dr-1', doctorName: 'Dr. Hamidou Karim',
    motif: 'Douleur thoracique aiguë, suspicion SCA',
    diagnosis: 'Syndrome coronarien aigu',
    bedId: 'bed-r-a01-1', bedNumber: 'A001-A', roomNumber: 'A001', floorLabel: 'Rez-de-chaussée', buildingName: 'Bâtiment A',
    admissionDate: '2026-08-01', admissionTime: '08:30',
    expectedDischargeDate: '2026-08-05',
    siteId: 'site-1', createdAt: '2026-08-01T08:30:00Z', updatedAt: '2026-08-01T08:30:00Z', createdById: 'u-1',
  },
  {
    id: 'adm-2', admissionNumber: 'ADM-2026-0002',
    patientId: p(1).id, patientMpiId: p(1).mpiId, patientName: pName(1),
    type: 'hospitalisation', status: 'active', priority: 'normal',
    serviceId: 'svc-card', serviceName: 'Cardiologie',
    doctorId: 'dr-1', doctorName: 'Dr. Hamidou Karim',
    motif: 'Contrôle insuffisance cardiaque',
    bedId: 'bed-r-a01-3', bedNumber: 'A001-C', roomNumber: 'A001', floorLabel: 'Rez-de-chaussée', buildingName: 'Bâtiment A',
    admissionDate: '2026-07-30', admissionTime: '14:15',
    expectedDischargeDate: '2026-08-03',
    siteId: 'site-1', createdAt: '2026-07-30T14:15:00Z', updatedAt: '2026-07-30T14:15:00Z', createdById: 'u-2',
  },
  {
    id: 'adm-3', admissionNumber: 'ADM-2026-0003',
    patientId: p(2).id, patientMpiId: p(2).mpiId, patientName: pName(2),
    type: 'urgence', status: 'active', priority: 'tres_urgent',
    serviceId: 'svc-urg', serviceName: 'Urgences',
    doctorId: 'dr-8', doctorName: 'Dr. Amrani Yacine',
    motif: 'AVC ischémique, déficit moteur hémiplégie droite',
    admissionDate: '2026-08-01', admissionTime: '02:45',
    siteId: 'site-1', createdAt: '2026-08-01T02:45:00Z', updatedAt: '2026-08-01T02:45:00Z', createdById: 'u-3',
    notes: 'Transféré depuis SAU, scanner cérébral en attente',
  },
  {
    id: 'adm-4', admissionNumber: 'ADM-2026-0004',
    patientId: p(3).id, patientMpiId: p(3).mpiId, patientName: pName(3),
    type: 'hospitalisation', status: 'active', priority: 'normal',
    serviceId: 'svc-neur', serviceName: 'Neurologie',
    doctorId: 'dr-3', doctorName: 'Dr. Tahir Mohamed',
    motif: 'Céphalées chroniques réfractaires',
    admissionDate: '2026-07-28', admissionTime: '11:00',
    expectedDischargeDate: '2026-08-02',
    siteId: 'site-1', createdAt: '2026-07-28T11:00:00Z', updatedAt: '2026-07-28T11:00:00Z', createdById: 'u-1',
  },
  {
    id: 'adm-5', admissionNumber: 'ADM-2026-0005',
    patientId: p(4).id, patientMpiId: p(4).mpiId, patientName: pName(4),
    type: 'hospitalisation', status: 'active', priority: 'normal',
    serviceId: 'svc-med', serviceName: 'Médecine interne',
    doctorId: 'dr-2', doctorName: 'Dr. Meziane Farid',
    motif: 'Décompensation diabétique, hyperglycémie',
    bedId: 'bed-r-a03-1', bedNumber: 'A101-A', roomNumber: 'A101', floorLabel: '1er étage', buildingName: 'Bâtiment A',
    admissionDate: '2026-07-31', admissionTime: '16:20',
    expectedDischargeDate: '2026-08-04',
    siteId: 'site-1', createdAt: '2026-07-31T16:20:00Z', updatedAt: '2026-07-31T16:20:00Z', createdById: 'u-2',
  },
  {
    id: 'adm-6', admissionNumber: 'ADM-2026-0006',
    patientId: p(5).id, patientMpiId: p(5).mpiId, patientName: pName(5),
    type: 'hospitalisation', status: 'active', priority: 'urgent',
    serviceId: 'svc-med', serviceName: 'Médecine interne',
    doctorId: 'dr-2', doctorName: 'Dr. Meziane Farid',
    motif: 'Infection pulmonaire sévère avec sepsis',
    bedId: 'bed-r-a04-1', bedNumber: 'A102-A', roomNumber: 'A102 (SI)', floorLabel: '1er étage', buildingName: 'Bâtiment A',
    admissionDate: '2026-08-01', admissionTime: '07:10',
    siteId: 'site-1', createdAt: '2026-08-01T07:10:00Z', updatedAt: '2026-08-01T07:10:00Z', createdById: 'u-3',
  },
  {
    id: 'adm-7', admissionNumber: 'ADM-2026-0007',
    patientId: p(6).id, patientMpiId: p(6).mpiId, patientName: pName(6),
    type: 'chirurgie', status: 'active', priority: 'normal',
    serviceId: 'svc-chir', serviceName: 'Chirurgie générale',
    doctorId: 'dr-4', doctorName: 'Dr. Bensalah Nadia',
    motif: 'Appendicite aiguë — appendicectomie programmée',
    bedId: 'bed-r-b01-1', bedNumber: 'B001-A', roomNumber: 'B001', floorLabel: 'Rez-de-chaussée', buildingName: 'Bâtiment B',
    admissionDate: '2026-07-31', admissionTime: '18:45',
    expectedDischargeDate: '2026-08-03',
    siteId: 'site-1', createdAt: '2026-07-31T18:45:00Z', updatedAt: '2026-07-31T18:45:00Z', createdById: 'u-1',
  },
  {
    id: 'adm-8', admissionNumber: 'ADM-2026-0008',
    patientId: p(7).id, patientMpiId: p(7).mpiId, patientName: pName(7),
    type: 'hospitalisation', status: 'active', priority: 'normal',
    serviceId: 'svc-pneu', serviceName: 'Pneumologie',
    doctorId: 'dr-5', doctorName: 'Dr. Ghezali Leila',
    motif: 'BPCO exacerbation aiguë',
    bedId: 'bed-r-b03-1', bedNumber: 'B101-A', roomNumber: 'B101', floorLabel: '1er étage', buildingName: 'Bâtiment B',
    admissionDate: '2026-07-29', admissionTime: '09:30',
    expectedDischargeDate: '2026-08-05',
    siteId: 'site-1', createdAt: '2026-07-29T09:30:00Z', updatedAt: '2026-07-29T09:30:00Z', createdById: 'u-2',
  },
  {
    id: 'adm-9', admissionNumber: 'ADM-2026-0009',
    patientId: p(9).id, patientMpiId: p(9).mpiId, patientName: pName(9),
    type: 'maternite', status: 'active', priority: 'normal',
    serviceId: 'svc-mat', serviceName: 'Maternité',
    doctorId: 'dr-6', doctorName: 'Dr. Kheloufi Souad',
    motif: 'Accouchement — grossesse à terme 39 SA',
    bedId: 'bed-r-c01-1', bedNumber: 'C001-A', roomNumber: 'C001', floorLabel: 'Rez-de-chaussée', buildingName: 'Bâtiment C',
    admissionDate: '2026-08-01', admissionTime: '05:20',
    siteId: 'site-1', createdAt: '2026-08-01T05:20:00Z', updatedAt: '2026-08-01T05:20:00Z', createdById: 'u-3',
  },
  {
    id: 'adm-10', admissionNumber: 'ADM-2026-0010',
    patientId: p(10).id, patientMpiId: p(10).mpiId, patientName: pName(10),
    type: 'maternite', status: 'active', priority: 'urgent',
    serviceId: 'svc-mat', serviceName: 'Maternité',
    doctorId: 'dr-6', doctorName: 'Dr. Kheloufi Souad',
    motif: 'Grossesse à risque — pré-éclampsie sévère',
    bedId: 'bed-r-c01-2', bedNumber: 'C001-B', roomNumber: 'C001', floorLabel: 'Rez-de-chaussée', buildingName: 'Bâtiment C',
    admissionDate: '2026-07-30', admissionTime: '22:00',
    siteId: 'site-1', createdAt: '2026-07-30T22:00:00Z', updatedAt: '2026-07-30T22:00:00Z', createdById: 'u-1',
  },
  // ── PRÉADMISSIONS ──
  {
    id: 'adm-11', admissionNumber: 'ADM-2026-0011',
    patientId: p(11).id, patientMpiId: p(11).mpiId, patientName: pName(11),
    type: 'preadmission', status: 'preadmission', priority: 'normal',
    serviceId: 'svc-chir', serviceName: 'Chirurgie générale',
    doctorId: 'dr-4', doctorName: 'Dr. Bensalah Nadia',
    motif: 'Cholécystectomie programmée',
    preadmissionDate: '2026-08-05',
    admissionDate: '2026-08-01', admissionTime: '10:00',
    siteId: 'site-1', createdAt: '2026-08-01T10:00:00Z', updatedAt: '2026-08-01T10:00:00Z', createdById: 'u-2',
  },
  {
    id: 'adm-12', admissionNumber: 'ADM-2026-0012',
    patientId: p(12).id, patientMpiId: p(12).mpiId, patientName: pName(12),
    type: 'preadmission', status: 'preadmission', priority: 'normal',
    serviceId: 'svc-card', serviceName: 'Cardiologie',
    doctorId: 'dr-1', doctorName: 'Dr. Hamidou Karim',
    motif: 'Coronarographie diagnostique programmée',
    preadmissionDate: '2026-08-08',
    admissionDate: '2026-08-01', admissionTime: '11:30',
    siteId: 'site-1', createdAt: '2026-08-01T11:30:00Z', updatedAt: '2026-08-01T11:30:00Z', createdById: 'u-1',
  },
  {
    id: 'adm-13', admissionNumber: 'ADM-2026-0013',
    patientId: p(13).id, patientMpiId: p(13).mpiId, patientName: pName(13),
    type: 'preadmission', status: 'preadmission', priority: 'urgent',
    serviceId: 'svc-neur', serviceName: 'Neurologie',
    doctorId: 'dr-3', doctorName: 'Dr. Tahir Mohamed',
    motif: 'Épilepsie réfractaire — bilan pré-chirurgical',
    preadmissionDate: '2026-08-03',
    admissionDate: '2026-08-01', admissionTime: '09:00',
    siteId: 'site-1', createdAt: '2026-08-01T09:00:00Z', updatedAt: '2026-08-01T09:00:00Z', createdById: 'u-3',
  },
  // ── AMBULATOIRE ──
  {
    id: 'adm-14', admissionNumber: 'ADM-2026-0014',
    patientId: p(14).id, patientMpiId: p(14).mpiId, patientName: pName(14),
    type: 'ambulatoire', status: 'ambulatoire', priority: 'normal',
    serviceId: 'svc-med', serviceName: 'Médecine interne',
    doctorId: 'dr-2', doctorName: 'Dr. Meziane Farid',
    motif: 'Perfusion IV — traitement anémie ferriprive',
    admissionDate: '2026-08-01', admissionTime: '08:00',
    siteId: 'site-1', createdAt: '2026-08-01T08:00:00Z', updatedAt: '2026-08-01T08:00:00Z', createdById: 'u-2',
  },
  // ── SORTIS ──
  {
    id: 'adm-15', admissionNumber: 'ADM-2026-0015',
    patientId: p(15).id, patientMpiId: p(15).mpiId, patientName: pName(15),
    type: 'hospitalisation', status: 'discharged', priority: 'normal',
    serviceId: 'svc-med', serviceName: 'Médecine interne',
    doctorId: 'dr-2', doctorName: 'Dr. Meziane Farid',
    motif: 'Hypertension artérielle sévère',
    admissionDate: '2026-07-25', admissionTime: '14:00',
    actualDischargeDate: '2026-08-01', actualDischargeTime: '10:00',
    dischargeType: 'domicile',
    siteId: 'site-1', createdAt: '2026-07-25T14:00:00Z', updatedAt: '2026-08-01T10:00:00Z', createdById: 'u-1',
  },
  {
    id: 'adm-16', admissionNumber: 'ADM-2026-0016',
    patientId: p(16).id, patientMpiId: p(16).mpiId, patientName: pName(16),
    type: 'chirurgie', status: 'discharged', priority: 'normal',
    serviceId: 'svc-chir', serviceName: 'Chirurgie générale',
    doctorId: 'dr-4', doctorName: 'Dr. Bensalah Nadia',
    motif: 'Hernie inguinale — hernioplastie',
    admissionDate: '2026-07-28', admissionTime: '07:00',
    actualDischargeDate: '2026-08-01', actualDischargeTime: '09:00',
    dischargeType: 'domicile',
    siteId: 'site-1', createdAt: '2026-07-28T07:00:00Z', updatedAt: '2026-08-01T09:00:00Z', createdById: 'u-2',
  },
  // ── TRANSFÉRÉ ──
  {
    id: 'adm-17', admissionNumber: 'ADM-2026-0017',
    patientId: p(17).id, patientMpiId: p(17).mpiId, patientName: pName(17),
    type: 'urgence', status: 'transferred', priority: 'vital',
    serviceId: 'svc-rea', serviceName: 'Réanimation',
    doctorId: 'dr-9', doctorName: 'Dr. Rahmani Omar',
    motif: 'Arrêt cardio-respiratoire récupéré',
    admissionDate: '2026-07-31', admissionTime: '23:55',
    transferTo: 'CHU Mustapha — Réanimation',
    transferDate: '2026-08-01',
    actualDischargeDate: '2026-08-01',
    siteId: 'site-1', createdAt: '2026-07-31T23:55:00Z', updatedAt: '2026-08-01T06:00:00Z', createdById: 'u-3',
  },
];

// ─── Timelines ────────────────────────────────────────────────────────────────

export const MOCK_ADMISSION_TIMELINES: Record<string, AdmissionTimelineEvent[]> = {
  'adm-1': [
    { id: 't-a1-1', admissionId: 'adm-1', type: 'admission', description: 'Admission en cardiologie — SCA suspecté', date: '2026-08-01T08:30:00Z', userId: 'u-1', userName: 'Dr. Hamidou Karim' },
    { id: 't-a1-2', admissionId: 'adm-1', type: 'bed_change', description: 'Attribution lit A001-A', date: '2026-08-01T08:45:00Z', userId: 'u-2', userName: 'Infirmière Réception' },
    { id: 't-a1-3', admissionId: 'adm-1', type: 'exam_ordered', description: 'ECG + troponines ordonnés', date: '2026-08-01T09:00:00Z', userId: 'u-1', userName: 'Dr. Hamidou Karim' },
    { id: 't-a1-4', admissionId: 'adm-1', type: 'exam_result', description: 'Troponines élevées — NSTEMI confirmé', date: '2026-08-01T10:30:00Z', userId: 'u-1', userName: 'Dr. Hamidou Karim' },
    { id: 't-a1-5', admissionId: 'adm-1', type: 'vitals', description: 'Signes vitaux enregistrés', date: '2026-08-01T11:00:00Z', userId: 'u-2', userName: 'Inf. Réception', meta: { fc: '112', taSys: '155', taDia: '95', temp: '37.8', spo2: '94', glycemie: '1.4' } },
    { id: 't-a1-6', admissionId: 'adm-1', type: 'vitals', description: 'Signes vitaux enregistrés', date: '2026-08-01T14:00:00Z', userId: 'u-2', userName: 'Inf. Réception', meta: { fc: '88', taSys: '138', taDia: '88', temp: '37.2', spo2: '97', glycemie: '1.2' } },
  ],
  'adm-5': [
    { id: 't-a5-1', admissionId: 'adm-5', type: 'admission', description: 'Admission médecine interne — décompensation diabétique', date: '2026-07-31T16:20:00Z', userId: 'u-2', userName: 'Dr. Meziane Farid' },
    { id: 't-a5-2', admissionId: 'adm-5', type: 'bed_change', description: 'Attribution lit A101-A', date: '2026-07-31T16:35:00Z', userId: 'u-2', userName: 'Infirmière Service' },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Compte les lits disponibles */
export function countFreeBeds(): number {
  return MOCK_BEDS.filter(b => b.status === 'libre').length;
}

/** Taux d'occupation (%) */
export function getOccupancyRate(): number {
  const occupied = MOCK_BEDS.filter(b => b.status === 'occupe').length;
  return Math.round((occupied / MOCK_BEDS.length) * 100);
}

/** Admissions du jour */
export function getTodayAdmissions(): Admission[] {
  const today = '2026-08-01';
  return MOCK_ADMISSIONS.filter(a => a.admissionDate === today && a.status !== 'cancelled');
}

/** Sorties du jour */
export function getTodayDischarges(): Admission[] {
  const today = '2026-08-01';
  return MOCK_ADMISSIONS.filter(a => a.actualDischargeDate === today);
}

/** Patients hospitalisés (actifs) */
export function getHospitalizedCount(): number {
  return MOCK_ADMISSIONS.filter(a => a.status === 'active').length;
}

/** Admissions urgentes actives */
export function getUrgentCount(): number {
  return MOCK_ADMISSIONS.filter(a =>
    a.status === 'active' &&
    ['urgent', 'tres_urgent', 'vital'].includes(a.priority)
  ).length;
}
