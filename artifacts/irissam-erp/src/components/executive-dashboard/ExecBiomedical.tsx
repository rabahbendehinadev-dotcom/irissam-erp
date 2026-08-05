import { useEffect, useState } from 'react';
import { execApi, ExecFilters } from '@/services/api/executive-dashboard';
import { DrillTarget } from '@/pages/ExecutiveDashboard';
import { PieChart, Pie, Cell, Legend, ResponsiveContainer, Tooltip } from 'recharts';
import { Loader2, Wrench, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  operational: '#10b981', out_of_service: '#ef4444',
  under_maintenance: '#f59e0b', decommissioned: '#6b7280',
};

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n/1_000).toFixed(0)}K`;
  return String(Math.round(n));
}

export default function ExecBiomedical({ filters, onDrill }: { filters: ExecFilters; onDrill: (t: DrillTarget) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    execApi.biomedical(filters)
      .then((r: any) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filters]);

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (!data) return null;

  const s  = data.summary ?? {};
  const wo = data.workOrdersSummary ?? {};
  const byStatus = (data.byStatus ?? []).map((r: any) => ({
    name: r.status ?? 'N/A', value: Number(r.count), fill: STATUS_COLORS[r.status] ?? '#94a3b8',
  }));

  return (
    <div className="p-4 space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <BioCard label="Équipements total"     value={s.total             ?? 0} icon={<Wrench       className="w-5 h-5 text-blue-600"  />} color="bg-blue-50" />
        <BioCard label="Opérationnels"         value={s.operational       ?? 0} icon={<CheckCircle  className="w-5 h-5 text-green-600" />} color="bg-green-50" />
        <BioCard label="En panne"              value={s.outOfService      ?? 0} icon={<XCircle      className="w-5 h-5 text-red-600"   />} color="bg-red-50" alert={(s.outOfService ?? 0) > 0}
          onClick={() => onDrill({ metric:'equipements_en_panne', label:'Équipements en panne' })} />
        <BioCard label="Maintenance en retard" value={s.maintenanceOverdue ?? 0} icon={<AlertTriangle className="w-5 h-5 text-amber-600"/>} color="bg-amber-50" alert={(s.maintenanceOverdue ?? 0) > 0}
          onClick={() => onDrill({ metric:'maintenance_retard', label:'Maintenances en retard' })} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status pie */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Répartition par statut</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                {byStatus.map((r: any, i: number) => <Cell key={i} fill={r.fill} />)}
              </Pie>
              <Legend formatter={(v: string) => (({ operational:'Opérationnel', out_of_service:'En panne', under_maintenance:'Maintenance', decommissioned:'Retiré' } as Record<string, string>)[v] ?? v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Work orders summary */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Ordres de travail (période)</h3>
          <div className="space-y-3">
            {[
              { label: 'Total',          value: wo.total        ?? 0, color: 'text-gray-900' },
              { label: 'Ouverts',        value: wo.open         ?? 0, color: 'text-blue-600' },
              { label: 'En cours',       value: wo.inProgress   ?? 0, color: 'text-amber-600' },
              { label: 'Clôturés',       value: wo.closed       ?? 0, color: 'text-green-600' },
              { label: 'Coût total',     value: fmt(wo.totalCost ?? 0) + ' DZD', color: 'text-gray-900', raw: true },
              { label: 'Durée moy. réparation', value: `${wo.avgRepairHours ?? 0}h`, color: 'text-gray-900', raw: true },
            ].map((row, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-xs text-gray-500">{row.label}</span>
                <span className={`text-sm font-bold ${row.color}`}>
                  {(row as any).raw ? row.value : (row.value as number).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Maintenance due table */}
        {(data.maintenanceDue ?? []).length > 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-100 lg:col-span-2 cursor-pointer"
            onClick={() => onDrill({ metric:'maintenance_retard', label:'Maintenances en retard' })}>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Maintenances en retard ({(data.maintenanceDue ?? []).length})
              <span className="text-xs text-gray-400 ml-2">— cliquer pour détails</span>
            </h3>
            <div className="overflow-auto max-h-44">
              <table className="w-full text-xs">
                <thead><tr className="bg-gray-50">
                  <th className="text-left px-2 py-1.5 text-gray-500">Code</th>
                  <th className="text-left px-2 py-1.5 text-gray-500">Modèle</th>
                  <th className="text-right px-2 py-1.5 text-gray-500">Date prévue</th>
                  <th className="text-right px-2 py-1.5 text-gray-500">Retard (j)</th>
                </tr></thead>
                <tbody>{(data.maintenanceDue ?? []).slice(0, 10).map((r: any, i: number) => (
                  <tr key={i} className="border-t border-gray-50">
                    <td className="px-2 py-1.5 font-medium">{r.internal_code}</td>
                    <td className="px-2 py-1.5 text-gray-500 truncate max-w-[120px]">{r.model ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right">{r.next_maintenance_date ? new Date(r.next_maintenance_date).toLocaleDateString('fr-FR') : '—'}</td>
                    <td className={`px-2 py-1.5 text-right font-bold ${(r.days_overdue ?? 0) > 30 ? 'text-red-600' : 'text-amber-600'}`}>{r.days_overdue}</td>
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

function BioCard({ label, value, icon, color, alert, onClick }: { label: string; value: number; icon: React.ReactNode; color: string; alert?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`bg-white rounded-xl p-4 shadow-sm border text-left w-full hover:shadow-md transition-all ${alert ? 'border-red-200' : 'border-gray-100'} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}>
      <div className={`inline-flex p-2 rounded-lg mb-2 ${color}`}>{icon}</div>
      <div className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </button>
  );
}
