import { useEffect, useState } from 'react';
import { execApi, ExecFilters } from '@/services/api/executive-dashboard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Loader2, BedDouble, HeartPulse, Scissors, AlertTriangle } from 'lucide-react';

export default function ExecCapacity({ filters }: { filters: ExecFilters }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    execApi.capacity(filters)
      .then((r: any) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filters]);

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (!data) return null;

  const icuRate = data.icu?.rate ?? 0;
  const bedsByService = (data.beds?.byService ?? []).slice(0, 12).map((r: any) => ({
    name: String(r.service ?? 'N/A').slice(0, 12),
    occupied: Number(r.occupied), available: Number(r.available),
    rate: Number(r.total) > 0 ? Math.round(100 * Number(r.occupied) / Number(r.total)) : 0,
  }));

  return (
    <div className="p-4 space-y-6">
      {/* Gauges */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <OccGauge label="Occupation globale lits"
          value={bedsByService.length > 0
            ? Math.round(bedsByService.reduce((s: number, r: { rate: number }) => s + r.rate, 0) / bedsByService.length) : 0}
          icon={<BedDouble className="w-5 h-5" />} color="blue" />
        <OccGauge label="ICU / Réanimation" value={icuRate}
          icon={<HeartPulse className="w-5 h-5" />} color={icuRate >= 100 ? 'red' : icuRate >= 80 ? 'orange' : 'green'} />
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-slate-600 mb-2">
            <Scissors className="w-5 h-5" /><span className="text-sm font-medium">Bloc opératoire</span>
          </div>
          {(data.bloc?.rooms ?? []).map((r: any, i: number) => (
            <div key={i} className="flex justify-between text-xs mt-1">
              <span className="text-gray-500">{r.status}</span>
              <span className="font-semibold">{r.count}</span>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-red-100">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <AlertTriangle className="w-5 h-5" /><span className="text-sm font-medium">Services saturés</span>
          </div>
          <div className="text-3xl font-bold text-red-600">{(data.saturatedServices ?? []).length}</div>
          <div className="text-xs text-gray-500 mt-1">occupation ≥ 90%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Occupation par service */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Occupation par service</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bedsByService} layout="vertical">
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
              <Tooltip formatter={(v: any) => `${v}%`} />
              <Bar dataKey="rate" name="Occupation" radius={[0, 4, 4, 0]}>
                {bedsByService.map((r: any, i: number) => (
                  <Cell key={i} fill={r.rate >= 90 ? '#ef4444' : r.rate >= 75 ? '#f59e0b' : '#10b981'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Services saturés table */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Services saturés (≥90%)</h3>
          {(data.saturatedServices ?? []).length === 0
            ? <p className="text-sm text-gray-400">Aucun service saturé ✓</p>
            : <div className="overflow-auto max-h-52">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50">
                    <th className="text-left px-2 py-1.5 text-gray-500">Service</th>
                    <th className="text-right px-2 py-1.5 text-gray-500">Total</th>
                    <th className="text-right px-2 py-1.5 text-gray-500">Occupés</th>
                    <th className="text-right px-2 py-1.5 text-gray-500">Taux</th>
                  </tr></thead>
                  <tbody>{(data.saturatedServices ?? []).map((r: any, i: number) => (
                    <tr key={i} className="border-t border-gray-50">
                      <td className="px-2 py-1.5 font-medium">{r.service ?? 'N/A'}</td>
                      <td className="px-2 py-1.5 text-right">{r.total}</td>
                      <td className="px-2 py-1.5 text-right">{r.occupied}</td>
                      <td className="px-2 py-1.5 text-right font-bold text-red-600">{r.rate}%</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
          }
        </div>
      </div>
    </div>
  );
}

function OccGauge({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    blue: 'text-blue-600 bg-blue-50', green: 'text-green-600 bg-green-50',
    orange: 'text-orange-600 bg-orange-50', red: 'text-red-600 bg-red-50',
  };
  const barColors: Record<string, string> = {
    blue: 'bg-blue-500', green: 'bg-green-500', orange: 'bg-orange-500', red: 'bg-red-500',
  };
  return (
    <div className={`bg-white rounded-xl p-4 shadow-sm border ${value >= 90 ? 'border-red-200' : 'border-gray-100'}`}>
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm font-medium mb-2 ${colors[color]}`}>
        {icon}<span>{value}%</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mt-1">
        <div className={`h-full rounded-full transition-all ${barColors[color]}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <div className="text-xs text-gray-500 mt-2">{label}</div>
    </div>
  );
}
