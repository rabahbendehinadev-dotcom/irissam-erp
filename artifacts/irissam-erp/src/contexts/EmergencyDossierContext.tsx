import {
  createContext, useContext, useState, useEffect, useCallback, useRef,
} from 'react';
import { useAuth } from '@/store/AuthContext';
import type { EmergencyPatient } from '@/types/emergency';
import { useToast } from '@/hooks/use-toast';
import { getMockDossier } from '@/mock/emergencyDossier';
import { apiClient } from '@/services/api/client';
import {
  validateLabOrder, validateImagingOrder,
  validateHospitalization, validateBloc, validateICU,
  validateTransfer, validateCloseFile,
} from '@/engine/validationEngine';
import type {
  EmergencyDossier, EmergencyWorkflowStatus, WorkflowTransition,
  VitalReading, GlasgowBreakdown, ABCDEAssessment, LabRequest, ImagingRequest,
  Prescription, Procedure, ClinicalNote, FinalDecision, AuditEntry,
  ObservationEntry, ClinicalExamination,
} from '@/types/emergencyDossier';
// EmergencyPatient imported above (line 5)

// ─── Context Shape ────────────────────────────────────────────────────────────

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** Status of the real DB encounter created on mount. */
export type EncounterStatus = 'loading' | 'ready' | 'error';

interface EmergencyDossierContextType {
  dossier: EmergencyDossier;
  patient: EmergencyPatient | null;
  /** The DB visit UUID — available after loading from /emergencies/visits/by-patient/:id */
  visitId: string | undefined;
  saveState: SaveState;
  lastSaved: string | null;
  /** Whether the real PostgreSQL encounter is available. Clinical actions are blocked until 'ready'. */
  encounterStatus: EncounterStatus;
  retryEncounter: () => void;
  // Workflow
  transitionStatus: (to: EmergencyWorkflowStatus, notes?: string) => void;
  startCare: () => void;
  suspendCare: () => void;
  closeFile: () => void;
  // Triage priority change — persists to DB via PATCH /emergencies/visits/:visitId
  updateTriagePriority: (priority: EmergencyPatient['priority']) => Promise<void>;
  // Clinical text
  updateClinicalText: (
    field: 'chiefComplaint' | 'illnessHistory' | 'clinicalExamination',
    value: string,
  ) => void;
  updateFullExam: (exam: ClinicalExamination) => void;
  // Vitals
  addVitalReading: (reading: Omit<VitalReading, 'timestamp'>) => void;
  addGlasgowReading: (breakdown: Omit<GlasgowBreakdown, 'recordedAt'>) => void;
  updateAbcde: (assessment: ABCDEAssessment) => void;
  // Orders — blocked until encounterStatus === 'ready'
  addLabRequest: (req: Omit<LabRequest, 'id' | 'requestedAt' | 'requestedBy'>) => void;
  updateLabStatus: (id: string, status: LabRequest['status'], result?: string, isCritical?: boolean) => void;
  addImagingRequest: (req: Omit<ImagingRequest, 'id' | 'requestedAt' | 'requestedBy'>) => void;
  updateImagingStatus: (id: string, status: ImagingRequest['status'], result?: string) => void;
  // Treatment — blocked until encounterStatus === 'ready'
  addPrescription: (rx: Omit<Prescription, 'id' | 'prescribedAt' | 'prescribedBy' | 'status'>) => void;
  updatePrescriptionStatus: (id: string, status: Prescription['status'], adminAt?: string, by?: string) => void;
  addProcedure: (proc: Omit<Procedure, 'id' | 'performedAt' | 'performedBy'>) => void;
  // Notes
  addNote: (note: Omit<ClinicalNote, 'id' | 'createdAt' | 'author' | 'authorId'>) => void;
  pinNote: (id: string) => void;
  editNote: (id: string, newContent: string) => void;
  // Observation
  startObservation: (obs: Omit<ObservationEntry, 'readings' | 'treatments' | 'evolution' | 'alerts'>) => void;
  addObservationReading: (reading: Omit<VitalReading, 'timestamp'>) => void;
  // Decision
  updateDecision: (updates: Partial<FinalDecision>) => void;
  confirmDecision: () => void;
  // Manual save
  triggerSave: () => void;
  // Audit
  appendAudit: (entry: Omit<AuditEntry, 'id' | 'timestamp' | 'performedBy' | 'performedById' | 'role'>) => void;
}

const EmergencyDossierContext = createContext<EmergencyDossierContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function EmergencyDossierProvider({
  patientId,
  visitId: propVisitId,
  patient: propPatient,
  children,
}: {
  patientId: string;
  /** Real DB emergency visit UUID — if provided, triage/vitals APIs use it. */
  visitId?: string;
  /** Pass the EmergencyPatient from the waiting-room list so DossierHeader can show real patient info. */
  patient?: EmergencyPatient | null;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dossier, setDossier] = useState<EmergencyDossier>(() => getMockDossier(patientId));
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  // Real encounter UUID from PostgreSQL — NO fallback allowed
  const [realEncounterId, setRealEncounterId] = useState<string | null>(null);
  const [encounterStatus, setEncounterStatus] = useState<EncounterStatus>('loading');
  // Incrementing this key retries the encounter creation effect
  const [retryKey, setRetryKey] = useState(0);
  const retryEncounter = useCallback(() => {
    setEncounterStatus('loading');
    setRetryKey(k => k + 1);
  }, []);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Patient object — provided by the caller (EmergencyPatientDetail) via prop
  const patient = propPatient ?? null;

  // ── Auto-save on every dossier change (2-second debounce) ─────────────────
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaveState('saving');
      // Simulate API call
      setTimeout(() => {
        setSaveState('saved');
        setLastSaved(new Date().toISOString());
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSaveState('idle'), 3000);
      }, 600);
    }, 2000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [dossier]);

  // ── Create a real DB encounter on mount — NO silent fallback ─────────────
  // If this fails, encounterStatus → 'error' and all clinical actions are blocked.
  // The user must click "Réessayer" (retryEncounter) to try again.
  useEffect(() => {
    let cancelled = false;
    setEncounterStatus('loading');
    async function initEncounter() {
      try {
        const enc = await apiClient.post<{ id: string; encounterNumber: string }>(
          '/encounters',
          {
            patientId,
            type: 'urgences',
            sourceModule: 'urgences',
            chiefComplaint: dossier.chiefComplaint || 'Urgence',
          },
        );
        if (!cancelled) {
          setRealEncounterId(enc.id);
          setEncounterStatus('ready');
          setDossier(d => ({ ...d, encounterId: enc.id, encounterNumber: enc.encounterNumber }));
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[EmergencyDossier] encounter creation failed — clinical actions BLOCKED:', err);
          setEncounterStatus('error');
        }
      }
    }
    void initEncounter();
    return () => { cancelled = true; };
  // retryKey triggers a retry; patientId is stable for the provider's lifetime
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, retryKey]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const who = user ? `${user.firstName} ${user.lastName}` : 'Utilisateur';
  const whoId = user?.id ?? '';
  const whoRole = user?.role ?? 'medecin';

  const nextId = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const pushAudit = useCallback((entry: Omit<AuditEntry, 'id' | 'timestamp' | 'performedBy' | 'performedById' | 'role'>) => {
    setDossier(d => ({
      ...d,
      auditLog: [{
        ...entry,
        id: nextId('a'),
        timestamp: new Date().toISOString(),
        performedBy: who,
        performedById: whoId,
        role: whoRole,
      }, ...d.auditLog],
    }));
  }, [who, whoId, whoRole]);

  // ── Workflow ──────────────────────────────────────────────────────────────
  const transitionStatus = useCallback((to: EmergencyWorkflowStatus, notes?: string) => {
    setDossier(d => {
      const transition: WorkflowTransition = {
        from: d.workflowStatus, to, at: new Date().toISOString(),
        by: who, byId: whoId, notes,
      };
      return {
        ...d,
        workflowStatus: to,
        workflowHistory: [...d.workflowHistory, transition],
      };
    });
    pushAudit({ action: `Changement de statut → ${to}`, category: 'admin', details: notes ?? '' });
  }, [who, whoId, pushAudit]);

  const startCare = useCallback(() => {
    setDossier(d => ({ ...d, careStartTime: new Date().toISOString() }));
    transitionStatus('en_prise_en_charge', 'Début de prise en charge');
  }, [transitionStatus]);

  const suspendCare = useCallback(() => {
    transitionStatus('attente_medecin', 'Prise en charge suspendue');
  }, [transitionStatus]);

  const closeFile = useCallback(() => {
    // Phase 3: validate no pending lab or imaging requests
    const pendingLab     = dossier.labRequests.filter(r => ['demandee', 'prelevee', 'en_cours'].includes(r.status)).length;
    const pendingImaging = dossier.imagingRequests.filter(r => ['demandee', 'planifiee'].includes(r.status)).length;
    const v = validateCloseFile({ pendingLabCount: pendingLab, pendingImagingCount: pendingImaging });
    if (!v.valid) {
      toast({ title: 'Clôture impossible', description: v.error, variant: 'destructive' });
      return;
    }
    transitionStatus('cloture', 'Dossier clôturé');
    pushAudit({ action: 'Clôture du dossier', category: 'admin', details: '' });
  }, [dossier, transitionStatus, pushAudit, toast]);

  // ── Clinical Text ─────────────────────────────────────────────────────────
  const updateClinicalText = useCallback((
    field: 'chiefComplaint' | 'illnessHistory' | 'clinicalExamination',
    value: string,
  ) => {
    setDossier(d => ({ ...d, [field]: value }));
  }, []);

  const updateFullExam = useCallback((exam: ClinicalExamination) => {
    setDossier(d => ({ ...d, clinicalExamination: exam }));
    pushAudit({ action: 'Examen clinique mis à jour', category: 'clinical', details: '' });
  }, [pushAudit]);

  // ── Vitals ────────────────────────────────────────────────────────────────
  const addVitalReading = useCallback((reading: Omit<VitalReading, 'timestamp'>) => {
    const r: VitalReading = {
      ...reading,
      timestamp: new Date().toISOString(),
      recordedBy: reading.recordedBy || who,
      bp: reading.sysBP && reading.diasBP
        ? `${reading.sysBP}/${reading.diasBP}`
        : (reading.bp ?? ''),
    };
    setDossier(d => ({ ...d, vitalReadings: [...d.vitalReadings, r] }));
    pushAudit({ action: 'Constantes enregistrées', category: 'clinical', details: `FC ${r.hr}, SpO₂ ${r.spo2}%` });
    // Persist to PostgreSQL — server derives encounterId from visitId
    if (propVisitId) {
      apiClient.post('/emergencies/vitals', {
        visitId:         propVisitId,
        heartRate:       r.hr,
        bloodPressure:   r.bp || undefined,
        spo2:            r.spo2,
        temperature:     r.temp,
        respiratoryRate: r.rr,
        gcs:             r.gcs,
        painLevel:       r.painLevel,
        glucose:         r.glucose,
      }).catch((err: Error) => console.error('[EmergencyDossier] vitals API failed:', err));
    }
  }, [who, propVisitId, pushAudit]);

  const addGlasgowReading = useCallback((breakdown: Omit<GlasgowBreakdown, 'recordedAt'>) => {
    const g: GlasgowBreakdown = {
      ...breakdown, recordedAt: new Date().toISOString(),
      recordedBy: breakdown.recordedBy || who,
    };
    setDossier(d => ({ ...d, glasgowHistory: [...d.glasgowHistory, g] }));
    pushAudit({ action: 'Glasgow évalué', category: 'clinical', details: `GCS ${g.eye + g.verbal + g.motor}/15` });
  }, [who, pushAudit]);

  const updateAbcde = useCallback((assessment: ABCDEAssessment) => {
    setDossier(d => ({ ...d, currentAbcde: assessment }));
    pushAudit({ action: 'ABCDE mis à jour', category: 'clinical', details: '' });
  }, [pushAudit]);

  // ── Lab ───────────────────────────────────────────────────────────────────
  const addLabRequest = useCallback((req: Omit<LabRequest, 'id' | 'requestedAt' | 'requestedBy'>) => {
    // HARD BLOCK: no lab order without a real encounter UUID
    if (!realEncounterId) {
      toast({
        title: 'Dossier non initialisé',
        description: 'Impossible de demander une analyse sans encounter actif. Cliquez sur « Réessayer ».',
        variant: 'destructive',
      });
      return;
    }
    // Phase 3: validate doctor is present
    const vLab = validateLabOrder({ requestedById: whoId });
    if (!vLab.valid) {
      toast({ title: 'Analyse refusée', description: vLab.error, variant: 'destructive' });
      return;
    }
    // Optimistic UI update
    const r: LabRequest = {
      ...req, id: nextId('l'), requestedAt: new Date().toISOString(),
      requestedBy: who, requestedById: whoId,
    };
    setDossier(d => ({ ...d, labRequests: [...d.labRequests, r] }));
    pushAudit({ action: 'Analyse demandée', category: 'lab', details: r.test });
    // Persist to PostgreSQL via API — fire-and-forget with error feedback
    const patientName = patient ? `${patient.lastName} ${patient.firstName}` : patientId;
    apiClient.post('/lab-orders', {
      patientId,
      encounterId: realEncounterId,
      patientName,
      test: r.test,
      category: r.category,
      urgency: r.urgency,
      requestedByName: who,
      laboratory: r.laboratory,
      sourceModule: 'urgences',
    }).catch((err: Error) => {
      console.error('[EmergencyDossier] lab order API failed:', err);
      toast({ title: 'Erreur réseau', description: 'L\'analyse a été enregistrée localement. Réessayez si elle n\'apparaît pas.', variant: 'destructive' });
    });
  }, [who, whoId, realEncounterId, pushAudit, patient, patientId, toast]);

  const updateLabStatus = useCallback((id: string, status: LabRequest['status'], result?: string, isCritical?: boolean) => {
    setDossier(d => ({
      ...d,
      labRequests: d.labRequests.map(r =>
        r.id === id
          ? { ...r, status, ...(result ? { result, resultAt: new Date().toISOString() } : {}), ...(isCritical !== undefined ? { isCritical } : {}) }
          : r,
      ),
    }));
    if (result) pushAudit({ action: 'Résultat biologique', category: 'lab', details: result, ...(isCritical ? { action: '⚠ RÉSULTAT CRITIQUE' } : {}) });
  }, [pushAudit]);

  // ── Imaging ───────────────────────────────────────────────────────────────
  const addImagingRequest = useCallback((req: Omit<ImagingRequest, 'id' | 'requestedAt' | 'requestedBy'>) => {
    // HARD BLOCK: no imaging order without a real encounter UUID
    if (!realEncounterId) {
      toast({
        title: 'Dossier non initialisé',
        description: 'Impossible de demander une imagerie sans encounter actif. Cliquez sur « Réessayer ».',
        variant: 'destructive',
      });
      return;
    }
    // Phase 3: validate doctor is present
    const vImg = validateImagingOrder({ requestedById: whoId });
    if (!vImg.valid) {
      toast({ title: 'Imagerie refusée', description: vImg.error, variant: 'destructive' });
      return;
    }
    // Optimistic UI update
    const r: ImagingRequest = {
      ...req, id: nextId('i'), requestedAt: new Date().toISOString(),
      requestedBy: who, requestedById: whoId,
    };
    setDossier(d => ({ ...d, imagingRequests: [...d.imagingRequests, r] }));
    pushAudit({ action: 'Imagerie demandée', category: 'imaging', details: `${r.exam} — ${r.region}` });
    // Persist to PostgreSQL via API — fire-and-forget with error feedback
    const patientName = patient ? `${patient.lastName} ${patient.firstName}` : patientId;
    apiClient.post('/imaging-orders', {
      patientId,
      encounterId: realEncounterId,
      patientName,
      exam: r.exam,
      region: r.region,
      side: r.side,
      urgency: r.urgency,
      withContrast: r.withContrast,
      requestedByName: who,
      sourceModule: 'urgences',
    }).catch((err: Error) => {
      console.error('[EmergencyDossier] imaging order API failed:', err);
      toast({ title: 'Erreur réseau', description: 'L\'imagerie a été enregistrée localement. Réessayez si elle n\'apparaît pas.', variant: 'destructive' });
    });
  }, [who, whoId, realEncounterId, pushAudit, patient, patientId, toast]);

  const updateImagingStatus = useCallback((id: string, status: ImagingRequest['status'], result?: string) => {
    setDossier(d => ({
      ...d,
      imagingRequests: d.imagingRequests.map(r =>
        r.id === id
          ? { ...r, status, ...(result ? { result, resultAt: new Date().toISOString() } : {}) }
          : r,
      ),
    }));
    if (result) pushAudit({ action: 'Résultat imagerie disponible', category: 'imaging', details: result });
  }, [pushAudit]);

  // ── Prescriptions ─────────────────────────────────────────────────────────
  const addPrescription = useCallback((rx: Omit<Prescription, 'id' | 'prescribedAt' | 'prescribedBy' | 'status'>) => {
    // HARD BLOCK: no prescription without a real encounter UUID
    if (!realEncounterId) {
      toast({
        title: 'Dossier non initialisé',
        description: 'Impossible d\'ajouter une prescription sans encounter actif. Cliquez sur « Réessayer ».',
        variant: 'destructive',
      });
      return;
    }
    // Optimistic UI update
    const p: Prescription = {
      ...rx, id: nextId('p'), prescribedAt: new Date().toISOString(),
      prescribedBy: who, prescribedById: whoId, status: 'prescrit',
    };
    setDossier(d => ({ ...d, prescriptions: [...d.prescriptions, p] }));
    pushAudit({ action: 'Prescription', category: 'prescription', details: `${p.drug} ${p.dosage} ${p.route}` });
    // Persist to PostgreSQL via API — fire-and-forget with error feedback
    const patientName = patient ? `${patient.lastName} ${patient.firstName}` : patientId;
    apiClient.post('/prescriptions', {
      patientId,
      encounterId: realEncounterId,
      patientName,
      drug: p.drug,
      dosage: p.dosage,
      route: p.route,
      frequency: p.frequency,
      duration: p.duration,
      prescribedByName: who,
      sourceModule: 'urgences',
    }).catch((err: Error) => {
      console.error('[EmergencyDossier] prescription API failed:', err);
      toast({ title: 'Erreur réseau', description: 'La prescription a été enregistrée localement. Réessayez si elle n\'apparaît pas.', variant: 'destructive' });
    });
  }, [who, whoId, realEncounterId, pushAudit, patient, patientId, toast]);

  const updatePrescriptionStatus = useCallback((id: string, status: Prescription['status'], adminAt?: string, by?: string) => {
    setDossier(d => ({
      ...d,
      prescriptions: d.prescriptions.map(p =>
        p.id === id ? { ...p, status, ...(adminAt ? { administeredAt: adminAt, administeredBy: by ?? who } : {}) } : p,
      ),
    }));
    if (status === 'administre') pushAudit({ action: 'Médicament administré', category: 'prescription', details: `Prescription #${id}` });
  }, [who, pushAudit]);

  // ── Procedures ────────────────────────────────────────────────────────────
  const addProcedure = useCallback((proc: Omit<Procedure, 'id' | 'performedAt' | 'performedBy'>) => {
    const p: Procedure = {
      ...proc, id: nextId('pr'), performedAt: new Date().toISOString(),
      performedBy: who, performedById: whoId,
    };
    setDossier(d => ({ ...d, procedures: [...d.procedures, p] }));
    pushAudit({ action: 'Procédure réalisée', category: 'clinical', details: p.name });
  }, [who, whoId, pushAudit]);

  // ── Notes ─────────────────────────────────────────────────────────────────
  const addNote = useCallback((note: Omit<ClinicalNote, 'id' | 'createdAt' | 'author' | 'authorId'>) => {
    const n: ClinicalNote = {
      ...note, id: nextId('n'), createdAt: new Date().toISOString(),
      author: who, authorId: whoId,
    };
    const fieldMap: Record<string, keyof EmergencyDossier> = {
      medical: 'medicalNotes', nursing: 'nursingNotes',
      administratif: 'adminNotes', transmission: 'transmissions',
    };
    const field = fieldMap[note.type] ?? 'medicalNotes';
    setDossier(d => ({
      ...d,
      [field]: [...(d[field] as ClinicalNote[]), n],
    }));
    pushAudit({ action: 'Note ajoutée', category: note.type === 'nursing' ? 'nursing' : 'clinical', details: note.content.slice(0, 80) });
  }, [who, whoId, pushAudit]);

  const pinNote = useCallback((id: string) => {
    const toggle = (arr: ClinicalNote[]) =>
      arr.map(n => n.id === id ? { ...n, isPinned: !n.isPinned } : n);
    setDossier(d => ({
      ...d,
      medicalNotes: toggle(d.medicalNotes),
      nursingNotes: toggle(d.nursingNotes),
      adminNotes: toggle(d.adminNotes),
      transmissions: toggle(d.transmissions),
    }));
  }, []);

  const editNote = useCallback((id: string, newContent: string) => {
    const edit = (arr: ClinicalNote[]) => arr.map(n => {
      if (n.id !== id) return n;
      const version = { content: n.content, editedAt: new Date().toISOString(), editedBy: who };
      return { ...n, content: newContent, versions: [...(n.versions ?? []), version] };
    });
    setDossier(d => ({
      ...d,
      medicalNotes: edit(d.medicalNotes),
      nursingNotes: edit(d.nursingNotes),
      adminNotes: edit(d.adminNotes),
      transmissions: edit(d.transmissions),
    }));
    pushAudit({ action: 'Note modifiée', category: 'clinical', details: `Note #${id} — version sauvegardée` });
  }, [who, pushAudit]);

  // ── Observation ───────────────────────────────────────────────────────────
  const startObservation = useCallback((obs: Omit<ObservationEntry, 'readings' | 'treatments' | 'evolution' | 'alerts'>) => {
    setDossier(d => ({
      ...d,
      observation: { ...obs, readings: [], treatments: [], evolution: '', alerts: [] },
    }));
    transitionStatus('en_observation', `Début observation: ${obs.motif}`);
    pushAudit({ action: 'Mise en observation', category: 'clinical', details: obs.motif });
  }, [transitionStatus, pushAudit]);

  const addObservationReading = useCallback((reading: Omit<VitalReading, 'timestamp'>) => {
    const r: VitalReading = {
      ...reading, timestamp: new Date().toISOString(), recordedBy: reading.recordedBy || who,
    };
    setDossier(d => ({
      ...d,
      observation: d.observation
        ? { ...d.observation, readings: [...d.observation.readings, r] }
        : d.observation,
      vitalReadings: [...d.vitalReadings, r],
    }));
  }, [who]);

  // ── Decision ──────────────────────────────────────────────────────────────
  const updateDecision = useCallback((updates: Partial<FinalDecision>) => {
    setDossier(d => ({ ...d, finalDecision: { ...d.finalDecision, ...updates } }));
  }, []);

  const confirmDecision = useCallback(() => {
    const d = dossier;
    const decision = d.finalDecision.decision;
    if (!decision) return;

    // Phase 3: validate decision-specific requirements before executing
    if (decision === 'hospitalisation') {
      const v = validateHospitalization({ ward: d.finalDecision.ward });
      if (!v.valid) { toast({ title: 'Hospitalisation refusée', description: v.error, variant: 'destructive' }); return; }
    } else if (decision === 'bloc') {
      const v = validateBloc({ surgeon: d.finalDecision.surgeon, intervention: d.finalDecision.intervention });
      if (!v.valid) { toast({ title: 'Demande bloc refusée', description: v.error, variant: 'destructive' }); return; }
    } else if (decision === 'reanimation') {
      const v = validateICU({ icuBed: d.finalDecision.icuBed, icuMotif: d.finalDecision.icuMotif });
      if (!v.valid) { toast({ title: 'Admission réa refusée', description: v.error, variant: 'destructive' }); return; }
    } else if (decision === 'transfert') {
      const v = validateTransfer({ destEtablissement: d.finalDecision.destEtablissement });
      if (!v.valid) { toast({ title: 'Transfert refusé', description: v.error, variant: 'destructive' }); return; }
    }

    const now = new Date().toISOString();
    const patientName = patient ? `${patient.lastName} ${patient.firstName}` : patientId;

    setDossier(prev => ({
      ...prev,
      finalDecision: {
        ...prev.finalDecision,
        decidedBy: who,
        decidedById: whoId,
        decidedAt: now,
      },
    }));

    // ── Cross-module actions via real PostgreSQL API ────────────────────────
    if (decision === 'domicile') {
      // Close the encounter in the DB
      if (realEncounterId) {
        apiClient.patch(`/encounters/${realEncounterId}/status`, { status: 'closed', reason: 'Retour à domicile' })
          .catch((err: Error) => console.error('[EmergencyDossier] encounter close failed:', err));
      }

    } else if (decision === 'hospitalisation') {
      // Create a real admission record linked to this encounter
      apiClient.post('/admissions', {
        patientId,
        encounterId: realEncounterId,
        patientName,
        type: 'urgence',
        serviceName: d.finalDecision.ward ?? 'À déterminer',
        doctorId: whoId,
        doctorName: who,
        motif: d.chiefComplaint,
        notes: d.finalDecision.medicalSummary ?? '',
        admissionDate: now.split('T')[0],
        admissionTime: now.split('T')[1].slice(0, 5),
        priority: 'urgent',
      }).catch((err: Error) => console.error('[EmergencyDossier] admission create failed:', err));

    } else if (decision === 'bloc') {
      // Create a surgical request in the real DB
      apiClient.post('/surgical-requests', {
        patientId,
        encounterId: realEncounterId,
        patientName,
        intervention: d.finalDecision.intervention ?? 'À déterminer',
        surgeonName: d.finalDecision.surgeon,
        urgencyDegree: d.finalDecision.urgencyDegree ?? 'urgent',
        sourceModule: 'urgences',
      }).catch((err: Error) => console.error('[EmergencyDossier] surgical request failed:', err));

    } else if (decision === 'reanimation') {
      // Create an ICU admission in the real DB
      apiClient.post('/icu/admissions', {
        patientId,
        encounterId: realEncounterId,
        patientName,
        motif: d.finalDecision.icuMotif ?? d.chiefComplaint,
        priority: d.finalDecision.icuPriority ?? 'P1',
        icuBed: d.finalDecision.icuBed,
      }).catch((err: Error) => console.error('[EmergencyDossier] ICU admission failed:', err));

    } else if (decision === 'transfert') {
      if (realEncounterId) {
        apiClient.patch(`/encounters/${realEncounterId}/status`, { status: 'closed', reason: `Transfert → ${d.finalDecision.destEtablissement ?? 'autre établissement'}` })
          .catch((err: Error) => console.error('[EmergencyDossier] encounter close failed:', err));
      }

    } else if (decision === 'deces') {
      if (realEncounterId) {
        apiClient.patch(`/encounters/${realEncounterId}/status`, { status: 'closed', reason: 'Décès' })
          .catch((err: Error) => console.error('[EmergencyDossier] encounter close failed:', err));
      }
    }

    // Auto-transition dossier workflow
    const statusMap: Partial<Record<NonNullable<typeof decision>, EmergencyWorkflowStatus>> = {
      hospitalisation: 'hospitalise',
      transfert:       'transfere',
      domicile:        'sorti',
      deces:           'decede',
      reanimation:     'hospitalise',
      bloc:            'hospitalise',
    };
    const nextStatus = statusMap[decision];
    if (nextStatus) transitionStatus(nextStatus, `Décision: ${decision}`);
    pushAudit({ action: 'Décision finale', category: 'decision', details: decision });
  }, [dossier, who, whoId, whoRole, patientId, patient, realEncounterId, transitionStatus, pushAudit, toast]);

  // ── Manual save & audit ───────────────────────────────────────────────────
  const triggerSave = useCallback(() => {
    setSaveState('saving');
    setTimeout(() => {
      setSaveState('saved');
      setLastSaved(new Date().toISOString());
      pushAudit({ action: 'Sauvegarde manuelle', category: 'system', details: '' });
    }, 400);
  }, [pushAudit]);

  const appendAudit = useCallback((entry: Omit<AuditEntry, 'id' | 'timestamp' | 'performedBy' | 'performedById' | 'role'>) => {
    pushAudit(entry);
  }, [pushAudit]);

  // ── Triage priority change — persists via PATCH /emergencies/visits/:visitId ─
  const updateTriagePriority = useCallback(async (priority: EmergencyPatient['priority']) => {
    // Optimistic local update (patient is read-only prop; update reflected via dossier audit)
    pushAudit({ action: `Priorité modifiée → ${priority}`, category: 'admin', details: `Changement de triage par ${who}` });

    // Persist to DB if we have a real visitId
    if (propVisitId) {
      try {
        await apiClient.patch(`/emergencies/visits/${propVisitId}`, { priority });
      } catch (err) {
        console.error('[EmergencyDossier] triage priority update failed:', err);
        toast({ title: 'Erreur réseau', description: 'La priorité a été mise à jour localement mais n\'a pas pu être sauvegardée.', variant: 'destructive' });
      }
    }
  }, [propVisitId, who, pushAudit, toast]);

  return (
    <EmergencyDossierContext.Provider value={{
      dossier, patient, visitId: propVisitId, saveState, lastSaved,
      encounterStatus, retryEncounter,
      transitionStatus, startCare, suspendCare, closeFile,
      updateTriagePriority,
      updateClinicalText, updateFullExam,
      addVitalReading, addGlasgowReading, updateAbcde,
      addLabRequest, updateLabStatus,
      addImagingRequest, updateImagingStatus,
      addPrescription, updatePrescriptionStatus,
      addProcedure,
      addNote, pinNote, editNote,
      startObservation, addObservationReading,
      updateDecision, confirmDecision,
      triggerSave, appendAudit,
    }}>
      {children}
    </EmergencyDossierContext.Provider>
  );
}

export function useEmergencyDossier(): EmergencyDossierContextType {
  const ctx = useContext(EmergencyDossierContext);
  if (!ctx) throw new Error('useEmergencyDossier must be used within EmergencyDossierProvider');
  return ctx;
}
