export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';
export type AlertCategory = 'lab' | 'stock' | 'medication' | 'capacity' | 'equipment' | 'schedule';

export interface MedicalAlert {
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  description: string;
  createdAt: string;
  isRead: boolean;
  siteId?: string;
  departmentId?: string;
  /** Patient ID when the alert is linked to a specific patient */
  patientId?: string;
}

export interface Medication {
  id: string;
  name: string;
  form: string;
  dosage: string;
  unit: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  expiresAt?: string;
  isLowStock: boolean;
  isExpiringSoon: boolean;
}

export interface BedOccupancy {
  departmentId: string;
  departmentName: string;
  total: number;
  occupied: number;
  available: number;
  cleaning: number;
  outOfService: number;
  occupancyRate: number;
}
