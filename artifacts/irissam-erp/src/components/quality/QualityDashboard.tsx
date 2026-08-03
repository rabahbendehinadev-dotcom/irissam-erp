import { useState, useEffect } from "react";
import { getQualityDashboard } from "@/services/api/quality";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function QualityDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getQualityDashboard().then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const kpis = data?.kpis ?? {};
  const incidentsByMonth = data?.incidents_by_month ?? [];
  const ncByType = data?.nc_by_type ?? [];
  const capaByStatus = data?.capa_by_status ?? [];
  const riskMatrix = data?.risk_matrix ?? [];

  const KPI_CARDS = [
    { label:"Incidents ouverts",   value: kpis.open_incidents ?? 0,    color:"text-red-600",     bg:"bg-red-50" },
    { label:"Non-conformités",     value: kpis.open_ncs ?? 0,          color:"text-orange-600",  bg:"bg-orange-50" },
    { label:"CAPA en cours",       value: kpis.open_capas ?? 0,        color:"text-amber-600",   bg:"bg-amber-50" },
    { label:"Risques critiques",   value: kpis.critical_risks ?? 0,    color:"text-rose-600",    bg:"bg-rose-50" },
    { label:"Audits planifiés",    value: kpis.planned_audits ?? 0,    color:"text-blue-600",    bg:"bg-blue-50" },
    { label:"Indicateurs hors cible",value:kpis.off_target_indicators??0,color:"text-purple-600",bg:"bg-purple-50" },
  ];

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-gray-400">
      <div className="text-center"><div className="text-4xl mb-3">⚙️</div><p className="text-sm">Chargement du tableau de bord qualité…</p></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {KPI_CARDS.map(k => (
          <div key={k.label} className={`${k.bg} rounded-xl p-4 border border-white/60`}>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-gray-600 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Incidents par mois (12 derniers mois)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={incidentsByMonth.map((r: any) => ({
              mois: `${r.month}/${String(r.year).slice(2)}`,
              Incidents: r.count,
            }))}>
              <XAxis dataKey="mois" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="Incidents" fill="#EF4444" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Non-conformités par type</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ncByType.map((r: any) => ({ type: r.type, NC: r.count }))}>
              <XAxis dataKey="type" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="NC" fill="#F59E0B" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">CAPA par statut</h3>
          <div className="space-y-2">
            {capaByStatus.map((r: any) => {
              const total = capaByStatus.reduce((s: number, x: any) => s + Number(x.count), 0);
              const pct = total ? Math.round(Number(r.count) / total * 100) : 0;
              const colors: Record<string,string> = {
                ouvert:"bg-blue-400", en_cours:"bg-amber-400", valide:"bg-indigo-400", clos:"bg-emerald-400", abandonne:"bg-gray-400"
              };
              return (
                <div key={r.status} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-24 capitalize">{r.status.replace(/_/g," ")}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${colors[r.status]??"bg-indigo-400"}`} style={{ width:`${pct}%` }} />
                  </div>
                  <span className="text-xs font-bold text-gray-700 w-8 text-right">{r.count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Matrice des risques</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="p-1 text-gray-400 font-normal text-center">Prob ↓ / Impact →</th>
                  {["Mineur","Modéré","Majeur","Critique","Catastrophique"].map(h =>
                    <th key={h} className="p-1 text-center text-gray-500 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {[5,4,3,2,1].map(prob => (
                  <tr key={prob}>
                    <td className="p-1 text-center font-medium text-gray-500">{prob}</td>
                    {[1,2,3,4,5].map(impact => {
                      const cell = riskMatrix.find((r: any) => Number(r.probability)===prob && Number(r.impact)===impact);
                      const score = prob * impact;
                      const bg = score >= 15 ? "bg-red-500 text-white" : score >= 9 ? "bg-orange-400 text-white" : score >= 5 ? "bg-amber-300" : "bg-emerald-200";
                      return (
                        <td key={impact} className={`p-1.5 text-center rounded font-bold ${bg}`}>
                          {cell?.count ?? 0}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
