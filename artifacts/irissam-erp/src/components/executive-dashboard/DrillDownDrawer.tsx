import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { execApi, ExecFilters } from '@/services/api/executive-dashboard';
import { DrillTarget } from '@/pages/ExecutiveDashboard';

interface Props {
  target: DrillTarget;
  filters: ExecFilters;
  onClose: () => void;
}

const COLUMN_LABELS: Record<string, string> = {
  patient_name: 'Patient', priority: 'Priorité', status: 'Statut',
  wait_minutes: 'Attente (min)', chief_complaint: 'Motif',
  invoice_number: 'N° Facture', total_amount: 'Montant', remaining_amount: 'Reste',
  invoice_date: 'Date', insurance_type: 'Assurance',
  name: 'Désignation', quantity_on_hand: 'Qté stock', reorder_point: 'Seuil',
  unit_cost: 'Coût unit.', stock_pct: '% stock',
  matricule: 'Matricule', category: 'Catégorie', department: 'Département',
  internal_code: 'Code', serial_number: 'N° Série', criticality: 'Criticité',
  next_maintenance_date: 'Proch. maintenance', days_overdue: 'Jours retard',
  reference: 'Référence', title: 'Titre', severity: 'Sévérité',
  occurred_date: 'Date survenance', due_date: 'Échéance',
  batch_number: 'N° lot', item_name: 'Article', expiry_date: 'Expiration', days_left: 'Jours restants',
};

function fmt(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'number') return val.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  const s = String(val);
  // ISO date
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return new Date(s).toLocaleDateString('fr-FR');
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T00:00:00').toLocaleDateString('fr-FR');
  return s;
}

export default function DrillDownDrawer({ target, filters, onClose }: Props) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setData([]);
    execApi.drilldown(target.metric, filters)
      .then((res: any) => { if (!cancelled) setData((res as any)?.data ?? res ?? []); })
      .catch(() => { if (!cancelled) setError('Impossible de charger les données.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [target.metric, filters]);

  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Drawer — bottom sheet on mobile, right panel on desktop */}
      <div className="fixed z-50
        bottom-0 left-0 right-0 h-[80vh] rounded-t-2xl
        md:bottom-auto md:right-0 md:top-0 md:w-[600px] md:h-full md:rounded-none
        bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-900 text-white
          rounded-t-2xl md:rounded-none">
          <h2 className="font-semibold text-sm">{target.label}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading && (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          )}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {!loading && !error && data.length === 0 && (
            <p className="text-gray-400 text-sm text-center mt-8">Aucun résultat.</p>
          )}
          {!loading && data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    {columns.map(col => (
                      <th key={col} className="text-left px-3 py-2 font-medium text-gray-600 border-b whitespace-nowrap">
                        {COLUMN_LABELS[col] ?? col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      {columns.map(col => (
                        <td key={col} className="px-3 py-2 border-b border-gray-100 whitespace-nowrap">
                          {fmt(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-400 mt-2">{data.length} résultat(s)</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
