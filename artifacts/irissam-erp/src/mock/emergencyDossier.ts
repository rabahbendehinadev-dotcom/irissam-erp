import type { EmergencyDossier, VitalReading, GlasgowBreakdown } from '@/types/emergencyDossier';

const base = Date.now();
const ago = (min: number) => new Date(base - min * 60_000).toISOString();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function vitals(
  minsAgo: number,
  v: Omit<VitalReading, 'timestamp' | 'recordedBy'>,
  by = 'Inf. Saïdi Meriem',
): VitalReading {
  return { timestamp: ago(minsAgo), recordedBy: by, ...v };
}

function gcs(minsAgo: number, e: 1|2|3|4, v: 1|2|3|4|5, m: 1|2|3|4|5|6, by = 'Dr. Merabet Farid'): GlasgowBreakdown {
  return { eye: e, verbal: v, motor: m, recordedAt: ago(minsAgo), recordedBy: by };
}

// ─── Dossier Data Map ─────────────────────────────────────────────────────────

const DOSSIERS: Record<string, EmergencyDossier> = {

  // ── ep-01: BENATALLAH Karim, 67M, P1 Cardiac ─────────────────────────────
  'ep-01': {
    patientId: 'ep-01', dossierNumber: 'UR-2026-4821',
    allergies: ['Aspirine', 'Iode'],
    chronicDiseases: ['HTA depuis 12 ans', 'Diabète type 2', 'Dyslipidémie'],
    bloodThinners: true, pregnant: false, bloodType: 'A+',
    chiefComplaint: 'Douleur thoracique irradiante membre gauche depuis 1h30',
    illnessHistory: 'Patient hypertendu diabétique se présente aux urgences pour douleur thoracique constrictive irradiant dans le bras gauche et la mâchoire, survenue au repos il y a 1h30. Associée à sueurs profuses et dyspnée. Traitements habituels : Metformine 1g x2, Amlodipine 5mg, Atorvastatine 40mg. Notion de tabagisme actif 30 paquets-années.',
    clinicalExam: 'PA: 88/60 mmHg, FC: 118 bpm, SpO₂: 91%, FR: 24/min, T°: 37.2°C. Patient algique, conscient, confus. Teint gris, sueurs froides. Bruits cardiaques réguliers, tachycardes, pas de souffle. Crépitants basaux bilatéraux. Abdomen souple. Pouls périphériques présents mais filants. ECG: sus-décalage ST en V1-V4 > 3 mm, onde Q en formation.',
    provisionalDiagnosis: 'IDM antérieur étendu STEMI — choc cardiogénique débutant. Indication coronarographie urgente.',
    vitalReadings: [
      vitals(28, { hr: 122, bp: '86/58', spo2: 89, temp: 37.2, rr: 26, gcs: 14, painLevel: 10 }),
      vitals(22, { hr: 119, bp: '88/60', spo2: 91, temp: 37.2, rr: 24, gcs: 14, painLevel: 9 }),
      vitals(16, { hr: 115, bp: '92/62', spo2: 92, temp: 37.1, rr: 22, gcs: 14, painLevel: 8 }),
      vitals(10, { hr: 112, bp: '95/65', spo2: 93, temp: 37.0, rr: 21, gcs: 15, painLevel: 7 }),
      vitals(4,  { hr: 108, bp: '98/66', spo2: 94, temp: 37.0, rr: 20, gcs: 15, painLevel: 6 }),
    ],
    glasgowHistory: [gcs(28, 3, 4, 4), gcs(22, 3, 4, 5), gcs(14, 4, 4, 5), gcs(4, 4, 5, 6)],
    currentAbcde: {
      airway: { status: 'libre', notes: 'Voies aériennes libres. Oxygène lunettes nasales 4L/min.' },
      breathing: { rate: 20, pattern: 'dyspnée', spo2: 94, notes: 'Crépitants basaux. SpO₂ en amélioration sous O₂.' },
      circulation: { hr: 108, bp: '98/66', capRefill: '3 secondes', notes: 'Choc cardiogénique. 2 VVP posées. Dopamine 5 mcg/kg/min.' },
      disability: { gcs: 15, pupils: 'Isocores réactives 3mm/3mm', glucose: 8.4, notes: 'Conscient, orienté.' },
      exposure: { temp: 37.0, findings: 'Pâleur, sueurs froides, sans traumatisme apparent.', notes: 'Réchauffement.' },
      recordedAt: ago(4), recordedBy: 'Dr. Merabet Farid',
    },
    labRequests: [
      { id: 'l1', test: 'Troponine I hs (x2)', category: 'Biochimie', urgency: 'STAT', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(25), status: 'disponible', result: 'Troponine J0: 4.82 ng/mL (N < 0.04) ↑↑↑', resultAt: ago(10) },
      { id: 'l2', test: 'BNP / NT-proBNP', category: 'Biochimie', urgency: 'STAT', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(25), status: 'disponible', result: 'BNP: 1240 pg/mL (N < 100) ↑↑↑', resultAt: ago(10) },
      { id: 'l3', test: 'NFS + Plaquettes', category: 'Hématologie', urgency: 'STAT', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(25), status: 'disponible', result: 'Hb: 12.1 g/dL, Plt: 210 G/L, GB: 12.4 G/L', resultAt: ago(8) },
      { id: 'l4', test: 'Ionogramme + Créatinine', category: 'Biochimie', urgency: 'STAT', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(25), status: 'disponible', result: 'Na: 138, K: 4.2, Créat: 112 µmol/L', resultAt: ago(8) },
      { id: 'l5', test: 'Bilan de coagulation (TP/TCA/INR)', category: 'Hémostase', urgency: 'STAT', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(25), status: 'en_cours' },
      { id: 'l6', test: 'Glycémie + HbA1c', category: 'Biochimie', urgency: 'urgent', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(25), status: 'disponible', result: 'Glycémie: 8.4 mmol/L, HbA1c: 7.8%', resultAt: ago(6) },
    ],
    imagingRequests: [
      { id: 'i1', exam: 'ECG 12 dérivations', region: 'Cœur', urgency: 'STAT', requestedBy: 'Inf. Saïdi Meriem', requestedAt: ago(27), status: 'disponible', result: 'Sus-décalage ST V1-V4 > 3mm. Bloc de branche droit incomplet. Rythme sinusal 118/min.', resultAt: ago(26) },
      { id: 'i2', exam: 'Radiographie thoracique face', region: 'Thorax', urgency: 'STAT', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(24), status: 'disponible', result: 'Cardiomégalie modérée. Syndrome alvéolo-interstitiel bilateral hilofuge.', resultAt: ago(18) },
      { id: 'i3', exam: 'Échographie cardiaque (ETT)', region: 'Cœur', urgency: 'urgent', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(20), status: 'en_cours' },
    ],
    prescriptions: [
      { id: 'p1', drug: 'Aspirine', dosage: '500 mg', route: 'PO', frequency: 'Dose de charge unique', prescribedBy: 'Dr. Merabet Farid', prescribedAt: ago(26), administeredAt: ago(25), status: 'administré' },
      { id: 'p2', drug: 'Clopidogrel (Plavix)', dosage: '600 mg', route: 'PO', frequency: 'Dose de charge unique', prescribedBy: 'Dr. Merabet Farid', prescribedAt: ago(26), administeredAt: ago(24), status: 'administré' },
      { id: 'p3', drug: 'Héparine non fractionnée', dosage: '5000 UI bolus IV', route: 'IV', frequency: 'Puis 1000 UI/h IVSE', prescribedBy: 'Dr. Merabet Farid', prescribedAt: ago(24), administeredAt: ago(22), status: 'en_cours' },
      { id: 'p4', drug: 'Morphine', dosage: '3 mg', route: 'IV', frequency: 'Toutes les 5 min si douleur > 6/10 (max 15 mg)', prescribedBy: 'Dr. Merabet Farid', prescribedAt: ago(24), administeredAt: ago(23), status: 'administré' },
      { id: 'p5', drug: 'Dopamine', dosage: '5 mcg/kg/min', route: 'IV', frequency: 'IVSE continu — titration selon PA', prescribedBy: 'Dr. Merabet Farid', prescribedAt: ago(18), status: 'en_cours' },
      { id: 'p6', drug: 'Metoclopramide (Primpéran)', dosage: '10 mg', route: 'IV', frequency: 'Si nausées', prescribedBy: 'Dr. Merabet Farid', prescribedAt: ago(24), status: 'prescrit' },
    ],
    procedures: [
      { id: 'pr1', name: 'Pose VVP x2 (G18)', category: 'Accès vasculaire', performedBy: 'Inf. Saïdi Meriem', performedAt: ago(26), notes: 'Avant-bras droit et gauche. Prélèvement bilan biologique.' },
      { id: 'pr2', name: 'ECG 12 dérivations', category: 'Cardiologie', performedBy: 'Inf. Saïdi Meriem', performedAt: ago(26) },
      { id: 'pr3', name: 'Monitoring continu FC/PA/SpO₂', category: 'Surveillance', performedBy: 'Inf. Saïdi Meriem', performedAt: ago(25), notes: 'Scope en place, alarmes actives.' },
      { id: 'pr4', name: 'O₂ lunettes nasales 4 L/min', category: 'Oxygénothérapie', performedBy: 'Inf. Saïdi Meriem', performedAt: ago(25) },
    ],
    medicalNotes: [
      { id: 'n1', content: 'Appel cardiologue interventionnel Dr. Amar Benali pour PTCA urgente. Plateau technique disponible dans 30 minutes. Transfert en salle de cathétérisme prévu.', type: 'medical', author: 'Dr. Merabet Farid', role: 'Médecin urgentiste senior', createdAt: ago(15), isPinned: true },
      { id: 'n2', content: 'Famille informée du diagnostic et du plan thérapeutique. Consentement éclairé signé pour coronarographie urgente.', type: 'medical', author: 'Dr. Merabet Farid', role: 'Médecin urgentiste senior', createdAt: ago(10) },
    ],
    nursingNotes: [
      { id: 'nn1', content: 'Patient installé en position demi-assise. Scope en place. 2 VVP posées. Prélèvements effectués. Antalgie administrée. Patiente informée des gestes.', type: 'nursing', author: 'Inf. Saïdi Meriem', role: 'Infirmière urgences', createdAt: ago(24) },
      { id: 'nn2', content: 'Douleur réévaluée à 6/10 après morphine 3mg. Nouvelle dose de 3mg administrée. Douleur à 4/10 à réévaluation 15 min plus tard.', type: 'nursing', author: 'Inf. Saïdi Meriem', role: 'Infirmière urgences', createdAt: ago(10), isPinned: true },
    ],
    finalDecision: { decision: 'bloc', ward: 'Cardiologie interventionnelle', notes: 'Transfert salle cathétérisme pour PTCA primaire. Coronarographie urgente.', decidedBy: 'Dr. Merabet Farid', decidedAt: ago(5) },
    auditLog: [
      { id: 'a1', action: 'Admission aux urgences', category: 'admin', details: 'Arrivée autonome. Triage P1 immédiat.', performedBy: 'Inf. Belkacemi Riad', role: 'Infirmier triage', timestamp: ago(28) },
      { id: 'a2', action: 'Prise en charge médicale', category: 'clinical', details: 'Dr. Merabet Farid prend en charge le patient.', performedBy: 'Dr. Merabet Farid', role: 'Médecin urgentiste', timestamp: ago(26) },
      { id: 'a3', action: 'Prescription médicamenteuse', category: 'prescription', details: 'Aspirine 500mg + Clopidogrel 600mg + HNF prescrites.', performedBy: 'Dr. Merabet Farid', role: 'Médecin urgentiste', timestamp: ago(26) },
      { id: 'a4', action: 'Bilan biologique STAT', category: 'lab', details: 'Troponine, BNP, NFS, ionogramme, coagulation demandés.', performedBy: 'Dr. Merabet Farid', role: 'Médecin urgentiste', timestamp: ago(25) },
      { id: 'a5', action: 'Résultat troponine disponible', category: 'lab', details: 'Troponine I hs: 4.82 ng/mL — confirmant STEMI.', performedBy: 'Système laboratoire', role: 'Automate', timestamp: ago(10) },
      { id: 'a6', action: 'Décision finale enregistrée', category: 'clinical', details: 'Transfert bloc pour PTCA primaire.', performedBy: 'Dr. Merabet Farid', role: 'Médecin urgentiste', timestamp: ago(5) },
    ],
  },

  // ── ep-02: MEZIANI Hassan, 28M, P1 Trauma ────────────────────────────────
  'ep-02': {
    patientId: 'ep-02', dossierNumber: 'UR-2026-2143',
    allergies: [],
    chronicDiseases: [],
    bloodThinners: false, pregnant: false, bloodType: 'O−',
    chiefComplaint: 'Polytraumatisme — AVP moto/voiture, éjection à 70 km/h',
    illnessHistory: 'Patient de 28 ans, conducteur de moto, éjecté suite à une collision avec un véhicule. Apporté par ambulance. Perte de connaissance initiale de 2 minutes selon témoins. Pas d\'antécédent connu. Ne prend aucun traitement.',
    clinicalExam: 'PA: 90/55 mmHg, FC: 132 bpm, SpO₂: 89%, T°: 36.8°C. Patient algique, semi-conscient (GCS 10). Plaie occipitale 8cm suturée en pré-hospitalier. Fracture bassin cliniquement suspectée (manœuvre de compression douloureuse). Déformation membre inférieur droit. Abdomen tendu à la palpation — hémorragie intra-abdominale suspectée. Auscultation: murmure vésiculaire diminué à gauche.',
    provisionalDiagnosis: 'Polytraumatisme grave: fracture du bassin, hémorragie intra-abdominale probable, pneumothorax gauche à exclure, TCE modéré.',
    vitalReadings: [
      vitals(8, { hr: 138, bp: '85/50', spo2: 87, temp: 36.8, rr: 30, gcs: 9, painLevel: 10 }, 'Inf. Belkacemi Riad'),
      vitals(6, { hr: 134, bp: '88/54', spo2: 89, temp: 36.8, rr: 28, gcs: 10, painLevel: 10 }, 'Inf. Belkacemi Riad'),
      vitals(4, { hr: 130, bp: '90/57', spo2: 91, temp: 36.7, rr: 26, gcs: 10, painLevel: 9 }, 'Inf. Belkacemi Riad'),
      vitals(2, { hr: 126, bp: '93/60', spo2: 92, temp: 36.7, rr: 24, gcs: 11, painLevel: 8 }, 'Inf. Belkacemi Riad'),
    ],
    glasgowHistory: [gcs(8, 2, 3, 3, 'Dr. Merabet Farid'), gcs(4, 3, 3, 4, 'Dr. Merabet Farid')],
    currentAbcde: {
      airway: { status: 'compromis', notes: 'Intubation oro-trachéale en cours. Mandrin prêt. SFAR protocol.' },
      breathing: { rate: 24, pattern: 'dyspnée', spo2: 92, notes: 'MV diminué à gauche. Drainage pleural à discuter.' },
      circulation: { hr: 126, bp: '93/60', capRefill: '4 secondes', notes: 'Choc hémorragique grade III. 2L NaCl 0.9% en cours. Commande CG O−.' },
      disability: { gcs: 11, pupils: 'Isocores 4mm/4mm, réactives', notes: 'TCE modéré — surveillance neurologique horaire.' },
      exposure: { temp: 36.7, findings: 'Fracture bassin, déformation MI droit, plaie occipitale, hématome périorbitaire gauche.', notes: 'Ceinture de contention pelvienne posée.' },
      recordedAt: ago(2), recordedBy: 'Dr. Merabet Farid',
    },
    labRequests: [
      { id: 'l1', test: 'Groupe sanguin + RAI (URGENCE)', category: 'Hémostase', urgency: 'STAT', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(7), status: 'disponible', result: 'Groupe O−, RAI négative. 4 CG compatibles commandés.', resultAt: ago(3) },
      { id: 'l2', test: 'NFS + Plaquettes', category: 'Hématologie', urgency: 'STAT', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(7), status: 'disponible', result: 'Hb: 8.2 g/dL, Plt: 145 G/L, GB: 14.8 G/L', resultAt: ago(3) },
      { id: 'l3', test: 'Bilan coagulation complet (TP/TCA/Fibrinogène)', category: 'Hémostase', urgency: 'STAT', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(7), status: 'en_cours' },
      { id: 'l4', test: 'Lactates veineux', category: 'Biochimie', urgency: 'STAT', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(7), status: 'disponible', result: 'Lactates: 5.8 mmol/L ↑↑ (N < 2)', resultAt: ago(2) },
      { id: 'l5', test: 'Ionogramme + Créatinine + BHC', category: 'Biochimie', urgency: 'STAT', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(7), status: 'en_cours' },
    ],
    imagingRequests: [
      { id: 'i1', exam: 'FAST écho (Focused Assessment with Sonography in Trauma)', region: 'Abdomen + Péricarde', urgency: 'STAT', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(6), status: 'disponible', result: 'Épanchement péri-splénique modéré. Pas d\'épanchement péricardique. Hémopéritoine probable.', resultAt: ago(4) },
      { id: 'i2', exam: 'Radiographie bassin face', region: 'Bassin', urgency: 'STAT', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(6), status: 'disponible', result: 'Disjonction symphyse pubienne. Fracture branche ilio-pubienne droite.', resultAt: ago(2) },
      { id: 'i3', exam: 'Scanner corps entier (Trauma Scan)', region: 'Crâne-Thorax-Abdomen-Pelvis', urgency: 'STAT', requestedBy: 'Dr. Merabet Farid', requestedAt: ago(4), status: 'en_attente' },
    ],
    prescriptions: [
      { id: 'p1', drug: 'NaCl 0.9%', dosage: '2L', route: 'IV', frequency: 'Bolus rapide — 2 voies larges', prescribedBy: 'Dr. Merabet Farid', prescribedAt: ago(7), administeredAt: ago(6), status: 'en_cours' },
      { id: 'p2', drug: 'Acide tranexamique (Exacyl)', dosage: '1g IV en 10 min puis 1g/8h', route: 'IV', frequency: 'Protocole CRASH-2', prescribedBy: 'Dr. Merabet Farid', prescribedAt: ago(6), administeredAt: ago(5), status: 'en_cours' },
      { id: 'p3', drug: 'Kétamine', dosage: '0.5 mg/kg IV', route: 'IV', frequency: 'Antalgie procédurale', prescribedBy: 'Dr. Merabet Farid', prescribedAt: ago(5), administeredAt: ago(4), status: 'administré' },
      { id: 'p4', drug: 'Paracétamol', dosage: '1g', route: 'IV', frequency: 'Toutes les 6h', prescribedBy: 'Dr. Merabet Farid', prescribedAt: ago(5), administeredAt: ago(4), status: 'administré' },
    ],
    procedures: [
      { id: 'pr1', name: 'Pose VVP x2 gros calibre (G14)', category: 'Accès vasculaire', performedBy: 'Inf. Belkacemi Riad', performedAt: ago(7), notes: 'FC et PA en cours. Prélèvements simultanés.' },
      { id: 'pr2', name: 'Ceinture de contention pelvienne (TCCC)', category: 'Immobilisation', performedBy: 'Dr. Merabet Farid', performedAt: ago(6) },
      { id: 'pr3', name: 'Monitoring invasif (scope)', category: 'Surveillance', performedBy: 'Inf. Belkacemi Riad', performedAt: ago(6) },
      { id: 'pr4', name: 'Sondage vésical', category: 'Surveillance', performedBy: 'Inf. Belkacemi Riad', performedAt: ago(4), notes: 'Diurèse: 5 mL en 4 min.' },
    ],
    medicalNotes: [
      { id: 'n1', content: 'Activation protocole transfusion massive (PTM). Ratio CGR/PFC/Plaquettes 1:1:1. Banque du sang alertée.', type: 'medical', author: 'Dr. Merabet Farid', role: 'Médecin urgentiste senior', createdAt: ago(5), isPinned: true },
      { id: 'n2', content: 'Chirurgien orthopédiste Dr. Benali contacté. Chirurgien viscéral Dr. Mansour en chemin.', type: 'medical', author: 'Dr. Merabet Farid', role: 'Médecin urgentiste senior', createdAt: ago(3) },
    ],
    nursingNotes: [
      { id: 'nn1', content: 'Patient installé sur brancard traumatologie. Collier cervical posé. 2 VVP G14. Scope, SpO₂, ETCO₂ en place. Famille contactée.', type: 'nursing', author: 'Inf. Belkacemi Riad', role: 'Infirmier urgences', createdAt: ago(7) },
      { id: 'nn2', content: 'Diurèse: 5 mL sur 4 min — oligurie marquée. Alarme de pression artérielle basse active. Médecin prévenu.', type: 'nursing', author: 'Inf. Belkacemi Riad', role: 'Infirmier urgences', createdAt: ago(2), isPinned: true },
    ],
    finalDecision: { decision: 'bloc', ward: 'Bloc opératoire — Orthopédie/Viscéral', notes: 'Instabilité hémodynamique persistante malgré remplissage. Indication chirurgicale formelle — contrôle hémorragique.', decidedBy: 'Dr. Merabet Farid', decidedAt: ago(1) },
    auditLog: [
      { id: 'a1', action: 'Admission SMUR', category: 'admin', details: 'Arrivée par ambulance. Triage P1 immédiat en déchocage.', performedBy: 'Inf. Belkacemi Riad', role: 'Infirmier triage', timestamp: ago(8) },
      { id: 'a2', action: 'Activation protocole trauma majeur', category: 'clinical', details: 'Code trauma activé — équipe pluridisciplinaire convoquée.', performedBy: 'Dr. Merabet Farid', role: 'Médecin urgentiste', timestamp: ago(7) },
      { id: 'a3', action: 'FAST écho réalisée', category: 'imaging', details: 'Épanchement péri-splénique détecté.', performedBy: 'Dr. Merabet Farid', role: 'Médecin urgentiste', timestamp: ago(4) },
      { id: 'a4', action: 'Activation PTM', category: 'clinical', details: 'Protocole transfusion massive activé — hémostase précaire.', performedBy: 'Dr. Merabet Farid', role: 'Médecin urgentiste', timestamp: ago(5) },
    ],
  },
};

// ─── Default fallback dossier ────────────────────────────────────────────────

function buildDefaultDossier(patientId: string): EmergencyDossier {
  const n = parseInt(patientId.replace('ep-', ''), 10) || 3;
  return {
    patientId, dossierNumber: `UR-2026-${3000 + n * 17}`,
    allergies: n % 3 === 0 ? ['Pénicilline'] : [],
    chronicDiseases: n % 2 === 0 ? ['HTA'] : [],
    bloodThinners: false, pregnant: false,
    bloodType: ['A+','B+','O+','AB+','A−','O−'][n % 6],
    chiefComplaint: 'Motif de consultation à documenter.',
    illnessHistory: 'Histoire de la maladie à compléter par le médecin.',
    clinicalExam: 'Examen clinique à documenter.',
    provisionalDiagnosis: 'Diagnostic provisoire à établir.',
    vitalReadings: [
      vitals(15, { hr: 88, bp: '120/80', spo2: 97, temp: 37.0, rr: 16, painLevel: 3 }),
      vitals(10, { hr: 85, bp: '122/78', spo2: 97, temp: 37.1, rr: 16, painLevel: 3 }),
      vitals(5,  { hr: 82, bp: '118/76', spo2: 98, temp: 36.9, rr: 15, painLevel: 2 }),
    ],
    glasgowHistory: [gcs(15, 4, 5, 6)],
    currentAbcde: {
      airway: { status: 'libre', notes: 'Voies aériennes libres.' },
      breathing: { rate: 15, pattern: 'normal', spo2: 97, notes: 'Eupnée.' },
      circulation: { hr: 82, bp: '118/76', capRefill: '< 2 sec', notes: 'Stable.' },
      disability: { gcs: 15, pupils: 'Isocores 3mm/3mm', notes: 'Conscient, orienté.' },
      exposure: { temp: 36.9, findings: 'Sans particularité.', notes: '' },
      recordedAt: ago(5), recordedBy: 'Inf. Saïdi Meriem',
    },
    labRequests: [],
    imagingRequests: [],
    prescriptions: [],
    procedures: [],
    medicalNotes: [],
    nursingNotes: [],
    finalDecision: { decision: null, notes: '' },
    auditLog: [
      { id: 'a1', action: 'Admission aux urgences', category: 'admin', details: 'Arrivée aux urgences. Triage effectué.', performedBy: 'Inf. triage', role: 'Infirmier triage', timestamp: ago(20) },
    ],
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getMockDossier(patientId: string): EmergencyDossier {
  return DOSSIERS[patientId] ?? buildDefaultDossier(patientId);
}
