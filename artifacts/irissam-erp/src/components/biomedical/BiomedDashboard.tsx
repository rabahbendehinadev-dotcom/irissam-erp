import { createResource, For, Show } from "solid-js";
import { getBiomedDashboard } from "@/services/api/biomedical";
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
         XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const STATUS_COLORS: Record<string,string> = {
  actif:"#10B981", en_maintenance:"#F59E0B", hors_service:"#EF4444",
  retire:"#94A3B8", en_attente_installation:"#6366F1", reserve:"#8B5CF6",
};
const CRITICALITY_COLORS: Record<string,string> = {
  critique:"#EF4444", haute:"#F97316", normale:"#6366F1", faible:"#94A3B8",
};

function KPI(props: { label: string; value: unknown; color?: string; sub?: string }) {
  return (
    <div class="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <p class="text-xs text-gray-500 font-medium uppercase tracking-wide">{props.label}</p>
      <p class={`text-3xl font-bold mt-1 ${props.color ?? "text-gray-900"}`}>{props.value ?? 0}</p>
      {props.sub && <p class="text-xs text-gray-400 mt-1">{props.sub}</p>}
    </div>
  );
}

export default function BiomedDashboard() {
  const [dash] = createResource(getBiomedDashboard);

  return (
    <div class="space-y-6 p-1">
      <Show when={dash.loading}>
        <div class="flex justify-center py-20"><div class="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"/></div>
      </Show>
      <Show when={dash.error}>
        <div class="p-4 bg-red-50 rounded-lg text-red-700">Erreur chargement dashboard: {String(dash.error)}</div>
      </Show>
      <Show when={dash()}>
        {(d) => (
          <>
            {/* KPI Row */}
            <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              <KPI label="Total équipements" value={d().kpis?.total_equipment} />
              <KPI label="Actifs"            value={d().kpis?.active_count}     color="text-emerald-600" />
              <KPI label="Hors service"      value={d().kpis?.out_of_service}   color="text-red-600" />
              <KPI label="En maintenance"    value={d().kpis?.in_maintenance}   color="text-amber-600" />
              <KPI label="Calib. expirées"   value={d().kpis?.calibration_expired_count} color="text-orange-600" />
              <KPI label="Maint. en retard"  value={d().kpis?.maintenance_overdue} color="text-red-600" />
              <KPI label="Maint. auj."       value={d().kpis?.maintenance_today} color="text-indigo-600" />
              <KPI label="Val. actifs (DA)"  value={Number(d().kpis?.total_asset_value ?? 0).toLocaleString("fr-DZ")} />
            </div>

            {/* Charts row */}
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Status pie */}
              <div class="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <h3 class="text-sm font-semibold text-gray-700 mb-4">Par statut</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={d().byStatus?.map((s: any) => ({ name: s.status, value: Number(s.count) }))}
                         dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                      <For each={d().byStatus}>
                        {(s: any, i) => <Cell key={i()} fill={STATUS_COLORS[s.status] ?? "#94A3B8"} />}
                      </For>
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Category bar */}
              <div class="bg-white rounded-xl border border-gray-100 p-4 shadow-sm col-span-2">
                <h3 class="text-sm font-semibold text-gray-700 mb-4">Par catégorie</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={d().byCategory?.map((c: any) => ({ name: c.name, Équipements: Number(c.count) }))}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="Équipements" fill="#6366F1" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Cost trend + maintenance plan */}
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Cost trend */}
              <div class="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <h3 class="text-sm font-semibold text-gray-700 mb-4">Coût maintenance (12 mois)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={d().costTrend?.map((r: any) => ({ mois: r.month, Coût: Number(r.cost) }))}>
                    <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => v.toLocaleString("fr-DZ") + " DA"} />
                    <Line type="monotone" dataKey="Coût" stroke="#6366F1" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Upcoming maintenance */}
              <div class="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <h3 class="text-sm font-semibold text-gray-700 mb-3">Maintenance planifiée (30 jours)</h3>
                <div class="space-y-2 max-h-52 overflow-y-auto">
                  <Show when={!d().maintenancePlan?.length}>
                    <p class="text-sm text-gray-400 text-center py-6">Aucune maintenance planifiée</p>
                  </Show>
                  <For each={d().maintenancePlan}>
                    {(item: any) => {
                      const due = new Date(item.next_maintenance_date);
                      const isOverdue = due < new Date();
                      return (
                        <div class={`flex items-center justify-between p-2 rounded-lg border ${isOverdue ? "border-red-200 bg-red-50" : "border-gray-100"}`}>
                          <div>
                            <p class="text-sm font-medium text-gray-800">{item.name}</p>
                            <p class="text-xs text-gray-500">{item.location_name}</p>
                          </div>
                          <span class={`text-xs font-semibold px-2 py-0.5 rounded-full ${isOverdue ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                            {due.toLocaleDateString("fr-DZ")}
                          </span>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </div>
            </div>

            {/* Bottom row */}
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Top failures */}
              <div class="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <h3 class="text-sm font-semibold text-gray-700 mb-3">Top pannes (90 jours)</h3>
                <div class="space-y-2">
                  <Show when={!d().topFailures?.length}>
                    <p class="text-sm text-gray-400 text-center py-4">Aucune panne enregistrée</p>
                  </Show>
                  <For each={d().topFailures}>
                    {(item: any) => (
                      <div class="flex items-center justify-between">
                        <div>
                          <p class="text-sm font-medium text-gray-800">{item.name}</p>
                          <p class="text-xs text-gray-400">{item.internal_code}</p>
                        </div>
                        <div class="text-right">
                          <p class="text-sm font-bold text-red-600">{item.failure_count} pannes</p>
                          <p class="text-xs text-gray-400">{Number(item.total_downtime).toFixed(1)}h arrêt</p>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </div>

              {/* Expiring calibrations */}
              <div class="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <h3 class="text-sm font-semibold text-gray-700 mb-3">Calibrations à échéance</h3>
                <div class="space-y-2 max-h-48 overflow-y-auto">
                  <Show when={!d().expiringSoon?.length}>
                    <p class="text-sm text-gray-400 text-center py-4">Aucune calibration urgente</p>
                  </Show>
                  <For each={d().expiringSoon}>
                    {(item: any) => (
                      <div class={`flex items-center justify-between p-2 rounded-lg ${item.calibration_expired ? "bg-red-50" : "bg-orange-50"}`}>
                        <div>
                          <p class="text-xs font-medium text-gray-800">{item.name}</p>
                          <p class="text-xs text-gray-500">{item.internal_code}</p>
                        </div>
                        <span class={`text-xs font-bold ${item.calibration_expired ? "text-red-600" : "text-orange-600"}`}>
                          {item.calibration_expired ? "EXPIRÉE" : new Date(item.next_calibration_date).toLocaleDateString("fr-DZ")}
                        </span>
                      </div>
                    )}
                  </For>
                </div>
              </div>

              {/* Perf indicators */}
              <div class="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <h3 class="text-sm font-semibold text-gray-700 mb-3">Indicateurs de performance</h3>
                <div class="space-y-3">
                  <div class="flex justify-between items-center">
                    <p class="text-sm text-gray-600">MTTR moyen</p>
                    <p class="text-lg font-bold text-indigo-600">{Number(d().mttr ?? 0).toFixed(1)}h</p>
                  </div>
                  <div class="flex justify-between items-center">
                    <p class="text-sm text-gray-600">Pannes (90j)</p>
                    <p class="text-lg font-bold text-red-600">{d().totalFailures90d ?? 0}</p>
                  </div>
                  <div class="flex justify-between items-center">
                    <p class="text-sm text-gray-600">OT récents</p>
                    <p class="text-lg font-bold text-gray-700">{d().recentWorkOrders?.length ?? 0}</p>
                  </div>
                  <div class="flex justify-between items-center">
                    <p class="text-sm text-gray-600">Criticité haute</p>
                    <p class="text-lg font-bold text-orange-600">
                      {d().byCriticality?.find((c: any) => c.criticality === "haute")?.count ?? 0} éq.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </Show>
    </div>
  );
}
