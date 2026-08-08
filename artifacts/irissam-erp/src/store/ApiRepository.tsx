/**
 * ApiRepository — PostgreSQL-backed implementation of MockRepositoryContextType.
 *
 * Strategy: "write-through" hybrid
 *  - Clinical records (encounters, lab orders, imaging orders, prescriptions, audit)
 *    are loaded from the API on mount and written to both local state + the API on mutation.
 *    → These survive page refresh.
 *  - ER/occupancy state (patients, rooms, beds, ambulances, operating rooms) remains
 *    in-memory from mock seeds (no real-time DB endpoints required for those in this phase).
 *
 * To switch to this provider set VITE_USE_API_REPOSITORY=true in the environment.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { MOCK_EMERGENCY_PATIENTS, MOCK_EMERGENCY_ROOMS, MOCK_EMERGENCY_AMBULANCES, MOCK_EMERGENCY_DOCTORS, MOCK_EMERGENCY_NURSES } from '@/mock/emergency';
import { MOCK_OCCUPANCY_BEDS, MOCK_ICU_BEDS, MOCK_OPERATING_ROOMS } from '@/mock/occupancy';
import { useNotifications } from './NotificationsContext';
import { canTransition, canStartCare, TRANSITION_LABELS } from '@/engine/workflowEngine';
import { validateLabOrder, validateImagingOrder } from '@/engine/validationEngine';
import type { EmergencyPatient, EmergencyPatientStatus, EmergencyRoom, EmergencyDoctor, EmergencyNurse, Ambulance, AmbulanceStatus } from '@/types/emergency';
import type { Encounter, EncounterLinkedRecord } from '@/types/encounter';
import type {
  RepoAuditEntry, RepoLabOrder, RepoImagingOrder, RepoPrescription,
  SurgicalRequest, ICUAdmission, AuditCtx, RepoModule,
  OccupancyBed, OccupancyICUBed, OperatingRoom, OperatingRoomSlot,
  BedFilterParams, BedStats, OperatingRoomStatus,
} from '@/types/repository';
import { MockRepositoryContext, type MockRepositoryContextType } from './MockRepository';
import { apiClient } from '@/services/api/client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MOCK_IP = '127.0.0.1';

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

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

/** Map API lab-order response to local RepoLabOrder shape.
 *
 * The backend /result endpoint sets status = "critique" for critical results.
 * The frontend type only knows 'demandee'|'prelevee'|'en_cours'|'validee'|'annulee'.
 * Normalize "critique" → "validee" + isCritical: true so UI status maps never
 * receive an unknown key (which would crash rendering in Laboratory.tsx etc.).
 */
function mapApiLabOrder(o: Record<string, unknown>): RepoLabOrder {
  const rawStatus = String(o.status ?? 'demandee');
  const isCriticalFromStatus = rawStatus === 'critique';
  const normalizedStatus: RepoLabOrder['status'] =
    isCriticalFromStatus ? 'validee' : (rawStatus as RepoLabOrder['status']);

  return {
    id:           String(o.id ?? ''),
    encounterId:  o.encounterId != null ? String(o.encounterId) : undefined,
    visitId:      o.visitId != null ? String(o.visitId) : '',
    patientId:    String(o.patientId ?? ''),
    patientName:  String(o.patientName ?? ''),
    test:         String(o.test ?? ''),
    category:     String(o.category ?? 'biologie'),
    urgency:      (o.urgency as RepoLabOrder['urgency']) ?? 'routine',
    requestedBy:  String(o.requestedByName ?? o.requestedBy ?? ''),
    requestedById: String(o.requestedById ?? ''),
    requestedAt:  String(o.requestedAt ?? new Date().toISOString()),
    status:       normalizedStatus,
    result:       o.result != null ? String(o.result) : undefined,
    isCritical:   Boolean(o.isCritical) || isCriticalFromStatus,
    resultAt:     o.resultAt != null ? String(o.resultAt) : undefined,
    validatedBy:  o.validatedByName != null ? String(o.validatedByName) : undefined,
    laboratory:   o.laboratory != null ? String(o.laboratory) : undefined,
    sourceModule: (o.sourceModule as RepoLabOrder['sourceModule']) ?? 'urgences',
    updatedAt:    o.updatedAt != null ? String(o.updatedAt) : undefined,
  };
}

/** Map API imaging-order response to local RepoImagingOrder shape. */
function mapApiImagingOrder(o: Record<string, unknown>): RepoImagingOrder {
  return {
    id:           String(o.id ?? ''),
    encounterId:  o.encounterId != null ? String(o.encounterId) : undefined,
    visitId:      o.visitId != null ? String(o.visitId) : '',
    patientId:    String(o.patientId ?? ''),
    patientName:  String(o.patientName ?? ''),
    exam:         String(o.exam ?? ''),
    region:       String(o.region ?? ''),
    side:         o.side != null ? String(o.side) : undefined,
    urgency:      (o.urgency as RepoImagingOrder['urgency']) ?? 'routine',
    withContrast: Boolean(o.withContrast),
    requestedBy:  String(o.requestedByName ?? o.requestedBy ?? ''),
    requestedById: String(o.requestedById ?? ''),
    requestedAt:  String(o.requestedAt ?? new Date().toISOString()),
    status:       (o.status as RepoImagingOrder['status']) ?? 'demandee',
    result:       o.result != null ? String(o.result) : undefined,
    resultAt:     o.resultAt != null ? String(o.resultAt) : undefined,
    report:       o.report != null ? String(o.report) : undefined,
    reportedBy:   o.reportedByName != null ? String(o.reportedByName) : undefined,
    reportedAt:   o.reportedAt != null ? String(o.reportedAt) : undefined,
    interpretedBy: o.interpretedByName != null ? String(o.interpretedByName) : undefined,
    interpretedAt: o.interpretedAt != null ? String(o.interpretedAt) : undefined,
    sourceModule: (o.sourceModule as RepoImagingOrder['sourceModule']) ?? 'urgences',
    updatedAt:    o.updatedAt != null ? String(o.updatedAt) : undefined,
  };
}

/** Map API prescription response to local RepoPrescription shape. */
function mapApiPrescription(p: Record<string, unknown>): RepoPrescription {
  return {
    id:              String(p.id ?? ''),
    encounterId:     p.encounterId != null ? String(p.encounterId) : undefined,
    visitId:         p.visitId != null ? String(p.visitId) : '',
    patientId:       String(p.patientId ?? ''),
    patientName:     String(p.patientName ?? ''),
    drug:            String(p.drug ?? ''),
    dosage:          String(p.dosage ?? ''),
    route:           String(p.route ?? ''),
    frequency:       String(p.frequency ?? ''),
    duration:        p.duration != null ? String(p.duration) : undefined,
    prescribedBy:    String(p.prescribedByName ?? p.prescribedBy ?? ''),
    prescribedById:  String(p.prescribedById ?? ''),
    prescribedAt:    String(p.prescribedAt ?? new Date().toISOString()),
    status:          (p.status as RepoPrescription['status']) ?? 'prescrit',
    preparedBy:      p.preparedByName != null ? String(p.preparedByName) : undefined,
    preparedAt:      p.preparedAt != null ? String(p.preparedAt) : undefined,
    dispensedBy:     p.dispensedByName != null ? String(p.dispensedByName) : undefined,
    dispensedAt:     p.dispensedAt != null ? String(p.dispensedAt) : undefined,
    dispenserComment: p.dispenserComment != null ? String(p.dispenserComment) : undefined,
    sourceModule:    (p.sourceModule as RepoPrescription['sourceModule']) ?? 'urgences',
    updatedAt:       p.updatedAt != null ? String(p.updatedAt) : undefined,
  };
}

/** Map API encounter response to local Encounter shape. */
function mapApiEncounter(e: Record<string, unknown>): Encounter {
  return {
    id:               String(e.id ?? ''),
    patientId:        String(e.patientId ?? ''),
    patientName:      String(e.patientName ?? ''),
    type:             (e.type as Encounter['type']) ?? 'urgence',
    status:           (e.status as Encounter['status']) ?? 'open',
    chiefComplaint:   e.chiefComplaint != null ? String(e.chiefComplaint) : '',
    sourceRecordId:   e.sourceRecordId != null ? String(e.sourceRecordId) : '',
    sourceModule:     (e.sourceModule as Encounter['sourceModule']) ?? 'urgences',
    linkedRecords:    Array.isArray(e.linkedRecords) ? e.linkedRecords as EncounterLinkedRecord[] : [],
    workflowStatus:   e.workflowStatus != null ? String(e.workflowStatus) : undefined,
    primaryDoctorName: e.primaryDoctorName != null ? String(e.primaryDoctorName) : undefined,
    openedAt:         String(e.openedAt ?? e.updatedAt ?? new Date().toISOString()),
    updatedAt:        String(e.updatedAt ?? new Date().toISOString()),
    closedAt:         e.closedAt != null ? String(e.closedAt) : undefined,
    closeReason:      e.closeReason != null ? String(e.closeReason) : undefined,
    createdById:      'system',
    createdByName:    'Système',
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ApiRepositoryProvider({ children }: { children: React.ReactNode }) {
  const { addNotification } = useNotifications();

  // ── In-memory ER state (seed from mock) ─────────────────────────────────────
  const [patients,         setPatients]         = useState<EmergencyPatient[]>(() => MOCK_EMERGENCY_PATIENTS.map(p => ({ ...p })));
  const [rooms,            setRooms]            = useState<EmergencyRoom[]>(() => MOCK_EMERGENCY_ROOMS.map(r => ({ ...r })));
  const [erDoctors,        setErDoctors]        = useState<EmergencyDoctor[]>(() => MOCK_EMERGENCY_DOCTORS.map(d => ({ ...d })));
  const [erNurses,         setErNurses]         = useState<EmergencyNurse[]>(() => MOCK_EMERGENCY_NURSES.map(n => ({ ...n })));
  const [ambulances,       setAmbulances]       = useState<Ambulance[]>(() => MOCK_EMERGENCY_AMBULANCES.map(a => ({ ...a })));

  // ── In-memory occupancy state ────────────────────────────────────────────────
  const [beds,           setBeds]           = useState<OccupancyBed[]>(() => MOCK_OCCUPANCY_BEDS.map(b => ({ ...b })));
  const [icuBeds,        setICUBeds]        = useState<OccupancyICUBed[]>(() => MOCK_ICU_BEDS.map(b => ({ ...b })));
  const [operatingRooms, setOperatingRooms] = useState<OperatingRoom[]>(() => MOCK_OPERATING_ROOMS.map(r => ({ ...r, slots: r.slots.map(s => ({ ...s })) })));

  // ── API-backed clinical state ────────────────────────────────────────────────
  const [encounters,       setEncounters]       = useState<Encounter[]>(() => buildInitialEncounters(MOCK_EMERGENCY_PATIENTS));
  const [labOrders,        setLabOrders]        = useState<RepoLabOrder[]>([]);
  const [imagingOrders,    setImagingOrders]    = useState<RepoImagingOrder[]>([]);
  const [prescriptions,    setPrescriptions]    = useState<RepoPrescription[]>([]);
  const [surgicalRequests, setSurgicalRequests] = useState<SurgicalRequest[]>([]);
  const [icuAdmissions,    setICUAdmissions]    = useState<ICUAdmission[]>([]);

  // ── Audit (write-through to API) ─────────────────────────────────────────────
  const [globalAudit, setGlobalAudit] = useState<RepoAuditEntry[]>([]);

  // ── Loading flag ─────────────────────────────────────────────────────────────
  const initialized = useRef(false);

  // ─────────────────────────────────────────────────────────────────────────────
  // MOUNT: Load clinical records from the API
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function loadClinicalData() {
      try {
        const [labRes, imgRes, rxRes, encRes] = await Promise.allSettled([
          apiClient.request<Record<string, unknown>[]>('/lab-orders?limit=500'),
          apiClient.request<Record<string, unknown>[]>('/imaging-orders?limit=500'),
          apiClient.request<Record<string, unknown>[]>('/prescriptions?limit=500'),
          apiClient.request<Record<string, unknown>[]>('/encounters?limit=500'),
        ]);

        if (labRes.status === 'fulfilled' && Array.isArray(labRes.value)) {
          setLabOrders(labRes.value.map(mapApiLabOrder));
        }
        if (imgRes.status === 'fulfilled' && Array.isArray(imgRes.value)) {
          setImagingOrders(imgRes.value.map(mapApiImagingOrder));
        }
        if (rxRes.status === 'fulfilled' && Array.isArray(rxRes.value)) {
          setPrescriptions(rxRes.value.map(mapApiPrescription));
        }
        if (encRes.status === 'fulfilled' && Array.isArray(encRes.value)) {
          // Merge API encounters on top of mock seed encounters, avoiding duplicates
          setEncounters(prev => {
            const apiEncounters = (encRes.value as Record<string, unknown>[]).map(mapApiEncounter);
            const apiIds = new Set(apiEncounters.map(e => e.id));
            // Keep mock seed encounters that don't have a real DB counterpart
            const mockOnly = prev.filter(e => !apiIds.has(e.id));
            return [...apiEncounters, ...mockOnly];
          });
        }
      } catch (err) {
        // Non-fatal — fall back to empty clinical state (mock seeds still work)
        console.warn('[ApiRepository] Failed to load clinical data from API:', err);
      }
    }

    loadClinicalData();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Internal helpers (identical to MockRepository)
  // ─────────────────────────────────────────────────────────────────────────────

  const audit = useCallback((
    module: RepoModule,
    action: string,
    ctx: AuditCtx,
    extras?: Partial<Pick<RepoAuditEntry, 'patientId' | 'encounterId' | 'visitId' | 'oldValue' | 'newValue' | 'resourceId' | 'resourceType'>>,
  ) => {
    const entry: RepoAuditEntry = {
      id: genId('aud'),
      timestamp: new Date().toISOString(),
      module, action,
      userId: ctx.userId, userName: ctx.userName, userRole: ctx.userRole,
      ip: MOCK_IP,
      ...extras,
    };
    setGlobalAudit(prev => [entry, ...prev]);
    // Fire-and-forget to API audit log
    apiClient.request('/audit-logs', {
      method: 'POST',
      body: {
        action,
        module,
        patientId:   extras?.patientId,
        encounterId: extras?.encounterId,
        entityId:    extras?.resourceId,
        oldValue:    extras?.oldValue,
        newValue:    extras?.newValue,
      },
    }).catch(() => { /* audit failures are never fatal */ });
  }, []);

  const patchPatient = useCallback((patientId: string, patch: Partial<EmergencyPatient>) => {
    setPatients(prev => prev.map(p => p.id === patientId ? { ...p, ...patch } : p));
  }, []);

  const syncEncounterWorkflow = useCallback((patientId: string, workflowStatus: string, patch?: Partial<Encounter>) => {
    setEncounters(prev => prev.map(e =>
      e.patientId === patientId
        ? { ...e, workflowStatus, updatedAt: new Date().toISOString(), ...patch }
        : e,
    ));
  }, []);

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

  const assignPatientToNurse = useCallback((nurseName: string, _patientId: string) => {
    setErNurses(prev => prev.map(n => n.name !== nurseName ? n : { ...n, patientCount: n.patientCount + 1 }));
  }, []);

  const freePatientFromNurse = useCallback((patientId: string) => {
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Encounter mutations (write-through to API)
  // ─────────────────────────────────────────────────────────────────────────────

  const linkRecordToEncounter = useCallback((encounterId: string, record: EncounterLinkedRecord) => {
    setEncounters(prev => prev.map(e =>
      e.id === encounterId
        ? { ...e, linkedRecords: [...e.linkedRecords, record], updatedAt: new Date().toISOString() }
        : e
    ));
  }, []);

  const createEncounter = useCallback((enc: Omit<Encounter, 'id' | 'openedAt' | 'updatedAt' | 'linkedRecords'> & { id?: string }): string => {
    const localId = enc.id ?? `enc-${enc.patientId}`;
    const now = new Date().toISOString();

    // Optimistic local insert
    const full: Encounter = {
      ...enc,
      id: localId,
      openedAt: now,
      updatedAt: now,
      linkedRecords: [],
      status: 'open',
    };
    setEncounters(prev => {
      if (prev.some(e => e.id === localId)) return prev;
      return [...prev, full];
    });

    // Persist to API (non-blocking); swap local ID for the real UUID returned
    apiClient.request<Record<string, unknown>>('/encounters', {
      method: 'POST',
      body: {
        patientId:        enc.patientId,
        patientName:      enc.patientName,
        type:             enc.type,
        chiefComplaint:   enc.chiefComplaint,
        sourceModule:     enc.sourceModule,
        primaryDoctorName: enc.primaryDoctorName,
        existingEncounterId: enc.id, // if caller already has a real UUID, return it
      },
    }).then(created => {
      if (!created?.id || String(created.id) === localId) return;
      // Replace the temporary local-only encounter with the DB-backed one
      setEncounters(prev => prev.map(e =>
        e.id === localId ? { ...e, id: String(created.id) } : e
      ));
    }).catch(() => { /* keep local version on API failure */ });

    audit('urgences', 'Encounter ouvert', { userId: enc.createdById, userName: enc.createdByName, userRole: 'system' }, {
      patientId: enc.patientId, encounterId: localId,
    });

    return localId;
  }, [audit]);

  const closeEncounter = useCallback((encounterId: string, reason: string, ctx: AuditCtx) => {
    const now = new Date().toISOString();
    setEncounters(prev => prev.map(e =>
      e.id === encounterId ? { ...e, status: 'closed', closedAt: now, closeReason: reason, updatedAt: now } : e
    ));
    // Persist to API
    apiClient.request(`/encounters/${encounterId}/status`, {
      method: 'PATCH',
      body: { status: 'closed', reason },
    }).catch(() => {});
    audit('urgences', `Encounter clôturé: ${reason}`, ctx, { encounterId });
  }, [audit]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Queries
  // ─────────────────────────────────────────────────────────────────────────────

  const getPatient              = useCallback((id: string) => patients.find(p => p.id === id) ?? null, [patients]);
  const getEncounterById        = useCallback((id: string) => encounters.find(e => e.id === id) ?? null, [encounters]);
  const getEncountersByPatient  = useCallback((pid: string) => encounters.filter(e => e.patientId === pid), [encounters]);
  const getLabOrdersByPatient   = useCallback((pid: string) => labOrders.filter(o => o.patientId === pid), [labOrders]);
  const getImagingOrdersByPatient = useCallback((pid: string) => imagingOrders.filter(o => o.patientId === pid), [imagingOrders]);
  const getPrescriptionsByPatient = useCallback((pid: string) => prescriptions.filter(p => p.patientId === pid), [prescriptions]);
  const getSurgicalsByPatient   = useCallback((pid: string) => surgicalRequests.filter(s => s.patientId === pid), [surgicalRequests]);
  const getICUsByPatient        = useCallback((pid: string) => icuAdmissions.filter(i => i.patientId === pid), [icuAdmissions]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Workflow
  // ─────────────────────────────────────────────────────────────────────────────

  const canTransitionPatient = useCallback((patientId: string, to: EmergencyPatientStatus): boolean => {
    const p = patients.find(pt => pt.id === patientId);
    if (!p) return false;
    return canTransition(p.status, to);
  }, [patients]);

  const startCare = useCallback((
    patientId: string,
    ctx: AuditCtx & { assignedDoctor?: string; assignedNurse?: string; assignedRoom?: string },
  ) => {
    const p = patients.find(pt => pt.id === patientId);
    if (!p) return;
    if (!canStartCare(p.status)) {
      console.warn(`[ApiRepository.startCare] blocked: ${p.status} → en_soins not allowed.`);
      return;
    }
    const oldStatus = p.status;
    setPatients(prev => prev.map(pt => pt.id !== patientId ? pt : {
      ...pt,
      status: 'en_soins' as EmergencyPatientStatus,
      ...(ctx.assignedDoctor ? { assignedDoctor: ctx.assignedDoctor } : {}),
      ...(ctx.assignedNurse  ? { assignedNurse:  ctx.assignedNurse  } : {}),
      ...(ctx.assignedRoom   ? { assignedRoom:   ctx.assignedRoom   } : {}),
    }));
    if (ctx.assignedRoom)   assignPatientToRoom(ctx.assignedRoom, patientId);
    if (ctx.assignedDoctor) assignPatientToDoctor(ctx.assignedDoctor, patientId);
    if (ctx.assignedNurse)  assignPatientToNurse(ctx.assignedNurse, patientId);
    syncEncounterWorkflow(patientId, 'en_soins', {
      primaryDoctorName: ctx.assignedDoctor,
      primaryNurseName:  ctx.assignedNurse,
      roomName:          ctx.assignedRoom,
    });
    audit('urgences', 'Prise en charge démarrée', ctx, {
      patientId, oldValue: oldStatus, newValue: 'en_soins',
    });
  }, [patients, assignPatientToRoom, assignPatientToDoctor, assignPatientToNurse, syncEncounterWorkflow, audit]);

  const updatePatientStatus = useCallback((
    patientId: string,
    status:    EmergencyPatientStatus,
    ctx:       AuditCtx,
    notes?:    string,
  ) => {
    const p = patients.find(pt => pt.id === patientId);
    if (!p) return;
    if (!canTransition(p.status, status)) {
      console.warn(`[ApiRepository] Rejected: ${p.status} → ${status} is not a valid transition.`);
      return;
    }
    patchPatient(patientId, { status });
    syncEncounterWorkflow(patientId, status);
    audit('urgences', `Statut: ${TRANSITION_LABELS[status] ?? status}`, ctx, {
      patientId, oldValue: p.status, newValue: status,
      ...(notes ? { resourceType: notes } : {}),
    });
  }, [patients, patchPatient, syncEncounterWorkflow, audit]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Clinical record creation (write-through to API)
  // ─────────────────────────────────────────────────────────────────────────────

  const createLabOrder = useCallback((order: Omit<RepoLabOrder, 'id' | 'requestedAt'>): string => {
    const guard = validateLabOrder({ requestedById: order.requestedById, test: order.test, patientId: order.patientId });
    if (!guard.valid) {
      console.error(`[ApiRepository.createLabOrder] Rejected — ${guard.error}`);
      return genId('lab-rejected');
    }
    const localId = genId('lab');
    const now = new Date().toISOString();
    const full: RepoLabOrder = { ...order, id: localId, requestedAt: now };

    // Optimistic local insert
    setLabOrders(prev => [...prev, full]);

    if (order.encounterId) {
      linkRecordToEncounter(order.encounterId, {
        recordType: 'lab_order', recordId: localId,
        summary: `${order.test} (${order.urgency})`,
        createdAt: now,
      });
    }

    addNotification({
      title: 'Nouvelle analyse demandée',
      body: `${order.test} — ${order.patientName} (${order.urgency.toUpperCase()})`,
      type: order.urgency === 'STAT' ? 'warning' : 'info',
      link: '/laboratory',
    });

    audit('laboratoire', `Analyse demandée: ${order.test}`, {
      userId: order.requestedById, userName: order.requestedBy, userRole: 'medecin',
    }, { patientId: order.patientId, encounterId: order.encounterId, visitId: order.visitId, resourceId: localId, resourceType: 'LabOrder' });

    // Persist to API; replace local ID with real UUID on success
    if (order.encounterId) {
      apiClient.request<Record<string, unknown>>('/lab-orders', {
        method: 'POST',
        body: {
          patientId:       order.patientId,
          encounterId:     order.encounterId,
          patientName:     order.patientName,
          visitId:         order.visitId,
          test:            order.test,
          category:        order.category,
          urgency:         order.urgency,
          requestedByName: order.requestedBy,
          laboratory:      order.laboratory,
          sourceModule:    order.sourceModule,
        },
      }).then(created => {
        if (!created?.id || String(created.id) === localId) return;
        setLabOrders(prev => prev.map(o =>
          o.id === localId ? { ...o, id: String(created.id) } : o
        ));
      }).catch(() => {});
    }

    return localId;
  }, [linkRecordToEncounter, addNotification, audit]);

  const createImagingOrder = useCallback((order: Omit<RepoImagingOrder, 'id' | 'requestedAt'>): string => {
    const guard = validateImagingOrder({ requestedById: order.requestedById, exam: order.exam, region: order.region, patientId: order.patientId });
    if (!guard.valid) {
      console.error(`[ApiRepository.createImagingOrder] Rejected — ${guard.error}`);
      return genId('img-rejected');
    }
    const localId = genId('img');
    const now = new Date().toISOString();
    const full: RepoImagingOrder = { ...order, id: localId, requestedAt: now };

    setImagingOrders(prev => [...prev, full]);

    if (order.encounterId) {
      linkRecordToEncounter(order.encounterId, {
        recordType: 'imaging_order', recordId: localId,
        summary: `${order.exam} — ${order.region}`,
        createdAt: now,
      });
    }

    addNotification({
      title: 'Nouvelle imagerie demandée',
      body: `${order.exam} (${order.region}) — ${order.patientName}`,
      type: order.urgency === 'STAT' ? 'warning' : 'info',
      link: '/imaging',
    });

    audit('imagerie', `Imagerie demandée: ${order.exam}`, {
      userId: order.requestedById, userName: order.requestedBy, userRole: 'medecin',
    }, { patientId: order.patientId, encounterId: order.encounterId, visitId: order.visitId, resourceId: localId, resourceType: 'ImagingOrder' });

    if (order.encounterId) {
      apiClient.request<Record<string, unknown>>('/imaging-orders', {
        method: 'POST',
        body: {
          patientId:       order.patientId,
          encounterId:     order.encounterId,
          patientName:     order.patientName,
          visitId:         order.visitId,
          exam:            order.exam,
          region:          order.region,
          side:            order.side,
          urgency:         order.urgency,
          withContrast:    order.withContrast,
          requestedByName: order.requestedBy,
          sourceModule:    order.sourceModule,
        },
      }).then(created => {
        if (!created?.id || String(created.id) === localId) return;
        setImagingOrders(prev => prev.map(o =>
          o.id === localId ? { ...o, id: String(created.id) } : o
        ));
      }).catch(() => {});
    }

    return localId;
  }, [linkRecordToEncounter, addNotification, audit]);

  const createPrescription = useCallback((rx: Omit<RepoPrescription, 'id' | 'prescribedAt'>): string => {
    const localId = genId('rx');
    const now = new Date().toISOString();
    const full: RepoPrescription = { ...rx, id: localId, prescribedAt: now };

    setPrescriptions(prev => [...prev, full]);

    if (rx.encounterId) {
      linkRecordToEncounter(rx.encounterId, {
        recordType: 'prescription', recordId: localId,
        summary: `${rx.drug} ${rx.dosage} ${rx.route}`,
        createdAt: now,
      });
    }

    addNotification({
      title: 'Nouvelle prescription',
      body: `${rx.drug} ${rx.dosage} — ${rx.patientName}`,
      type: 'info',
      link: '/pharmacy',
    });

    audit('urgences', `Prescription: ${rx.drug} ${rx.dosage}`, {
      userId: rx.prescribedById, userName: rx.prescribedBy, userRole: 'medecin',
    }, { patientId: rx.patientId, encounterId: rx.encounterId, visitId: rx.visitId, resourceId: localId, resourceType: 'Prescription' });

    if (rx.encounterId) {
      apiClient.request<Record<string, unknown>>('/prescriptions', {
        method: 'POST',
        body: {
          patientId:        rx.patientId,
          encounterId:      rx.encounterId,
          patientName:      rx.patientName,
          visitId:          rx.visitId,
          drug:             rx.drug,
          dosage:           rx.dosage,
          route:            rx.route,
          frequency:        rx.frequency,
          duration:         rx.duration,
          prescribedByName: rx.prescribedBy,
          sourceModule:     rx.sourceModule,
        },
      }).then(created => {
        if (!created?.id || String(created.id) === localId) return;
        setPrescriptions(prev => prev.map(p =>
          p.id === localId ? { ...p, id: String(created.id) } : p
        ));
      }).catch(() => {});
    }

    return localId;
  }, [linkRecordToEncounter, addNotification, audit]);

  const createSurgicalRequest = useCallback((req: Omit<SurgicalRequest, 'id' | 'createdAt'>): string => {
    const id = genId('surg');
    const full: SurgicalRequest = { ...req, id, createdAt: new Date().toISOString(), status: 'demande' };
    setSurgicalRequests(prev => [...prev, full]);
    addNotification({
      title: 'Demande de bloc opératoire',
      body: `${req.intervention ?? 'Intervention'} — ${req.patientName}`,
      type: 'warning', link: '/bloc',
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
    addNotification({
      title: 'Admission en réanimation',
      body: `${adm.motif} — ${adm.patientName}${adm.icuBed ? ` (${adm.icuBed})` : ''}`,
      type: 'error', link: '/icu',
    });
    audit('reanimation', `Admission réanimation: ${adm.motif}`, {
      userId: adm.requestedById, userName: adm.requestedBy, userRole: 'medecin',
    }, { patientId: adm.patientId, visitId: adm.visitId, resourceId: id, resourceType: 'ICUAdmission' });
    return id;
  }, [addNotification, audit]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Status update mutations (write-through to API)
  // ─────────────────────────────────────────────────────────────────────────────

  const updateLabOrderStatus = useCallback((
    orderId: string, status: RepoLabOrder['status'], result?: string, isCritical?: boolean, ctx?: AuditCtx,
  ) => {
    const now = new Date().toISOString();
    const order = labOrders.find(o => o.id === orderId);
    setLabOrders(prev => prev.map(o =>
      o.id !== orderId ? o : {
        ...o, status, updatedAt: now,
        ...(result ? { result, resultAt: now, validatedBy: ctx?.userName } : {}),
        ...(isCritical !== undefined ? { isCritical } : {}),
      }
    ));

    // Phase 5: notifications on result/critical
    if (isCritical && result) {
      addNotification({
        title: '⚠ Résultat critique',
        body: `${order?.test ?? ''} — ${order?.patientName ?? ''}: ${result}`,
        type: 'error', link: '/laboratory',
      });
    }
    if (status === 'validee' && order && result) {
      if (!isCritical) {
        addNotification({
          title: 'Résultat biologique disponible',
          body: `${order.test} — ${order.patientName}`,
          type: 'success', link: '/laboratory',
        });
      }
      if (order.encounterId) {
        linkRecordToEncounter(order.encounterId, {
          recordType: 'lab_order', recordId: orderId,
          summary: `Résultat ${order.test}${isCritical ? ' ⚠ CRITIQUE' : ''}: ${result}`,
          createdAt: now,
        });
      }
    }
    if (ctx) {
      audit('laboratoire', `Analyse ${status}: ${order?.test ?? orderId}`, ctx, {
        patientId: order?.patientId, encounterId: order?.encounterId,
        visitId: order?.visitId, resourceId: orderId, resourceType: 'LabOrder',
        oldValue: order?.status, newValue: status,
      });
    }

    // Persist to API — use the dedicated /result endpoint when a result is being validated
    // (it persists result, isCritical, validatedBy and sets status automatically).
    // Fall back to /status for other transitions (prelevee, en_cours, annulee).
    if (result) {
      apiClient.request(`/lab-orders/${orderId}/result`, {
        method: 'POST',
        body: {
          result,
          isCritical: isCritical ?? false,
          validatedByName: ctx?.userName,
        },
      }).catch(() => {});
    } else {
      apiClient.request(`/lab-orders/${orderId}/status`, {
        method: 'PATCH',
        body: { status },
      }).catch(() => {});
    }
  }, [labOrders, addNotification, linkRecordToEncounter, audit]);

  const updateImagingStatus = useCallback((
    orderId: string, status: RepoImagingOrder['status'], result?: string,
    meta?: { report?: string; reportedBy?: string; interpretedBy?: string },
    ctx?: AuditCtx,
  ) => {
    const now = new Date().toISOString();
    const order = imagingOrders.find(o => o.id === orderId);
    setImagingOrders(prev => prev.map(o =>
      o.id !== orderId ? o : {
        ...o, status, updatedAt: now,
        ...(result ? { result, resultAt: now } : {}),
        ...(meta?.report ? { report: meta.report, reportedBy: meta.reportedBy ?? ctx?.userName, reportedAt: now } : {}),
        ...(meta?.interpretedBy ? { interpretedBy: meta.interpretedBy, interpretedAt: now } : {}),
      }
    ));
    if (status === 'interpretee' && order) {
      addNotification({
        title: "Rapport d'imagerie disponible",
        body: `${order.exam} (${order.region}) — ${order.patientName}`,
        type: 'success', link: '/imaging',
      });
      if (order.encounterId) {
        linkRecordToEncounter(order.encounterId, {
          recordType: 'imaging_order', recordId: orderId,
          summary: `Rapport: ${order.exam} (${order.region}) — ${result ?? 'voir rapport'}`,
          createdAt: now,
        });
      }
    }
    if (ctx) {
      audit('imagerie', `Imagerie ${status}: ${order?.exam ?? orderId}`, ctx, {
        patientId: order?.patientId, encounterId: order?.encounterId,
        visitId: order?.visitId, resourceId: orderId, resourceType: 'ImagingOrder',
        oldValue: order?.status, newValue: status,
      });
    }

    // Persist to API — use the dedicated /report endpoint when a report is being validated
    // (it persists report, interpretedBy, interpretedAt and sets status to interpretee).
    // Fall back to /status for simpler transitions (planifiee, realisee, annulee).
    if (meta?.report) {
      apiClient.request(`/imaging-orders/${orderId}/report`, {
        method: 'POST',
        body: {
          report:            meta.report,
          interpretedByName: meta.interpretedBy ?? ctx?.userName,
        },
      }).catch(() => {});
    } else {
      apiClient.request(`/imaging-orders/${orderId}/status`, {
        method: 'PATCH',
        body: { status },
      }).catch(() => {});
    }
  }, [imagingOrders, addNotification, linkRecordToEncounter, audit]);

  const updatePrescriptionStatus = useCallback((
    prescriptionId: string, status: RepoPrescription['status'], ctx: AuditCtx,
    meta?: { dispensedBy?: string; comment?: string },
  ) => {
    const now = new Date().toISOString();
    const rx = prescriptions.find(p => p.id === prescriptionId);
    setPrescriptions(prev => prev.map(p =>
      p.id !== prescriptionId ? p : {
        ...p, status, updatedAt: now,
        ...(status === 'prepare' ? { preparedBy: meta?.dispensedBy ?? ctx.userName, preparedAt: now } : {}),
        ...(status === 'delivre' ? {
          dispensedBy: meta?.dispensedBy ?? ctx.userName,
          dispensedAt: now,
          dispenserComment: meta?.comment,
        } : {}),
      }
    ));
    if (status === 'delivre' && rx) {
      addNotification({
        title: 'Médicament délivré',
        body: `${rx.drug} ${rx.dosage} — ${rx.patientName}`,
        type: 'success', link: '/pharmacy',
      });
      if (rx.encounterId) {
        linkRecordToEncounter(rx.encounterId, {
          recordType: 'prescription', recordId: prescriptionId,
          summary: `Délivré: ${rx.drug} ${rx.dosage} par ${meta?.dispensedBy ?? ctx.userName}`,
          createdAt: now,
        });
      }
    }
    audit('pharmacie', `Prescription ${status}: ${rx?.drug ?? prescriptionId}`, ctx, {
      patientId: rx?.patientId, encounterId: rx?.encounterId,
      visitId: rx?.visitId, resourceId: prescriptionId, resourceType: 'Prescription',
      oldValue: rx?.status, newValue: status,
    });

    // Persist to API — use the dedicated /dispense endpoint for delivery
    // (it persists dispensedBy, dispenserComment, dispensedAt and sets status to delivre).
    // Fall back to /status for simpler transitions (prepare, annule).
    if (status === 'delivre') {
      apiClient.request(`/prescriptions/${prescriptionId}/dispense`, {
        method: 'POST',
        body: {
          dispensedByName:  meta?.dispensedBy ?? ctx.userName,
          dispenserComment: meta?.comment,
        },
      }).catch(() => {});
    } else {
      apiClient.request(`/prescriptions/${prescriptionId}/status`, {
        method: 'PATCH',
        body: { status },
      }).catch(() => {});
    }
  }, [prescriptions, addNotification, linkRecordToEncounter, audit]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Visit closure
  // ─────────────────────────────────────────────────────────────────────────────

  const freeOccupancy = useCallback((patientId: string) => {
    const p = patients.find(pt => pt.id === patientId);
    if (p?.assignedRoom) freePatientFromRoom(p.assignedRoom, patientId);
    freePatientFromDoctor(patientId);
    freePatientFromNurse(patientId);
  }, [patients, freePatientFromRoom, freePatientFromDoctor, freePatientFromNurse]);

  const closeVisitDischarged = useCallback((patientId: string, ctx: AuditCtx, encounterId?: string) => {
    patchPatient(patientId, { status: 'sorti' });
    freeOccupancy(patientId);
    syncEncounterWorkflow(patientId, 'sorti');
    closeEncounter(encounterId ?? `enc-${patientId}`, 'domicile', ctx);
    audit('urgences', 'Sortie vers domicile', ctx, {
      patientId, encounterId: encounterId ?? `enc-${patientId}`, oldValue: 'en_soins', newValue: 'sorti',
    });
  }, [patchPatient, freeOccupancy, syncEncounterWorkflow, closeEncounter, audit]);

  const closeVisitHospitalized = useCallback((patientId: string, admissionId: string, ctx: AuditCtx, encounterId?: string) => {
    patchPatient(patientId, { status: 'hospitalise' });
    freeOccupancy(patientId);
    syncEncounterWorkflow(patientId, 'hospitalise');
    closeEncounter(encounterId ?? `enc-${patientId}`, 'hospitalisation', ctx);
    addNotification({ title: 'Nouvelle hospitalisation', body: 'Patient transféré depuis les urgences', type: 'info', link: '/admissions' });
    audit('hospitalisation', 'Hospitalisation', ctx, {
      patientId, encounterId: encounterId ?? `enc-${patientId}`, newValue: 'hospitalise',
      resourceId: admissionId, resourceType: 'Admission',
    });
  }, [patchPatient, freeOccupancy, syncEncounterWorkflow, closeEncounter, addNotification, audit]);

  const closeVisitBloc = useCallback((patientId: string, surgicalRequestId: string, ctx: AuditCtx, encounterId?: string) => {
    patchPatient(patientId, { status: 'hospitalise' });
    freeOccupancy(patientId);
    syncEncounterWorkflow(patientId, 'hospitalise');
    closeEncounter(encounterId ?? `enc-${patientId}`, 'bloc', ctx);
    audit('bloc', 'Transfert bloc opératoire', ctx, {
      patientId, encounterId: encounterId ?? `enc-${patientId}`, newValue: 'hospitalise',
      resourceId: surgicalRequestId, resourceType: 'SurgicalRequest',
    });
  }, [patchPatient, freeOccupancy, syncEncounterWorkflow, closeEncounter, audit]);

  const closeVisitICU = useCallback((patientId: string, icuAdmissionId: string, ctx: AuditCtx, encounterId?: string) => {
    patchPatient(patientId, { status: 'hospitalise' });
    freeOccupancy(patientId);
    syncEncounterWorkflow(patientId, 'hospitalise');
    closeEncounter(encounterId ?? `enc-${patientId}`, 'reanimation', ctx);
    audit('reanimation', 'Transfert réanimation', ctx, {
      patientId, encounterId: encounterId ?? `enc-${patientId}`, newValue: 'hospitalise',
      resourceId: icuAdmissionId, resourceType: 'ICUAdmission',
    });
  }, [patchPatient, freeOccupancy, syncEncounterWorkflow, closeEncounter, audit]);

  const closeVisitTransferred = useCallback((patientId: string, ctx: AuditCtx, destEtablissement?: string, encounterId?: string) => {
    patchPatient(patientId, { status: 'transfere' });
    freeOccupancy(patientId);
    syncEncounterWorkflow(patientId, 'transfere');
    closeEncounter(encounterId ?? `enc-${patientId}`, 'transfert', ctx);
    audit('urgences', `Transfert: ${destEtablissement ?? 'autre établissement'}`, ctx, {
      patientId, encounterId: encounterId ?? `enc-${patientId}`, newValue: 'transfere',
    });
  }, [patchPatient, freeOccupancy, syncEncounterWorkflow, closeEncounter, audit]);

  const closeVisitDeceased = useCallback((patientId: string, ctx: AuditCtx, provisionalCause?: string, encounterId?: string) => {
    patchPatient(patientId, { status: 'decede' });
    freeOccupancy(patientId);
    syncEncounterWorkflow(patientId, 'decede');
    closeEncounter(encounterId ?? `enc-${patientId}`, 'deces', ctx);
    audit('urgences', `Décès${provisionalCause ? ` — ${provisionalCause}` : ''}`, ctx, {
      patientId, encounterId: encounterId ?? `enc-${patientId}`, newValue: 'decede',
    });
  }, [patchPatient, freeOccupancy, syncEncounterWorkflow, closeEncounter, audit]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Audit public API
  // ─────────────────────────────────────────────────────────────────────────────

  const addGlobalAudit = useCallback((entry: Omit<RepoAuditEntry, 'id' | 'timestamp' | 'ip'>) => {
    const full: RepoAuditEntry = { ...entry, id: genId('aud'), timestamp: new Date().toISOString(), ip: MOCK_IP };
    setGlobalAudit(prev => [full, ...prev]);
    apiClient.request('/audit-logs', {
      method: 'POST',
      body: {
        action:      entry.action,
        module:      entry.module,
        patientId:   entry.patientId,
        encounterId: entry.encounterId,
        entityId:    entry.resourceId,
        oldValue:    entry.oldValue,
        newValue:    entry.newValue,
      },
    }).catch(() => {});
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Hospital-wide occupancy (in-memory, same as MockRepository)
  // ─────────────────────────────────────────────────────────────────────────────

  const checkOccupancyThreshold = useCallback((nextBeds: OccupancyBed[]) => {
    const total    = nextBeds.length;
    const occupied = nextBeds.filter(b => b.status === 'occupe' || b.status === 'reserve').length;
    const rate     = total > 0 ? occupied / total : 0;
    if (rate >= 0.9) {
      addNotification({
        title: "Taux d'occupation élevé",
        body: `${Math.round(rate * 100)}% des lits sont occupés ou réservés.`,
        type: 'warning', link: '/hospitalization',
      });
    }
  }, [addNotification]);

  const assignBed = useCallback((
    bedId: string,
    params: { patientId: string; patientName: string; encounterId?: string; admissionId?: string; expectedReleaseAt?: string },
    ctx: AuditCtx,
  ) => {
    const now = new Date().toISOString();
    setBeds(prev => {
      const next = prev.map(b =>
        b.id !== bedId ? b : {
          ...b, status: 'occupe' as const,
          patientId: params.patientId, patientName: params.patientName,
          admissionId: params.admissionId, encounterId: params.encounterId,
          expectedReleaseAt: params.expectedReleaseAt, occupiedAt: now, updatedAt: now,
        },
      );
      checkOccupancyThreshold(next);
      return next;
    });
    const bed = beds.find(b => b.id === bedId);
    audit('hospitalisation', `Lit assigné: ${bed?.number ?? bedId} → ${params.patientName}`, ctx, {
      patientId: params.patientId, resourceId: bedId, resourceType: 'Bed',
      oldValue: 'disponible', newValue: 'occupe',
    });
  }, [beds, checkOccupancyThreshold, audit]);

  const freeBed = useCallback((bedId: string, ctx: AuditCtx) => {
    const now = new Date().toISOString();
    setBeds(prev => prev.map(b =>
      b.id !== bedId ? b : {
        ...b, status: 'disponible' as const,
        patientId: undefined, patientName: undefined, admissionId: undefined,
        encounterId: undefined, occupiedAt: undefined, expectedReleaseAt: undefined, updatedAt: now,
      },
    ));
    const bed = beds.find(b => b.id === bedId);
    audit('hospitalisation', `Lit libéré: ${bed?.number ?? bedId}`, ctx, {
      resourceId: bedId, resourceType: 'Bed', oldValue: bed?.status ?? 'occupe', newValue: 'disponible',
    });
  }, [beds, audit]);

  const startBedCleaning = useCallback((bedId: string, ctx: AuditCtx) => {
    const now = new Date().toISOString();
    setBeds(prev => prev.map(b =>
      b.id !== bedId ? b : {
        ...b, status: 'nettoyage' as const,
        patientId: undefined, patientName: undefined, admissionId: undefined,
        encounterId: undefined, occupiedAt: undefined, cleaningStartedAt: now, updatedAt: now,
      },
    ));
    const bed = beds.find(b => b.id === bedId);
    audit('hospitalisation', `Nettoyage démarré: ${bed?.number ?? bedId}`, ctx, {
      resourceId: bedId, resourceType: 'Bed', oldValue: bed?.status, newValue: 'nettoyage',
    });
  }, [beds, audit]);

  const completeBedCleaning = useCallback((bedId: string, ctx: AuditCtx) => {
    const now = new Date().toISOString();
    setBeds(prev => prev.map(b =>
      b.id !== bedId ? b : { ...b, status: 'disponible' as const, cleaningStartedAt: undefined, updatedAt: now },
    ));
    const bed = beds.find(b => b.id === bedId);
    audit('hospitalisation', `Nettoyage terminé: ${bed?.number ?? bedId}`, ctx, {
      resourceId: bedId, resourceType: 'Bed', oldValue: 'nettoyage', newValue: 'disponible',
    });
    addNotification({
      title: 'Lit disponible',
      body: `Le lit ${bed?.number ?? bedId} est prêt à être assigné.`,
      type: 'success', link: '/hospitalization',
    });
  }, [beds, audit, addNotification]);

  const getAvailableBeds = useCallback((filter?: BedFilterParams): OccupancyBed[] => {
    return beds.filter(b => {
      if (b.status !== 'disponible') return false;
      if (filter?.buildingId && b.buildingId !== filter.buildingId) return false;
      if (filter?.floorId    && b.floorId    !== filter.floorId)    return false;
      if (filter?.type       && b.type       !== filter.type)       return false;
      if (filter?.siteId     && b.siteId     !== filter.siteId)     return false;
      return true;
    });
  }, [beds]);

  const getBedStats = useCallback((filter?: BedFilterParams): BedStats => {
    const filtered = filter
      ? beds.filter(b => {
          if (filter.buildingId && b.buildingId !== filter.buildingId) return false;
          if (filter.floorId    && b.floorId    !== filter.floorId)    return false;
          if (filter.type       && b.type       !== filter.type)       return false;
          if (filter.siteId     && b.siteId     !== filter.siteId)     return false;
          return true;
        })
      : beds;
    const total       = filtered.length;
    const disponible  = filtered.filter(b => b.status === 'disponible').length;
    const occupe      = filtered.filter(b => b.status === 'occupe').length;
    const reserve     = filtered.filter(b => b.status === 'reserve').length;
    const nettoyage   = filtered.filter(b => b.status === 'nettoyage').length;
    const maintenance = filtered.filter(b => b.status === 'maintenance').length;
    const hors_service = filtered.filter(b => b.status === 'hors_service').length;
    return {
      total, disponible, occupe, reserve, nettoyage, maintenance, hors_service,
      occupancyRate: total > 0 ? Math.round(((occupe + reserve) / total) * 100) : 0,
    };
  }, [beds]);

  const getAvailableICUBeds = useCallback((): OccupancyICUBed[] => {
    return icuBeds.filter(b => b.status === 'disponible');
  }, [icuBeds]);

  const getICUStats = useCallback(() => {
    const total     = icuBeds.length;
    const disponible = icuBeds.filter(b => b.status === 'disponible').length;
    const occupe    = icuBeds.filter(b => b.status === 'occupe').length;
    const reserve   = icuBeds.filter(b => b.status === 'reserve').length;
    return {
      total, disponible, occupe, reserve,
      occupancyRate: total > 0 ? Math.round(((occupe + reserve) / total) * 100) : 0,
    };
  }, [icuBeds]);

  const reserveICUBed = useCallback((
    bedId: string,
    params: { patientId: string; patientName: string; encounterId?: string; icuAdmissionId?: string; priority?: string },
    ctx: AuditCtx,
  ) => {
    const now = new Date().toISOString();
    setICUBeds(prev => prev.map(b =>
      b.id !== bedId ? b : {
        ...b, status: 'occupe' as const,
        patientId: params.patientId, patientName: params.patientName,
        encounterId: params.encounterId, icuAdmissionId: params.icuAdmissionId,
        priority: params.priority as OccupancyICUBed['priority'],
        occupiedAt: now, updatedAt: now,
      },
    ));
    const bed = icuBeds.find(b => b.id === bedId);
    audit('reanimation', `Lit REA assigné: ${bed?.number ?? bedId} → ${params.patientName}`, ctx, {
      patientId: params.patientId, resourceId: bedId, resourceType: 'ICUBed',
      oldValue: 'disponible', newValue: 'occupe',
    });
  }, [icuBeds, audit]);

  const freeICUBed = useCallback((bedId: string, ctx: AuditCtx) => {
    const now = new Date().toISOString();
    const bed = icuBeds.find(b => b.id === bedId);
    setICUBeds(prev => prev.map(b =>
      b.id !== bedId ? b : {
        ...b, status: 'disponible' as const,
        patientId: undefined, patientName: undefined,
        encounterId: undefined, icuAdmissionId: undefined, occupiedAt: undefined, updatedAt: now,
      },
    ));
    audit('reanimation', `Lit REA libéré: ${bed?.number ?? bedId}`, ctx, {
      resourceId: bedId, resourceType: 'ICUBed', oldValue: bed?.status, newValue: 'disponible',
    });
  }, [icuBeds, audit]);

  const getAvailableOperatingRooms = useCallback((startAt: string, endAt: string): OperatingRoom[] => {
    const start = new Date(startAt).getTime();
    const end   = new Date(endAt).getTime();
    return operatingRooms.filter(r => {
      if (r.status === 'hors_service' || r.status === 'maintenance') return false;
      return !r.slots.some(s =>
        start < new Date(s.endAt).getTime() && end > new Date(s.startAt).getTime()
      );
    });
  }, [operatingRooms]);

  const reserveOperatingRoom = useCallback((roomId: string, slot: Omit<OperatingRoomSlot, 'id'>, ctx: AuditCtx): boolean => {
    const room = operatingRooms.find(r => r.id === roomId);
    if (!room || room.status === 'hors_service' || room.status === 'maintenance') return false;
    const slotId = genId('slot');
    const slotData = slot as OperatingRoomSlot;
    setOperatingRooms(prev => prev.map(r =>
      r.id !== roomId ? r : {
        ...r, slots: [...r.slots, { ...slotData, id: slotId }],
        updatedAt: new Date().toISOString(),
      },
    ));
    audit('bloc', `Créneau réservé: ${room.name} — ${slot.intervention ?? 'Intervention'}`, ctx, {
      patientId: slot.patientId, resourceId: roomId, resourceType: 'OperatingRoom',
    });
    return true;
  }, [operatingRooms, audit]);

  const releaseOperatingRoom = useCallback((roomId: string, surgicalRequestId: string, ctx: AuditCtx) => {
    const room = operatingRooms.find(r => r.id === roomId);
    setOperatingRooms(prev => prev.map(r =>
      r.id !== roomId ? r : {
        ...r, slots: r.slots.filter(s => s.surgicalRequestId !== surgicalRequestId),
        status: 'nettoyage' as const, currentSurgicalRequestId: undefined,
        updatedAt: new Date().toISOString(),
      },
    ));
    audit('bloc', `Fin d'intervention: ${room?.name ?? roomId}`, ctx, {
      resourceId: roomId, resourceType: 'OperatingRoom', newValue: 'nettoyage',
    });
  }, [operatingRooms, audit]);

  const updateOperatingRoomStatus = useCallback((roomId: string, status: OperatingRoomStatus, ctx: AuditCtx) => {
    const room = operatingRooms.find(r => r.id === roomId);
    setOperatingRooms(prev => prev.map(r =>
      r.id !== roomId ? r : { ...r, status, updatedAt: new Date().toISOString() },
    ));
    audit('bloc', `Salle ${room?.name ?? roomId}: ${status}`, ctx, {
      resourceId: roomId, resourceType: 'OperatingRoom', oldValue: room?.status, newValue: status,
    });
    if (status === 'libre') {
      addNotification({
        title: 'Salle opératoire disponible',
        body: `${room?.name ?? roomId} est disponible pour une nouvelle intervention.`,
        type: 'success', link: '/operating-room',
      });
    }
  }, [operatingRooms, audit, addNotification]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Dev utility
  // ─────────────────────────────────────────────────────────────────────────────

  const resetRepository = useCallback(() => {
    setPatients(MOCK_EMERGENCY_PATIENTS.map(p => ({ ...p })));
    setEncounters(buildInitialEncounters(MOCK_EMERGENCY_PATIENTS));
    setLabOrders([]);
    setImagingOrders([]);
    setPrescriptions([]);
    setSurgicalRequests([]);
    setICUAdmissions([]);
    setRooms(MOCK_EMERGENCY_ROOMS.map(r => ({ ...r })));
    setErDoctors(MOCK_EMERGENCY_DOCTORS.map(d => ({ ...d })));
    setErNurses(MOCK_EMERGENCY_NURSES.map(n => ({ ...n })));
    setAmbulances(MOCK_EMERGENCY_AMBULANCES.map(a => ({ ...a })));
    setBeds(MOCK_OCCUPANCY_BEDS.map(b => ({ ...b })));
    setICUBeds(MOCK_ICU_BEDS.map(b => ({ ...b })));
    setOperatingRooms(MOCK_OPERATING_ROOMS.map(r => ({ ...r, slots: r.slots.map(s => ({ ...s })) })));
    setGlobalAudit([]);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Context value
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <MockRepositoryContext.Provider value={{
      encounters, getEncounterById, getEncountersByPatient,
      createEncounter, closeEncounter, linkRecordToEncounter,
      patients, labOrders, imagingOrders, prescriptions, surgicalRequests, icuAdmissions,
      rooms, erDoctors, erNurses, ambulances,
      assignPatientToRoom, freePatientFromRoom, updateAmbulanceStatus,
      beds, icuBeds, operatingRooms,
      getAvailableBeds, getAvailableICUBeds, getAvailableOperatingRooms,
      getBedStats, getICUStats,
      assignBed, freeBed, startBedCleaning, completeBedCleaning,
      reserveICUBed, freeICUBed,
      reserveOperatingRoom, releaseOperatingRoom, updateOperatingRoomStatus,
      globalAudit, addGlobalAudit,
      getPatient, getLabOrdersByPatient, getImagingOrdersByPatient,
      getPrescriptionsByPatient, getSurgicalsByPatient, getICUsByPatient,
      canTransitionPatient,
      startCare, updatePatientStatus,
      createLabOrder, createImagingOrder, createPrescription,
      createSurgicalRequest, createICUAdmission,
      updateLabOrderStatus, updateImagingStatus, updatePrescriptionStatus,
      closeVisitDischarged, closeVisitHospitalized, closeVisitBloc,
      closeVisitICU, closeVisitTransferred, closeVisitDeceased,
      resetRepository,
    }}>
      {children}
    </MockRepositoryContext.Provider>
  );
}
