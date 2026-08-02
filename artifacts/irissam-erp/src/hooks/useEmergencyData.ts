/**
 * useEmergencyData — fetches live emergency data from the real PostgreSQL API.
 * Replaces the mock arrays that were previously read from MockRepository.
 *
 * Endpoints consumed:
 *   GET /api/emergencies/patients  → active visits + today's stats
 *   GET /api/emergencies/rooms     → emergency room occupancy
 *   GET /api/emergencies/ambulances → ambulance fleet
 *
 * Auto-refreshes every 30 seconds.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/services/api/client';
import type { EmergencyPatient, EmergencyRoom, Ambulance } from '@/types/emergency';

export interface EmergencyTodayStats {
  sorties:          number;
  hospitalisations: number;
  transferts:       number;
}

export interface EmergencyDataState {
  patients:   EmergencyPatient[];
  rooms:      EmergencyRoom[];
  ambulances: Ambulance[];
  todayStats: EmergencyTodayStats;
  loading:    boolean;
  error:      string | null;
  refresh:    () => void;
}

const EMPTY_TODAY: EmergencyTodayStats = { sorties: 0, hospitalisations: 0, transferts: 0 };
const REFRESH_INTERVAL_MS = 30_000;

/** Map raw API visit to EmergencyPatient (handles extra bloodType / allergies / patientId fields). */
function mapVisit(raw: any): EmergencyPatient & { bloodType?: string; allergies?: string[] } {
  return {
    id:             raw.id,          // visit UUID
    patientId:      raw.patientId,   // real DB patient UUID
    mpiId:          raw.mpiId ?? raw.id,
    lastName:       raw.lastName  ?? '—',
    firstName:      raw.firstName ?? '—',
    age:            raw.age       ?? 0,
    gender:         raw.gender    === 'F' ? 'F' : 'M',
    priority:       raw.priority  ?? 'P5',
    status:         raw.status    ?? 'attente_triage',
    arrivalTime:    raw.arrivalTime,
    chiefComplaint: raw.chiefComplaint ?? '',
    mechanism:      raw.mechanism      ?? undefined,
    assignedDoctor: raw.assignedDoctor ?? undefined,
    assignedNurse:  raw.assignedNurse  ?? undefined,
    assignedRoom:   raw.assignedRoom   ?? undefined,
    vitals:         raw.vitals         ?? undefined,
    triageNotes:    raw.triageNotes    ?? undefined,
    byAmbulance:    Boolean(raw.byAmbulance),
    isMinor:        Boolean(raw.isMinor),
    tags:           Array.isArray(raw.tags) ? raw.tags : [],
    bloodType:      raw.bloodType   ?? undefined,
    allergies:      Array.isArray(raw.allergies) ? raw.allergies : [],
  };
}

export function useEmergencyData(): EmergencyDataState {
  const [patients,   setPatients]   = useState<EmergencyPatient[]>([]);
  const [rooms,      setRooms]      = useState<EmergencyRoom[]>([]);
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [todayStats, setTodayStats] = useState<EmergencyTodayStats>(EMPTY_TODAY);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      setError(null);
      try {
        const [patientsResp, roomsResp, ambulancesResp] = await Promise.all([
          apiClient.get<{ visits: any[]; todayStats: EmergencyTodayStats }>('/emergencies/patients'),
          apiClient.get<any[]>('/emergencies/rooms'),
          apiClient.get<any[]>('/emergencies/ambulances'),
        ]);

        if (!cancelled) {
          setPatients((patientsResp.visits ?? []).map(mapVisit));
          setTodayStats(patientsResp.todayStats ?? EMPTY_TODAY);
          setRooms(roomsResp ?? []);
          setAmbulances(ambulancesResp ?? []);
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message ?? 'Erreur lors du chargement des urgences');
          setLoading(false);
        }
      }
    }

    fetchAll();

    // Auto-refresh every 30 s
    timerRef.current = setInterval(fetchAll, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  return { patients, rooms, ambulances, todayStats, loading, error, refresh };
}
