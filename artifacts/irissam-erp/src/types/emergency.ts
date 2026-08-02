// ─── Emergency Module Types ───────────────────────────────────────────────────

/** Manchester Triage System (5 levels) */
export type EmergencyPriority = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';

/** Patient journey through the emergency department */
export type EmergencyPatientStatus =
  | 'attente_triage'   // Arrived, waiting to be triaged
  | 'en_triage'        // Being triaged
  | 'attente_soins'    // Triaged, waiting for a room
  | 'en_soins'         // In treatment
  | 'observation'      // Under observation
  | 'hospitalise'      // Being admitted (transfer to ward)
  | 'sorti'            // Discharged
  | 'transfere'        // Transferred to another facility
  | 'decede';          // Deceased (mock only)

export type RoomType = 'triage' | 'soins' | 'reanimation' | 'observation' | 'attente';
export type RoomStatus = 'libre' | 'occupee' | 'partielle' | 'nettoyage';
export type AmbulanceStatus = 'disponible' | 'vers_hopital' | 'vers_patient' | 'sur_place' | 'maintenance' | 'en_route' | 'transport_patient' | 'hors_service';
export type StaffStatus = 'actif' | 'pause' | 'intervention_urgente';

export interface EmergencyVitals {
  hr?: number;         // Heart rate (bpm)
  bp?: string;         // Blood pressure "120/80"
  spo2?: number;       // SpO2 (%)
  temp?: number;       // Temperature (°C)
  rr?: number;         // Respiratory rate (/min)
  gcs?: number;        // Glasgow Coma Scale (3–15)
  painLevel?: number;  // Pain scale 0–10
  glucose?: number;    // Blood glucose (mmol/L)
}

export interface EmergencyPatient {
  id: string;
  mpiId: string;
  lastName: string;
  firstName: string;
  age: number;
  gender: 'M' | 'F';
  priority: EmergencyPriority;
  status: EmergencyPatientStatus;
  arrivalTime: string;       // ISO 8601
  chiefComplaint: string;    // Motif principal
  mechanism?: string;        // AVP, chute, agression…
  assignedDoctor?: string;
  assignedNurse?: string;
  assignedRoom?: string;
  vitals?: EmergencyVitals;
  triageNotes?: string;
  byAmbulance?: boolean;
  isMinor?: boolean;
  tags?: string[];           // 'trauma' | 'cardiac' | 'neuro' | 'pediatric' | 'psychiatric' | 'intox'
  // Extended fields served by the API (from the patients table)
  bloodType?: string;        // e.g. 'A+', 'O-'
  allergies?: string[];      // known drug / substance allergies
  /** Real DB patient UUID — present when loaded from the API, absent for mock records. */
  patientId?: string;
  /** Real DB emergency visit UUID — present when loaded from the API. */
  visitId?: string;
  /** ISO 8601 date-of-birth — used for demographics display in the dossier. */
  dateOfBirth?: string;
  /** Known chronic diseases. */
  chronicDiseases?: string[];
  /** Phone number. */
  phone?: string;
}

export interface EmergencyRoom {
  id: string;
  name: string;
  shortName: string;
  type: RoomType;
  capacity: number;
  occupied: number;
  patientIds: string[];
}

export interface Ambulance {
  id: string;
  callSign: string;
  status: AmbulanceStatus;
  crew: string;
  etaMinutes?: number;
  patientId?: string;
  patientName?: string;
  patientPriority?: EmergencyPriority;
  chiefComplaint?: string;
  location?: string;
  dispatchedAt?: string;
}

export interface EmergencyDoctor {
  id: string;
  name: string;
  role: 'chef_service' | 'senior' | 'resident';
  specialty: string;
  patientCount: number;
  maxPatients: number;
  status: StaffStatus;
  patientIds: string[];
}

export interface EmergencyNurse {
  id: string;
  name: string;
  role: 'infirmier' | 'aide_soignant';
  patientCount: number;
  maxPatients: number;
  status: StaffStatus;
}

export interface EmergencyStats {
  totalPresent: number;
  waitingTriage: number;
  inCare: number;
  critical: number;        // P1 + P2
  ambulancesEnRoute: number;
  averageWaitMin: number;
}
