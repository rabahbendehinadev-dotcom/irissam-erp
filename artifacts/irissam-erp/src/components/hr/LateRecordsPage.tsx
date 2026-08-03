/** Retards page */
import { useState } from "react";
import { useQuery } from "@/hooks/useQuery";
import { apiClient } from "@/lib/api-client";
import { Timer, RefreshCw, Check, X } from "lucide-react";

const STATUS: Record<string, { label: string; cls: string }> = {
  en_attente:    { label: "En attente",     cls: "bg-amber-100 text-amber-700" },
  justifie:      { label: "Justifié",       cls: "bg-blue-100 text-blue-700" },
  non_justifie:  { label: "Non justifié",   cls: "bg-red-100 text-red-700" },
  approuve:      { label: "Approuvé",       cls: "bg-green-100 text-green-700" },
  rejete:        { label: "Rejeté",         cls: "bg-gray-100 text-gray-600" },
};

export default function LateRecordsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const { data, loading, refetch } = useQuery<any>(`/hr/attendance?status=retard&limit=100`);
  const records: any[] = Array.isArray(data?.data) ? data.data : [];
  const total = data?.total ?? 0;

  // Use the late_records endpoint via a separate query
  const { data: lateData, loading: lateLoading, refetch: refetchLate } = useQuery<any>(
    `/hr/attendance?status=retard&limit=100${statusFilter ? `&status_filter=${statusFilter}` : ""}`
  );

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Retards</h1>
          <p className="text-sm text-gray-500">{records.length} enregistrement{records.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={refetch} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"><RefreshCw className="w-4 h-4"/></button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total retards", value: records.length, cls: "bg-amber-50 text-amber-700" },
          { label: "> 30 min", value: records.filter((r: any) => r.late_minutes > 30).length, cls: "bg-red-50 text-red-700" },
          { label: "Moy. retard", value: records.length ? Math.round(records.reduce((s: number, r: any) => s + (r.late_minutes ?? 0), 0) / records.length) + " min" : "—", cls: "bg-orange-50 text-orange-700" },
          { label: "Employés concernés", value: new Set(records.map((r: any) => r.employee_id)).size, cls: "bg-yellow-50 text-yellow-700" },
        ].map((s, i) => (
          <div key={i} className={`rounded-xl p-4 border border-gray-100 shadow-sm ${s.cls.split(" ")[0]}`}>
            <p className={`text-2xl font-bold ${s.cls.split(" ")[1]}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="hidden sm:block bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Employé</th>
              <th className="px-4 py-3 text-center">Date</th>
              <th className="px-4 py-3 text-center">Prévu</th>
              <th className="px-4 py-3 text-center">Arrivée</th>
              <th className="px-4 py-3 text-center">Retard</th>
              <th className="px-4 py-3 text-center">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && Array.from({length:4}).map((_,i) => (
              <tr key={i} className="animate-pulse">{Array.from({length:6}).map((_,j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded"/></td>)}</tr>
            ))}
            {!loading && records.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Aucun retard enregistré</td></tr>}
            {records.map((r: any) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{r.employee_name}</p>
                  <p className="text-xs text-gray-400">{r.matricule}</p>
                </td>
                <td className="px-4 py-3 text-center text-xs">{new Date(r.record_date).toLocaleDateString("fr-FR")}</td>
                <td className="px-4 py-3 text-center font-mono text-xs">
                  {r.planned_start ? new Date(r.planned_start).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}) : "—"}
                </td>
                <td className="px-4 py-3 text-center font-mono text-xs">
                  {r.check_in ? new Date(r.check_in).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}) : "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`font-bold text-sm ${r.late_minutes > 30 ? "text-red-600" : "text-amber-600"}`}>
                    {r.late_minutes} min
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-xs text-gray-500">{r.source ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="sm:hidden space-y-2">
        {records.map((r: any) => (
          <div key={r.id} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center ${r.late_minutes > 30 ? "bg-red-50" : "bg-amber-50"}`}>
              <span className={`text-lg font-bold ${r.late_minutes > 30 ? "text-red-600" : "text-amber-600"}`}>{r.late_minutes}</span>
              <span className="text-[9px] text-gray-400">min</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-800 truncate">{r.employee_name}</p>
              <p className="text-xs text-gray-400">{new Date(r.record_date).toLocaleDateString("fr-FR")} · {r.department_name ?? "—"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
