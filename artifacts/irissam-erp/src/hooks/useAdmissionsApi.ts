/**
 * useAdmissionsApi — drop-in replacement for useAdmissions() backed by real PostgreSQL API.
 * Exposes the same interface so Admissions.tsx needs minimal changes.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/services/api/client';
import type { Admission } from '@/types/admission';

// ── Map API response → Admission type ─────────────────────────────────────────

export function mapApiAdmission(a: any): Admission {
  return {
    id:                  a.id,
    admissionNumber:     a.admissionNumber ?? '',
    encounterId:         a.encounterId     ?? undefined,
    patientId:           a.patientId,
    patientName:         a.patientName     ?? '',
    patientMpiId:        a.patientMpiId    ?? a.patientId,
    patientDob:          a.patientDob      ?? '',
    patientPhone:        a.patientPhone    ?? '',
    type:                a.type            ?? 'hospitalisation',
    status:              a.status          ?? 'active',
    priority:            a.priority        ?? 'normal',
    serviceId:           a.serviceId       ?? '',
    serviceName:         a.serviceName     ?? '',
    doctorId:            a.doctorId        ?? '',
    doctorName:          a.doctorName      ?? '',
    motif:               a.motif           ?? '',
    diagnosis:           a.diagnosis       ?? '',
    bedId:               a.bedId           ?? '',
    bedNumber:           a.bedNumber       ?? '',
    roomNumber:          a.roomNumber      ?? '',
    floorLabel:          a.floorLabel      ?? '',
    buildingName:        a.buildingName    ?? '',
    admissionDate:       a.admissionDate   ?? '',
    admissionTime:       a.admissionTime   ?? '',
    expectedDischargeDate: a.expectedDischargeDate ?? '',
    actualDischargeDate:   a.actualDischargeDate   ?? '',
    actualDischargeTime:   a.actualDischargeTime   ?? '',
    dischargeType:       a.dischargeType   ?? undefined,
    dischargeNotes:      a.dischargeNotes  ?? '',
    preadmissionDate:        a.preadmissionDate        ?? undefined,
    preadmissionConvertedAt: a.preadmissionConvertedAt ?? undefined,
    notes:               a.notes           ?? '',
    createdAt:           a.createdAt       ?? new Date().toISOString(),
    updatedAt:           a.updatedAt       ?? new Date().toISOString(),
    siteId:              a.siteId          ?? '',
    createdById:         a.createdById     ?? '',
  };
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export interface AdmissionsApiState {
  admissions: Admission[];
  loading:    boolean;
  error:      string | null;
  refresh:    () => void;
  discharge:  (id: string, type: string, date: string, time: string, notes: string) => Promise<void>;
  transfer:   (id: string, payload: { newBedId: string; motif: string }) => Promise<void>;
  cancel:     (id: string) => Promise<void>;
  addAdmission: (a: Admission) => void;
  updateAdmission: (a: Admission) => void;
}

export function useAdmissionsApi(): AdmissionsApiState {
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const refreshKeyRef = useRef(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiClient.get<any[]>('/admissions')
      .then(rows => {
        if (!cancelled) {
          setAdmissions(rows.map(mapApiAdmission));
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message ?? 'Erreur lors du chargement');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [refreshKey]);

  const discharge = useCallback(
    async (id: string, type: string, date: string, time: string, notes: string) => {
      // Sortie ADT atomique côté serveur : admission clôturée + lit → nettoyage
      // + encounter fermé + journalisation. La date/heure saisies sont transmises.
      await apiClient.post(`/admissions/${id}/discharge`, {
        dischargeType:  type,
        dischargeNotes: notes || undefined,
        dischargeDate:  date || undefined,
        dischargeTime:  time || undefined,
      });
      refresh();
    },
    [refresh],
  );

  const transfer = useCallback(
    async (id: string, payload: { newBedId: string; motif: string }) => {
      // Mouvement ADT atomique côté serveur : ancien lit libéré (→ nettoyage),
      // nouveau lit occupé, admission réalignée, mouvement journalisé.
      await apiClient.post(`/admissions/${id}/transfer`, payload);
      refresh();
    },
    [refresh],
  );

  const cancel = useCallback(
    async (id: string) => {
      await apiClient.post(`/admissions/${id}/cancel`, {});
      refresh();
    },
    [refresh],
  );

  const addAdmission = useCallback((a: Admission) => {
    setAdmissions(prev => [a, ...prev]);
  }, []);

  const updateAdmission = useCallback((a: Admission) => {
    setAdmissions(prev => prev.map(x => x.id === a.id ? a : x));
  }, []);

  return { admissions, loading, error, refresh, discharge, transfer, cancel, addAdmission, updateAdmission };
}
