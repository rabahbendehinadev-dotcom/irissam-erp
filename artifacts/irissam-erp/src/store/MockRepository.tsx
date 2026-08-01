/**
 * MockRepository — Unified in-memory Hospital Data Store
 *
 * Implements Phases 2–8 of Production Logic:
 *   Phase 2 — Single source of truth: all modules read here
 *   Phase 4 — Workflow engine: only valid transitions allowed
 *   Phase 5 — Internal notifications: cross-module alerts on record creation
 *   Phase 6 — Real-time occupancy: rooms, beds, doctors, nurses, ambulances
 *   Phase 7 — Full audit: every mutation logged (date, user, module, old/new value, encounterId)
 *   Phase 8 — PostgreSQL-compatible interface: swap mock → API without touching UI
 *
 * PostgreSQL migration path:
 *   Each `useState` setter becomes `await apiClient.mutation(...)`.
 *   The exported `MockRepositoryContextType` is the service interface contract.
 *   UI and business logic are completely decoupled from persistence.
 */

import { createContext, useContext, useState, useCallback } from 'react';
import { MOCK_EMERGENCY_PATIENTS, MOCK_EMERGENCY_ROOMS, MOCK_EMERGENCY_AMBULANCES, MOCK_EMERGENCY_DOCTORS, MOCK_EMERGENCY_NURSES } from '@/mock/emergency';
import { useNotifications } from './NotificationsContext';
import { canTransition, canStartCare, TRANSITION_LABELS } from '@/engine/workflowEngine';
import type { EmergencyPatient, EmergencyPatientStatus, EmergencyRoom, EmergencyDoctor, EmergencyNurse, Ambulance, AmbulanceStatus } from '@/types/emergency';
import type { Encounter, EncounterLinkedRecord } from '@/types/encounter';
import type {
  RepoAuditEntry, RepoLabOrder, RepoImagingOrder, RepoPrescription,
  SurgicalRequest, ICUAdmission, AuditCtx, RepoModule,
} from '@/types/repository';

// ─── Context Contract ─────────────────────────────────────────────────────────
// This interface is the PostgreSQL-compatible service contract.
// A real API implementation must satisfy the same shape.

export interface MockRepositoryContextType {
  // ── Phase 1 data: Encounters ───────────────────────────────────────────────
  encounters:           Encounter[];
  getEncounterById:     (id: string) => Encounter | null;
  getEncountersByPatient: (patientId: string) => Encounter[];
  createEncounter:      (enc: Omit<Encounter, 'id' | 'openedAt' | 'updatedAt' | 'linkedRecords'>) => string;
  closeEncounter:       (encounterId: string, reason: string, ctx: AuditCtx) => void;
  linkRecordToEncounter:(encounterId: string, record: EncounterLinkedRecord) => void;

  // ── Phase 2 data: Cross-module clinical records ────────────────────────────
  patients:             EmergencyPatient[];
  labOrders:            RepoLabOrder[];
  imagingOrders:        RepoImagingOrder[];
  prescriptions:        RepoPrescription[];
  surgicalRequests:     SurgicalRequest[];
  icuAdmissions:        ICUAdmission[];

  // ── Phase 6 data: Real-time occupancy ─────────────────────────────────────
  rooms:                EmergencyRoom[];
  erDoctors:            EmergencyDoctor[];
  erNurses:             EmergencyNurse[];
  ambulances:           Ambulance[];
  assignPatientToRoom:  (roomId: string, patientId: string) => void;
  freePatientFromRoom:  (roomId: string, patientId: string) => void;
  updateAmbulanceStatus:(ambulanceId: string, status: AmbulanceStatus, patch?: Partial<Ambulance>) => void;

  // ── Phase 7 data: Audit ────────────────────────────────────────────────────
  globalAudit:          RepoAuditEntry[];
  addGlobalAudit:       (entry: Omit<RepoAuditEntry, 'id' | 'timestamp' | 'ip'>) => void;

  // ── Queries ────────────────────────────────────────────────────────────────
  getPatient:                (id: string) => EmergencyPatient | null;
  getLabOrdersByPatient:     (patientId: string) => RepoLabOrder[];
  getImagingOrdersByPatient: (patientId: string) => RepoImagingOrder[];
  getPrescriptionsByPatient: (patientId: string) => RepoPrescription[];
  getSurgicalsByPatient:     (patientId: string) => SurgicalRequest[];
  getICUsByPatient:          (patientId: string) => ICUAdmission[];

  // ── Phase 4: Workflow ──────────────────────────────────────────────────────
  /** Returns true if the patient can legally transition to the given status. */
  canTransitionPatient: (patientId: string, to: EmergencyPatientStatus) => boolean;

  // ── Emergency workflow mutations ───────────────────────────────────────────
  /**
   * Start care for a patient: set status → en_soins, create/update encounter,
   * update occupancy (room, doctor, nurse), log audit.
   * Phase 4: only allowed if canStartCare(current.status).
   */
  startCare: (
    patientId: string,
    ctx: AuditCtx & { assignedDoctor?: string; assignedNurse?: string; assignedRoom?: string },
  ) => void;

  /**
   * Transition a patient to a new workflow status.
   * Phase 4: silently rejected if canTransition(from, to) === false.
   */
  updatePatientStatus: (
    patientId: string,
    status:    EmergencyPatientStatus,
    ctx:       AuditCtx,
    notes?:    string,
  ) => void;

  // ── Cross-module record creation (Phase 5: fires notifications) ──────────
  createLabOrder:        (order: Omit<RepoLabOrder,     'id' | 'requestedAt'>) => string;
  createImagingOrder:    (order: Omit<RepoImagingOrder, 'id' | 'requestedAt'>) => string;
  createPrescription:    (rx:    Omit<RepoPrescription, 'id' | 'prescribedAt'>) => string;
  createSurgicalRequest: (req:   Omit<SurgicalRequest,  'id' | 'createdAt'>) => string;
  createICUAdmission:    (adm:   Omit<ICUAdmission,     'id' | 'createdAt'>) => string;

  updateLabOrderStatus:  (orderId: string, status: RepoLabOrder['status'],     result?: string, isCritical?: boolean) => void;
  updateImagingStatus:   (orderId: string, status: RepoImagingOrder['status'], result?: string) => void;

  // ── Visit closure (Phase 6: frees occupancy; Phase 5: notifies modules) ──
  closeVisitDischarged:   (patientId: string, ctx: AuditCtx) => void;
  closeVisitHospitalized: (patientId: string, admissionId: string, ctx: AuditCtx) => void;
  closeVisitBloc:         (patientId: string, surgicalRequestId: string, ctx: AuditCtx) => void;
  closeVisitICU:          (patientId: string, icuAdmissionId: string, ctx: AuditCtx) => void;
  closeVisitTransferred:  (patientId: string, ctx: AuditCtx, destEtablissement?: string) => void;
  closeVisitDeceased:     (patientId: string, ctx: AuditCtx, provisionalCause?: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const MockRepositoryContext = createContext<MockRepositoryContextType | null>(null);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MOCK_IP = '127.0.0.1';

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Build initial encounters from mock patients — one per active emergency patient. */
function buildInitialEncounters(patients: EmergencyPatient[]): Encounter[] {
  return patients.map(p => ({
    id: `enc-${p.id}`,
    patientId: p.id,
    patientName: `${p.lastName} ${p.firstName}`,
    type: 'urgence' as const,
    status: (['sorti', 'transfere', 'decede'].includes(p.status) ? 'closed' : 'open') as Encounter['status'],
    chiefComplaint: p.chiefComplaint,
    sourceModule: 'urgences' as const,
    sourceRecordId: `visit-${p.id}`,
    linkedRecords: [],
    workflowStatus: p.status,
    primaryDoctorName: p.assignedDoctor,
    primaryNurseName: p.assignedNurse,
    roomName: p.assignedRoom,
    openedAt: p.arrivalTime,
    updatedAt: p.arrivalTime,
    createdById: 'system',
    createdByName: 'Système',
  }));
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function MockRepositoryProvider({ children }: { children: React.ReactNode }) {
  // ── Phase 5: Notifications ──────────────────────────────────────────────
  const { addNotification } = useNotifications();

  // ── Phase 1 & 2: Clinical state ────────────────────────────────────────
  const [patients,         setPatients]         = useState<EmergencyPatient[]>(() => MOCK_EMERGENCY_PATIENTS.map(p => ({ ...p })));
  const [encounters,       setEncounters]       = useState<Encounter[]>(() => buildInitialEncounters(MOCK_EMERGENCY_PATIENTS));
  const [labOrders,        setLabOrders]        = useState<RepoLabOrder[]>([]);
  const [imagingOrders,    setImagingOrders]    = useState<RepoImagingOrder[]>([]);
  const [prescriptions,    setPrescriptions]    = useState<RepoPrescription[]>([]);
  const [surgicalRequests, setSurgicalRequests] = useState<SurgicalRequest[]>([]);
  const [icuAdmissions,    setICUAdmissions]    = useState<ICUAdmission[]>([]);

  // ── Phase 6: Real-time occupancy ────────────────────────────────────────
  const [rooms,      setRooms]      = useState<EmergencyRoom[]>(() => MOCK_EMERGENCY_ROOMS.map(r => ({ ...r })));
  const [erDoctors,  setErDoctors]  = useState<EmergencyDoctor[]>(() => MOCK_EMERGENCY_DOCTORS.map(d => ({ ...d })));
  const [erNurses,   setErNurses]   = useState<EmergencyNurse[]>(() => MOCK_EMERGENCY_NURSES.map(n => ({ ...n })));
  const [ambulances, setAmbulances] = useState<Ambulance[]>(() => MOCK_EMERGENCY_AMBULANCES.map(a => ({ ...a })));

  // ── Phase 7: Global audit ────────────────────────────────────────────────
  const [globalAudit, setGlobalAudit] = useState<RepoAuditEntry[]>([]);

  // ── Internal: Audit append ────────────────────────────────────────────────
  const audit = useCallback((
    module: RepoModule,
    action: string,
    ctx: AuditCtx,
    extras?: Partial<Pick<RepoAuditEntry, 'patientId' | 'encounterId' | 'visitId' | 'oldValue' | 'newValue' | 'resourceId' | 'resourceType'>>,
  ) => {
    setGlobalAudit(prev => [{
      id: genId('aud'),
      timestamp: new Date().toISOString(),
      module, action,
      userId: ctx.userId, userName: ctx.userName, userRole: ctx.userRole,
      ip: MOCK_IP,
      ...extras,
    }, ...prev]);
  }, []);

  // ── Internal: Patient patch ────────────────────────────────────────────────
  const patchPatient = useCallback((patientId: string, patch: Partial<EmergencyPatient>) => {
    setPatients(prev => prev.map(p => p.id === patientId ? { ...p, ...patch } : p));
  }, []);

  // ── Internal: Encounter sync ───────────────────────────────────────────────
  const syncEncounterWorkflow = useCallback((patientId: string, workflowStatus: string, patch?: Partial<Encounter>) => {
    setEncounters(prev => prev.map(e =>
      e.id === `enc-${patientId}`
        ? { ...e, workflowStatus, updatedAt: new Date().toISOString(), ...patch }
        : e,
    ));
  }, []);

  // ── Internal: Occupancy helpers ────────────────────────────────────────────
  const assignPatientToRoom = useCallback((roomId: string, patientId: string) => {
    setRooms(prev => prev.map(r => {
      if (r.id !== roomId && r.name !== roomId) return r;
      const ids = r.patientIds ?? [];
      if (ids.includes(patientId)) return r;
      return { ...r, occupied: Math.min(r.occupied + 1, r.capacity), patientIds: [...ids, patientId] };
    }));
  }, []);

  const freePatientFromRoom = useCallback((roomId: string, patientId: string) => {
    setRooms(prev => prev.map(r => {
      if (r.id !== roomId && r.name !== roomId) return r;
      const ids = (r.patientIds ?? []).filter(id => id !== patientId);
      return { ...r, occupied: Math.max(0, r.occupied - 1), patientIds: ids };
    }));
  }, []);

  const assignPatientToDoctor = useCallback((doctorName: string, patientId: string) => {
    setErDoctors(prev => prev.map(d => {
      if (d.name !== doctorName) return d;
      const ids = d.patientIds ?? [];
      if (ids.includes(patientId)) return d;
      return { ...d, patientCount: d.patientCount + 1, patientIds: [...ids, patientId] };
    }));
  }, []);

  const freePatientFromDoctor = useCallback((patientId: string) => {
    setErDoctors(prev => prev.map(d => {
      if (!(d.patientIds ?? []).includes(patientId)) return d;
      return {
        ...d,
        patientCount: Math.max(0, d.patientCount - 1),
        patientIds: (d.patientIds ?? []).filter(id => id !== patientId),
      };
    }));
  }, []);

  const assignPatientToNurse = useCallback((nurseName: string, patientId: string) => {
    setErNurses(prev => prev.map(n => n.name !== nurseName ? n : { ...n, patientCount: n.patientCount + 1 }));
  }, []);

  const freePatientFromNurse = useCallback((patientId: string) => {
    // Nurses don't track patientIds in the type; decrement the nurse associated via encounter
    setEncounters(prev => {
      const enc = prev.find(e => e.patientId === patientId);
      if (!enc?.primaryNurseName) return prev;
      const nurseName = enc.primaryNurseName;
      setErNurses(n => n.map(nurse =>
        nurse.name === nurseName ? { ...nurse, patientCount: Math.max(0, nurse.patientCount - 1) } : nurse
      ));
      return prev;
    });
  }, []);

  const updateAmbulanceStatus = useCallback((ambulanceId: string, status: AmbulanceStatus, patch?: Partial<Ambulance>) => {
    setAmbulances(prev => prev.map(a =>
      a.id === ambulanceId ? { ...a, status, ...patch } : a
    ));
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 1: Encounter mutations
  // ─────────────────────────────────────────────────────────────────────────

  const createEncounter = useCallback((enc: Omit<Encounter, 'id' | 'openedAt' | 'updatedAt' | 'linkedRecords'> & { id?: string }): string => {
    const id = enc.id ?? `enc-${enc.patientId}`;
    const now = new Date().toISOString();
    const full: Encounter = {
      ...enc,
      id,
      openedAt: now,
      updatedAt: now,
      linkedRecords: [],
      status: 'open',
    };
    setEncounters(prev => {
      // Don't create a duplicate for same patient if one already exists
      if (prev.some(e => e.id === id)) return prev;
      return [...prev, full];
    });
    audit('urgences', 'Encounter ouvert', { userId: enc.createdById, userName: enc.createdByName, userRole: 'system' }, {
      patientId: enc.patientId, encounterId: id,
    });
    return id;
  }, [audit]);

  const closeEncounter = useCallback((encounterId: string, reason: string, ctx: AuditCtx) => {
    const now = new Date().toISOString();
    setEncounters(prev => prev.map(e =>
      e.id === encounterId ? { ...e, status: 'closed', closedAt: now, closeReason: reason, updatedAt: now } : e
    ));
    audit('urgences', `Encounter clôturé: ${reason}`, ctx, { encounterId });
  }, [audit]);

  const linkRecordToEncounter = useCallback((encounterId: string, record: EncounterLinkedRecord) => {
    setEncounters(prev => prev.map(e =>
      e.id === encounterId
        ? { ...e, linkedRecords: [...e.linkedRecords, record], updatedAt: new Date().toISOString() }
        : e
    ));
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // QUERIES
  // ─────────────────────────────────────────────────────────────────────────

  const getPatient              = useCallback((id: string) => patients.find(p => p.id === id) ?? null, [patients]);
  const getEncounterById        = useCallback((id: string) => encounters.find(e => e.id === id) ?? null, [encounters]);
  const getEncountersByPatient  = useCallback((pid: string) => encounters.filter(e => e.patientId === pid), [encounters]);
  const getLabOrdersByPatient   = useCallback((pid: string) => labOrders.filter(o => o.patientId === pid), [labOrders]);
  const getImagingOrdersByPatient = useCallback((pid: string) => imagingOrders.filter(o => o.patientId === pid), [imagingOrders]);
  const getPrescriptionsByPatient = useCallback((pid: string) => prescriptions.filter(p => p.patientId === pid), [prescriptions]);
  const getSurgicalsByPatient   = useCallback((pid: string) => surgicalRequests.filter(s => s.patientId === pid), [surgicalRequests]);
  const getICUsByPatient        = useCallback((pid: string) => icuAdmissions.filter(i => i.patientId === pid), [icuAdmissions]);

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 4: Workflow — canTransitionPatient
  // ─────────────────────────────────────────────────────────────────────────

  const canTransitionPatient = useCallback((patientId: string, to: EmergencyPatientStatus): boolean => {
    const p = patients.find(pt => pt.id === patientId);
    if (!p) return false;
    return canTransition(p.status, to);
  }, [patients]);

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 2 + 4 + 6 + 7: startCare
  // ─────────────────────────────────────────────────────────────────────────

  const startCare = useCallback((
    patientId: string,
    ctx: AuditCtx & { assignedDoctor?: string; assignedNurse?: string; assignedRoom?: string },
  ) => {
    const p = patients.find(pt => pt.id === patientId);
    if (!p) return;

    // Phase 4: workflow gate — only valid if patient is waiting for care
    if (!canStartCare(p.status)) {
      console.warn(`[WorkflowEngine] startCare blocked: ${p.status} → en_soins not allowed.`);
      return;
    }

    const oldStatus = p.status;

    // Phase 2: update patient
    setPatients(prev => prev.map(pt => pt.id !== patientId ? pt : {
      ...pt,
      status: 'en_soins' as EmergencyPatientStatus,
      ...(ctx.assignedDoctor ? { assignedDoctor: ctx.assignedDoctor } : {}),
      ...(ctx.assignedNurse  ? { assignedNurse:  ctx.assignedNurse  } : {}),
      ...(ctx.assignedRoom   ? { assignedRoom:   ctx.assignedRoom   } : {}),
    }));

    // Phase 6: occupancy
    if (ctx.assignedRoom)   assignPatientToRoom(ctx.assignedRoom, patientId);
    if (ctx.assignedDoctor) assignPatientToDoctor(ctx.assignedDoctor, patientId);
    if (ctx.assignedNurse)  assignPatientToNurse(ctx.assignedNurse, patientId);

    // Phase 1: sync encounter
    syncEncounterWorkflow(patientId, 'en_soins', {
      primaryDoctorName: ctx.assignedDoctor,
      primaryNurseName: ctx.assignedNurse,
      roomName: ctx.assignedRoom,
    });

    // Phase 7: audit
    audit('urgences', 'Prise en charge démarrée', ctx, {
      patientId, encounterId: `enc-${patientId}`,
      oldValue: oldStatus, newValue: 'en_soins',
    });
  }, [patients, assignPatientToRoom, assignPatientToDoctor, assignPatientToNurse, syncEncounterWorkflow, audit]);

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 4 + 7: updatePatientStatus
  // ─────────────────────────────────────────────────────────────────────────

  const updatePatientStatus = useCallback((
    patientId: string,
    status:    EmergencyPatientStatus,
    ctx:       AuditCtx,
    notes?:    string,
  ) => {
    const p = patients.find(pt => pt.id === patientId);
    if (!p) return;

    // Phase 4: enforce workflow transitions
    if (!canTransition(p.status, status)) {
      console.warn(`[WorkflowEngine] Rejected: ${p.status} → ${status} is not a valid transition.`);
      return;
    }

    patchPatient(patientId, { status });
    syncEncounterWorkflow(patientId, status);
    audit('urgences', `Statut: ${TRANSITION_LABELS[status] ?? status}`, ctx, {
      patientId, encounterId: `enc-${patientId}`,
      oldValue: p.status, newValue: status,
      ...(notes ? { resourceType: notes } : {}),
    });
  }, [patients, patchPatient, syncEncounterWorkflow, audit]);

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 2 + 5 + 7: Cross-module record creation
  // ─────────────────────────────────────────────────────────────────────────

  const createLabOrder = useCallback((order: Omit<RepoLabOrder, 'id' | 'requestedAt'>): string => {
    const id = genId('lab');
    const full: RepoLabOrder = { ...order, id, requestedAt: new Date().toISOString() };
    setLabOrders(prev => [...prev, full]);

    // Phase 1: link to encounter
    if (order.encounterId) {
      linkRecordToEncounter(order.encounterId, {
        recordType: 'lab_order', recordId: id,
        summary: `${order.test} (${order.urgency})`,
        createdAt: full.requestedAt,
      });
    }

    // Phase 5: notify laboratory
    addNotification({
      title: 'Nouvelle analyse demandée',
      body: `${order.test} — ${order.patientName} (${order.urgency.toUpperCase()})`,
      type: order.urgency === 'STAT' ? 'warning' : 'info',
      link: '/laboratory',
    });

    // Phase 7: audit
    audit('laboratoire', `Analyse demandée: ${order.test}`, {
      userId: order.requestedById, userName: order.requestedBy, userRole: 'medecin',
    }, { patientId: order.patientId, encounterId: order.encounterId, visitId: order.visitId, resourceId: id, resourceType: 'LabOrder' });

    return id;
  }, [linkRecordToEncounter, addNotification, audit]);

  const createImagingOrder = useCallback((order: Omit<RepoImagingOrder, 'id' | 'requestedAt'>): string => {
    const id = genId('img');
    const full: RepoImagingOrder = { ...order, id, requestedAt: new Date().toISOString() };
    setImagingOrders(prev => [...prev, full]);

    // Phase 1: link to encounter
    if (order.encounterId) {
      linkRecordToEncounter(order.encounterId, {
        recordType: 'imaging_order', recordId: id,
        summary: `${order.exam} — ${order.region}`,
        createdAt: full.requestedAt,
      });
    }

    // Phase 5: notify radiology
    addNotification({
      title: 'Nouvelle imagerie demandée',
      body: `${order.exam} (${order.region}) — ${order.patientName}`,
      type: order.urgency === 'STAT' ? 'warning' : 'info',
      link: '/imaging',
    });

    audit('imagerie', `Imagerie demandée: ${order.exam}`, {
      userId: order.requestedById, userName: order.requestedBy, userRole: 'medecin',
    }, { patientId: order.patientId, encounterId: order.encounterId, visitId: order.visitId, resourceId: id, resourceType: 'ImagingOrder' });

    return id;
  }, [linkRecordToEncounter, addNotification, audit]);

  const createPrescription = useCallback((rx: Omit<RepoPrescription, 'id' | 'prescribedAt'>): string => {
    const id = genId('rx');
    const full: RepoPrescription = { ...rx, id, prescribedAt: new Date().toISOString() };
    setPrescriptions(prev => [...prev, full]);

    // Phase 1: link to encounter
    if (rx.encounterId) {
      linkRecordToEncounter(rx.encounterId, {
        recordType: 'prescription', recordId: id,
        summary: `${rx.drug} ${rx.dosage} ${rx.route}`,
        createdAt: full.prescribedAt,
      });
    }

    // Phase 5: notify pharmacy
    addNotification({
      title: 'Nouvelle prescription',
      body: `${rx.drug} ${rx.dosage} — ${rx.patientName}`,
      type: 'info',
      link: '/pharmacy',
    });

    audit('urgences', `Prescription: ${rx.drug} ${rx.dosage}`, {
      userId: rx.prescribedById, userName: rx.prescribedBy, userRole: 'medecin',
    }, { patientId: rx.patientId, encounterId: rx.encounterId, visitId: rx.visitId, resourceId: id, resourceType: 'Prescription' });

    return id;
  }, [linkRecordToEncounter, addNotification, audit]);

  const createSurgicalRequest = useCallback((req: Omit<SurgicalRequest, 'id' | 'createdAt'>): string => {
    const id = genId('surg');
    const full: SurgicalRequest = { ...req, id, createdAt: new Date().toISOString(), status: 'demande' };
    setSurgicalRequests(prev => [...prev, full]);

    // Phase 5: notify bloc
    addNotification({
      title: 'Demande de bloc opératoire',
      body: `${req.intervention ?? 'Intervention'} — ${req.patientName}`,
      type: 'warning',
      link: '/bloc',
    });

    audit('bloc', `Demande bloc: ${req.intervention ?? 'À déterminer'}`, {
      userId: req.requestedById, userName: req.requestedBy, userRole: 'medecin',
    }, { patientId: req.patientId, visitId: req.visitId, resourceId: id, resourceType: 'SurgicalRequest' });

    return id;
  }, [addNotification, audit]);

  const createICUAdmission = useCallback((adm: Omit<ICUAdmission, 'id' | 'createdAt'>): string => {
    const id = genId('icu');
    const full: ICUAdmission = { ...adm, id, createdAt: new Date().toISOString(), status: 'demande' };
    setICUAdmissions(prev => [...prev, full]);

    // Phase 5: notify ICU
    addNotification({
      title: 'Admission en réanimation',
      body: `${adm.motif} — ${adm.patientName}${adm.icuBed ? ` (${adm.icuBed})` : ''}`,
      type: 'error',
      link: '/icu',
    });

    audit('reanimation', `Admission réanimation: ${adm.motif}`, {
      userId: adm.requestedById, userName: adm.requestedBy, userRole: 'medecin',
    }, { patientId: adm.patientId, visitId: adm.visitId, resourceId: id, resourceType: 'ICUAdmission' });

    return id;
  }, [addNotification, audit]);

  const updateLabOrderStatus = useCallback((
    orderId: string, status: RepoLabOrder['status'], result?: string, isCritical?: boolean,
  ) => {
    setLabOrders(prev => prev.map(o =>
      o.id !== orderId ? o : {
        ...o, status,
        ...(result ? { result, resultAt: new Date().toISOString() } : {}),
        ...(isCritical !== undefined ? { isCritical } : {}),
      }
    ));
    if (isCritical && result) {
      addNotification({ title: '⚠ Résultat critique', body: result, type: 'error', link: '/laboratory' });
    }
  }, [addNotification]);

  const updateImagingStatus = useCallback((
    orderId: string, status: RepoImagingOrder['status'], result?: string,
  ) => {
    setImagingOrders(prev => prev.map(o =>
      o.id !== orderId ? o : {
        ...o, status,
        ...(result ? { result, resultAt: new Date().toISOString() } : {}),
      }
    ));
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 6: Visit closure — free occupancy + close encounter
  // ─────────────────────────────────────────────────────────────────────────

  /** Internal: free all resources (room, doctor, nurse) when a patient leaves. */
  const freeOccupancy = useCallback((patientId: string) => {
    const p = patients.find(pt => pt.id === patientId);
    if (p?.assignedRoom)   freePatientFromRoom(p.assignedRoom, patientId);
    freePatientFromDoctor(patientId);
    freePatientFromNurse(patientId);
  }, [patients, freePatientFromRoom, freePatientFromDoctor, freePatientFromNurse]);

  const closeVisitDischarged = useCallback((patientId: string, ctx: AuditCtx) => {
    patchPatient(patientId, { status: 'sorti' });
    freeOccupancy(patientId);
    syncEncounterWorkflow(patientId, 'sorti');
    closeEncounter(`enc-${patientId}`, 'domicile', ctx);
    audit('urgences', 'Sortie vers domicile', ctx, {
      patientId, encounterId: `enc-${patientId}`, oldValue: 'en_soins', newValue: 'sorti',
    });
  }, [patchPatient, freeOccupancy, syncEncounterWorkflow, closeEncounter, audit]);

  const closeVisitHospitalized = useCallback((patientId: string, admissionId: string, ctx: AuditCtx) => {
    patchPatient(patientId, { status: 'hospitalise' });
    freeOccupancy(patientId);
    syncEncounterWorkflow(patientId, 'hospitalise');
    closeEncounter(`enc-${patientId}`, 'hospitalisation', ctx);
    // Phase 5: notify admissions
    addNotification({
      title: 'Nouvelle hospitalisation',
      body: `Patient transféré depuis les urgences`,
      type: 'info',
      link: '/admissions',
    });
    audit('hospitalisation', 'Hospitalisation', ctx, {
      patientId, encounterId: `enc-${patientId}`, newValue: 'hospitalise',
      resourceId: admissionId, resourceType: 'Admission',
    });
  }, [patchPatient, freeOccupancy, syncEncounterWorkflow, closeEncounter, addNotification, audit]);

  const closeVisitBloc = useCallback((patientId: string, surgicalRequestId: string, ctx: AuditCtx) => {
    patchPatient(patientId, { status: 'hospitalise' });
    freeOccupancy(patientId);
    syncEncounterWorkflow(patientId, 'hospitalise');
    closeEncounter(`enc-${patientId}`, 'bloc', ctx);
    audit('bloc', 'Transfert bloc opératoire', ctx, {
      patientId, encounterId: `enc-${patientId}`, newValue: 'hospitalise',
      resourceId: surgicalRequestId, resourceType: 'SurgicalRequest',
    });
  }, [patchPatient, freeOccupancy, syncEncounterWorkflow, closeEncounter, audit]);

  const closeVisitICU = useCallback((patientId: string, icuAdmissionId: string, ctx: AuditCtx) => {
    patchPatient(patientId, { status: 'hospitalise' });
    freeOccupancy(patientId);
    syncEncounterWorkflow(patientId, 'hospitalise');
    closeEncounter(`enc-${patientId}`, 'reanimation', ctx);
    audit('reanimation', 'Transfert réanimation', ctx, {
      patientId, encounterId: `enc-${patientId}`, newValue: 'hospitalise',
      resourceId: icuAdmissionId, resourceType: 'ICUAdmission',
    });
  }, [patchPatient, freeOccupancy, syncEncounterWorkflow, closeEncounter, audit]);

  const closeVisitTransferred = useCallback((patientId: string, ctx: AuditCtx, destEtablissement?: string) => {
    patchPatient(patientId, { status: 'transfere' });
    freeOccupancy(patientId);
    syncEncounterWorkflow(patientId, 'transfere');
    closeEncounter(`enc-${patientId}`, 'transfert', ctx);
    audit('urgences', `Transfert: ${destEtablissement ?? 'autre établissement'}`, ctx, {
      patientId, encounterId: `enc-${patientId}`, newValue: 'transfere',
    });
  }, [patchPatient, freeOccupancy, syncEncounterWorkflow, closeEncounter, audit]);

  const closeVisitDeceased = useCallback((patientId: string, ctx: AuditCtx, provisionalCause?: string) => {
    patchPatient(patientId, { status: 'decede' });
    freeOccupancy(patientId);
    syncEncounterWorkflow(patientId, 'decede');
    closeEncounter(`enc-${patientId}`, 'deces', ctx);
    audit('urgences', `Décès${provisionalCause ? ` — ${provisionalCause}` : ''}`, ctx, {
      patientId, encounterId: `enc-${patientId}`, newValue: 'decede',
    });
  }, [patchPatient, freeOccupancy, syncEncounterWorkflow, closeEncounter, audit]);

  const addGlobalAudit = useCallback((entry: Omit<RepoAuditEntry, 'id' | 'timestamp' | 'ip'>) => {
    setGlobalAudit(prev => [{
      ...entry, id: genId('aud'), timestamp: new Date().toISOString(), ip: MOCK_IP,
    }, ...prev]);
  }, []);

  return (
    <MockRepositoryContext.Provider value={{
      // Encounters
      encounters, getEncounterById, getEncountersByPatient,
      createEncounter, closeEncounter, linkRecordToEncounter,
      // Clinical data
      patients, labOrders, imagingOrders, prescriptions, surgicalRequests, icuAdmissions,
      // Occupancy
      rooms, erDoctors, erNurses, ambulances,
      assignPatientToRoom, freePatientFromRoom, updateAmbulanceStatus,
      // Audit
      globalAudit, addGlobalAudit,
      // Queries
      getPatient, getLabOrdersByPatient, getImagingOrdersByPatient,
      getPrescriptionsByPatient, getSurgicalsByPatient, getICUsByPatient,
      // Workflow
      canTransitionPatient,
      // Mutations
      startCare, updatePatientStatus,
      createLabOrder, createImagingOrder, createPrescription,
      createSurgicalRequest, createICUAdmission,
      updateLabOrderStatus, updateImagingStatus,
      closeVisitDischarged, closeVisitHospitalized, closeVisitBloc,
      closeVisitICU, closeVisitTransferred, closeVisitDeceased,
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
