import { useState, useEffect } from "react";
import { getQualityAnalytics } from "@/services/api/quality";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Cell } from "recharts";

const COLORS = ["#6366F1","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#06B6D4","#F97316"];

function riskColor(score: number) {
  if (score >= 15) return "#EF4444";
  if (score >= 9)  return "#F97316";
  if (score >= 5)  return "#F59E0B";
  return "#10B981";
}

export default function QualityAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getQualityAnalytics()
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const incidentTrend    = data?.incident_trend ?? [];
  const ncByDepartment   = data?.nc_by_department ?? [];
  const capaEffectiveness= data?.capa_effectiveness ?? [];
  const riskDistribution = data?.risk_distribution ?? [];
  const auditScores      = data?.audit_scores ?? [];
  const indicatorSummary = data?.indicator_summary ?? {};
  const riskMatrix       = data?.risk_matrix ?? [];

  const heatCells = Array.from({ length: 5 }, (_, pi) => {
    const prob = 5 - pi;
    return Array.from({ length: 5 }, (_, ii) => {
      const impact = ii + 1;
      const cell = riskMatrix.find((r: any) => Number(r.probability) === prob && Number(r.impact) === impact);
      return { prob, impact, count: cell?.count ?? 0, score: prob * impact };
    });
  });

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-gray-400">
      <div className="text-center"><div className="text-4xl mb-3">📊</div><p className="text-sm">Chargement des analytics qualité…</p></div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Indicator KPI summary */}
      {indicatorSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label:"Indicateurs actifs",    value: indicatorSummary.active ?? 0,     color:"text-indigo-600",  bg:"bg-indigo-50" },
            { label:"En cible",              value: indicatorSummary.on_target ?? 0,   color:"text-emerald-600", bg:"bg-emerald-50" },
            { label:"Hors cible",            value: indicatorSummary.off_target ?? 0,  color:"text-red-600",     bg:"bg-red-50" },
            { label:"Sans données (30j)",    value: indicatorSummary.no_data ?? 0,     color:"text-gray-500",    bg:"bg-gray-50" },
          ].map(k => (
            <div key={k.label} className={`${k.bg} rounded-xl p-4`}>
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-xs text-gray-600 mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Incident trend */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Tendance incidents (12 mois)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={incidentTrend.map((r: any) => ({
              mois: `${r.month}/${String(r.year).slice(2)}`,
              Incidents: r.count,
              Clôturés: r.closed_count ?? 0,
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="mois" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="Incidents" stroke="#EF4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Clôturés" stroke="#10B981" strokeWidth={2} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* NC by department */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Non-conformités par service</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ncByDepartment.map((r: any) => ({
              service: r.department?.length > 14 ? r.department.slice(0,14)+"…" : (r.department ?? "N/A"),
              NC: r.count,
            }))}>
              <XAxis dataKey="service" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="NC" radius={[4,4,0,0]}>
                {ncByDepartment.map((_: any, i: number) =>
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                )}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* CAPA effectiveness */}
        {capaEffectiveness.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Efficacité CAPA par type</h3>
            <div className="space-y-3">
              {capaEffectiveness.map((r: any) => {
                const closed = Number(r.closed_count);
                const total  = Number(r.total_count);
                const pct    = total ? Math.round(closed / total * 100) : 0;
                return (
                  <div key={r.type} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 w-24 capitalize">{r.type}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3">
                      <div className={`h-3 rounded-full ${pct>=80?"bg-emerald-500":pct>=50?"bg-amber-500":"bg-red-500"}`}
                        style={{ width:`${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-gray-700 w-12 text-right">{pct}% ({closed}/{total})</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Risk distribution */}
        {riskDistribution.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribution des risques par catégorie</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={riskDistribution.map((r: any) => ({
                catégorie: r.category,
                Risques: r.count,
                "Score moy.": Number(r.avg_score).toFixed(1),
              }))}>
                <XAxis dataKey="catégorie" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="Risques" radius={[4,4,0,0]}>
                  {riskDistribution.map((r: any, i: number) =>
                    <Cell key={i} fill={riskColor(Number(r.avg_score))} />
                  )}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Audit scores */}
      {auditScores.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Résultats des audits récents</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{["Audit","Type","Service","Clôturé le","NC","Observations","Score"].map(h =>
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {auditScores.map((a: any) => {
                  const score = a.score ?? null;
                  const sc = score !== null ? (score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-red-600") : "text-gray-400";
                  return (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs font-medium text-gray-900">{a.title}</td>
                      <td className="px-4 py-3 text-xs capitalize text-gray-600">{a.type}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{a.department ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{a.closed_at ? new Date(a.closed_at).toLocaleDateString("fr-DZ") : "—"}</td>
                      <td className="px-4 py-3 text-xs text-center text-orange-600 font-semibold">{a.nc_count ?? 0}</td>
                      <td className="px-4 py-3 text-xs text-center text-blue-600">{a.observations ?? 0}</td>
                      <td className={`px-4 py-3 text-xs font-bold ${sc}`}>{score !== null ? `${score}/100` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Risk heatmap */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Matrice des risques consolidée</h3>
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-gray-400 font-normal">Prob ↓ / Impact →</th>
                {["1-Mineur","2-Modéré","3-Majeur","4-Critique","5-Catastrophique"].map(h =>
                  <th key={h} className="p-2 text-center text-gray-500 font-medium w-24">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {heatCells.map((row, ri) => (
                <tr key={ri}>
                  <td className="p-2 text-center font-medium text-gray-500">{5-ri}</td>
                  {row.map(cell => (
                    <td key={cell.impact} className={`p-3 text-center font-bold rounded m-0.5 ${
                      cell.score>=15 ? "bg-red-500 text-white" :
                      cell.score>=9  ? "bg-orange-400 text-white" :
                      cell.score>=5  ? "bg-amber-300 text-gray-900" :
                      "bg-emerald-200 text-gray-900"
                    }`}>
                      {cell.count || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-4 mt-3 text-xs">
            <span className="flex items-center gap-1"><span className="w-4 h-3 bg-emerald-200 rounded inline-block"/> Faible (&lt;5)</span>
            <span className="flex items-center gap-1"><span className="w-4 h-3 bg-amber-300 rounded inline-block"/> Modéré (5-8)</span>
            <span className="flex items-center gap-1"><span className="w-4 h-3 bg-orange-400 rounded inline-block"/> Élevé (9-14)</span>
            <span className="flex items-center gap-1"><span className="w-4 h-3 bg-red-500 rounded inline-block"/> Critique (≥15)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
