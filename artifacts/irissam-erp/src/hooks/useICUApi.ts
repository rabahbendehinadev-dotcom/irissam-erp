/**
 * useICUApi — ICU beds + admissions backed by real PostgreSQL API.
 * Replaces useMockRepository() for the Resuscitation page.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/services/api/client';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface IcuBedApi {
  id:            string;
  number:        string;
  unitName:      string;
  type:          string;
  status:        'disponible' | 'occupe' | 'reserve' | 'nettoyage' | 'hors_service';
  patientId:     string | null;
  patientName:   string | null;
  encounterId:   string | null;
  icuAdmissionId: string | null;
  priority:      string | null;
  occupiedAt:    string | null;
  updatedAt:     string;
}

export interface IcuAdmissionApi {
  id:              string;
  encounterId:     string | null;
  patientId:       string;
  patientName:     string;
  motif:           string;
  priority:        string;
  icuBedId:        string | null;
  teamNotified:    string;
  status:          string;
  requestedByName: string | null;
  notes:           string | null;
  createdAt:       string;
  updatedAt:       string;
}

export interface IcuStats {
  total:         number;
  disponible:    number;
  occupe:        number;
  occupancyRate: number;
}

export interface ICUApiState {
  icuBeds:       IcuBedApi[];
  loading:       boolean;
  error:         string | null;
  refresh:       () => void;
  getICUStats:   () => IcuStats;
  freeICUBed:    (bedId: string) => Promise<void>;
  admitToICU:    (payload: {
    patientId:   string;
    encounterId: string;
    patientName: string;
    motif:       string;
    priority?:   string;
    icuBedId?:   string;
  }) => Promise<IcuAdmissionApi>;
  dischargeFromICU: (admissionId: string) => Promise<void>;
}

export function useICUApi(): ICUApiState {
  const [icuBeds, setIcuBeds] = useState<IcuBedApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient.get<IcuBedApi[]>('/icu/beds')
      .then(beds => { if (!cancelled) { setIcuBeds(beds); setLoading(false); } })
      .catch(err => { if (!cancelled) { setError(err.message ?? 'Erreur ICU'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const getICUStats = useCallback((): IcuStats => {
    const total      = icuBeds.length;
    const disponible = icuBeds.filter(b => b.status === 'disponible').length;
    const occupe     = icuBeds.filter(b => b.status === 'occupe').length;
    const occupancyRate = total > 0 ? Math.round((occupe / total) * 100) : 0;
    return { total, disponible, occupe, occupancyRate };
  }, [icuBeds]);

  const freeICUBed = useCallback(async (bedId: string) => {
    // Find the ICU admission for this bed and discharge it
    const beds = await apiClient.get<IcuBedApi[]>('/icu/beds');
    const bed  = beds.find(b => b.id === bedId);
    if (bed?.icuAdmissionId) {
      await apiClient.post(`/icu/admissions/${bed.icuAdmissionId}/discharge`, {});
    }
    refresh();
  }, [refresh]);

  const admitToICU = useCallback(async (payload: {
    patientId:   string;
    encounterId: string;
    patientName: string;
    motif:       string;
    priority?:   string;
    icuBedId?:   string;
  }): Promise<IcuAdmissionApi> => {
    const result = await apiClient.post<IcuAdmissionApi>('/icu/admissions', payload);
    refresh();
    return result;
  }, [refresh]);

  const dischargeFromICU = useCallback(async (admissionId: string) => {
    await apiClient.post(`/icu/admissions/${admissionId}/discharge`, {});
    refresh();
  }, [refresh]);

  return { icuBeds, loading, error, refresh, getICUStats, freeICUBed, admitToICU, dischargeFromICU };
}
