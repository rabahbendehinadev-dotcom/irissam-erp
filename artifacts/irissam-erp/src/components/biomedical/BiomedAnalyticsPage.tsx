import { useState, useEffect } from "react";
import { getBiomedMTBF, getBiomedCosts, getBiomedAvailability } from "@/services/api/biomedical";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const COLORS = ["#6366F1","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#06B6D4","#F97316"];

export default function BiomedAnalyticsPage() {
  const [mtbf, setMtbf] = useState<any>(null);
  const [costs, setCosts] = useState<any>(null);
  const [availability, setAvailability] = useState<any>(null);

  useEffect(() => { getBiomedMTBF().then(setMtbf).catch(() => {}); }, []);
  useEffect(() => { getBiomedCosts().then(setCosts).catch(() => {}); }, []);
  useEffect(() => { getBiomedAvailability().then(setAvailability).catch(() => {}); }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Pannes par équipement (90 jours)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={(mtbf?.data ?? []).slice(0,10).map((r: any) => ({
            name: r.name.length > 20 ? r.name.slice(0,20)+"…" : r.name,
            Pannes: Number(r.failure_count),
            "Arrêt (h)": Number(r.total_downtime_hours),
          }))}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="Pannes" fill="#EF4444" radius={[4,4,0,0]} />
            <Bar dataKey="Arrêt (h)" fill="#F97316" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Top coûts maintenance (12 mois)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={(costs?.data ?? []).slice(0,10).map((r: any) => ({
            name: r.name.length > 20 ? r.name.slice(0,20)+"…" : r.name,
            "Coût total (DA)": Number(r.total_cost),
          }))}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: any) => v.toLocaleString("fr-DZ")} />
            <Tooltip formatter={(v: any) => v.toLocaleString("fr-DZ")+" DA"} />
            <Bar dataKey="Coût total (DA)" radius={[4,4,0,0]}>
              {(costs?.data ?? []).slice(0,10).map((_: any, i: number) =>
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              )}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Taux de disponibilité par équipement</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {["Équipement","Code","Statut","Criticité","Disponibilité","Arrêts (h/an)"].map(h =>
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(availability?.data ?? []).map((r: any, idx: number) => {
                const pct = Number(r.availability_pct);
                const color = pct >= 95 ? "text-emerald-600" : pct >= 85 ? "text-amber-600" : "text-red-600";
                return (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-sm text-gray-900">{r.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.internal_code}</td>
                    <td className="px-4 py-3 text-xs capitalize text-gray-600">{r.status}</td>
                    <td className="px-4 py-3 text-xs capitalize text-gray-600">{r.criticality}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-2 w-24">
                          <div className={`h-2 rounded-full ${pct>=95?"bg-emerald-500":pct>=85?"bg-amber-500":"bg-red-500"}`}
                            style={{ width: `${Math.min(pct,100)}%` }}/>
                        </div>
                        <span className={`text-xs font-bold ${color}`}>{pct.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{Number(r.total_downtime_hours).toFixed(1)}h</td>
                  </tr>
                );
              })}
              {!availability?.data?.length && (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Aucune donnée disponibilité (équipements sans date de mise en service)</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
