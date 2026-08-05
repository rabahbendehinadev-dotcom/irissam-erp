/**
 * PatientPrescriptionsTab — Ordonnances/prescriptions d'un patient.
 */
import { useState, useEffect, useCallback } from 'react';
import { Pill, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Prescription {
  id: string;
  drug: string;
  dosage: string;
  route: string;
  frequency: string;
  duration: string | null;
  notes: string | null;
  prescribedByName: string;
  prescribedAt: string | null;
  status: string;
  dispensedByName: string | null;
  dispensedAt: string | null;
  sourceModule: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  prescribed:  { label: 'Prescrite',  color: 'bg-blue-100 text-blue-700' },
  prepared:    { label: 'Préparée',   color: 'bg-yellow-100 text-yellow-700' },
  dispensed:   { label: 'Délivrée',   color: 'bg-green-100 text-green-700' },
  cancelled:   { label: 'Annulée',    color: 'bg-gray-100 text-gray-500' },
};

function fmt(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function PatientPrescriptionsTab({ patientId }: { patientId: string }) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<Prescription[]>(`/prescriptions?patientId=${encodeURIComponent(patientId)}&limit=200`);
      setPrescriptions(Array.isArray(data) ? data : []);
    } catch {
      setError('Impossible de charger les prescriptions.');
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

  if (prescriptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] text-gray-400 gap-2">
        <Pill size={40} className="opacity-20" />
        <p className="font-semibold text-sm">Aucune prescription enregistrée</p>
        <p className="text-xs">Les ordonnances apparaîtront ici après une consultation.</p>
      </div>
    );
  }

  const dispensed = prescriptions.filter(p => p.status === 'dispensed').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Prescriptions & Ordonnances</h3>
        <div className="flex items-center gap-2">
          {dispensed > 0 && (
            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
              <CheckCircle size={11} /> {dispensed} délivrée{dispensed > 1 ? 's' : ''}
            </span>
          )}
          <span className="text-xs text-gray-400">{prescriptions.length} prescription{prescriptions.length !== 1 ? 's' : ''}</span>
          <button onClick={load} className="text-gray-400 hover:text-gray-600 transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {prescriptions.map(p => {
          const s = STATUS_MAP[p.status] ?? { label: p.status, color: 'bg-gray-100 text-gray-500' };
          return (
            <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-gray-800 text-sm">{p.drug}</span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-0.5">
                    <p><span className="text-gray-400">Posologie :</span> {p.dosage} — {p.frequency}</p>
                    <p><span className="text-gray-400">Voie :</span> {p.route}{p.duration ? ` — Durée : ${p.duration}` : ''}</p>
                    {p.notes && <p className="text-gray-400 italic text-xs mt-1">{p.notes}</p>}
                  </div>
                </div>
                <div className="text-right shrink-0 text-xs text-gray-400">
                  <p>Prescrit par <span className="font-medium text-gray-600">{p.prescribedByName}</span></p>
                  <p>{fmt(p.prescribedAt)}</p>
                  {p.dispensedAt && (
                    <p className="text-green-600 mt-1">Délivré le {fmt(p.dispensedAt)}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
