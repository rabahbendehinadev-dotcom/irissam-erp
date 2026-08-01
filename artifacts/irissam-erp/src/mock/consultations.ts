import type { Consultation, VitalSigns, Diagnosis, PrescriptionItem, LabOrder, ImagingOrder, MedicalDocument, FollowUpPlan } from '@/types/consultation';

// ─── Reusable sub-records ───────────────────────────────────────────────────

const vitals: Record<string, VitalSigns> = {
  normal: { weight: 72, height: 175, temperature: 37.1, systolicBP: 120, diastolicBP: 78, heartRate: 72, respiratoryRate: 16, oxygenSaturation: 98, bloodGlucose: 5.4, painLevel: 0, bmi: 23.5 },
  hta:    { weight: 88, height: 168, temperature: 37.3, systolicBP: 165, diastolicBP: 98, heartRate: 88, respiratoryRate: 18, oxygenSaturation: 96, bloodGlucose: 7.8, painLevel: 3, bmi: 31.2 },
  pain:   { weight: 65, height: 162, temperature: 38.2, systolicBP: 130, diastolicBP: 82, heartRate: 95, respiratoryRate: 20, oxygenSaturation: 97, bloodGlucose: 5.1, painLevel: 7, bmi: 24.8 },
  cardio: { weight: 80, height: 172, temperature: 36.9, systolicBP: 145, diastolicBP: 92, heartRate: 102, respiratoryRate: 22, oxygenSaturation: 94, bloodGlucose: 6.2, painLevel: 5, bmi: 27.1 },
};

const dxHTA: Diagnosis[] = [
  { id: 'dx-1', kind: 'principal', status: 'confirme', icd10Code: 'I10', label: 'Hypertension artérielle essentielle', gravity: 'modere', confirmedAt: '2026-07-15T10:00:00' },
];
const dxDiabete: Diagnosis[] = [
  { id: 'dx-2', kind: 'principal', status: 'confirme', icd10Code: 'E11', label: 'Diabète de type 2', gravity: 'modere', confirmedAt: '2026-06-01T09:00:00' },
  { id: 'dx-3', kind: 'secondaire', status: 'provisoire', icd10Code: 'E78', label: 'Hyperlipidémie mixte', gravity: 'leger' },
];
const dxCardio: Diagnosis[] = [
  { id: 'dx-4', kind: 'principal', status: 'confirme', icd10Code: 'I25', label: 'Cardiopathie ischémique chronique', gravity: 'grave', confirmedAt: '2026-07-01T11:00:00' },
];
const dxVide: Diagnosis[] = [
  { id: 'dx-5', kind: 'principal', status: 'provisoire', label: 'Diagnostic en cours d\'établissement', gravity: 'leger' },
];

const rxHTA: PrescriptionItem[] = [
  { id: 'rx-1', medication: 'Amlodipine', form: 'Comprimé', dosage: '5 mg', route: 'Oral', frequency: '1×/jour', duration: '30 jours', quantity: '30', timing: 'Matin', renewable: true },
  { id: 'rx-2', medication: 'Perindopril', form: 'Comprimé', dosage: '4 mg', route: 'Oral', frequency: '1×/jour', duration: '30 jours', quantity: '30', timing: 'Matin à jeun', renewable: true },
];
const rxDouleur: PrescriptionItem[] = [
  { id: 'rx-3', medication: 'Paracétamol', form: 'Comprimé', dosage: '1000 mg', route: 'Oral', frequency: '3×/jour si douleur', duration: '7 jours', quantity: '21', timing: 'Après repas', renewable: false, notes: 'Max 3g/jour' },
];

const labNFS: LabOrder[] = [
  { id: 'lab-1', analysisType: 'NFS + CRP', priority: 'normale', laboratory: 'Laboratoire Central', clinicalReason: 'Bilan de suivi HTA', fastingRequired: false, requestedDate: '2026-08-03', status: 'demandee' },
  { id: 'lab-2', analysisType: 'Glycémie à jeun + HbA1c', priority: 'normale', laboratory: 'Laboratoire Central', clinicalReason: 'Suivi diabétique', fastingRequired: true, requestedDate: '2026-08-03', status: 'demandee' },
];
const labUrgent: LabOrder[] = [
  { id: 'lab-3', analysisType: 'Troponine I + D-Dimères', priority: 'urgente', laboratory: 'Laboratoire Urgences', clinicalReason: 'Douleur thoracique aiguë', fastingRequired: false, requestedDate: '2026-08-01', status: 'en_cours' },
];

const imgRadio: ImagingOrder[] = [
  { id: 'img-1', examType: 'Radiographie thorax', anatomicZone: 'Thorax — face', priority: 'normale', imagingService: 'Radiologie', clinicalReason: 'Dyspnée chronique', clinicalQuestion: 'Cardiomégalie? Épanchement?', withContrast: false, requestedDate: '2026-08-03', status: 'demandee' },
];

const docCR: MedicalDocument[] = [
  { id: 'doc-1', type: 'compte_rendu', date: '2026-08-01T09:00:00', doctorName: 'Dr Karim Benamara', content: 'Consultation de contrôle pour HTA. Tension artérielle équilibrée sous traitement. Maintien du traitement en cours. Prochain contrôle dans 1 mois.', signaturePlaceholder: true },
];
const docArret: MedicalDocument[] = [
  { id: 'doc-2', type: 'arret_travail', date: '2026-08-01T10:00:00', doctorName: 'Dr Amira Douahi', content: 'Arrêt de travail pour rachialgies lombaires aiguës.', duration: '5 jours', signaturePlaceholder: true },
];

const followUpStandard: FollowUpPlan = {
  recommendedTreatment: 'Maintien traitement antihypertenseur',
  medicalAdvice: 'Régime hyposodé strict, activité physique régulière 30 min/jour',
  diet: 'Régime hyposodé, réduit en graisses saturées',
  rest: 'Non requis',
  monitoring: 'Tension artérielle quotidienne au domicile',
  controlDate: '2026-09-01',
  newAppointment: true,
  returnToEmergencyIfWorse: true,
};

// ─── Main consultations dataset ──────────────────────────────────────────────

export const MOCK_CONSULTATIONS: Consultation[] = [
  {
    id: 'c-01', number: 'CON-2026-0051',
    patientId: 'p-1', patientName: 'Belkacem Mohamed', patientMpi: 'MPI-2024-000001',
    doctorId: 'd-1', doctorName: 'Dr Karim Benamara', specialty: 'Médecine interne',
    serviceId: 'svc-1', serviceName: 'Médecine interne', siteId: 'site-1', siteName: 'IRISSAM Alger',
    date: '2026-08-01', scheduledAt: '2026-08-01T08:00:00', startedAt: '2026-08-01T08:05:00', endedAt: '2026-08-01T08:32:00', duration: 27,
    type: 'controle', origin: 'rdv', reason: 'Contrôle HTA — suivi mensuel',
    status: 'terminee', syncStatus: 'synced',
    vitalSigns: vitals.hta, chiefComplaint: 'Céphalées et vertiges depuis 3 jours',
    diagnoses: dxHTA, prescriptions: rxHTA, labOrders: labNFS, imagingOrders: [],
    documents: docCR, followUp: followUpStandard,
    createdAt: '2026-08-01T08:00:00', updatedAt: '2026-08-01T08:32:00', createdById: 'd-1', completedById: 'd-1',
  },
  {
    id: 'c-02', number: 'CON-2026-0052',
    patientId: 'p-2', patientName: 'Hamraoui Fatima', patientMpi: 'MPI-2024-000002',
    doctorId: 'd-2', doctorName: 'Dr Amira Douahi', specialty: 'Gynécologie',
    serviceId: 'svc-4', serviceName: 'Gynécologie', siteId: 'site-1', siteName: 'IRISSAM Alger',
    date: '2026-08-01', scheduledAt: '2026-08-01T08:30:00', startedAt: '2026-08-01T08:35:00', endedAt: '2026-08-01T09:05:00', duration: 30,
    type: 'controle', origin: 'rdv', reason: 'Suivi diabète + bilan gynécologique',
    status: 'terminee', syncStatus: 'synced',
    vitalSigns: { ...vitals.normal, bloodGlucose: 9.2, weight: 68, height: 163, bmi: 25.6 },
    diagnoses: dxDiabete, prescriptions: rxDouleur, labOrders: labNFS, imagingOrders: [],
    documents: docArret, followUp: { ...followUpStandard, controlDate: '2026-09-15', monitoring: 'Glycémie quotidienne' },
    createdAt: '2026-08-01T08:30:00', updatedAt: '2026-08-01T09:05:00', createdById: 'd-2', completedById: 'd-2',
  },
  {
    id: 'c-03', number: 'CON-2026-0053',
    patientId: 'p-3', patientName: 'Benali Ahmed', patientMpi: 'MPI-2024-000003',
    doctorId: 'd-3', doctorName: 'Dr Mourad Settouf', specialty: 'Cardiologie',
    serviceId: 'svc-5', serviceName: 'Cardiologie', siteId: 'site-1', siteName: 'IRISSAM Alger',
    date: '2026-08-01', scheduledAt: '2026-08-01T09:00:00', startedAt: '2026-08-01T09:10:00',
    type: 'specialisee', origin: 'rdv', reason: 'Douleur thoracique et dyspnée d\'effort',
    status: 'en_cours', syncStatus: 'pending',
    vitalSigns: vitals.cardio, diagnoses: dxCardio, prescriptions: [], labOrders: labUrgent, imagingOrders: imgRadio,
    documents: [], followUp: undefined,
    createdAt: '2026-08-01T09:00:00', updatedAt: '2026-08-01T09:10:00', createdById: 'd-3',
  },
  {
    id: 'c-04', number: 'CON-2026-0054',
    patientId: 'p-4', patientName: 'Kherfi Amina', patientMpi: 'MPI-2024-000004',
    doctorId: 'd-1', doctorName: 'Dr Karim Benamara', specialty: 'Médecine générale',
    serviceId: 'svc-1', serviceName: 'Médecine interne', siteId: 'site-1', siteName: 'IRISSAM Alger',
    date: '2026-08-01', scheduledAt: '2026-08-01T09:30:00',
    type: 'sans_rdv', origin: 'sans_rdv', reason: 'Fièvre et maux de gorge depuis 2 jours',
    status: 'en_attente', syncStatus: 'synced',
    createdAt: '2026-08-01T09:20:00', updatedAt: '2026-08-01T09:20:00', createdById: 'u-4',
  },
  {
    id: 'c-05', number: 'CON-2026-0055',
    patientId: 'p-5', patientName: 'Hamdi Yacine', patientMpi: 'MPI-2024-000005',
    doctorId: 'd-2', doctorName: 'Dr Amira Douahi', specialty: 'Médecine interne',
    serviceId: 'svc-1', serviceName: 'Médecine interne', siteId: 'site-1', siteName: 'IRISSAM Alger',
    date: '2026-08-01', scheduledAt: '2026-08-01T10:00:00',
    type: 'programmee', origin: 'rdv', reason: 'Bilan de routine annuel',
    status: 'en_attente', syncStatus: 'synced',
    createdAt: '2026-08-01T07:00:00', updatedAt: '2026-08-01T07:00:00', createdById: 'u-4',
  },
  {
    id: 'c-06', number: 'CON-2026-0056',
    patientId: 'p-1', patientName: 'Belkacem Mohamed', patientMpi: 'MPI-2024-000001',
    doctorId: 'd-3', doctorName: 'Dr Mourad Settouf', specialty: 'Cardiologie',
    serviceId: 'svc-5', serviceName: 'Cardiologie', siteId: 'site-1', siteName: 'IRISSAM Alger',
    date: '2026-08-01', scheduledAt: '2026-08-01T10:30:00',
    type: 'urgences', origin: 'urgence', reason: 'Palpitations et douleur précordiale',
    status: 'en_attente', syncStatus: 'synced',
    createdAt: '2026-08-01T10:15:00', updatedAt: '2026-08-01T10:15:00', createdById: 'u-1',
  },
  {
    id: 'c-07', number: 'CON-2026-0057',
    patientId: 'p-2', patientName: 'Hamraoui Fatima', patientMpi: 'MPI-2024-000002',
    doctorId: 'd-1', doctorName: 'Dr Karim Benamara', specialty: 'Médecine interne',
    serviceId: 'svc-1', serviceName: 'Médecine interne', siteId: 'site-1', siteName: 'IRISSAM Alger',
    date: '2026-08-01', scheduledAt: '2026-08-01T11:00:00',
    type: 'programmee', origin: 'rdv', reason: 'Suivi post-hospitalisation',
    status: 'planifiee', syncStatus: 'synced',
    createdAt: '2026-07-28T14:00:00', updatedAt: '2026-07-28T14:00:00', createdById: 'u-4',
  },
  {
    id: 'c-08', number: 'CON-2026-0058',
    patientId: 'p-3', patientName: 'Benali Ahmed', patientMpi: 'MPI-2024-000003',
    doctorId: 'd-4', doctorName: 'Dr Sofiane Boudali', specialty: 'Chirurgie',
    serviceId: 'svc-2', serviceName: 'Chirurgie', siteId: 'site-1', siteName: 'IRISSAM Alger',
    date: '2026-08-01', scheduledAt: '2026-08-01T11:30:00',
    type: 'controle', origin: 'rdv', reason: 'Contrôle post-opératoire',
    status: 'planifiee', syncStatus: 'synced',
    createdAt: '2026-07-25T10:00:00', updatedAt: '2026-07-25T10:00:00', createdById: 'u-4',
  },
  {
    id: 'c-09', number: 'CON-2026-0049',
    patientId: 'p-4', patientName: 'Kherfi Amina', patientMpi: 'MPI-2024-000004',
    doctorId: 'd-5', doctorName: 'Dr Nadia Ferhat', specialty: 'Pédiatrie',
    serviceId: 'svc-3', serviceName: 'Pédiatrie', siteId: 'site-1', siteName: 'IRISSAM Alger',
    date: '2026-07-31', scheduledAt: '2026-07-31T15:00:00', startedAt: '2026-07-31T15:05:00', endedAt: '2026-07-31T15:35:00', duration: 30,
    type: 'programmee', origin: 'rdv', reason: 'Consultation pédiatrique de routine',
    status: 'terminee', syncStatus: 'synced',
    vitalSigns: vitals.normal, diagnoses: dxVide, prescriptions: [], labOrders: [], imagingOrders: [], documents: [],
    followUp: { ...followUpStandard, controlDate: '2026-10-01', monitoring: 'Surveillance croissance' },
    createdAt: '2026-07-31T15:00:00', updatedAt: '2026-07-31T15:35:00', createdById: 'd-5', completedById: 'd-5',
  },
  {
    id: 'c-10', number: 'CON-2026-0048',
    patientId: 'p-5', patientName: 'Hamdi Yacine', patientMpi: 'MPI-2024-000005',
    doctorId: 'd-1', doctorName: 'Dr Karim Benamara', specialty: 'Médecine interne',
    serviceId: 'svc-1', serviceName: 'Médecine interne', siteId: 'site-1', siteName: 'IRISSAM Alger',
    date: '2026-07-30', scheduledAt: '2026-07-30T09:00:00',
    type: 'sans_rdv', origin: 'sans_rdv', reason: 'Douleurs abdominales aiguës',
    status: 'annulee', syncStatus: 'synced',
    createdAt: '2026-07-30T08:50:00', updatedAt: '2026-07-30T09:00:00', createdById: 'u-4',
  },
  {
    id: 'c-11', number: 'CON-2026-0047',
    patientId: 'p-1', patientName: 'Belkacem Mohamed', patientMpi: 'MPI-2024-000001',
    doctorId: 'd-3', doctorName: 'Dr Mourad Settouf', specialty: 'Cardiologie',
    serviceId: 'svc-5', serviceName: 'Cardiologie', siteId: 'site-1', siteName: 'IRISSAM Alger',
    date: '2026-07-29', scheduledAt: '2026-07-29T14:00:00',
    type: 'programmee', origin: 'rdv', reason: 'Consultation cardio programmée',
    status: 'patient_absent', syncStatus: 'synced',
    createdAt: '2026-07-20T10:00:00', updatedAt: '2026-07-29T14:30:00', createdById: 'u-4',
  },
  {
    id: 'c-12', number: 'CON-2026-0046',
    patientId: 'p-3', patientName: 'Benali Ahmed', patientMpi: 'MPI-2024-000003',
    doctorId: 'd-1', doctorName: 'Dr Karim Benamara', specialty: 'Médecine interne',
    serviceId: 'svc-1', serviceName: 'Médecine interne', siteId: 'site-1', siteName: 'IRISSAM Alger',
    date: '2026-07-28', scheduledAt: '2026-07-28T08:30:00', startedAt: '2026-07-28T08:35:00', endedAt: '2026-07-28T09:20:00', duration: 45,
    type: 'hospitalisation', origin: 'admission', admissionId: 'adm-3',
    reason: 'Consultation liée à l\'hospitalisation — IRC stade 3',
    status: 'terminee', syncStatus: 'synced',
    vitalSigns: vitals.pain, diagnoses: dxHTA, prescriptions: rxHTA, labOrders: labNFS, imagingOrders: imgRadio,
    documents: docCR, followUp: followUpStandard,
    createdAt: '2026-07-28T08:30:00', updatedAt: '2026-07-28T09:20:00', createdById: 'd-1', completedById: 'd-1',
  },
];

// ─── Session Registry (for consultations created during this browser session) ─

export const SESSION_CONSULTATIONS: Consultation[] = [];

export function addSessionConsultation(c: Consultation): void {
  SESSION_CONSULTATIONS.unshift(c);
}

export function getAllConsultations(): Consultation[] {
  return [...SESSION_CONSULTATIONS, ...MOCK_CONSULTATIONS];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getTodayConsultations(): Consultation[] {
  const today = '2026-08-01';
  return MOCK_CONSULTATIONS.filter(c => c.date === today);
}

export function getConsultationsByPatient(patientId: string): Consultation[] {
  return MOCK_CONSULTATIONS.filter(c => c.patientId === patientId);
}

export function getConsultationStats() {
  const today = getTodayConsultations();
  return {
    todayTotal:   today.length,
    enAttente:    today.filter(c => c.status === 'en_attente').length,
    enCours:      today.filter(c => c.status === 'en_cours').length,
    terminees:    today.filter(c => c.status === 'terminee').length,
    annulees:     today.filter(c => c.status === 'annulee' || c.status === 'patient_absent').length,
    sansRdv:      today.filter(c => c.origin === 'sans_rdv').length,
    avgDuration:  Math.round(today.filter(c => c.duration).reduce((s, c) => s + (c.duration ?? 0), 0) / Math.max(today.filter(c => c.duration).length, 1)),
    aRevoir:      2, // mock
  };
}
