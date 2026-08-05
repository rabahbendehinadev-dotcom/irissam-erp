import { useEffect, useState } from 'react';
import { execApi, ExecFilters } from '@/services/api/executive-dashboard';
import { DrillTarget } from '@/pages/ExecutiveDashboard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2, Package, AlertTriangle, TrendingDown } from 'lucide-react';

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n/1_000).toFixed(0)}K`;
  return String(Math.round(n));
}

export default function ExecStock({ filters, onDrill }: { filters: ExecFilters; onDrill: (t: DrillTarget) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setErr(false);
    execApi.stock(filters)
      .then((r: any) => setData(r))
      .catch(() => setErr(true))
      .finally(() => setLoading(false));
  }, [filters, retryKey]);

  if (loading && !data) return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (err) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
      <AlertTriangle className="w-10 h-10 text-red-300" />
      <p className="text-sm">Erreur de chargement — Stock médical</p>
      <button onClick={() => setRetryKey(k => k + 1)} className="text-xs bg-slate-800 text-white px-3 py-1.5 rounded hover:bg-slate-700 transition-colors">Réessayer</button>
    </div>
  );
  if (!data) return null;

  const s = data.summary ?? {};
  const topConsumed = (data.topConsumed ?? []).slice(0, 8).map((r: any) => ({ name: String(r.name ?? 'N/A').slice(0, 18), val: Number(r.consumed) }));

  return (
    <div className="p-4 space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StockCard label="Valeur totale stock"  value={fmt(s.totalValue ?? 0) + ' DZD'} icon={<Package      className="w-5 h-5 text-blue-600"  />} color="bg-blue-50" />
        <StockCard label="Articles totaux"      value={(s.totalItems ?? 0).toLocaleString()} icon={<Package      className="w-5 h-5 text-indigo-600"/>} color="bg-indigo-50" />
        <StockCard label="Stock critique"       value={s.critical ?? 0}        icon={<AlertTriangle className="w-5 h-5 text-amber-600"/>} color="bg-amber-50" alert={(s.critical ?? 0) > 0}
          onClick={() => onDrill({ metric:'stock_critique', label:'Articles en stock critique' })} />
        <StockCard label="Ruptures totales"     value={s.stockout  ?? 0}        icon={<TrendingDown  className="w-5 h-5 text-red-600"  />} color="bg-red-50" alert={(s.stockout ?? 0) > 0}
          onClick={() => onDrill({ metric:'stock_critique', label:'Articles en rupture' })} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top consommations */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Top consommations (période)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topConsumed} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
              <Tooltip />
              <Bar dataKey="val" fill="#3b82f6" name="Consommé" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Lots expirant */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-100 cursor-pointer"
          onClick={() => onDrill({ metric:'lots_expirant', label:'Lots expirant bientôt' })}>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Lots expirant (90j) <span className="text-xs text-gray-400">— cliquer pour détails</span>
          </h3>
          {(data.expiringBatches ?? []).length === 0
            ? <p className="text-sm text-gray-400">Aucun lot expirant bientôt ✓</p>
            : <div className="overflow-auto max-h-52">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50">
                    <th className="text-left px-2 py-1.5 text-gray-500">Article</th>
                    <th className="text-right px-2 py-1.5 text-gray-500">Qté</th>
                    <th className="text-right px-2 py-1.5 text-gray-500">Jours</th>
                  </tr></thead>
                  <tbody>{(data.expiringBatches ?? []).slice(0, 10).map((r: any, i: number) => (
                    <tr key={i} className="border-t border-gray-50">
                      <td className="px-2 py-1.5 font-medium truncate max-w-[140px]">{r.item_name}</td>
                      <td className="px-2 py-1.5 text-right">{r.quantity_on_hand}</td>
                      <td className={`px-2 py-1.5 text-right font-bold ${(r.days_left ?? 99) <= 14 ? 'text-red-600' : (r.days_left ?? 99) <= 30 ? 'text-amber-600' : 'text-green-600'}`}>{r.days_left}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
          }
        </div>

        {/* Commandes en attente */}
        {(data.pendingOrders ?? []).length > 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 lg:col-span-2">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Commandes en attente ({(data.pendingOrders ?? []).length})</h3>
            <div className="overflow-auto max-h-44">
              <table className="w-full text-xs">
                <thead><tr className="bg-gray-50">
                  <th className="text-left px-2 py-1.5 text-gray-500">N° commande</th>
                  <th className="text-left px-2 py-1.5 text-gray-500">Statut</th>
                  <th className="text-right px-2 py-1.5 text-gray-500">Montant</th>
                  <th className="text-right px-2 py-1.5 text-gray-500">Livraison prévue</th>
                </tr></thead>
                <tbody>{(data.pendingOrders ?? []).map((r: any, i: number) => (
                  <tr key={i} className="border-t border-gray-50">
                    <td className="px-2 py-1.5 font-medium">{r.order_number}</td>
                    <td className="px-2 py-1.5 text-gray-500">{r.status}</td>
                    <td className="px-2 py-1.5 text-right">{fmt(Number(r.total_amount ?? 0))} DZD</td>
                    <td className="px-2 py-1.5 text-right">{r.expected_delivery_date ? new Date(r.expected_delivery_date).toLocaleDateString('fr-FR') : '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StockCard({ label, value, icon, color, alert, onClick }: { label: string; value: string | number; icon: React.ReactNode; color: string; alert?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`bg-white rounded-xl p-4 shadow-sm border text-left w-full hover:shadow-md transition-all ${alert ? 'border-red-200' : 'border-gray-100'} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}>
      <div className={`inline-flex p-2 rounded-lg mb-2 ${color}`}>{icon}</div>
      <div className="text-xl font-bold text-gray-900">{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </button>
  );
}
