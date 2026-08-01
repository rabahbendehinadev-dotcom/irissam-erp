import type { MedicalAlert } from '@/types';

export const MOCK_ALERTS: MedicalAlert[] = [
  { id: 'alt-1', severity: 'critical', category: 'lab', title: 'Résultat d\'analyse critique', description: 'Patient : Fatima Zahra – Potassium élevé', createdAt: '2024-05-14T10:15:00', isRead: false, departmentId: 'dept-4', siteId: 'site-1' },
  { id: 'alt-2', severity: 'medium', category: 'stock', title: 'Stock faible', description: 'Paracétamol 1G – 15 unités restantes', createdAt: '2024-05-14T09:45:00', isRead: false, siteId: 'site-1' },
  { id: 'alt-3', severity: 'medium', category: 'medication', title: 'Médicament proche péremption', description: 'Amoxicilline 500mg – Expire le 20/05/2024', createdAt: '2024-05-14T09:30:00', isRead: false, siteId: 'site-1' },
  { id: 'alt-4', severity: 'critical', category: 'capacity', title: 'Service de réanimation indisponible', description: 'Service Réanimation – Capacité 100%', createdAt: '2024-05-14T09:20:00', isRead: false, departmentId: 'dept-7', siteId: 'site-1' },
  { id: 'alt-5', severity: 'high', category: 'schedule', title: 'Intervention en retard', description: 'Bloc 2 – Début prévu à 09:00', createdAt: '2024-05-14T09:10:00', isRead: false, departmentId: 'dept-8', siteId: 'site-1' },
];
