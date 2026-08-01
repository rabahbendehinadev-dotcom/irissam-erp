export type PatientGender = 'M' | 'F';
export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export type AdmissionStatus = 'active' | 'discharged' | 'transferred' | 'deceased';
export type AppointmentStatus = 'confirmed' | 'pending' | 'cancelled' | 'completed' | 'no_show';

export interface Patient {
  id: string;
  fileNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: PatientGender;
  bloodType?: BloodType;
  phone?: string;
  address?: string;
  departmentId?: string;
  siteId: string;
}

export interface Admission {
  id: string;
  patientId: string;
  patient: Patient;
  departmentId: string;
  bedNumber?: string;
  admittedAt: string;
  dischargedAt?: string;
  status: AdmissionStatus;
  diagnosis?: string;
  attendingDoctorId?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patient: Patient;
  doctorId: string;
  doctorName: string;
  departmentId: string;
  departmentName: string;
  scheduledAt: string;
  duration: number;
  status: AppointmentStatus;
  notes?: string;
}
