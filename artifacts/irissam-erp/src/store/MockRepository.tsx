/**
 * MockRepository — Unified in-memory data store for all cross-module operations.
 *
 * Design contract:
 *   - All state is React useState, so mutations are automatically reactive.
 *   - No API calls. All writes are synchronous.
 *   - To migrate to PostgreSQL: replace each mutation with an API call that
 *     returns the updated record and calls the setState setter.
 *   - Every mutation appends to globalAudit (Date, Time, User, old/new value, module, IP).
 */

import { createContext, useContext, useState, useCallback } from 'react';
import { MOCK_EMERGENCY_PATIENTS } from '@/mock/emergency';
import type { EmergencyPatient, EmergencyPatientStatus } from '@/types/emergency';
import type {
  RepoAuditEntry, RepoLabOrder, RepoImagingOrder, RepoPrescription,
  SurgicalRequest, ICUAdmission, EmergencyVisit, AuditCtx, RepoModule,
} from '@/types/repository';

// ─── Context type ─────────────────────────────────────────────────────────────

export interface MockRepositoryContextType {
  // ── Live data ──────────────────────────────────────────────────────────────
  patients:         EmergencyPatient[];
  labOrders:        RepoLabOrder[];
  imagingOrders:    RepoImagingOrder[];
  prescriptions:    RepoPrescription[];
  surgicalRequests: SurgicalRequest[];
  icuAdmissions:    ICUAdmission[];
  globalAudit:      RepoAuditEntry[];

  // ── Queries ────────────────────────────────────────────────────────────────
  getPatient:                (id: string) => EmergencyPatient | null;
  getLabOrdersByPatient:     (patientId: string) => RepoLabOrder[];
  getImagingOrdersByPatient: (patientId: string) => RepoImagingOrder[];
  getPrescriptionsByPatient: (patientId: string) => RepoPrescription[];
  getSurgicalsByPatient:     (patientId: string) => SurgicalRequest[];
  getICUsByPatient:          (patientId: string) => ICUAdmission[];

  // ── Emergency workflow ─────────────────────────────────────────────────────
  /**
   * Mark a patient as "en soins" — updates status, records careStartTime, logs audit.
   * Call this when staff clicks "Prendre en charge" or "Démarrer".
   */
  startCare: (
    patientId: string,
    ctx: AuditCtx & { assignedDoctor?: string; assignedNurse?: string; assignedRoom?: string },
  ) => void;

  /** Generic status update for any workflow transition. */
  updatePatientStatus: (
    patientId: string,
    status: EmergencyPatientStatus,
    ctx: AuditCtx,
    notes?: string,
  ) => void;

  // ── Cross-module record creation ───────────────────────────────────────────
  createLabOrder:        (order: Omit<RepoLabOrder, 'id' | 'requestedAt'>) => string;
  createImagingOrder:    (order: Omit<RepoImagingOrder, 'id' | 'requestedAt'>) => string;
  createPrescription:    (rx: Omit<RepoPrescription, 'id' | 'prescribedAt'>) => string;
  createSurgicalRequest: (req: Omit<SurgicalRequest, 'id' | 'createdAt'>) => string;
  createICUAdmission:    (adm: Omit<ICUAdmission, 'id' | 'createdAt'>) => string;

  /** Update status of a lab order (called by Lab module). */
  updateLabOrderStatus: (orderId: string, status: RepoLabOrder['status'], result?: string, isCritical?: boolean) => void;

  /** Update status of an imaging order (called by Radiology module). */
  updateImagingStatus: (orderId: string, status: RepoImagingOrder['status'], result?: string) => void;

  // ── Visit closure ──────────────────────────────────────────────────────────
  /** Close a visit as discharged to home. */
  closeVisitDischarged:   (patientId: string, ctx: AuditCtx) => void;
  /** Close a visit with hospitalisation. Links the provided admissionId. */
  closeVisitHospitalized: (patientId: string, admissionId: string, ctx: AuditCtx) => void;
  /** Close a visit due to bloc request. Links surgicalRequestId. */
  closeVisitBloc:         (patientId: string, surgicalRequestId: string, ctx: AuditCtx) => void;
  /** Close a visit due to ICU admission. Links icuAdmissionId. */
  closeVisitICU:          (patientId: string, icuAdmissionId: string, ctx: AuditCtx) => void;
  /** Close a visit due to transfer. */
  closeVisitTransferred:  (patientId: string, ctx: AuditCtx, destEtablissement?: string) => void;
  /**
   * Close a visit due to death. Sets isLocked = true.
   * Only a Super Admin can re-open (backend enforcement; UI just blocks edits).
   */
  closeVisitDeceased: (patientId: string, ctx: AuditCtx, provisionalCause?: string) => void;

  // ── Manual audit ──────────────────────────────────────────────────────────
  addGlobalAudit: (entry: Omit<RepoAuditEntry, 'id' | 'timestamp' | 'ip'>) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const MockRepositoryContext = createContext<MockRepositoryContextType | null>(null);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MOCK_IP = '127.0.0.1';

function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Build initial visits from mock patients
function buildInitialVisits(patients: EmergencyPatient[]): EmergencyVisit[] {
  return patients.map(p => ({
    id: `visit-${p.id}`,
    patientId: p.id,
    patientName: `${p.lastName} ${p.firstName}`,
    priority: p.priority,
    status: p.status,
    assignedDoctorName: p.assignedDoctor,
    assignedNurseName: p.assignedNurse,
    assignedRoomName: p.assignedRoom,
    chiefComplaint: p.chiefComplaint,
    arrivalTime: p.arrivalTime,
    isLocked: p.status === 'decede',
    createdAt: p.arrivalTime,
    updatedAt: p.arrivalTime,
  }));
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function MockRepositoryProvider({ children }: { children: React.ReactNode }) {
  // Mutable copy of emergency patients — reactive
  const [patients, setPatients] = useState<EmergencyPatient[]>(
    () => MOCK_EMERGENCY_PATIENTS.map(p => ({ ...p })),
  );

  const [labOrders,        setLabOrders]        = useState<RepoLabOrder[]>([]);
  const [imagingOrders,    setImagingOrders]    = useState<RepoImagingOrder[]>([]);
  const [prescriptions,    setPrescriptions]    = useState<RepoPrescription[]>([]);
  const [surgicalRequests, setSurgicalRequests] = useState<SurgicalRequest[]>([]);
  const [icuAdmissions,    setICUAdmissions]    = useState<ICUAdmission[]>([]);
  const [globalAudit,      setGlobalAudit]      = useState<RepoAuditEntry[]>([]);

  // ── Audit helper ────────────────────────────────────────────────────────
  const audit = useCallback((
    module: RepoModule,
    action: string,
    ctx: AuditCtx,
    extras?: Partial<Pick<RepoAuditEntry, 'patientId' | 'visitId' | 'oldValue' | 'newValue' | 'resourceId' | 'resourceType'>>,
  ) => {
    const entry: RepoAuditEntry = {
      id: genId('aud'),
      timestamp: new Date().toISOString(),
      module,
      action,
      userId: ctx.userId,
      userName: ctx.userName,
      userRole: ctx.userRole,
      ip: MOCK_IP,
      ...extras,
    };
    setGlobalAudit(prev => [entry, ...prev]);
  }, []);

  // ── Queries ────────────────────────────────────────────────────────────
  const getPatient = useCallback(
    (id: string) => patients.find(p => p.id === id) ?? null,
    [patients],
  );

  const getLabOrdersByPatient = useCallback(
    (patientId: string) => labOrders.filter(o => o.patientId === patientId),
    [labOrders],
  );

  const getImagingOrdersByPatient = useCallback(
    (patientId: string) => imagingOrders.filter(o => o.patientId === patientId),
    [imagingOrders],
  );

  const getPrescriptionsByPatient = useCallback(
    (patientId: string) => prescriptions.filter(p => p.patientId === patientId),
    [prescriptions],
  );

  const getSurgicalsByPatient = useCallback(
    (patientId: string) => surgicalRequests.filter(s => s.patientId === patientId),
    [surgicalRequests],
  );

  const getICUsByPatient = useCallback(
    (patientId: string) => icuAdmissions.filter(i => i.patientId === patientId),
    [icuAdmissions],
  );

  // ── updatePatient (internal) ─────────────────────────────────────────────
  const patchPatient = useCallback((patientId: string, patch: Partial<EmergencyPatient>) => {
    setPatients(prev => prev.map(p => p.id === patientId ? { ...p, ...patch } : p));
  }, []);

  // ── startCare ────────────────────────────────────────────────────────────
  const startCare = useCallback((
    patientId: string,
    ctx: AuditCtx & { assignedDoctor?: string; assignedNurse?: string; assignedRoom?: string },
  ) => {
    setPatients(prev => prev.map(p => {
      if (p.id !== patientId) return p;
      const old = p.status;
      return {
        ...p,
        status: 'en_soins' as EmergencyPatientStatus,
        ...(ctx.assignedDoctor ? { assignedDoctor: ctx.assignedDoctor } : {}),
        ...(ctx.assignedNurse  ? { assignedNurse:  ctx.assignedNurse  } : {}),
        ...(ctx.assignedRoom   ? { assignedRoom:   ctx.assignedRoom   } : {}),
      };
    }));
    audit('urgences', 'Prise en charge démarrée', ctx, {
      patientId,
      oldValue: patients.find(p => p.id === patientId)?.status,
      newValue: 'en_soins',
    });
  }, [patients, audit]);

  // ── updatePatientStatus ───────────────────────────────────────────────────
  const updatePatientStatus = useCallback((
    patientId: string,
    status: EmergencyPatientStatus,
    ctx: AuditCtx,
    notes?: string,
  ) => {
    const old = patients.find(p => p.id === patientId)?.status;
    patchPatient(patientId, { status });
    audit('urgences', `Statut → ${status}`, ctx, {
      patientId,
      oldValue: old,
      newValue: status,
      ...(notes ? { resourceType: notes } : {}),
    });
  }, [patients, patchPatient, audit]);

  // ── createLabOrder ────────────────────────────────────────────────────────
  const createLabOrder = useCallback((order: Omit<RepoLabOrder, 'id' | 'requestedAt'>): string => {
    const id = genId('lab');
    const full: RepoLabOrder = { ...order, id, requestedAt: new Date().toISOString() };
    setLabOrders(prev => [...prev, full]);
    audit('laboratoire', `Analyse demandée: ${order.test}`, {
      userId: order.requestedById, userName: order.requestedBy, userRole: 'medecin',
    }, { patientId: order.patientId, visitId: order.visitId, resourceId: id, resourceType: 'LabOrder' });
    return id;
  }, [audit]);

  // ── createImagingOrder ────────────────────────────────────────────────────
  const createImagingOrder = useCallback((order: Omit<RepoImagingOrder, 'id' | 'requestedAt'>): string => {
    const id = genId('img');
    const full: RepoImagingOrder = { ...order, id, requestedAt: new Date().toISOString() };
    setImagingOrders(prev => [...prev, full]);
    audit('imagerie', `Imagerie demandée: ${order.exam}`, {
      userId: order.requestedById, userName: order.requestedBy, userRole: 'medecin',
    }, { patientId: order.patientId, visitId: order.visitId, resourceId: id, resourceType: 'ImagingOrder' });
    return id;
  }, [audit]);

  // ── createPrescription ────────────────────────────────────────────────────
  const createPrescription = useCallback((rx: Omit<RepoPrescription, 'id' | 'prescribedAt'>): string => {
    const id = genId('rx');
    const full: RepoPrescription = { ...rx, id, prescribedAt: new Date().toISOString() };
    setPrescriptions(prev => [...prev, full]);
    audit('urgences', `Prescription: ${rx.drug} ${rx.dosage}`, {
      userId: rx.prescribedById, userName: rx.prescribedBy, userRole: 'medecin',
    }, { patientId: rx.patientId, visitId: rx.visitId, resourceId: id, resourceType: 'Prescription' });
    return id;
  }, [audit]);

  // ── createSurgicalRequest ────────────────────────────────────────────────
  const createSurgicalRequest = useCallback((req: Omit<SurgicalRequest, 'id' | 'createdAt'>): string => {
    const id = genId('surg');
    const full: SurgicalRequest = { ...req, id, createdAt: new Date().toISOString(), status: 'demande' };
    setSurgicalRequests(prev => [...prev, full]);
    patchPatient(req.patientId, { status: 'hospitalise' });
    audit('bloc', `Demande bloc: ${req.intervention}`, {
      userId: req.requestedById, userName: req.requestedBy, userRole: 'medecin',
    }, { patientId: req.patientId, visitId: req.visitId, resourceId: id, resourceType: 'SurgicalRequest' });
    return id;
  }, [patchPatient, audit]);

  // ── createICUAdmission ────────────────────────────────────────────────────
  const createICUAdmission = useCallback((adm: Omit<ICUAdmission, 'id' | 'createdAt'>): string => {
    const id = genId('icu');
    const full: ICUAdmission = { ...adm, id, createdAt: new Date().toISOString(), status: 'demande' };
    setICUAdmissions(prev => [...prev, full]);
    patchPatient(adm.patientId, { status: 'hospitalise' });
    audit('reanimation', `Admission réanimation: ${adm.motif}`, {
      userId: adm.requestedById, userName: adm.requestedBy, userRole: 'medecin',
    }, { patientId: adm.patientId, visitId: adm.visitId, resourceId: id, resourceType: 'ICUAdmission' });
    return id;
  }, [patchPatient, audit]);

  // ── updateLabOrderStatus ─────────────────────────────────────────────────
  const updateLabOrderStatus = useCallback((
    orderId: string,
    status: RepoLabOrder['status'],
    result?: string,
    isCritical?: boolean,
  ) => {
    setLabOrders(prev => prev.map(o =>
      o.id === orderId
        ? { ...o, status, ...(result ? { result, resultAt: new Date().toISOString() } : {}), ...(isCritical !== undefined ? { isCritical } : {}) }
        : o,
    ));
  }, []);

  // ── updateImagingStatus ───────────────────────────────────────────────────
  const updateImagingStatus = useCallback((
    orderId: string,
    status: RepoImagingOrder['status'],
    result?: string,
  ) => {
    setImagingOrders(prev => prev.map(o =>
      o.id === orderId
        ? { ...o, status, ...(result ? { result, resultAt: new Date().toISOString() } : {}) }
        : o,
    ));
  }, []);

  // ── Visit closure helpers ─────────────────────────────────────────────────
  const closeVisitDischarged = useCallback((patientId: string, ctx: AuditCtx) => {
    patchPatient(patientId, { status: 'sorti' });
    audit('urgences', 'Sortie domicile', ctx, { patientId, oldValue: 'en_soins', newValue: 'sorti' });
  }, [patchPatient, audit]);

  const closeVisitHospitalized = useCallback((patientId: string, admissionId: string, ctx: AuditCtx) => {
    patchPatient(patientId, { status: 'hospitalise' });
    audit('hospitalisation', 'Hospitalisation', ctx, {
      patientId, newValue: 'hospitalise', resourceId: admissionId, resourceType: 'Admission',
    });
  }, [patchPatient, audit]);

  const closeVisitBloc = useCallback((patientId: string, surgicalRequestId: string, ctx: AuditCtx) => {
    patchPatient(patientId, { status: 'hospitalise' });
    audit('bloc', 'Transfert bloc opératoire', ctx, {
      patientId, newValue: 'hospitalise', resourceId: surgicalRequestId, resourceType: 'SurgicalRequest',
    });
  }, [patchPatient, audit]);

  const closeVisitICU = useCallback((patientId: string, icuAdmissionId: string, ctx: AuditCtx) => {
    patchPatient(patientId, { status: 'hospitalise' });
    audit('reanimation', 'Transfert réanimation', ctx, {
      patientId, newValue: 'hospitalise', resourceId: icuAdmissionId, resourceType: 'ICUAdmission',
    });
  }, [patchPatient, audit]);

  const closeVisitTransferred = useCallback((patientId: string, ctx: AuditCtx, destEtablissement?: string) => {
    patchPatient(patientId, { status: 'transfere' });
    audit('urgences', `Transfert vers ${destEtablissement ?? 'autre établissement'}`, ctx, {
      patientId, newValue: 'transfere',
    });
  }, [patchPatient, audit]);

  const closeVisitDeceased = useCallback((patientId: string, ctx: AuditCtx, provisionalCause?: string) => {
    patchPatient(patientId, { status: 'decede' });
    audit('urgences', `Décès constaté${provisionalCause ? ` — ${provisionalCause}` : ''}`, ctx, {
      patientId, newValue: 'decede',
    });
  }, [patchPatient, audit]);

  // ── addGlobalAudit ────────────────────────────────────────────────────────
  const addGlobalAudit = useCallback((entry: Omit<RepoAuditEntry, 'id' | 'timestamp' | 'ip'>) => {
    setGlobalAudit(prev => [{
      ...entry, id: genId('aud'), timestamp: new Date().toISOString(), ip: MOCK_IP,
    }, ...prev]);
  }, []);

  return (
    <MockRepositoryContext.Provider value={{
      patients, labOrders, imagingOrders, prescriptions, surgicalRequests, icuAdmissions, globalAudit,
      getPatient, getLabOrdersByPatient, getImagingOrdersByPatient, getPrescriptionsByPatient,
      getSurgicalsByPatient, getICUsByPatient,
      startCare, updatePatientStatus,
      createLabOrder, createImagingOrder, createPrescription,
      createSurgicalRequest, createICUAdmission,
      updateLabOrderStatus, updateImagingStatus,
      closeVisitDischarged, closeVisitHospitalized, closeVisitBloc,
      closeVisitICU, closeVisitTransferred, closeVisitDeceased,
      addGlobalAudit,
    }}>
      {children}
    </MockRepositoryContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMockRepository(): MockRepositoryContextType {
  const ctx = useContext(MockRepositoryContext);
  if (!ctx) throw new Error('useMockRepository must be used within MockRepositoryProvider');
  return ctx;
}
