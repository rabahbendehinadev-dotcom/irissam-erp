/**
 * PatientImagingOrdersTab — Demandes d'imagerie pour un patient.
 */
import { useState, useEffect, useCallback } from 'react';
import { Scan, RefreshCw, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface ImagingOrder {
  id: string;
  exam: string;
  region: string;
  side: string | null;
  urgency: string;
  withContrast: boolean;
  requestedByName: string;
  requestedAt: string | null;
  status: string;
  result: string | null;
  report: string | null;
  resultAt: string | null;
  sourceModule: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  en_attente:    { label: 'En attente',    color: 'bg-yellow-100 text-yellow-700' },
  planifie:      { label: 'Planifié',      color: 'bg-blue-100 text-blue-700' },
  realise:       { label: 'Réalisé',       color: 'bg-purple-100 text-purple-700' },
  rapport_rendu: { label: 'Rapport rendu', color: 'bg-green-100 text-green-700' },
  interpretee:   { label: 'Interprétée',   color: 'bg-emerald-100 text-emerald-700' },
  annulee:       { label: 'Annulée',       color: 'bg-gray-100 text-gray-500' },
};

function fmt(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function PatientImagingOrdersTab({ patientId }: { patientId: string }) {
  const [orders, setOrders] = useState<ImagingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<ImagingOrder[]>(`/imaging-orders?patientId=${encodeURIComponent(patientId)}&limit=200`);
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      setError('Impossible de charger les examens d\'imagerie.');
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

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] text-gray-400 gap-2">
        <Scan size={40} className="opacity-20" />
        <p className="font-semibold text-sm">Aucun examen d'imagerie prescrit</p>
        <p className="text-xs">Les demandes d'imagerie apparaîtront ici.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Imagerie médicale</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{orders.length} examen{orders.length !== 1 ? 's' : ''}</span>
          <button onClick={load} className="text-gray-400 hover:text-gray-600 transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Examen</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Région</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Urgence</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Demandé par</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.map(o => {
                const s = STATUS_MAP[o.status] ?? { label: o.status, color: 'bg-gray-100 text-gray-500' };
                return (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {o.exam}
                      {o.withContrast && <span className="ml-1.5 text-xs text-blue-600">(+ contraste)</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {o.region}{o.side ? ` · ${o.side}` : ''}
                    </td>
                    <td className={`px-4 py-3 text-gray-500 capitalize ${o.urgency === 'stat' ? 'text-red-600 font-bold' : o.urgency === 'urgent' ? 'text-orange-600 font-semibold' : ''}`}>
                      {o.urgency === 'stat' ? 'STAT' : o.urgency === 'urgent' ? 'Urgent' : 'Routine'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{o.requestedByName || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{fmt(o.requestedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
