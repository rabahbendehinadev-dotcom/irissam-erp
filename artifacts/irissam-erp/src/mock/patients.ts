import type { Patient } from '@/types';

export const MOCK_PATIENTS: Patient[] = [
  { id: 'p-1', fileNumber: '2024-1258', firstName: 'Mohamed', lastName: 'Ali', dateOfBirth: '1979-03-15', gender: 'M', bloodType: 'B+', phone: '0555 12 34 56', departmentId: 'dept-1', siteId: 'site-1' },
  { id: 'p-2', fileNumber: '2024-1257', firstName: 'Fatima', lastName: 'Zahra', dateOfBirth: '1992-07-22', gender: 'F', bloodType: 'A+', phone: '0555 23 45 67', departmentId: 'dept-4', siteId: 'site-1' },
  { id: 'p-3', fileNumber: '2024-1256', firstName: 'Ahmed', lastName: 'Benali', dateOfBirth: '1964-11-08', gender: 'M', bloodType: 'O+', phone: '0555 34 56 78', departmentId: 'dept-5', siteId: 'site-1' },
  { id: 'p-4', fileNumber: '2024-1255', firstName: 'Amina', lastName: 'Kherfi', dateOfBirth: '1997-05-30', gender: 'F', bloodType: 'AB+', phone: '0555 45 67 89', departmentId: 'dept-3', siteId: 'site-1' },
  { id: 'p-5', fileNumber: '2024-1254', firstName: 'Yacine', lastName: 'Hamdi', dateOfBirth: '1988-09-14', gender: 'M', bloodType: 'A-', phone: '0555 56 78 90', departmentId: 'dept-2', siteId: 'site-1' },
  { id: 'p-6', fileNumber: '2024-1253', firstName: 'Rachid', lastName: 'Tlemcani', dateOfBirth: '1975-01-20', gender: 'M', bloodType: 'O-', departmentId: 'dept-1', siteId: 'site-1' },
];
