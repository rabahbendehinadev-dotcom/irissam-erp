import type {
  EmergencyDossier, VitalReading, GlasgowBreakdown,
  ClinicalExamination, ABCDEAssessment, EmergencyWorkflowStatus,
} from '@/types/emergencyDossier';

const base = Date.now();
const ago = (min: number) => new Date(base - min * 60_000).toISOString();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function v(minsAgo: number, data: Omit<VitalReading, 'timestamp' | 'recordedBy'>, by = 'Inf. Saïdi Meriem'): VitalReading {
  const d = { ...data };
  return {
    ...d,
    bp: d.sysBP && d.diasBP ? `${d.sysBP}/${d.diasBP}` : (d.bp ?? ''),
    timestamp: ago(minsAgo),
    recordedBy: by,
  };
}

function g(minsAgo: number, e: 1|2|3|4, vb: 1|2|3|4|5, m: 1|2|3|4|5|6, by = 'Dr. Merabet Farid'): GlasgowBreakdown {
  return { eye: e, verbal: vb, motor: m, recordedAt: ago(minsAgo), recordedBy: by };
}

function defaultExam(by: string, at: string): ClinicalExamination {
  const s = (status: 'normal' | 'anormal' | 'non_evalue' = 'non_evalue', findings = '') => ({ status, findings });
  return {
    generalState:     s('non_evalue'),
    cardiovascular:   s('non_evalue'),
    respiratory:      s('non_evalue'),
    neurological:     s('non_evalue'),
    abdominal:        s('non_evalue'),
    traumatic:        s('non_evalue'),
    cutaneous:        s('non_evalue'),
    ent:              s('non_evalue'),
    musculoskeletal:  s('non_evalue'),
    other:            s('non_evalue'),
    provisionalDiagnosis: '',
    differentialDiagnoses: [],
    severity: 'non_grave',
    icd10Placeholder: '',
    examinedAt: at,
    examinedBy: by,
  };
}

function defaultAbcde(by: string, at: string): ABCDEAssessment {
  const item = { status: 'non_evalue' as const, notes: '' };
  return {
    airway:      { ...item },
    breathing:   { ...item },
    circulation: { ...item },
    disability:  { ...item },
    exposure:    { ...item },
    recordedAt: at,
    recordedBy: by,
  };
}

// ─── Dossier: ep-01 — BENATALLAH Karim, 67M, P1 IDM ─────────────────────────

const D01: EmergencyDossier = {
  patientId: 'ep-01',
  dossierNumber: 'UR-2026-4821',
  workflowStatus: 'en_prise_en_charge',
  workflowHistory: [
    { from: 'arrive', to: 'en_triage', at: ago(27), by: 'Inf. Belkacemi Riad', byId: 'u-003' },
    { from: 'en_triage', to: 'en_prise_en_charge', at: ago(25), by: 'Dr. Merabet Farid', byId: 'u-001' },
  ],
  triageStartTime: ago(27),
  careStartTime: ago(25),
  allergies: ['Aspirine', 'Iode'],
  chronicDiseases: ['HTA depuis 12 ans', 'Diabète type 2', 'Dyslipidémie'],
  bloodThinners: true,
  pregnant: false,
  bloodType: 'A+',
  chronicTreatment: 'Metformine 1g×2, Amlodipine 5mg, Atorvastatine 40mg',
  chiefComplaint: 'Douleur thoracique irradiante membre gauche depuis 1h30',
  chiefComplaintTime: ago(95),
  chiefComplaintContext: 'Survenue au repos, irradiation bras gauche et mâchoire',
  mechanism: 'Douleur spontanée — sans effort',
  illnessHistory: 'Patient hypertendu diabétique, tabagisme 30 PA. Douleur thoracique constrictive survenue au repos il y a 1h30, irradiant dans le bras gauche et la mâchoire, associée à sueurs profuses et dyspnée.',
  symptomsDuration: '1h30',
  symptomsIntensity: '9/10',
  vitalReadings: [
    v(28, { hr: 122, sysBP: 86, diasBP: 58, bp: '86/58', spo2: 89, temp: 37.2, rr: 26, gcs: 14, painLevel: 10 }),
    v(22, { hr: 119, sysBP: 88, diasBP: 60, bp: '88/60', spo2: 91, temp: 37.2, rr: 24, gcs: 14, painLevel: 9 }),
    v(16, { hr: 115, sysBP: 92, diasBP: 62, bp: '92/62', spo2: 92, temp: 37.1, rr: 22, gcs: 14, painLevel: 8 }),
    v(10, { hr: 112, sysBP: 95, diasBP: 65, bp: '95/65', spo2: 93, temp: 37.0, rr: 21, gcs: 15, painLevel: 7, glucose: 8.4 }),
    v(4,  { hr: 108, sysBP: 98, diasBP: 66, bp: '98/66', spo2: 94, temp: 37.0, rr: 20, gcs: 15, painLevel: 6, glucose: 8.1 }),
  ],
  glasgowHistory: [g(28, 3, 4, 4), g(22, 3, 4, 5), g(14, 4, 4, 5), g(4, 4, 5, 6)],
  currentAbcde: {
    airway:      { status: 'normal', notes: 'Voies aériennes libres. O₂ lunettes nasales 4 L/min.' },
    breathing:   { status: 'anormal', notes: 'Crépitants basaux. SpO₂ en amélioration sous O₂.', rate: 20, pattern: 'dyspnée', spo2: 94 },
    circulation: { status: 'anormal', notes: 'Choc cardiogénique débutant. 2 VVP. Dopamine 5 mcg/kg/min.', hr: 108, bp: '98/66', capRefill: '3 secondes' },
    disability:  { status: 'normal', notes: 'Conscient, orienté.', gcs: 15, pupils: 'Isocores 3mm/3mm', glucose: 8.1 },
    exposure:    { status: 'anormal', notes: 'Réchauffement actif.', temp: 37.0, findings: 'Pâleur, sueurs froides, sans traumatisme.' },
    recordedAt: ago(4), recordedBy: 'Dr. Merabet Farid',
  },
  clinicalExamination: {
    generalState:    { status: 'anormal', findings: 'Patient algique, conscient, confus. Teint gris, sueurs froides.' },
    cardiovascular:  { status: 'anormal', findings: 'BDC réguliers tachycardes 108/min, pas de souffle. Pouls périphériques filants.' },
    respiratory:     { status: 'anormal', findings: 'Crépitants basaux bilatéraux. FR 20/min sous O₂.' },
    neurological:    { status: 'normal', findings: 'GCS 15/15. Pas de déficit focal.' },
    abdominal:       { status: 'normal', findings: 'Abdomen souple, indolore.' },
    traumatic:       { status: 'normal', findings: 'Sans traumatisme apparent.' },
    cutaneous:       { status: 'anormal', findings: 'Pâleur cutanéo-muqueuse, sueurs froides diffuses.' },
    ent:             { status: 'non_evalue', findings: '' },
    musculoskeletal: { status: 'non_evalue', findings: '' },
    other:           { status: 'non_evalue', findings: '' },
    provisionalDiagnosis: 'IDM antérieur étendu STEMI — choc cardiogénique débutant',
    differentialDiagnoses: ['Dissection aortique', 'Embolie pulmonaire massive', 'Péricardite aiguë'],
    severity: 'critique',
    icd10Placeholder: 'I21.0 — Infarctus transmural aigu de la paroi antérieure',
    examinedAt: ago(24),
    examinedBy: 'Dr. Merabet Farid',
  },
  labRequests: [
    { id: 'l1', test: 'Troponine I hs (x2)', category: 'Biochimie', urgency: 'STAT', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(25), status: 'validee', result: 'Troponine J0: 4.82 ng/mL (N < 0.04) ↑↑↑', isCritical: true, resultAt: ago(10) },
    { id: 'l2', test: 'BNP / NT-proBNP', category: 'Biochimie', urgency: 'STAT', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(25), status: 'validee', result: 'BNP: 1240 pg/mL ↑↑↑', isCritical: true, resultAt: ago(10) },
    { id: 'l3', test: 'NFS + Plaquettes', category: 'Hématologie', urgency: 'STAT', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(25), status: 'validee', result: 'Hb 12.1 g/dL, Plt 210 G/L, GB 12.4 G/L', resultAt: ago(8) },
    { id: 'l4', test: 'Ionogramme + Créatinine', category: 'Biochimie', urgency: 'STAT', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(25), status: 'validee', result: 'Na 138, K 4.2, Créat 112 µmol/L', resultAt: ago(8) },
    { id: 'l5', test: 'Bilan coagulation (TP/TCA/INR)', category: 'Hémostase', urgency: 'STAT', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(25), status: 'en_cours' },
    { id: 'l6', test: 'Glycémie + HbA1c', category: 'Biochimie', urgency: 'urgent', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(25), status: 'validee', result: 'Glycémie 8.4 mmol/L, HbA1c 7.8%', resultAt: ago(6) },
  ],
  imagingRequests: [
    { id: 'i1', exam: 'ECG 12 dérivations', region: 'Cœur', urgency: 'STAT', requestedBy: 'Inf. Saïdi Meriem', requestedAt: ago(27), status: 'interpretee', result: 'Sus-décalage ST V1-V4 > 3mm. Rythme sinusal 118/min.', resultAt: ago(26) },
    { id: 'i2', exam: 'Radiographie thoracique', region: 'Thorax', urgency: 'STAT', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(24), status: 'interpretee', result: 'Cardiomégalie + syndrome alvéolo-interstitiel bilateral.', resultAt: ago(18) },
    { id: 'i3', exam: 'Échographie cardiaque (ETT)', region: 'Cœur', urgency: 'urgent', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(20), status: 'planifiee' },
  ],
  prescriptions: [
    { id: 'p1', drug: 'Aspirine', dosage: '500 mg', route: 'PO', frequency: 'Dose de charge unique', prescribedBy: 'Dr. Merabet Farid', prescribedAt: ago(26), administeredAt: ago(25), administeredBy: 'Inf. Saïdi Meriem', status: 'administre' },
    { id: 'p2', drug: 'Clopidogrel (Plavix)', dosage: '600 mg', route: 'PO', frequency: 'Dose de charge unique', prescribedBy: 'Dr. Merabet Farid', prescribedAt: ago(26), administeredAt: ago(24), administeredBy: 'Inf. Saïdi Meriem', status: 'administre' },
    { id: 'p3', drug: 'HNF', dosage: '5000 UI bolus + 1000 UI/h IVSE', route: 'IV', frequency: 'Continu', prescribedBy: 'Dr. Merabet Farid', prescribedAt: ago(24), administeredAt: ago(22), administeredBy: 'Inf. Saïdi Meriem', status: 'administre' },
    { id: 'p4', drug: 'Morphine', dosage: '3 mg IV / 5 min max 15 mg', route: 'IV', frequency: 'Si douleur > 6/10', prescribedBy: 'Dr. Merabet Farid', prescribedAt: ago(24), status: 'administre', administeredAt: ago(23) },
    { id: 'p5', drug: 'Dopamine', dosage: '5 mcg/kg/min IVSE', route: 'IV', frequency: 'Continu — titration PA', prescribedBy: 'Dr. Merabet Farid', prescribedAt: ago(18), status: 'administre', administeredAt: ago(17) },
    { id: 'p6', drug: 'Metoclopramide', dosage: '10 mg', route: 'IV', frequency: 'Si nausées', prescribedBy: 'Dr. Merabet Farid', prescribedAt: ago(24), status: 'prescrit' },
  ],
  procedures: [
    { id: 'pr1', name: 'Pose VVP ×2 (G18)', category: 'perfusion', performedBy: 'Inf. Saïdi Meriem', performedAt: ago(26), notes: 'Avant-bras D+G. Prélèvements simultanés.' },
    { id: 'pr2', name: 'ECG 12 dérivations', category: 'autre', performedBy: 'Inf. Saïdi Meriem', performedAt: ago(26) },
    { id: 'pr3', name: 'Monitoring continu FC/PA/SpO₂', category: 'autre', performedBy: 'Inf. Saïdi Meriem', performedAt: ago(25), notes: 'Scope en place, alarmes actives.' },
    { id: 'pr4', name: 'Oxygénothérapie lunettes nasales 4 L/min', category: 'oxygene', performedBy: 'Inf. Saïdi Meriem', performedAt: ago(25) },
  ],
  medicalNotes: [
    { id: 'n1', content: 'Appel cardiologue interventionnel Dr. Benali — PTCA urgente. Plateau disponible dans 30 min. Transfert salle cath prévu.', type: 'medical', author: 'Dr. Merabet Farid', role: 'Médecin urgentiste senior', createdAt: ago(15), isPinned: true },
    { id: 'n2', content: 'Famille informée du diagnostic. Consentement éclairé signé pour coronarographie urgente.', type: 'medical', author: 'Dr. Merabet Farid', role: 'Médecin urgentiste senior', createdAt: ago(10) },
  ],
  nursingNotes: [
    { id: 'nn1', content: 'Patient installé en position demi-assise. Scope en place. 2 VVP posées. Prélèvements effectués. Antalgie administrée.', type: 'nursing', author: 'Inf. Saïdi Meriem', role: 'Infirmière urgences', createdAt: ago(24) },
    { id: 'nn2', content: 'Douleur réévaluée à 6/10 après morphine 3mg. Nouvelle dose 3mg. Douleur 4/10 à 15min.', type: 'nursing', author: 'Inf. Saïdi Meriem', role: 'Infirmière urgences', createdAt: ago(10), isPinned: true },
  ],
  adminNotes: [],
  transmissions: [],
  finalDecision: {
    decision: 'bloc',
    ward: 'Cardiologie interventionnelle',
    notes: 'PTCA primaire urgente. Coronarographie en salle cath.',
    decidedBy: 'Dr. Merabet Farid',
    decidedAt: ago(5),
  },
  auditLog: [
    { id: 'a1', action: 'Admission aux urgences', category: 'admin', details: 'Arrivée autonome. Triage P1 immédiat.', performedBy: 'Inf. Belkacemi Riad', role: 'Infirmier triage', timestamp: ago(28) },
    { id: 'a2', action: 'Prise en charge médicale', category: 'clinical', details: 'Dr. Merabet Farid prend en charge.', performedBy: 'Dr. Merabet Farid', role: 'Médecin urgentiste', timestamp: ago(26) },
    { id: 'a3', action: 'Prescriptions médicamenteuses', category: 'prescription', details: 'Aspirine + Clopidogrel + HNF prescrits.', performedBy: 'Dr. Merabet Farid', role: 'Médecin urgentiste', timestamp: ago(26) },
    { id: 'a4', action: 'Bilan biologique STAT', category: 'lab', details: 'Troponine, BNP, NFS, ionogramme, coagulation.', performedBy: 'Dr. Merabet Farid', role: 'Médecin urgentiste', timestamp: ago(25) },
    { id: 'a5', action: '⚠ RÉSULTAT CRITIQUE — Troponine', category: 'lab', details: 'Troponine I hs: 4.82 ng/mL — STEMI confirmé.', performedBy: 'Système laboratoire', role: 'Automate', timestamp: ago(10) },
    { id: 'a6', action: 'Décision finale enregistrée', category: 'decision', details: 'Transfert bloc — PTCA primaire.', performedBy: 'Dr. Merabet Farid', role: 'Médecin urgentiste', timestamp: ago(5) },
  ],
};

// ─── Dossier: ep-02 — MEZIANI Hassan, 28M, P1 Polytrauma ─────────────────────

const D02: EmergencyDossier = {
  patientId: 'ep-02',
  dossierNumber: 'UR-2026-2143',
  workflowStatus: 'en_soins',
  workflowHistory: [
    { from: 'arrive', to: 'en_triage', at: ago(8), by: 'Inf. Belkacemi Riad', byId: 'u-003' },
    { from: 'en_triage', to: 'en_prise_en_charge', at: ago(7), by: 'Dr. Merabet Farid', byId: 'u-001' },
    { from: 'en_prise_en_charge', to: 'en_soins', at: ago(4), by: 'Dr. Merabet Farid', byId: 'u-001' },
  ],
  triageStartTime: ago(8),
  careStartTime: ago(7),
  allergies: [],
  chronicDiseases: [],
  bloodThinners: false,
  pregnant: false,
  bloodType: 'O−',
  rareBloodType: true,
  chiefComplaint: 'Polytraumatisme — AVP moto/voiture, éjection à 70 km/h',
  chiefComplaintContext: 'Apporté par SMUR. Collision frontale.',
  mechanism: 'AVP — éjection à 70 km/h, choc cranio-facial',
  illnessHistory: 'Conducteur de moto éjecté suite à collision. Perte de connaissance initiale 2 min selon témoins. Pas d\'antécédent connu.',
  symptomsDuration: 'Immédiat',
  symptomsIntensity: '10/10',
  vitalReadings: [
    v(8, { hr: 138, sysBP: 85, diasBP: 50, bp: '85/50', spo2: 87, temp: 36.8, rr: 30, gcs: 9, painLevel: 10 }, 'Inf. Belkacemi Riad'),
    v(6, { hr: 134, sysBP: 88, diasBP: 54, bp: '88/54', spo2: 89, temp: 36.8, rr: 28, gcs: 10, painLevel: 10 }, 'Inf. Belkacemi Riad'),
    v(4, { hr: 130, sysBP: 90, diasBP: 57, bp: '90/57', spo2: 91, temp: 36.7, rr: 26, gcs: 10, painLevel: 9 }, 'Inf. Belkacemi Riad'),
    v(2, { hr: 126, sysBP: 93, diasBP: 60, bp: '93/60', spo2: 92, temp: 36.7, rr: 24, gcs: 11, painLevel: 8 }, 'Inf. Belkacemi Riad'),
  ],
  glasgowHistory: [g(8, 2, 3, 3, 'Dr. Merabet Farid'), g(4, 3, 3, 4, 'Dr. Merabet Farid')],
  currentAbcde: {
    airway:      { status: 'anormal', notes: 'Intubation oro-trachéale préparée. SFAR protocol.', actionImmédiate: 'IOT si GCS ≤ 8' },
    breathing:   { status: 'anormal', notes: 'MV diminué à gauche.', rate: 24, pattern: 'dyspnée', spo2: 92, actionImmédiate: 'Drain pleural à discuter' },
    circulation: { status: 'anormal', notes: 'Choc hémorragique grade III. 2L NaCl en cours.', hr: 126, bp: '93/60', capRefill: '4 secondes', actionImmédiate: 'Commande CG O−' },
    disability:  { status: 'anormal', notes: 'TCE modéré. Surveillance neurologique horaire.', gcs: 11, pupils: 'Isocores 4mm/4mm' },
    exposure:    { status: 'anormal', notes: 'Ceinture pelvienne posée.', temp: 36.7, findings: 'Fracture bassin, MI droit déformé, plaie occipitale.' },
    recordedAt: ago(2), recordedBy: 'Dr. Merabet Farid',
  },
  clinicalExamination: {
    generalState:    { status: 'anormal', findings: 'Patient semi-conscient, algique, instable.' },
    cardiovascular:  { status: 'anormal', findings: 'Tachycardie 126/min. Pouls filants. PA 93/60.' },
    respiratory:     { status: 'anormal', findings: 'MV diminué à gauche. FR 24/min. Dyspnée.' },
    neurological:    { status: 'anormal', findings: 'GCS 11/15. Pupilles iso réactives.' },
    abdominal:       { status: 'anormal', findings: 'Abdomen tendu. Épanchement périsplénique (FAST+).' },
    traumatic:       { status: 'anormal', findings: 'Fracture bassin confirmée RX. Déformation MI droit.' },
    cutaneous:       { status: 'anormal', findings: 'Plaie occipitale 8cm. Hématome périorbitaire gauche.' },
    ent:             { status: 'non_evalue', findings: '' },
    musculoskeletal: { status: 'anormal', findings: 'Fracture branche ilio-pubienne droite. Disjonction symphyse.' },
    other:           { status: 'non_evalue', findings: '' },
    provisionalDiagnosis: 'Polytraumatisme grave: fracture bassin, hémopéritoine probable, pneumothorax gauche, TCE modéré',
    differentialDiagnoses: ['Rupture splénique isolée', 'Hémothorax gauche massif'],
    severity: 'critique',
    icd10Placeholder: 'T00-T07 — Traumatismes multiples',
    examinedAt: ago(6),
    examinedBy: 'Dr. Merabet Farid',
  },
  labRequests: [
    { id: 'l1', test: 'Groupe sanguin + RAI', category: 'Hémostase', urgency: 'STAT', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(7), status: 'validee', result: 'Groupe O−, RAI négative. 4 CG compatibles.', resultAt: ago(3) },
    { id: 'l2', test: 'NFS + Plaquettes', category: 'Hématologie', urgency: 'STAT', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(7), status: 'validee', result: 'Hb 8.2 g/dL, Plt 145 G/L, GB 14.8 G/L', isCritical: true, resultAt: ago(3) },
    { id: 'l3', test: 'Bilan coagulation + Fibrinogène', category: 'Hémostase', urgency: 'STAT', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(7), status: 'en_cours' },
    { id: 'l4', test: 'Lactates veineux', category: 'Biochimie', urgency: 'STAT', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(7), status: 'validee', result: 'Lactates 5.8 mmol/L ↑↑', isCritical: true, resultAt: ago(2) },
    { id: 'l5', test: 'Ionogramme + Créatinine + BHC', category: 'Biochimie', urgency: 'STAT', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(7), status: 'en_cours' },
  ],
  imagingRequests: [
    { id: 'i1', exam: 'FAST écho (Trauma)', region: 'Abdomen + Péricarde', urgency: 'STAT', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(6), status: 'interpretee', result: 'Épanchement périsplénique modéré. Hémopéritoine probable.', resultAt: ago(4) },
    { id: 'i2', exam: 'Radiographie bassin', region: 'Bassin', urgency: 'STAT', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(6), status: 'interpretee', result: 'Disjonction symphyse. Fracture branche ilio-pubienne droite.', resultAt: ago(2) },
    { id: 'i3', exam: 'Scanner corps entier (Trauma Scan)', region: 'Crâne-Thorax-Abdomen-Pelvis', urgency: 'STAT', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(4), status: 'planifiee' },
  ],
  prescriptions: [
    { id: 'p1', drug: 'NaCl 0.9%', dosage: '2L bolus', route: 'IV', frequency: '2 voies larges', prescribedBy: 'Dr. Merabet Farid', prescribedAt: ago(7), administeredAt: ago(6), status: 'administre' },
    { id: 'p2', drug: 'Acide tranexamique (CRASH-2)', dosage: '1g IV/10min puis 1g/8h', route: 'IV', frequency: 'Protocole PTM', prescribedBy: 'Dr. Merabet Farid', prescribedAt: ago(6), administeredAt: ago(5), status: 'administre' },
    { id: 'p3', drug: 'Kétamine', dosage: '0.5 mg/kg IV', route: 'IV', frequency: 'Antalgie procédurale', prescribedBy: 'Dr. Merabet Farid', prescribedAt: ago(5), administeredAt: ago(4), status: 'administre' },
    { id: 'p4', drug: 'Paracétamol', dosage: '1g/6h', route: 'IV', frequency: 'Toutes les 6h', prescribedBy: 'Dr. Merabet Farid', prescribedAt: ago(5), administeredAt: ago(4), status: 'administre' },
  ],
  procedures: [
    { id: 'pr1', name: 'Pose VVP ×2 (G14)', category: 'perfusion', performedBy: 'Inf. Belkacemi Riad', performedAt: ago(7), notes: 'Calibre large pour transfusion rapide.' },
    { id: 'pr2', name: 'Ceinture pelvienne (TCCC)', category: 'immobilisation', performedBy: 'Dr. Merabet Farid', performedAt: ago(6) },
    { id: 'pr3', name: 'Monitoring invasif', category: 'autre', performedBy: 'Inf. Belkacemi Riad', performedAt: ago(6) },
    { id: 'pr4', name: 'Sondage vésical', category: 'catheter', performedBy: 'Inf. Belkacemi Riad', performedAt: ago(4), notes: 'Diurèse 5 mL/4 min — oligurie.' },
  ],
  medicalNotes: [
    { id: 'n1', content: 'Activation PTM — ratio CGR/PFC/Plaquettes 1:1:1. Banque du sang alertée.', type: 'medical', author: 'Dr. Merabet Farid', role: 'Médecin urgentiste senior', createdAt: ago(5), isPinned: true },
    { id: 'n2', content: 'Chirurgien orthopédiste Dr. Benali + chirurgien viscéral Dr. Mansour convoqués.', type: 'medical', author: 'Dr. Merabet Farid', role: 'Médecin urgentiste senior', createdAt: ago(3) },
  ],
  nursingNotes: [
    { id: 'nn1', content: 'Collier cervical posé. 2 VVP G14. Scope + SpO₂ + ETCO₂. Famille contactée.', type: 'nursing', author: 'Inf. Belkacemi Riad', role: 'Infirmier urgences', createdAt: ago(7) },
    { id: 'nn2', content: 'Diurèse 5 mL/4 min — oligurie marquée. Alarme PA basse active. Médecin prévenu.', type: 'nursing', author: 'Inf. Belkacemi Riad', role: 'Infirmier urgences', createdAt: ago(2), isPinned: true },
  ],
  adminNotes: [],
  transmissions: [],
  finalDecision: {
    decision: 'bloc',
    ward: 'Bloc opératoire — Orthopédie/Viscéral',
    notes: 'Instabilité hémodynamique. Indication chirurgicale formelle — contrôle hémorragique.',
    decidedBy: 'Dr. Merabet Farid',
    decidedAt: ago(1),
  },
  auditLog: [
    { id: 'a1', action: 'Admission SMUR', category: 'admin', details: 'Arrivée ambulance. Triage P1 déchocage.', performedBy: 'Inf. Belkacemi Riad', role: 'Infirmier triage', timestamp: ago(8) },
    { id: 'a2', action: 'Activation code trauma', category: 'clinical', details: 'Équipe pluridisciplinaire convoquée.', performedBy: 'Dr. Merabet Farid', role: 'Médecin urgentiste', timestamp: ago(7) },
    { id: 'a3', action: 'FAST écho — hémopéritoine', category: 'imaging', details: 'Épanchement périsplénique détecté.', performedBy: 'Dr. Merabet Farid', role: 'Médecin urgentiste', timestamp: ago(4) },
    { id: 'a4', action: 'Activation PTM', category: 'clinical', details: 'Protocole transfusion massive activé.', performedBy: 'Dr. Merabet Farid', role: 'Médecin urgentiste', timestamp: ago(5) },
  ],
};

// ─── Default fallback ─────────────────────────────────────────────────────────

function buildDefault(patientId: string): EmergencyDossier {
  const n = parseInt(patientId.replace('ep-', ''), 10) || 3;
  const at = ago(20);
  return {
    patientId, dossierNumber: `UR-2026-${3000 + n * 17}`,
    workflowStatus: 'attente_medecin' as EmergencyWorkflowStatus,
    workflowHistory: [
      { from: 'arrive', to: 'attente_medecin', at, by: 'Inf. triage', byId: '' },
    ],
    triageStartTime: at,
    allergies: n % 3 === 0 ? ['Pénicilline'] : [],
    chronicDiseases: n % 2 === 0 ? ['HTA'] : [],
    bloodThinners: false, pregnant: false,
    bloodType: ['A+','B+','O+','AB+','A−','O−'][n % 6],
    chiefComplaint: 'Motif de consultation à documenter.',
    illnessHistory: 'Histoire de la maladie à compléter.',
    vitalReadings: [
      v(15, { hr: 88, sysBP: 120, diasBP: 80, bp: '120/80', spo2: 97, temp: 37.0, rr: 16, painLevel: 3 }),
      v(10, { hr: 85, sysBP: 122, diasBP: 78, bp: '122/78', spo2: 97, temp: 37.1, rr: 16, painLevel: 3 }),
      v(5,  { hr: 82, sysBP: 118, diasBP: 76, bp: '118/76', spo2: 98, temp: 36.9, rr: 15, painLevel: 2 }),
    ],
    glasgowHistory: [g(15, 4, 5, 6)],
    currentAbcde: defaultAbcde('Inf. triage', at),
    clinicalExamination: defaultExam('Dr.', at),
    labRequests: [],
    imagingRequests: [],
    prescriptions: [],
    procedures: [],
    medicalNotes: [],
    nursingNotes: [],
    adminNotes: [],
    transmissions: [],
    finalDecision: { decision: null, notes: '' },
    auditLog: [
      { id: 'a1', action: 'Admission aux urgences', category: 'admin', details: 'Triage effectué.', performedBy: 'Inf. triage', role: 'Infirmier triage', timestamp: ago(20) },
    ],
  };
}

const DOSSIERS: Record<string, EmergencyDossier> = {
  'ep-01': D01,
  'ep-02': D02,
};

export function getMockDossier(patientId: string): EmergencyDossier {
  return DOSSIERS[patientId] ?? buildDefault(patientId);
}
