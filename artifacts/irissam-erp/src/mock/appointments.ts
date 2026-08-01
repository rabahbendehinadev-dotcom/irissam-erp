import type { Appointment } from '@/types';
import { MOCK_PATIENTS } from './patients';

export const MOCK_APPOINTMENTS: Appointment[] = [
  { id: 'apt-1', patientId: 'p-2', patient: MOCK_PATIENTS[1], doctorId: 'doc-1', doctorName: 'Dr. Dubois', departmentId: 'dept-4', departmentName: 'Gynécologie', scheduledAt: '2024-05-14T10:30:00', duration: 30, status: 'confirmed' },
  { id: 'apt-2', patientId: 'p-1', patient: MOCK_PATIENTS[0], doctorId: 'doc-2', doctorName: 'Dr. Martin', departmentId: 'dept-5', departmentName: 'Cardiologie', scheduledAt: '2024-05-14T11:00:00', duration: 45, status: 'confirmed' },
  { id: 'apt-3', patientId: 'p-4', patient: MOCK_PATIENTS[3], doctorId: 'doc-3', doctorName: 'Dr. Leroy', departmentId: 'dept-3', departmentName: 'Pédiatrie', scheduledAt: '2024-05-14T11:30:00', duration: 30, status: 'pending' },
  { id: 'apt-4', patientId: 'p-5', patient: MOCK_PATIENTS[4], doctorId: 'doc-4', doctorName: 'Dr. Moreau', departmentId: 'dept-2', departmentName: 'Chirurgie', scheduledAt: '2024-05-14T14:00:00', duration: 60, status: 'pending' },
  { id: 'apt-5', patientId: 'p-6', patient: MOCK_PATIENTS[5], doctorId: 'doc-5', doctorName: 'Dr. Bernard', departmentId: 'dept-1', departmentName: 'Médecine interne', scheduledAt: '2024-05-14T15:30:00', duration: 30, status: 'pending' },
];
