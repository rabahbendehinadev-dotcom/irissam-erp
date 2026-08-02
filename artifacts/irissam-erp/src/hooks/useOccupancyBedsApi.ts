/**
 * useOccupancyBedsApi — fetches occupancy beds from the real PostgreSQL API.
 * Used by BedSelector and AdmissionMiniDashboard.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/services/api/client';
import type { OccupancyBed, BedStats } from '@/types/repository';

export interface OccupancyBedsApiState {
  beds:     OccupancyBed[];
  loading:  boolean;
  error:    string | null;
  refresh:  () => void;
  stats:    BedStats;
}

function mapApiBed(raw: any): OccupancyBed {
  return {
    id:              raw.id,
    number:          raw.number ?? '',
    roomId:          raw.roomId          ?? raw.id,
    roomNumber:      raw.roomNumber       ?? raw.number ?? '',
    floorId:         raw.floorId          ?? '',
    floorLabel:      raw.floorLabel       ?? '',
    buildingId:      raw.buildingId       ?? '',
    buildingName:    raw.buildingName     ?? '',
    buildingCode:    raw.buildingCode     ?? '',
    siteId:          raw.siteId           ?? '',
    type:            raw.type             ?? 'standard',
    status:          raw.status,
    patientId:       raw.patientId        ?? undefined,
    patientName:     raw.patientName      ?? undefined,
    encounterId:     raw.encounterId      ?? undefined,
    admissionId:     raw.admissionId      ?? undefined,
    occupiedAt:      raw.occupiedAt       ?? undefined,
    expectedReleaseAt: raw.expectedReleaseAt ?? undefined,
    cleaningStartedAt: raw.cleaningStartedAt ?? undefined,
    updatedAt:       raw.updatedAt        ?? new Date().toISOString(),
  };
}

function computeStats(beds: OccupancyBed[]): BedStats {
  const total       = beds.length;
  const disponible  = beds.filter(b => b.status === 'disponible').length;
  const occupe      = beds.filter(b => b.status === 'occupe').length;
  const reserve     = beds.filter(b => b.status === 'reserve').length;
  const nettoyage   = beds.filter(b => b.status === 'nettoyage').length;
  const maintenance = beds.filter(b => b.status === 'maintenance').length;
  const hors_service = beds.filter(b => b.status === 'hors_service').length;
  const occupancyRate = total > 0 ? Math.round((occupe / total) * 100) : 0;
  return { total, disponible, occupe, reserve, nettoyage, maintenance, hors_service, occupancyRate };
}

const EMPTY_STATS: BedStats = {
  total: 0, disponible: 0, occupe: 0, reserve: 0,
  nettoyage: 0, maintenance: 0, hors_service: 0, occupancyRate: 0,
};

/** Fetch all beds (with filter params forwarded to query string). */
export function useOccupancyBedsApi(params?: {
  siteId?: string;
  availableOnly?: boolean;
  refreshKey?: number;
}): OccupancyBedsApiState {
  const [beds, setBeds]       = useState<OccupancyBed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [localKey, setLocalKey] = useState(0);

  const refresh = useCallback(() => setLocalKey(k => k + 1), []);

  const externalKey = params?.refreshKey ?? 0;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const path = params?.availableOnly
      ? '/occupancy-beds/available'
      : '/occupancy-beds';

    apiClient.get<any[]>(path)
      .then(rows => {
        if (!cancelled) {
          setBeds(rows.map(mapApiBed));
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message ?? 'Erreur lors du chargement des lits');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localKey, externalKey, params?.availableOnly]);

  const stats = loading ? EMPTY_STATS : computeStats(beds);

  return { beds, loading, error, refresh, stats };
}
