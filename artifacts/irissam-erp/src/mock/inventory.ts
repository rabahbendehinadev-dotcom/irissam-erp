import type { Medication } from '@/types';

export const MOCK_MEDICATIONS_LOW_STOCK: Medication[] = [
  { id: 'med-1', name: 'Paracétamol 1G', form: 'Comprimé', dosage: '1G', unit: 'unités', currentStock: 15, minStock: 50, maxStock: 500, isLowStock: true, isExpiringSoon: false },
  { id: 'med-2', name: 'Amoxicilline 500mg', form: 'Gélule', dosage: '500mg', unit: 'unités', currentStock: 20, minStock: 60, maxStock: 400, expiresAt: '2024-05-20', isLowStock: true, isExpiringSoon: true },
  { id: 'med-3', name: 'Sérum physiologique 250ml', form: 'Flacon', dosage: '250ml', unit: 'unités', currentStock: 18, minStock: 40, maxStock: 300, isLowStock: true, isExpiringSoon: false },
];

export const MOCK_BLOOD_BANK = {
  totalUnits: 156,
  available: 100,
  urgentRequests: 8,
  expiringIn48h: 12,
};

export const MOCK_AMBULANCES = {
  total: 12,
  inService: 6,
  available: 4,
  inMaintenance: 2,
};

export const MOCK_RESUSCITATION = {
  totalBeds: 24,
  occupied: 20,
  available: 3,
  occupancyRate: 83,
};

export const MOCK_OPERATING_ROOM = {
  totalRooms: 8,
  available: 5,
  occupied: 2,
  inPreparation: 1,
};
