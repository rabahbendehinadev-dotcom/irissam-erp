import {
  createContext, useContext, useState, useEffect, useCallback, useRef,
} from 'react';
import { useAuth } from '@/store/AuthContext';
import { getMockDossier } from '@/mock/emergencyDossier';
import { MOCK_EMERGENCY_PATIENTS } from '@/mock/emergency';
import type {
  EmergencyDossier, EmergencyWorkflowStatus, WorkflowTransition,
  VitalReading, GlasgowBreakdown, ABCDEAssessment, LabRequest, ImagingRequest,
  Prescription, Procedure, ClinicalNote, FinalDecision, AuditEntry,
  ObservationEntry, ClinicalExamination,
} from '@/types/emergencyDossier';
import type { EmergencyPatient } from '@/types/emergency';

// ─── Context Shape ────────────────────────────────────────────────────────────

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface EmergencyDossierContextType {
  dossier: EmergencyDossier;
  patient: EmergencyPatient | null;
  saveState: SaveState;
  lastSaved: string | null;
  // Workflow
  transitionStatus: (to: EmergencyWorkflowStatus, notes?: string) => void;
  startCare: () => void;
  suspendCare: () => void;
  closeFile: () => void;
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
  // Orders
  addLabRequest: (req: Omit<LabRequest, 'id' | 'requestedAt' | 'requestedBy'>) => void;
  updateLabStatus: (id: string, status: LabRequest['status'], result?: string, isCritical?: boolean) => void;
  addImagingRequest: (req: Omit<ImagingRequest, 'id' | 'requestedAt' | 'requestedBy'>) => void;
  updateImagingStatus: (id: string, status: ImagingRequest['status'], result?: string) => void;
  // Treatment
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
  children,
}: {
  patientId: string;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [dossier, setDossier] = useState<EmergencyDossier>(() => getMockDossier(patientId));
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const patient = MOCK_EMERGENCY_PATIENTS.find(p => p.id === patientId) ?? null;

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
    transitionStatus('cloture', 'Dossier clôturé');
    pushAudit({ action: 'Clôture du dossier', category: 'admin', details: '' });
  }, [transitionStatus, pushAudit]);

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
  }, [who, pushAudit]);

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
    const r: LabRequest = {
      ...req, id: nextId('l'), requestedAt: new Date().toISOString(),
      requestedBy: who, requestedById: whoId,
    };
    setDossier(d => ({ ...d, labRequests: [...d.labRequests, r] }));
    pushAudit({ action: 'Analyse demandée', category: 'lab', details: r.test });
  }, [who, whoId, pushAudit]);

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
    const r: ImagingRequest = {
      ...req, id: nextId('i'), requestedAt: new Date().toISOString(),
      requestedBy: who, requestedById: whoId,
    };
    setDossier(d => ({ ...d, imagingRequests: [...d.imagingRequests, r] }));
    pushAudit({ action: 'Imagerie demandée', category: 'imaging', details: `${r.exam} — ${r.region}` });
  }, [who, whoId, pushAudit]);

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
    const p: Prescription = {
      ...rx, id: nextId('p'), prescribedAt: new Date().toISOString(),
      prescribedBy: who, prescribedById: whoId, status: 'prescrit',
    };
    setDossier(d => ({ ...d, prescriptions: [...d.prescriptions, p] }));
    pushAudit({ action: 'Prescription', category: 'prescription', details: `${p.drug} ${p.dosage} ${p.route}` });
  }, [who, whoId, pushAudit]);

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
    setDossier(prev => ({
      ...prev,
      finalDecision: {
        ...prev.finalDecision,
        decidedBy: who,
        decidedById: whoId,
        decidedAt: new Date().toISOString(),
      },
    }));
    // Auto-transition workflow
    const statusMap: Partial<Record<NonNullable<typeof decision>, EmergencyWorkflowStatus>> = {
      hospitalisation: 'hospitalise',
      transfert: 'transfere',
      domicile: 'sorti',
      deces: 'decede',
      reanimation: 'hospitalise',
      bloc: 'hospitalise',
    };
    const nextStatus = statusMap[decision];
    if (nextStatus) transitionStatus(nextStatus, `Décision: ${decision}`);
    pushAudit({ action: 'Décision finale', category: 'decision', details: decision });
  }, [dossier, who, whoId, transitionStatus, pushAudit]);

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

  return (
    <EmergencyDossierContext.Provider value={{
      dossier, patient, saveState, lastSaved,
      transitionStatus, startCare, suspendCare, closeFile,
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
