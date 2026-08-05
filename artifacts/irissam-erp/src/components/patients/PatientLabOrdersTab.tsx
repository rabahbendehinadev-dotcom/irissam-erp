/**
 * PatientLabOrdersTab — Analyses biologiques prescrites pour un patient.
 */
import { useState, useEffect, useCallback } from 'react';
import { FlaskConical, RefreshCw, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface LabOrder {
  id: string;
  test: string;
  category: string;
  urgency: string;
  status: string;
  requestedByName: string;
  requestedAt: string | null;
  result: string | null;
  isCritical: boolean;
  laboratory: string | null;
  updatedAt: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  en_attente:    { label: 'En attente',    color: 'bg-yellow-100 text-yellow-700' },
  en_cours:      { label: 'En cours',      color: 'bg-blue-100 text-blue-700' },
  resultat_recu: { label: 'Résultat reçu', color: 'bg-purple-100 text-purple-700' },
  validee:       { label: 'Validée',       color: 'bg-green-100 text-green-700' },
  critique:      { label: 'Critique',      color: 'bg-red-100 text-red-700' },
  annulee:       { label: 'Annulée',       color: 'bg-gray-100 text-gray-500' },
};

const URGENCY_MAP: Record<string, { label: string; color: string }> = {
  routine: { label: 'Routine',   color: 'text-gray-500' },
  urgent:  { label: 'Urgent',    color: 'text-orange-600 font-semibold' },
  stat:    { label: 'STAT',      color: 'text-red-600 font-bold' },
};

function fmt(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function PatientLabOrdersTab({ patientId }: { patientId: string }) {
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<LabOrder[]>(`/lab-orders?patientId=${encodeURIComponent(patientId)}&limit=200`);
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      setError('Impossible de charger les analyses.');
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
        <FlaskConical size={40} className="opacity-20" />
        <p className="font-semibold text-sm">Aucune analyse prescrite</p>
        <p className="text-xs">Les demandes d'analyses apparaîtront ici.</p>
      </div>
    );
  }

  const critiques = orders.filter(o => o.isCritical || o.status === 'critique').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Analyses & Biologie</h3>
        <div className="flex items-center gap-2">
          {critiques > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-600 font-semibold bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
              <AlertTriangle size={11} /> {critiques} critique{critiques > 1 ? 's' : ''}
            </span>
          )}
          <span className="text-xs text-gray-400">{orders.length} prescription{orders.length !== 1 ? 's' : ''}</span>
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
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Analyse</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Catégorie</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Urgence</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Demandé par</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.map(o => {
                const s = STATUS_MAP[o.status] ?? { label: o.status, color: 'bg-gray-100 text-gray-500' };
                const u = URGENCY_MAP[o.urgency] ?? { label: o.urgency, color: 'text-gray-500' };
                return (
                  <tr key={o.id} className={`hover:bg-gray-50 transition-colors ${o.isCritical ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {o.test}
                      {o.isCritical && (
                        <span className="ml-1.5 text-xs text-red-600 font-bold">⚠</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{o.category || '—'}</td>
                    <td className={`px-4 py-3 ${u.color}`}>{u.label}</td>
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
