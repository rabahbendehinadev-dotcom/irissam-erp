import { createResource, For, Show } from "solid-js";
import { getQualityDashboard } from "@/services/api/quality";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from "recharts";

const SEVERITY_COLOR: Record<string, string> = {
  mineur: "#10B981", modere: "#F59E0B", grave: "#EF4444", critique: "#7C3AED",
};

const COLORS = ["#6366F1","#10B981","#F59E0B","#EF4444","#8B5CF6","#06B6D4","#EC4899","#F97316"];

function KPICard(props: { label: string; value: number|string; color: string; icon: string; alert?: boolean }) {
  return (
    <div class={`bg-white rounded-xl border p-4 flex items-center gap-4 shadow-sm ${props.alert ? "border-red-200" : "border-gray-100"}`}>
      <div class={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${props.color}`}>
        {props.icon}
      </div>
      <div>
        <p class={`text-2xl font-bold ${props.alert ? "text-red-600" : "text-gray-900"}`}>{props.value}</p>
        <p class="text-xs text-gray-500 leading-tight">{props.label}</p>
      </div>
    </div>
  );
}

// Risk Heatmap cell colors
function heatColor(criticality: number) {
  if (criticality >= 20) return "bg-red-600 text-white";
  if (criticality >= 15) return "bg-red-400 text-white";
  if (criticality >= 10) return "bg-orange-400 text-white";
  if (criticality >= 5)  return "bg-yellow-300 text-gray-800";
  return "bg-green-200 text-gray-700";
}

export default function QualityDashboard() {
  const [data, { refetch }] = createResource(getQualityDashboard);

  const kpis = () => data()?.kpis ?? {};
  const incidentsByMonth = () => (data()?.incidentsByMonth ?? []).map((r: any) => ({
    month: r.month, "Total": Number(r.total), "Graves/Critiques": Number(r.severe),
  }));
  const byType = () => (data()?.byType ?? []).map((r: any) => ({ name: r.name, value: Number(r.value) }));
  const capaStatus = () => {
    const raw: any[] = data()?.capaStatus ?? [];
    const map: Record<string, any> = {};
    raw.forEach(r => {
      if (!map[r.status]) map[r.status] = { status: r.status };
      map[r.status][r.capa_type === "corrective" ? "Corrective" : "Préventive"] = Number(r.cnt);
    });
    return Object.values(map);
  };
  const heatmap = () => data()?.riskHeatmap ?? [];
  const indicators = () => data()?.indicators ?? [];
  const upcomingAudits = () => data()?.upcomingAudits ?? [];
  const expiringDocs = () => data()?.expiringDocs ?? [];
  const overdueCapas = () => data()?.overdueCapas ?? [];

  // Build 5x5 heatmap grid
  const heatCells = () => {
    const map: Record<string, any> = {};
    for (const r of heatmap()) {
      map[`${r.probability}-${r.impact}`] = r;
    }
    return map;
  };

  return (
    <div class="space-y-6">
      <Show when={data.loading}><div class="text-center py-10 text-gray-400">Chargement du tableau de bord…</div></Show>
      <Show when={!data.loading}>
        {/* KPI cards */}
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KPICard label="Incidents ouverts (30j)" value={kpis().incidents_open_30d ?? 0} color="bg-orange-100" icon="⚠️" alert={Number(kpis().incidents_open_30d) > 0} />
          <KPICard label="Non-conformités ouvertes" value={kpis().nc_open ?? 0} color="bg-yellow-100" icon="❌" alert={Number(kpis().nc_open) > 5} />
          <KPICard label="CAPA en retard" value={(Number(kpis().capa_overdue ?? 0) + Number(kpis().papa_overdue ?? 0))} color="bg-red-100" icon="🕐" alert={Number(kpis().capa_overdue) > 0} />
          <KPICard label="Risques critiques" value={kpis().critical_risks ?? 0} color="bg-purple-100" icon="🚨" alert={Number(kpis().critical_risks) > 0} />
          <KPICard label="Audits planifiés (30j)" value={kpis().audits_upcoming ?? 0} color="bg-blue-100" icon="📋" />
          <KPICard label="Audits clos (90j)" value={kpis().audits_closed_90d ?? 0} color="bg-emerald-100" icon="✅" />
          <KPICard label="Documents expirant bientôt" value={kpis().docs_expiring_soon ?? 0} color="bg-amber-100" icon="📄" alert={Number(kpis().docs_expiring_soon) > 0} />
          <KPICard label="Documents expirés" value={kpis().docs_expired ?? 0} color="bg-red-100" icon="🗓️" alert={Number(kpis().docs_expired) > 0} />
          <KPICard label="Incidents clos (30j)" value={kpis().incidents_closed_30d ?? 0} color="bg-green-100" icon="🔒" />
          <KPICard label="Pièces en retard (PA)" value={kpis().papa_overdue ?? 0} color="bg-indigo-100" icon="🔄" />
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Incidents par mois */}
          <div class="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <h3 class="text-sm font-semibold text-gray-700 mb-4">Incidents — 12 derniers mois</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={incidentsByMonth()}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Total" stroke="#6366F1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Graves/Critiques" stroke="#EF4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Incidents par type */}
          <div class="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <h3 class="text-sm font-semibold text-gray-700 mb-4">Incidents par type (90j)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={byType()} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }: any) => `${name} ${(percent*100).toFixed(0)}%`}>
                  {byType().map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CAPA par statut */}
          <div class="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <h3 class="text-sm font-semibold text-gray-700 mb-4">CAPA par statut</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={capaStatus()}>
                <XAxis dataKey="status" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Corrective" fill="#6366F1" radius={[4,4,0,0]} />
                <Bar dataKey="Préventive" fill="#10B981" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Risk Heatmap 5×5 */}
          <div class="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <h3 class="text-sm font-semibold text-gray-700 mb-3">Heatmap des risques (probabilité × impact)</h3>
            <div class="overflow-x-auto">
              <table class="border-collapse text-xs">
                <thead>
                  <tr>
                    <th class="w-12 h-8 text-gray-400 text-right pr-2">P\I</th>
                    {[1,2,3,4,5].map(i => <th class="w-12 h-8 text-center text-gray-500 font-semibold">{i}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[5,4,3,2,1].map(p => (
                    <tr>
                      <td class="text-right pr-2 text-gray-500 font-semibold">{p}</td>
                      {[1,2,3,4,5].map(i => {
                        const cell = heatCells()[`${p}-${i}`];
                        const crit = p * i;
                        return (
                          <td class={`w-12 h-12 text-center rounded-sm border border-white ${heatColor(crit)}`}
                            title={cell ? `${cell.risk_count} risque(s)` : ""}>
                            {cell ? <span class="font-bold text-sm">{cell.risk_count}</span> : <span class="opacity-30">·</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div class="flex gap-2 mt-2 text-xs text-gray-500">
                {[["≥20","bg-red-600"],["15-19","bg-red-400"],["10-14","bg-orange-400"],["5-9","bg-yellow-300"],["<5","bg-green-200"]].map(([l,c]) =>
                  <span class="flex items-center gap-1"><span class={`w-3 h-3 rounded-sm ${c}`}/>{l}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Indicators */}
        <Show when={indicators().length > 0}>
          <div class="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <h3 class="text-sm font-semibold text-gray-700 mb-4">Indicateurs qualité</h3>
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <For each={indicators()}>
                {(ind: any) => {
                  const lastVal = ind.last_value !== null ? Number(ind.last_value) : null;
                  const target = ind.target_value !== null ? Number(ind.target_value) : null;
                  const isAlert = lastVal !== null && target !== null && lastVal > target;
                  return (
                    <div class={`rounded-xl border p-3 text-center ${isAlert ? "border-red-200 bg-red-50" : "border-gray-100"}`}>
                      <p class="text-xs text-gray-500 truncate mb-1">{ind.name}</p>
                      <p class={`text-2xl font-bold ${isAlert ? "text-red-600" : "text-gray-900"}`}>
                        {lastVal !== null ? lastVal.toFixed(1) : "—"} <span class="text-xs font-normal">{ind.unit}</span>
                      </p>
                      {target !== null && <p class="text-xs text-gray-400">Cible: {target} {ind.unit}</p>}
                      {ind.trend && <span class="text-xs">{ind.trend === "amelioration" ? "📈" : ind.trend === "degradation" ? "📉" : "➡️"}</span>}
                    </div>
                  );
                }}
              </For>
            </div>
          </div>
        </Show>

        {/* Overdue CAPAs */}
        <Show when={overdueCapas().length > 0}>
          <div class="bg-white rounded-xl border border-red-200 p-5 shadow-sm">
            <h3 class="text-sm font-semibold text-red-700 mb-3">⚠ CAPA en retard</h3>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-red-50 border-b border-red-100">
                  <tr>
                    {["Réf.","Titre","Type","Responsable","Service","Échéance"].map(h =>
                      <th class="px-3 py-2 text-left text-xs font-semibold text-red-600 uppercase">{h}</th>)}
                  </tr>
                </thead>
                <tbody class="divide-y divide-red-50">
                  <For each={overdueCapas()}>
                    {(c: any) => (
                      <tr class="hover:bg-red-50">
                        <td class="px-3 py-2 font-mono text-xs text-red-700">{c.reference}</td>
                        <td class="px-3 py-2 text-xs font-medium text-gray-900">{c.title}</td>
                        <td class="px-3 py-2"><span class={`px-2 py-0.5 rounded-full text-xs font-medium ${c.capa_type === "corrective" ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"}`}>{c.capa_type}</span></td>
                        <td class="px-3 py-2 text-xs text-gray-600">{c.responsible_name ?? "—"}</td>
                        <td class="px-3 py-2 text-xs text-gray-500">{c.department ?? "—"}</td>
                        <td class="px-3 py-2 text-xs font-bold text-red-600">{new Date(c.due_date).toLocaleDateString("fr-DZ")}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
        </Show>

        {/* Upcoming audits + expiring docs in two columns */}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Show when={upcomingAudits().length > 0}>
            <div class="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h3 class="text-sm font-semibold text-gray-700 mb-3">Audits à venir (30j)</h3>
              <div class="space-y-2">
                <For each={upcomingAudits()}>
                  {(a: any) => (
                    <div class="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div>
                        <p class="text-sm font-medium text-gray-900">{a.title}</p>
                        <p class="text-xs text-gray-500">{a.lead_auditor_name ?? "—"} · {a.audit_type}</p>
                      </div>
                      <span class="text-xs text-indigo-600 font-semibold">{new Date(a.planned_start_date).toLocaleDateString("fr-DZ")}</span>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
          <Show when={expiringDocs().length > 0}>
            <div class="bg-white rounded-xl border border-amber-200 p-5 shadow-sm">
              <h3 class="text-sm font-semibold text-amber-700 mb-3">⏰ Documents expirant bientôt</h3>
              <div class="space-y-2">
                <For each={expiringDocs()}>
                  {(d: any) => (
                    <div class="flex items-center justify-between py-2 border-b border-amber-50 last:border-0">
                      <div>
                        <p class="text-sm font-medium text-gray-900">{d.title}</p>
                        <p class="text-xs text-gray-500">{d.owner_name ?? "—"} · {d.doc_type}</p>
                      </div>
                      <span class="text-xs text-amber-700 font-semibold">{new Date(d.expiry_date).toLocaleDateString("fr-DZ")}</span>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
