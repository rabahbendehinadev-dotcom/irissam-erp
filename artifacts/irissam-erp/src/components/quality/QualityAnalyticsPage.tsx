import { createResource } from "solid-js";
import { getQualityDashboard } from "@/services/api/quality";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, Cell, PieChart, Pie,
} from "recharts";

const COLORS = ["#6366F1","#10B981","#F59E0B","#EF4444","#8B5CF6","#06B6D4","#EC4899","#F97316"];
const SEV_COLORS: Record<string,string> = {
  mineur: "#10B981", modere: "#F59E0B", grave: "#EF4444", critique: "#7C3AED",
};

export default function QualityAnalyticsPage() {
  const [data] = createResource(getQualityDashboard);

  const incidentsByMonth = () => (data()?.incidentsByMonth ?? []).map((r: any) => ({
    month: r.month, "Total": Number(r.total), "Graves/Critiques": Number(r.severe),
  }));
  const byType = () => (data()?.byType ?? []).map((r: any) => ({ name: r.name.replace(/_/g," "), value: Number(r.value) }));
  const bySeverity = () => (data()?.bySeverity ?? []).map((r: any) => ({ name: r.name, value: Number(r.value) }));
  const capaStatus = () => {
    const raw: any[] = data()?.capaStatus ?? [];
    const map: Record<string, any> = {};
    raw.forEach(r => {
      if (!map[r.status]) map[r.status] = { status: r.status.replace(/_/g," "), Corrective: 0, Préventive: 0 };
      map[r.status][r.capa_type === "corrective" ? "Corrective" : "Préventive"] = Number(r.cnt);
    });
    return Object.values(map);
  };
  const heatmap = () => data()?.riskHeatmap ?? [];
  const indicators = () => (data()?.indicators ?? []).filter((i: any) => i.last_value !== null).map((i: any) => ({
    name: i.name.length > 20 ? i.name.slice(0,20)+"…" : i.name,
    Valeur: Number(i.last_value),
    Cible: i.target_value ? Number(i.target_value) : undefined,
  }));

  function heatColor(c: number) {
    if (c >= 20) return "bg-red-600 text-white";
    if (c >= 15) return "bg-red-400 text-white";
    if (c >= 10) return "bg-orange-400 text-white";
    if (c >= 5)  return "bg-yellow-300 text-gray-800";
    return "bg-green-200 text-gray-700";
  }

  const heatCells = () => {
    const map: Record<string, any> = {};
    for (const r of heatmap()) { map[`${r.probability}-${r.impact}`] = r; }
    return map;
  };

  return (
    <div class="space-y-6">
      {/* Incidents trend */}
      <div class="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h3 class="text-sm font-semibold text-gray-700 mb-4">Tendance mensuelle des incidents (12 mois)</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={incidentsByMonth()}>
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="Total" stroke="#6366F1" strokeWidth={2} dot={{ r:3 }} />
            <Line type="monotone" dataKey="Graves/Critiques" stroke="#EF4444" strokeWidth={2} dot={{ r:3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By type */}
        <div class="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 class="text-sm font-semibold text-gray-700 mb-4">Incidents par type (90j)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={byType()} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                label={({ name, percent }: any) => `${name} ${(percent*100).toFixed(0)}%`}>
                {byType().map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* By severity */}
        <div class="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 class="text-sm font-semibold text-gray-700 mb-4">Incidents ouverts par sévérité</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bySeverity()}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[6,6,0,0]}>
                {bySeverity().map((r: any, i: number) =>
                  <Cell key={i} fill={SEV_COLORS[r.name] ?? COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* CAPA status */}
      <div class="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h3 class="text-sm font-semibold text-gray-700 mb-4">CAPA — répartition par statut</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={capaStatus()}>
            <XAxis dataKey="status" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Corrective" fill="#6366F1" radius={[4,4,0,0]} stackId="a" />
            <Bar dataKey="Préventive" fill="#10B981" radius={[4,4,0,0]} stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Indicators bar */}
      <div class="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h3 class="text-sm font-semibold text-gray-700 mb-4">Indicateurs qualité — dernière valeur vs cible</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={indicators()}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Valeur" fill="#6366F1" radius={[4,4,0,0]} />
            <Bar dataKey="Cible" fill="#10B981" radius={[4,4,0,0]} fillOpacity={0.5} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Risk heatmap full */}
      <div class="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h3 class="text-sm font-semibold text-gray-700 mb-4">Matrice des risques (heatmap 5×5)</h3>
        <div class="flex gap-8 items-start">
          <div>
            <p class="text-xs text-gray-500 mb-2 text-center">← Impact →</p>
            <table class="border-collapse text-xs">
              <thead>
                <tr>
                  <th class="w-16 h-8 text-gray-400 text-right pr-2">P\I</th>
                  {[1,2,3,4,5].map(i => <th class="w-14 h-8 text-center text-gray-500 font-semibold">{i}</th>)}
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
                        <td class={`w-14 h-14 text-center rounded-md border-2 border-white ${heatColor(crit)} relative group`}>
                          {cell ? (
                            <div>
                              <span class="font-bold text-lg">{cell.risk_count}</span>
                              <span class="hidden group-hover:block absolute z-10 left-full top-0 ml-1 bg-gray-900 text-white text-xs rounded-lg px-2 py-1 w-40 whitespace-normal">
                                {cell.risk_titles?.slice(0,3).join(", ")}
                              </span>
                            </div>
                          ) : <span class="opacity-20">·</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div class="flex gap-2 mt-3 text-xs text-gray-500 flex-wrap">
              {[["≥20 — Inacceptable","bg-red-600"],["15–19 — Critique","bg-red-400"],["10–14 — Élevé","bg-orange-400"],["5–9 — Modéré","bg-yellow-300"],["<5 — Faible","bg-green-200"]].map(([l,c]) =>
                <span class="flex items-center gap-1"><span class={`w-3 h-3 rounded-sm ${c}`}/>{l}</span>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
