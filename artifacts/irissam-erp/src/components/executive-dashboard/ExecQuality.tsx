import { useEffect, useState } from 'react';
import { execApi, ExecFilters } from '@/services/api/executive-dashboard';
import { DrillTarget } from '@/pages/ExecutiveDashboard';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2, ShieldCheck, AlertTriangle, CheckCircle } from 'lucide-react';

export default function ExecQuality({ filters, onDrill }: { filters: ExecFilters; onDrill: (t: DrillTarget) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    execApi.quality(filters)
      .then((r: any) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filters]);

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (!data) return null;

  const s = data.incidentSummary ?? {};
  const trend = (data.incidentTrend ?? []).map((r: any) => ({ month: String(r.month).slice(0, 7), total: Number(r.total), critical: Number(r.critical) }));

  // 5x5 risk heatmap grid
  const heatmap: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0));
  (data.riskHeatmap ?? []).forEach((r: any) => {
    const p = Math.min(5, Math.max(1, Number(r.probability))) - 1;
    const i = Math.min(5, Math.max(1, Number(r.impact)))      - 1;
    heatmap[4 - p][i] = Number(r.count);
  });
  const heatColor = (p: number, i: number): string => {
    const score = (p + 1) * (i + 1);
    if (score >= 15) return 'bg-red-500 text-white';
    if (score >= 9)  return 'bg-orange-400 text-white';
    if (score >= 4)  return 'bg-yellow-300';
    return 'bg-green-200';
  };

  return (
    <div className="p-4 space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QCard label="Incidents ouverts"   value={s.open     ?? 0} alert={(s.open ?? 0) > 0}
          icon={<AlertTriangle  className="w-5 h-5 text-red-600"   />} color="bg-red-50"
          onClick={() => onDrill({ metric:'incidents_ouverts', label:'Incidents qualité ouverts' })} />
        <QCard label="Incidents critiques" value={s.critical ?? 0} alert={(s.critical ?? 0) > 0}
          icon={<AlertTriangle  className="w-5 h-5 text-red-600"   />} color="bg-red-50"
          onClick={() => onDrill({ metric:'incidents_ouverts', label:'Incidents qualité' })} />
        <QCard label="CAPA en retard"      value={(data.capaOverdue ?? []).length} alert={(data.capaOverdue ?? []).length > 0}
          icon={<AlertTriangle  className="w-5 h-5 text-amber-600" />} color="bg-amber-50"
          onClick={() => onDrill({ metric:'capa_retard', label:'CAPA en retard' })} />
        <QCard label="Incidents clôturés"  value={s.closed   ?? 0}
          icon={<CheckCircle    className="w-5 h-5 text-green-600" />} color="bg-green-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Incident trend */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Tendance incidents (12 mois)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trend}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="total"    stroke="#3b82f6" strokeWidth={2} dot={false} name="Total" />
              <Line type="monotone" dataKey="critical" stroke="#ef4444" strokeWidth={2} dot={false} name="Critiques" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Risk heatmap */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Heatmap des risques</h3>
          <div className="flex gap-2">
            <div className="flex flex-col justify-between text-xs text-gray-400 py-1">
              {['5','4','3','2','1'].map(n => <span key={n} className="h-8 flex items-center">{n}</span>)}
            </div>
            <div className="flex-1">
              <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                {heatmap.flatMap((row, pi) =>
                  row.map((count, ii) => (
                    <div key={`${pi}-${ii}`}
                      className={`h-8 rounded flex items-center justify-center text-xs font-bold ${heatColor(4-pi, ii)}`}>
                      {count > 0 ? count : ''}
                    </div>
                  ))
                )}
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                {['1','2','3','4','5'].map(n => <span key={n} className="text-center" style={{ width: '20%' }}>{n}</span>)}
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-gray-400">← Impact faible</span>
                <span className="text-gray-400">Impact élevé →</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top indicators */}
        {(data.topIndicators ?? []).length > 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 lg:col-span-2">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-500" /> Indicateurs qualité
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {(data.topIndicators ?? []).map((ind: any, i: number) => {
                const latest = Number(ind.latest_value ?? 0);
                const target = Number(ind.target_value ?? 0);
                const ok = target > 0 ? latest >= target : true;
                return (
                  <div key={i} className={`p-3 rounded-lg border ${ok ? 'border-green-100 bg-green-50' : 'border-amber-100 bg-amber-50'}`}>
                    <div className={`text-lg font-bold ${ok ? 'text-green-700' : 'text-amber-700'}`}>
                      {latest.toFixed(1)} <span className="text-xs font-normal">{ind.unit}</span>
                    </div>
                    <div className="text-xs font-medium text-gray-700 truncate">{ind.name}</div>
                    {target > 0 && <div className="text-xs text-gray-400">Cible: {target}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function QCard({ label, value, icon, color, alert, onClick }: { label: string; value: number; icon: React.ReactNode; color: string; alert?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`bg-white rounded-xl p-4 shadow-sm border text-left w-full hover:shadow-md transition-all ${alert ? 'border-red-200' : 'border-gray-100'} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}>
      <div className={`inline-flex p-2 rounded-lg mb-2 ${color}`}>{icon}</div>
      <div className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </button>
  );
}
