import type { Site, Building, Floor, Department } from '@/types';

export const MOCK_SITES: Site[] = [
  { id: 'site-1', name: 'Site Principal', code: 'SP', address: 'Alger Centre', phone: '+213 21 00 00 00', isActive: true },
  { id: 'site-2', name: 'Annexe Sud', code: 'AS', address: 'Alger Sud', phone: '+213 21 00 00 01', isActive: true },
];

export const MOCK_BUILDINGS: Building[] = [
  { id: 'bld-1', siteId: 'site-1', name: 'Bâtiment A', code: 'A' },
  { id: 'bld-2', siteId: 'site-1', name: 'Bâtiment B', code: 'B' },
];

export const MOCK_FLOORS: Floor[] = [
  { id: 'fl-1', buildingId: 'bld-1', name: 'RDC', level: 0 },
  { id: 'fl-2', buildingId: 'bld-1', name: 'Étage 1', level: 1 },
  { id: 'fl-3', buildingId: 'bld-1', name: 'Étage 2', level: 2 },
];

export const MOCK_DEPARTMENTS: Department[] = [
  { id: 'dept-1', siteId: 'site-1', name: 'Médecine interne', code: 'MED', color: '#3B82F6', capacity: 40, isActive: true },
  { id: 'dept-2', siteId: 'site-1', name: 'Chirurgie', code: 'CHI', color: '#06B6D4', capacity: 30, isActive: true },
  { id: 'dept-3', siteId: 'site-1', name: 'Pédiatrie', code: 'PED', color: '#10B981', capacity: 25, isActive: true },
  { id: 'dept-4', siteId: 'site-1', name: 'Gynécologie', code: 'GYN', color: '#8B5CF6', capacity: 20, isActive: true },
  { id: 'dept-5', siteId: 'site-1', name: 'Cardiologie', code: 'CAR', color: '#F97316', capacity: 18, isActive: true },
  { id: 'dept-6', siteId: 'site-1', name: 'Urgences', code: 'URG', color: '#EF4444', capacity: 15, isActive: true },
  { id: 'dept-7', siteId: 'site-1', name: 'Réanimation', code: 'REA', color: '#EC4899', capacity: 24, isActive: true },
  { id: 'dept-8', siteId: 'site-1', name: 'Bloc opératoire', code: 'BLO', color: '#6366F1', capacity: 8, isActive: true },
  { id: 'dept-9', siteId: 'site-1', name: 'Laboratoire', code: 'LAB', color: '#14B8A6', capacity: 0, isActive: true },
  { id: 'dept-10', siteId: 'site-1', name: 'Imagerie', code: 'IMG', color: '#84CC16', capacity: 0, isActive: true },
];
