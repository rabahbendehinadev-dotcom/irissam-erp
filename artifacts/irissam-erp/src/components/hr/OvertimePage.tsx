/** Heures supplémentaires page */
import { useState } from "react";
import { useQuery } from "@/hooks/useQuery";
import { apiClient } from "@/lib/api-client";
import { TrendingUp, Plus, RefreshCw, Check, X } from "lucide-react";

const STATUS: Record<string, { label: string; cls: string }> = {
  brouillon:   { label: "Brouillon",   cls: "bg-gray-100 text-gray-600" },
  soumise:     { label: "Soumise",     cls: "bg-blue-100 text-blue-700" },
  approuvee:   { label: "Approuvée",   cls: "bg-green-100 text-green-700" },
  rejetee:     { label: "Rejetée",     cls: "bg-red-100 text-red-700" },
  payee:       { label: "Payée",       cls: "bg-purple-100 text-purple-700" },
  compensee:   { label: "Compensée",   cls: "bg-teal-100 text-teal-700" },
  annulee:     { label: "Annulée",     cls: "bg-gray-200 text-gray-500" },
};

const REASONS = ["urgence_medicale","remplacement","surcharge","astreinte","formation","maintenance","autre"];
const COMP_TYPES = ["monetaire","repos_compensateur","les_deux"];

export default function OvertimePage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ employeeId: "", overtimeDate: "", startTime: "", endTime: "", durationMinutes: "", reason: "autre", compensationType: "monetaire", notes: "" });

  const params = new URLSearchParams({ limit: "50", ...(statusFilter && { status: statusFilter }) });
  const { data, loading, refetch } = useQuery<any>(`/hr/overtime?${params}`);
  const records: any[] = data?.data ?? [];
  const total = data?.total ?? 0;

  async function create() {
    setSaving(true);
    try {
      await apiClient.post("/hr/overtime", {
        ...form,
        durationMinutes: form.durationMinutes ? parseInt(form.durationMinutes) : undefined,
      });
      setShowAdd(false); refetch();
    } finally { setSaving(false); }
  }

  const totalApproved = records.filter((r: any) => r.status === "approuvee").reduce((s: number, r: any) => s + (r.duration_minutes ?? 0), 0);
  const totalHours = Math.floor(totalApproved / 60);
  const totalMins = totalApproved % 60;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Heures supplémentaires</h1>
          <p className="text-sm text-gray-500">{total} demande{total !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={refetch} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"><RefreshCw className="w-4 h-4"/></button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4"/> Déclarer H.Sup.
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total approuvé", value: `${totalHours}h${totalMins > 0 ? totalMins+"min" : ""}`, cls: "bg-green-50 text-green-700" },
          { label: "En attente", value: records.filter((r: any) => r.status === "soumise").length, cls: "bg-amber-50 text-amber-700" },
          { label: "Ce mois", value: records.filter((r: any) => r.overtime_date?.startsWith(new Date().toISOString().slice(0,7))).length, cls: "bg-blue-50 text-blue-700" },
          { label: "Compensation repos", value: records.filter((r: any) => r.compensation_type === "repos_compensateur").length, cls: "bg-purple-50 text-purple-700" },
        ].map((s, i) => (
          <div key={i} className={`rounded-xl p-4 border border-gray-100 shadow-sm ${s.cls.split(" ")[0]}`}>
            <p className={`text-2xl font-bold ${s.cls.split(" ")[1]}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {[{ v:"", l:"Toutes" }, ...Object.entries(STATUS).map(([k,v]) => ({ v: k, l: v.label }))].map(o => (
          <button key={o.v} onClick={() => setStatusFilter(o.v)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${statusFilter === o.v ? "bg-blue-600 text-white border-blue-600" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
            {o.l}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="hidden sm:block bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Employé</th>
              <th className="px-4 py-3 text-center">Date</th>
              <th className="px-4 py-3 text-center">Durée</th>
              <th className="px-4 py-3 text-center">Motif</th>
              <th className="px-4 py-3 text-center">Compensation</th>
              <th className="px-4 py-3 text-center">Statut</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && Array.from({length:4}).map((_,i) => (
              <tr key={i} className="animate-pulse">{Array.from({length:7}).map((_,j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded"/></td>)}</tr>
            ))}
            {!loading && records.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Aucune heure supplémentaire</td></tr>}
            {records.map((r: any) => {
              const st = STATUS[r.status] ?? { label: r.status, cls: "bg-gray-100 text-gray-500" };
              const h = Math.floor((r.duration_minutes ?? 0) / 60);
              const m = (r.duration_minutes ?? 0) % 60;
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><p className="font-medium text-gray-800">{r.employee_name}</p><p className="text-xs text-gray-400">{r.matricule}</p></td>
                  <td className="px-4 py-3 text-center text-xs">{r.overtime_date ? new Date(r.overtime_date).toLocaleDateString("fr-FR") : "—"}</td>
                  <td className="px-4 py-3 text-center font-semibold text-blue-700 text-sm">{h}h{m > 0 ? m+"min" : ""}</td>
                  <td className="px-4 py-3 text-center text-xs text-gray-500">{r.reason?.replace(/_/g," ") ?? "—"}</td>
                  <td className="px-4 py-3 text-center"><span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">{r.compensation_type ?? "—"}</span></td>
                  <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span></td>
                  <td className="px-4 py-3 text-center">
                    {r.status === "soumise" && (
                      <div className="flex justify-center gap-1">
                        <button onClick={async () => { await apiClient.post(`/hr/overtime/${r.id}/approve`, {}); refetch(); }} className="p-1.5 rounded hover:bg-green-100 text-green-600"><Check className="w-3.5 h-3.5"/></button>
                        <button onClick={async () => { await apiClient.post(`/hr/overtime/${r.id}/reject`, {}); refetch(); }} className="p-1.5 rounded hover:bg-red-100 text-red-600"><X className="w-3.5 h-3.5"/></button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {records.map((r: any) => {
          const st = STATUS[r.status] ?? { label: r.status, cls: "bg-gray-100 text-gray-500" };
          const h = Math.floor((r.duration_minutes ?? 0) / 60);
          const m = (r.duration_minutes ?? 0) % 60;
          return (
            <div key={r.id} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex flex-col items-center justify-center">
                <span className="text-base font-bold text-blue-700">{h}h</span>
                {m > 0 && <span className="text-[9px] text-blue-500">{m}min</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-800 truncate">{r.employee_name}</p>
                <p className="text-xs text-gray-400">{r.overtime_date ? new Date(r.overtime_date).toLocaleDateString("fr-FR") : "—"} · {r.reason?.replace(/_/g," ")}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${st.cls}`}>{st.label}</span>
            </div>
          );
        })}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between"><h2 className="font-bold text-gray-900">Déclarer des heures supplémentaires</h2><button onClick={() => setShowAdd(false)}><X className="w-5 h-5"/></button></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="text-xs font-medium text-gray-700">ID Employé *</label><input value={form.employeeId} onChange={e => setForm(f=>({...f,employeeId:e.target.value}))} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/></div>
              <div><label className="text-xs font-medium text-gray-700">Date</label><input type="date" value={form.overtimeDate} onChange={e => setForm(f=>({...f,overtimeDate:e.target.value}))} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/></div>
              <div><label className="text-xs font-medium text-gray-700">Durée (min) *</label><input type="number" value={form.durationMinutes} onChange={e => setForm(f=>({...f,durationMinutes:e.target.value}))} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/></div>
              <div><label className="text-xs font-medium text-gray-700">Motif</label>
                <select value={form.reason} onChange={e => setForm(f=>({...f,reason:e.target.value}))} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none">
                  {REASONS.map(r => <option key={r} value={r}>{r.replace(/_/g," ")}</option>)}
                </select>
              </div>
              <div><label className="text-xs font-medium text-gray-700">Compensation</label>
                <select value={form.compensationType} onChange={e => setForm(f=>({...f,compensationType:e.target.value}))} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none">
                  {COMP_TYPES.map(c => <option key={c} value={c}>{c.replace(/_/g," ")}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={create} disabled={saving || !form.employeeId || !form.durationMinutes}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? "…" : "Soumettre"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
