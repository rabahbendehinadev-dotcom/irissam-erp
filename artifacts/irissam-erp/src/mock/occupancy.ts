/**
 * Mock occupancy seed data — OccupancyBed, OccupancyICUBed, OperatingRoom
 * All initial states are intentionally varied so the UI has interesting data to show.
 */

import type {
  OccupancyBed, OccupancyICUBed, OperatingRoom,
} from '@/types/repository';

const now = new Date().toISOString();
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const fromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

// ─── Ward beds (matching MOCK_ADM_BUILDINGS / MOCK_ADM_FLOORS / MOCK_ROOMS) ───

export const MOCK_OCCUPANCY_BEDS: OccupancyBed[] = [
  // ── Bâtiment A — Rez-de-chaussée — A001 (Cardiologie) ──────────────────
  { id: 'obed-a01-1', number: 'A001-A', roomId: 'r-a01', roomNumber: 'A001', floorId: 'a-rdc', floorLabel: 'Rez-de-chaussée', buildingId: 'bat-a', buildingName: 'Bâtiment A', buildingCode: 'A', siteId: 'site-1', type: 'standard', status: 'occupe',     patientId: 'p-001', patientName: 'BENATALLAH Karim', admissionId: 'adm-1', occupiedAt: ago(1200), updatedAt: ago(1200) },
  { id: 'obed-a01-2', number: 'A001-B', roomId: 'r-a01', roomNumber: 'A001', floorId: 'a-rdc', floorLabel: 'Rez-de-chaussée', buildingId: 'bat-a', buildingName: 'Bâtiment A', buildingCode: 'A', siteId: 'site-1', type: 'standard', status: 'disponible', updatedAt: now },
  { id: 'obed-a01-3', number: 'A001-C', roomId: 'r-a01', roomNumber: 'A001', floorId: 'a-rdc', floorLabel: 'Rez-de-chaussée', buildingId: 'bat-a', buildingName: 'Bâtiment A', buildingCode: 'A', siteId: 'site-1', type: 'standard', status: 'occupe',     patientId: 'p-002', patientName: 'OUALI Fatima',      admissionId: 'adm-2', occupiedAt: ago(480),  updatedAt: ago(480) },
  { id: 'obed-a01-4', number: 'A001-D', roomId: 'r-a01', roomNumber: 'A001', floorId: 'a-rdc', floorLabel: 'Rez-de-chaussée', buildingId: 'bat-a', buildingName: 'Bâtiment A', buildingCode: 'A', siteId: 'site-1', type: 'standard', status: 'nettoyage',   cleaningStartedAt: ago(30), updatedAt: ago(30) },

  // ── Bâtiment A — Rez-de-chaussée — A002 (Cardiologie) ──────────────────
  { id: 'obed-a02-1', number: 'A002-A', roomId: 'r-a02', roomNumber: 'A002', floorId: 'a-rdc', floorLabel: 'Rez-de-chaussée', buildingId: 'bat-a', buildingName: 'Bâtiment A', buildingCode: 'A', siteId: 'site-1', type: 'standard', status: 'disponible', updatedAt: now },
  { id: 'obed-a02-2', number: 'A002-B', roomId: 'r-a02', roomNumber: 'A002', floorId: 'a-rdc', floorLabel: 'Rez-de-chaussée', buildingId: 'bat-a', buildingName: 'Bâtiment A', buildingCode: 'A', siteId: 'site-1', type: 'standard', status: 'disponible', updatedAt: now },
  { id: 'obed-a02-3', number: 'A002-C', roomId: 'r-a02', roomNumber: 'A002', floorId: 'a-rdc', floorLabel: 'Rez-de-chaussée', buildingId: 'bat-a', buildingName: 'Bâtiment A', buildingCode: 'A', siteId: 'site-1', type: 'standard', status: 'maintenance',updatedAt: ago(120) },
  { id: 'obed-a02-4', number: 'A002-D', roomId: 'r-a02', roomNumber: 'A002', floorId: 'a-rdc', floorLabel: 'Rez-de-chaussée', buildingId: 'bat-a', buildingName: 'Bâtiment A', buildingCode: 'A', siteId: 'site-1', type: 'standard', status: 'disponible', updatedAt: now },

  // ── Bâtiment A — 1er étage — A101 (Médecine interne) ───────────────────
  { id: 'obed-a03-1', number: 'A101-A', roomId: 'r-a03', roomNumber: 'A101', floorId: 'a-1',   floorLabel: '1er étage',        buildingId: 'bat-a', buildingName: 'Bâtiment A', buildingCode: 'A', siteId: 'site-1', type: 'standard', status: 'occupe',     patientId: 'p-003', patientName: 'FERHAT Omar', admissionId: 'adm-3', occupiedAt: ago(720), updatedAt: ago(720) },
  { id: 'obed-a03-2', number: 'A101-B', roomId: 'r-a03', roomNumber: 'A101', floorId: 'a-1',   floorLabel: '1er étage',        buildingId: 'bat-a', buildingName: 'Bâtiment A', buildingCode: 'A', siteId: 'site-1', type: 'standard', status: 'disponible', updatedAt: now },
  { id: 'obed-a03-3', number: 'A101-C', roomId: 'r-a03', roomNumber: 'A101', floorId: 'a-1',   floorLabel: '1er étage',        buildingId: 'bat-a', buildingName: 'Bâtiment A', buildingCode: 'A', siteId: 'site-1', type: 'standard', status: 'disponible', updatedAt: now },
  { id: 'obed-a03-4', number: 'A101-D', roomId: 'r-a03', roomNumber: 'A101', floorId: 'a-1',   floorLabel: '1er étage',        buildingId: 'bat-a', buildingName: 'Bâtiment A', buildingCode: 'A', siteId: 'site-1', type: 'standard', status: 'disponible', updatedAt: now },

  // ── Bâtiment A — 1er étage — A102 (Soins intensifs) ────────────────────
  { id: 'obed-a04-1', number: 'A102-A', roomId: 'r-a04', roomNumber: 'A102', floorId: 'a-1',   floorLabel: '1er étage',        buildingId: 'bat-a', buildingName: 'Bâtiment A', buildingCode: 'A', siteId: 'site-1', type: 'soins_intensifs', status: 'occupe', patientId: 'p-004', patientName: 'TAIBI Rachid', admissionId: 'adm-4', occupiedAt: ago(360), updatedAt: ago(360) },
  { id: 'obed-a04-2', number: 'A102-B', roomId: 'r-a04', roomNumber: 'A102', floorId: 'a-1',   floorLabel: '1er étage',        buildingId: 'bat-a', buildingName: 'Bâtiment A', buildingCode: 'A', siteId: 'site-1', type: 'soins_intensifs', status: 'disponible', updatedAt: now },

  // ── Bâtiment A — 2ème étage — A201 (Neurologie) ────────────────────────
  { id: 'obed-a05-1', number: 'A201-A', roomId: 'r-a05', roomNumber: 'A201', floorId: 'a-2',   floorLabel: '2ème étage',       buildingId: 'bat-a', buildingName: 'Bâtiment A', buildingCode: 'A', siteId: 'site-1', type: 'standard', status: 'disponible', updatedAt: now },
  { id: 'obed-a05-2', number: 'A201-B', roomId: 'r-a05', roomNumber: 'A201', floorId: 'a-2',   floorLabel: '2ème étage',       buildingId: 'bat-a', buildingName: 'Bâtiment A', buildingCode: 'A', siteId: 'site-1', type: 'standard', status: 'occupe',     patientId: 'p-005', patientName: 'MEZIANI Hassan', admissionId: 'adm-5', occupiedAt: ago(240), updatedAt: ago(240) },
  { id: 'obed-a05-3', number: 'A201-C', roomId: 'r-a05', roomNumber: 'A201', floorId: 'a-2',   floorLabel: '2ème étage',       buildingId: 'bat-a', buildingName: 'Bâtiment A', buildingCode: 'A', siteId: 'site-1', type: 'standard', status: 'nettoyage',   cleaningStartedAt: ago(15), updatedAt: ago(15) },
  { id: 'obed-a05-4', number: 'A201-D', roomId: 'r-a05', roomNumber: 'A201', floorId: 'a-2',   floorLabel: '2ème étage',       buildingId: 'bat-a', buildingName: 'Bâtiment A', buildingCode: 'A', siteId: 'site-1', type: 'standard', status: 'disponible', updatedAt: now },

  // ── Bâtiment B — Rez-de-chaussée — B001 (Chirurgie) ────────────────────
  { id: 'obed-b01-1', number: 'B001-A', roomId: 'r-b01', roomNumber: 'B001', floorId: 'b-rdc', floorLabel: 'Rez-de-chaussée', buildingId: 'bat-b', buildingName: 'Bâtiment B', buildingCode: 'B', siteId: 'site-1', type: 'standard', status: 'occupe',     patientId: 'p-006', patientName: 'BENSALEM Khaled', admissionId: 'adm-6', occupiedAt: ago(600), updatedAt: ago(600) },
  { id: 'obed-b01-2', number: 'B001-B', roomId: 'r-b01', roomNumber: 'B001', floorId: 'b-rdc', floorLabel: 'Rez-de-chaussée', buildingId: 'bat-b', buildingName: 'Bâtiment B', buildingCode: 'B', siteId: 'site-1', type: 'standard', status: 'disponible', updatedAt: now },
  { id: 'obed-b01-3', number: 'B001-C', roomId: 'r-b01', roomNumber: 'B001', floorId: 'b-rdc', floorLabel: 'Rez-de-chaussée', buildingId: 'bat-b', buildingName: 'Bâtiment B', buildingCode: 'B', siteId: 'site-1', type: 'standard', status: 'disponible', updatedAt: now },
  { id: 'obed-b01-4', number: 'B001-D', roomId: 'r-b01', roomNumber: 'B001', floorId: 'b-rdc', floorLabel: 'Rez-de-chaussée', buildingId: 'bat-b', buildingName: 'Bâtiment B', buildingCode: 'B', siteId: 'site-1', type: 'standard', status: 'hors_service', updatedAt: ago(2880) },

  // ── Bâtiment B — 1er étage — B101 (Pneumologie) ────────────────────────
  { id: 'obed-b03-1', number: 'B101-A', roomId: 'r-b03', roomNumber: 'B101', floorId: 'b-1',   floorLabel: '1er étage',        buildingId: 'bat-b', buildingName: 'Bâtiment B', buildingCode: 'B', siteId: 'site-1', type: 'standard', status: 'disponible', updatedAt: now },
  { id: 'obed-b03-2', number: 'B101-B', roomId: 'r-b03', roomNumber: 'B101', floorId: 'b-1',   floorLabel: '1er étage',        buildingId: 'bat-b', buildingName: 'Bâtiment B', buildingCode: 'B', siteId: 'site-1', type: 'standard', status: 'occupe',     patientId: 'p-007', patientName: 'AMRANI Leila', admissionId: 'adm-7', occupiedAt: ago(1440), updatedAt: ago(1440) },
  { id: 'obed-b03-3', number: 'B101-C', roomId: 'r-b03', roomNumber: 'B101', floorId: 'b-1',   floorLabel: '1er étage',        buildingId: 'bat-b', buildingName: 'Bâtiment B', buildingCode: 'B', siteId: 'site-1', type: 'standard', status: 'reserve',    updatedAt: ago(60) },
  { id: 'obed-b03-4', number: 'B101-D', roomId: 'r-b03', roomNumber: 'B101', floorId: 'b-1',   floorLabel: '1er étage',        buildingId: 'bat-b', buildingName: 'Bâtiment B', buildingCode: 'B', siteId: 'site-1', type: 'standard', status: 'disponible', updatedAt: now },

  // ── Bâtiment C — Rez-de-chaussée — C001 (Maternité) ────────────────────
  { id: 'obed-c01-1', number: 'C001-A', roomId: 'r-c01', roomNumber: 'C001', floorId: 'c-rdc', floorLabel: 'Rez-de-chaussée', buildingId: 'bat-c', buildingName: 'Bâtiment C', buildingCode: 'C', siteId: 'site-1', type: 'maternite', status: 'occupe',     patientId: 'p-008', patientName: 'CHERIF Amira', admissionId: 'adm-8', occupiedAt: ago(300), updatedAt: ago(300) },
  { id: 'obed-c01-2', number: 'C001-B', roomId: 'r-c01', roomNumber: 'C001', floorId: 'c-rdc', floorLabel: 'Rez-de-chaussée', buildingId: 'bat-c', buildingName: 'Bâtiment C', buildingCode: 'C', siteId: 'site-1', type: 'maternite', status: 'disponible', updatedAt: now },
  { id: 'obed-c01-3', number: 'C001-C', roomId: 'r-c01', roomNumber: 'C001', floorId: 'c-rdc', floorLabel: 'Rez-de-chaussée', buildingId: 'bat-c', buildingName: 'Bâtiment C', buildingCode: 'C', siteId: 'site-1', type: 'maternite', status: 'disponible', updatedAt: now },
  { id: 'obed-c01-4', number: 'C001-D', roomId: 'r-c01', roomNumber: 'C001', floorId: 'c-rdc', floorLabel: 'Rez-de-chaussée', buildingId: 'bat-c', buildingName: 'Bâtiment C', buildingCode: 'C', siteId: 'site-1', type: 'maternite', status: 'nettoyage',   cleaningStartedAt: ago(20), updatedAt: ago(20) },

  // ── Bâtiment C — 1er étage — C101 (Pédiatrie) ──────────────────────────
  { id: 'obed-c03-1', number: 'C101-A', roomId: 'r-c03', roomNumber: 'C101', floorId: 'c-1',   floorLabel: '1er étage',        buildingId: 'bat-c', buildingName: 'Bâtiment C', buildingCode: 'C', siteId: 'site-1', type: 'pediatrie', status: 'occupe',     patientId: 'p-009', patientName: 'BOUZID Ahmed', admissionId: 'adm-9', occupiedAt: ago(180), updatedAt: ago(180) },
  { id: 'obed-c03-2', number: 'C101-B', roomId: 'r-c03', roomNumber: 'C101', floorId: 'c-1',   floorLabel: '1er étage',        buildingId: 'bat-c', buildingName: 'Bâtiment C', buildingCode: 'C', siteId: 'site-1', type: 'pediatrie', status: 'disponible', updatedAt: now },
  { id: 'obed-c03-3', number: 'C101-C', roomId: 'r-c03', roomNumber: 'C101', floorId: 'c-1',   floorLabel: '1er étage',        buildingId: 'bat-c', buildingName: 'Bâtiment C', buildingCode: 'C', siteId: 'site-1', type: 'pediatrie', status: 'disponible', updatedAt: now },
  { id: 'obed-c03-4', number: 'C101-D', roomId: 'r-c03', roomNumber: 'C101', floorId: 'c-1',   floorLabel: '1er étage',        buildingId: 'bat-c', buildingName: 'Bâtiment C', buildingCode: 'C', siteId: 'site-1', type: 'pediatrie', status: 'disponible', updatedAt: now },
];

// ─── ICU Beds ─────────────────────────────────────────────────────────────────

export const MOCK_ICU_BEDS: OccupancyICUBed[] = [
  { id: 'icu-01', number: 'REA-01', unitName: 'Réanimation médicale', siteId: 'site-1', type: 'icu', status: 'occupe',     patientId: 'ep-01', patientName: 'BENATALLAH Karim', encounterId: 'enc-ep-01', icuAdmissionId: undefined, priority: 'P1', occupiedAt: ago(90), updatedAt: ago(90) },
  { id: 'icu-02', number: 'REA-02', unitName: 'Réanimation médicale', siteId: 'site-1', type: 'icu', status: 'disponible', updatedAt: now },
  { id: 'icu-03', number: 'REA-03', unitName: 'Réanimation médicale', siteId: 'site-1', type: 'icu', status: 'disponible', updatedAt: now },
  { id: 'icu-04', number: 'REA-04', unitName: 'Réanimation chirurgicale', siteId: 'site-1', type: 'icu', status: 'occupe', patientId: 'p-rea-1', patientName: 'MEDJBER Souad', priority: 'P2', occupiedAt: ago(480), updatedAt: ago(480) },
  { id: 'icu-05', number: 'REA-05', unitName: 'Réanimation chirurgicale', siteId: 'site-1', type: 'icu', status: 'reserve', updatedAt: ago(30) },
  { id: 'icu-06', number: 'HDU-01', unitName: 'Unité de soins continus', siteId: 'site-1', type: 'hdu', status: 'disponible', updatedAt: now },
  { id: 'icu-07', number: 'HDU-02', unitName: 'Unité de soins continus', siteId: 'site-1', type: 'hdu', status: 'disponible', updatedAt: now },
  { id: 'icu-08', number: 'HDU-03', unitName: 'Unité de soins continus', siteId: 'site-1', type: 'hdu', status: 'hors_service', updatedAt: ago(1440) },
];

// ─── Operating Rooms ──────────────────────────────────────────────────────────

export const MOCK_OPERATING_ROOMS: OperatingRoom[] = [
  {
    id: 'or-01',
    name: 'Salle de bloc 1',
    shortName: 'BLOC-1',
    siteId: 'site-1',
    specialty: 'Chirurgie générale',
    status: 'en_intervention',
    currentSurgicalRequestId: 'surg-mock-1',
    slots: [
      {
        id: 'slot-or01-1',
        startAt: ago(90),
        endAt: fromNow(1),
        surgicalRequestId: 'surg-mock-1',
        patientId: 'p-006',
        patientName: 'BENSALEM Khaled',
        intervention: 'Appendicectomie',
        surgeon: 'Dr. Benali Karim',
      },
      {
        id: 'slot-or01-2',
        startAt: fromNow(2),
        endAt: fromNow(4),
        surgicalRequestId: 'surg-mock-2',
        patientId: 'p-010',
        patientName: 'HADJ ALI Mourad',
        intervention: 'Ostéosynthèse radius',
        surgeon: 'Dr. Ferhat Samir',
      },
    ],
    updatedAt: ago(90),
  },
  {
    id: 'or-02',
    name: 'Salle de bloc 2',
    shortName: 'BLOC-2',
    siteId: 'site-1',
    specialty: 'Chirurgie cardiaque',
    status: 'en_preparation',
    slots: [
      {
        id: 'slot-or02-1',
        startAt: fromNow(0.5),
        endAt: fromNow(4),
        surgicalRequestId: 'surg-mock-3',
        patientId: 'p-card-1',
        patientName: 'FERHAT Omar',
        intervention: 'Pontage aorto-coronarien',
        surgeon: 'Dr. Kadri Mouloud',
      },
    ],
    updatedAt: ago(30),
  },
  {
    id: 'or-03',
    name: 'Salle de bloc 3',
    shortName: 'BLOC-3',
    siteId: 'site-1',
    specialty: 'Chirurgie orthopédique',
    status: 'libre',
    slots: [],
    updatedAt: now,
  },
  {
    id: 'or-04',
    name: 'Salle de bloc 4',
    shortName: 'BLOC-4',
    siteId: 'site-1',
    specialty: 'ORL / Ophtalmologie',
    status: 'nettoyage',
    slots: [],
    updatedAt: ago(45),
  },
];
