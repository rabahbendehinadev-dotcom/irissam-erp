/** Types partagés — Gestion des lits & infrastructure (API /infrastructure). */

export interface BedCardData {
  id: string;
  number: string;
  type: string;
  status: string;
  notes: string | null;
  roomId: string | null;
  roomNumber: string | null;
  floorId: string | null;
  floorLabel: string | null;
  buildingId: string | null;
  buildingName: string | null;
  buildingCode: string | null;
  serviceId: string | null;
  serviceName: string | null;
  patientId: string | null;
  patientName: string | null;
  admissionId: string | null;
  occupiedAt: string | null;
  updatedAt: string | null;
  admissionNumber: string | null;
  admissionDate: string | null;
  doctorName: string | null;
  admissionServiceName: string | null;
  mpiId: string | null;
  fileNumber: string | null;
  patientFullName: string | null;
}

export interface TreeRoom {
  id: string;
  number: string;
  name: string | null;
  serviceId: string | null;
  serviceName: string | null;
  active: boolean;
  bedCount: number;
}

export interface TreeFloor {
  id: string;
  name: string;
  level: number;
  active: boolean;
  rooms: TreeRoom[];
}

export interface TreeBuilding {
  id: string;
  name: string;
  code: string;
  active: boolean;
  floorsCount: number;
  floors: TreeFloor[];
}

export interface ServiceRef {
  id: string;
  name: string;
  code: string;
}

export const BED_TYPE_LABEL: Record<string, string> = {
  standard:        'Standard',
  soins_intensifs: 'Soins intensifs',
  isolement:       'Isolement',
  maternite:       'Maternité',
  pediatrie:       'Pédiatrie',
};

export const BED_STATUS_LABEL: Record<string, string> = {
  disponible:   'Disponible',
  occupe:       'Occupé',
  reserve:      'Réservé',
  nettoyage:    'Nettoyage',
  maintenance:  'Maintenance',
  hors_service: 'Hors service',
};
