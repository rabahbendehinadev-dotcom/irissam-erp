/**
 * PatientEmergencyVisitsTab — Visite(s) aux urgences d'un patient.
 * Uses GET /api/emergencies/visits/by-patient/:patientId for the active visit.
 */
import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, RefreshCw, Clock, CheckCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface EmergencyVisit {
  id: string;
  patientId: string;
  priority: string | null;
  status: string;
  triageNotes: string | null;
  arrivalTime: string;
  closedAt: string | null;
  roomName: string | null;
  chiefComplaint: string | null;
  finalDecision: string | null;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  attente_triage: { label: 'Attente triage',  color: 'bg-gray-100 text-gray-600' },
  en_triage:      { label: 'En triage',        color: 'bg-yellow-100 text-yellow-700' },
  attente_soins:  { label: 'Attente soins',    color: 'bg-orange-100 text-orange-700' },
  en_soins:       { label: 'En soins',         color: 'bg-blue-100 text-blue-700' },
  observation:    { label: 'Observation',      color: 'bg-purple-100 text-purple-700' },
  hospitalise:    { label: 'Hospitalisé',      color: 'bg-indigo-100 text-indigo-700' },
  sorti:          { label: 'Sorti',            color: 'bg-green-100 text-green-700' },
  transfere:      { label: 'Transféré',        color: 'bg-teal-100 text-teal-700' },
  decede:         { label: 'Décédé',           color: 'bg-red-100 text-red-700' },
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  P1: { label: 'P1 — Extrême urgence', color: 'bg-red-600 text-white' },
  P2: { label: 'P2 — Très urgent',     color: 'bg-orange-500 text-white' },
  P3: { label: 'P3 — Urgent',          color: 'bg-yellow-400 text-gray-900' },
  P4: { label: 'P4 — Moins urgent',    color: 'bg-green-400 text-white' },
  P5: { label: 'P5 — Non urgent',      color: 'bg-blue-400 text-white' },
  non_classe: { label: 'Non classé',   color: 'bg-gray-200 text-gray-600' },
};

function fmt(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('fr-DZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function PatientEmergencyVisitsTab({ patientId }: { patientId: string }) {
  const [visit, setVisit] = useState<EmergencyVisit | null | false>(false); // false = not loaded yet
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<EmergencyVisit | null>(`/emergencies/visits/by-patient/${encodeURIComponent(patientId)}`);
      setVisit(data ?? null);
    } catch (err: unknown) {
      // 404 = no active visit (normal)
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 404) {
        setVisit(null);
      } else {
        setError('Impossible de charger les données urgences.');
      }
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] gap-3 text-red-500">
        <AlertTriangle size={32} className="opacity-60" />
        <p className="text-sm">{error}</p>
        <button onClick={load} className="flex items-center gap-1.5 text-xs border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
          <RefreshCw size={12} /> Réessayer
        </button>
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] text-gray-400 gap-2">
        <AlertTriangle size={40} className="opacity-20" />
        <p className="font-semibold text-sm">Aucune visite aux urgences en cours</p>
        <p className="text-xs">Les visites actives aux urgences apparaîtront ici.</p>
      </div>
    );
  }

  const s = STATUS_MAP[visit.status] ?? { label: visit.status, color: 'bg-gray-100 text-gray-500' };
  const p = visit.priority ? (PRIORITY_MAP[visit.priority] ?? { label: visit.priority, color: 'bg-gray-100 text-gray-600' }) : null;
  const isClosed = Boolean(visit.closedAt) || ['sorti', 'transfere', 'decede'].includes(visit.status);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Urgences</h3>
        <button onClick={load} className="text-gray-400 hover:text-gray-600 transition-colors">
          <RefreshCw size={14} />
        </button>
      </div>

      <div className={`bg-white border rounded-xl p-5 ${isClosed ? 'border-gray-200' : 'border-orange-200'}`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {p && (
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${p.color}`}>{p.label}</span>
              )}
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
              {!isClosed && (
                <span className="flex items-center gap-1 text-xs text-orange-600 font-medium">
                  <Clock size={11} className="animate-pulse" /> Visite en cours
                </span>
              )}
              {isClosed && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle size={11} /> Visite terminée
                </span>
              )}
            </div>
            {visit.chiefComplaint && (
              <p className="text-sm font-medium text-gray-700">Motif : {visit.chiefComplaint}</p>
            )}
            {visit.roomName && (
              <p className="text-xs text-gray-400 mt-0.5">Salle : {visit.roomName}</p>
            )}
          </div>
          <div className="text-right text-xs text-gray-400 shrink-0">
            <p>Arrivée : <span className="font-medium text-gray-600">{fmt(visit.arrivalTime)}</span></p>
            {visit.closedAt && (
              <p className="mt-0.5">Fermée : <span className="font-medium text-gray-600">{fmt(visit.closedAt)}</span></p>
            )}
          </div>
        </div>

        {/* Triage notes */}
        {visit.triageNotes && (
          <div className="bg-gray-50 rounded-lg p-3 mt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Notes de triage</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{visit.triageNotes}</p>
          </div>
        )}

        {/* Final decision */}
        {visit.finalDecision && (
          <div className="bg-blue-50 rounded-lg p-3 mt-2 border border-blue-100">
            <p className="text-xs font-semibold text-blue-600 uppercase mb-1">Décision finale</p>
            <p className="text-sm text-gray-700">{visit.finalDecision}</p>
          </div>
        )}
      </div>
    </div>
  );
}
