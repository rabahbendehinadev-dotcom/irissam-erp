/**
 * useOperatingRoomApi — operating rooms + surgical requests backed by real API.
 * Replaces useMockRepository() for the OperatingRoom page.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/services/api/client';
import type { OperatingRoomStatus } from '@/types/repository';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ORRoomApi {
  id:                       string;
  name:                     string;
  shortName:                string;
  specialty:                string | null;
  status:                   OperatingRoomStatus;
  currentSurgicalRequestId: string | null;
  floorLabel:               string | null;
  updatedAt:                string;
  // Backward-compat with MockRepository OperatingRoom shape
  slots: ORSlotApi[];
}

export interface ORSlotApi {
  id:           string;
  patientName:  string;
  intervention: string;
  surgeon:      string;
  startAt:      string;
  endAt:        string;
  status:       string;
}

export interface SurgicalRequestApi {
  id:              string;
  encounterId:     string | null;
  patientId:       string;
  patientName:     string;
  intervention:    string;
  surgeonName:     string | null;
  anesthesistName: string | null;
  urgencyDegree:   string;
  status:          string;
  orRoomId:        string | null;
  scheduledAt:     string | null;
  createdAt:       string;
}

export interface ORApiState {
  operatingRooms:   ORRoomApi[];
  surgicalRequests: SurgicalRequestApi[];
  loading:          boolean;
  error:            string | null;
  refresh:          () => void;
  updateORStatus:   (id: string, status: OperatingRoomStatus) => Promise<void>;
  createSurgicalRequest: (payload: {
    patientId:   string;
    encounterId: string;
    patientName: string;
    intervention: string;
    surgeonName?: string;
    urgencyDegree?: string;
  }) => Promise<SurgicalRequestApi>;
  scheduleSurgery: (requestId: string, orRoomId: string, scheduledAt: string) => Promise<void>;
  startSurgery:    (requestId: string) => Promise<void>;
  completeSurgery: (requestId: string) => Promise<void>;
  cancelSurgery:   (requestId: string) => Promise<void>;
}

export function useOperatingRoomApi(): ORApiState {
  const [operatingRooms,   setOperatingRooms]   = useState<ORRoomApi[]>([]);
  const [surgicalRequests, setSurgicalRequests] = useState<SurgicalRequestApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      apiClient.get<any[]>('/operating-rooms'),
      apiClient.get<SurgicalRequestApi[]>('/surgical-requests'),
    ])
      .then(([rooms, requests]) => {
        if (!cancelled) {
          // Attach empty slots array for backward-compat with ORCard component
          setOperatingRooms(rooms.map(r => ({ ...r, slots: [] })));
          setSurgicalRequests(requests);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) { setError(err.message ?? 'Erreur Bloc'); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const updateORStatus = useCallback(async (id: string, status: OperatingRoomStatus) => {
    // No direct PATCH on OR — status is driven by surgical request lifecycle
    // Optimistic update only
    setOperatingRooms(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  }, []);

  const createSurgicalRequest = useCallback(async (payload: any): Promise<SurgicalRequestApi> => {
    const result = await apiClient.post<SurgicalRequestApi>('/surgical-requests', payload);
    refresh();
    return result;
  }, [refresh]);

  const scheduleSurgery = useCallback(async (requestId: string, orRoomId: string, scheduledAt: string) => {
    await apiClient.post(`/surgical-requests/${requestId}/schedule`, { orRoomId, scheduledAt });
    refresh();
  }, [refresh]);

  const startSurgery = useCallback(async (requestId: string) => {
    await apiClient.post(`/surgical-requests/${requestId}/start`, {});
    refresh();
  }, [refresh]);

  const completeSurgery = useCallback(async (requestId: string) => {
    await apiClient.post(`/surgical-requests/${requestId}/complete`, {});
    refresh();
  }, [refresh]);

  const cancelSurgery = useCallback(async (requestId: string) => {
    await apiClient.post(`/surgical-requests/${requestId}/cancel`, {});
    refresh();
  }, [refresh]);

  return {
    operatingRooms, surgicalRequests, loading, error, refresh,
    updateORStatus, createSurgicalRequest,
    scheduleSurgery, startSurgery, completeSurgery, cancelSurgery,
  };
}
