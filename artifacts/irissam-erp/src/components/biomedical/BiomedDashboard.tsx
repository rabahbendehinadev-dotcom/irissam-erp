import { useState, useEffect } from "react";
import { getBiomedDashboard } from "@/services/api/biomedical";
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
         XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const STATUS_COLORS: Record<string,string> = {
  actif:"#10B981", en_maintenance:"#F59E0B", hors_service:"#EF4444",
  retire:"#94A3B8", en_attente_installation:"#6366F1", reserve:"#8B5CF6",
};

function KPI(props: { label: string; value: unknown; color?: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{props.label}</p>
      <p className={`text-3xl font-bold mt-1 ${props.color ?? "text-gray-900"}`}>{props.value ?? 0}</p>
      {props.sub && <p className="text-xs text-gray-400 mt-1">{props.sub}</p>}
    </div>
  );
}

export default function BiomedDashboard() {
  const [dash, setDash] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getBiomedDashboard().then(d => { setDash(d); setLoading(false); }).catch(e => { setError(e); setLoading(false); });
  }, []);

  return (
    <div className="space-y-6 p-1">
      {loading && (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"/></div>
      )}
      {error && (
        <div className="p-4 bg-red-50 rounded-lg text-red-700">Erreur chargement dashboard: {String(error)}</div>
      )}
      {!loading && dash && (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <KPI label="Total équipements" value={dash.kpis?.total_equipment} />
            <KPI label="Actifs"            value={dash.kpis?.active_count}     color="text-emerald-600" />
            <KPI label="Hors service"      value={dash.kpis?.out_of_service}   color="text-red-600" />
            <KPI label="En maintenance"    value={dash.kpis?.in_maintenance}   color="text-amber-600" />
            <KPI label="Calib. expirées"   value={dash.kpis?.calibration_expired_count} color="text-orange-600" />
            <KPI label="Maint. en retard"  value={dash.kpis?.maintenance_overdue} color="text-red-600" />
            <KPI label="Maint. auj."       value={dash.kpis?.maintenance_today} color="text-indigo-600" />
            <KPI label="Val. actifs (DA)"  value={Number(dash.kpis?.total_asset_value ?? 0).toLocaleString("fr-DZ")} />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Par statut</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={dash.byStatus?.map((s: any) => ({ name: s.status, value: Number(s.count) }))}
                       dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                    {dash.byStatus?.map((s: any, i: number) => <Cell key={i} fill={STATUS_COLORS[s.status] ?? "#94A3B8"} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm col-span-2">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Par catégorie</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dash.byCategory?.map((c: any) => ({ name: c.name, Équipements: Number(c.count) }))}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="Équipements" fill="#6366F1" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Coût maintenance (12 mois)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dash.costTrend?.map((r: any) => ({ mois: r.month, Coût: Number(r.cost) }))}>
                  <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => v.toLocaleString("fr-DZ") + " DA"} />
                  <Line type="monotone" dataKey="Coût" stroke="#6366F1" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Maintenance planifiée (30 jours)</h3>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {!dash.maintenancePlan?.length && (
                  <p className="text-sm text-gray-400 text-center py-6">Aucune maintenance planifiée</p>
                )}
                {dash.maintenancePlan?.map((item: any, i: number) => {
                  const due = new Date(item.next_maintenance_date);
                  const isOverdue = due < new Date();
                  return (
                    <div key={i} className={`flex items-center justify-between p-2 rounded-lg border ${isOverdue ? "border-red-200 bg-red-50" : "border-gray-100"}`}>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.location_name}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isOverdue ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                        {due.toLocaleDateString("fr-DZ")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Top pannes (90 jours)</h3>
              <div className="space-y-2">
                {!dash.topFailures?.length && (
                  <p className="text-sm text-gray-400 text-center py-4">Aucune panne enregistrée</p>
                )}
                {dash.topFailures?.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.internal_code}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600">{item.failure_count} pannes</p>
                      <p className="text-xs text-gray-400">{Number(item.total_downtime).toFixed(1)}h arrêt</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Calibrations à échéance</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {!dash.expiringSoon?.length && (
                  <p className="text-sm text-gray-400 text-center py-4">Aucune calibration urgente</p>
                )}
                {dash.expiringSoon?.map((item: any, i: number) => (
                  <div key={i} className={`flex items-center justify-between p-2 rounded-lg ${item.calibration_expired ? "bg-red-50" : "bg-orange-50"}`}>
                    <div>
                      <p className="text-xs font-medium text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.internal_code}</p>
                    </div>
                    <span className={`text-xs font-bold ${item.calibration_expired ? "text-red-600" : "text-orange-600"}`}>
                      {item.calibration_expired ? "EXPIRÉE" : new Date(item.next_calibration_date).toLocaleDateString("fr-DZ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Indicateurs de performance</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-600">MTTR moyen</p>
                  <p className="text-lg font-bold text-indigo-600">{Number(dash.mttr ?? 0).toFixed(1)}h</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-600">Pannes (90j)</p>
                  <p className="text-lg font-bold text-red-600">{dash.totalFailures90d ?? 0}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-600">OT récents</p>
                  <p className="text-lg font-bold text-gray-700">{dash.recentWorkOrders?.length ?? 0}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-600">Criticité haute</p>
                  <p className="text-lg font-bold text-orange-600">
                    {dash.byCriticality?.find((c: any) => c.criticality === "haute")?.count ?? 0} éq.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
