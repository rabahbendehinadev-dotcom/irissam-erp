/** Absences management page */
import { useState } from "react";
import { useQuery } from "@/hooks/useQuery";
import { apiClient } from "@/lib/api-client";
import { AlertCircle, Plus, RefreshCw, Check, X } from "lucide-react";

const STATUS: Record<string, { label: string; cls: string }> = {
  brouillon:  { label: "Brouillon",  cls: "bg-gray-100 text-gray-600" },
  soumise:    { label: "Soumise",    cls: "bg-blue-100 text-blue-700" },
  approuvee:  { label: "Approuvée", cls: "bg-green-100 text-green-700" },
  rejetee:    { label: "Rejetée",   cls: "bg-red-100 text-red-700" },
  annulee:    { label: "Annulée",   cls: "bg-gray-200 text-gray-500" },
};

const ABSENCE_TYPES = ["injustifiee","maladie","mission","formation","accident_travail","conge_exceptionnel","suspension","autre"];

export default function AbsencesPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ employeeId: "", dateFrom: "", dateTo: "", type: "maladie", reason: "" });

  const params = new URLSearchParams({ limit: "50", ...(statusFilter && { status: statusFilter }) });
  const { data, loading, refetch } = useQuery<any>(`/hr/absences?${params}`);
  const absences: any[] = data?.data ?? [];
  const total = data?.total ?? 0;

  async function createAbsence() {
    if (!form.employeeId || !form.dateFrom || !form.dateTo) return;
    setSaving(true);
    try { await apiClient.post("/hr/absences", form); setShowAdd(false); refetch(); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Absences</h1>
          <p className="text-sm text-gray-500">{total} absence{total !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={refetch} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"><RefreshCw className="w-4 h-4"/></button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4"/> Enregistrer absence
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        {[{ v:"", l:"Toutes" }, ...Object.entries(STATUS).map(([k,v]) => ({ v: k, l: v.label }))].map(o => (
          <button key={o.v} onClick={() => setStatusFilter(o.v)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${statusFilter === o.v ? "bg-blue-600 text-white border-blue-600" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
            {o.l}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase hidden sm:table-header-group">
            <tr>
              <th className="px-4 py-3 text-left">Employé</th>
              <th className="px-4 py-3 text-center">Type</th>
              <th className="px-4 py-3 text-center">Du</th>
              <th className="px-4 py-3 text-center">Au</th>
              <th className="px-4 py-3 text-center">Statut</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && Array.from({length:3}).map((_,i) => (
              <tr key={i} className="animate-pulse"><td colSpan={6} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded"/></td></tr>
            ))}
            {!loading && absences.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Aucune absence enregistrée</td></tr>
            )}
            {absences.map((a: any) => {
              const st = STATUS[a.status] ?? { label: a.status, cls: "bg-gray-100 text-gray-500" };
              const days = Math.ceil((new Date(a.date_to).getTime() - new Date(a.date_from).getTime()) / 86400000) + 1;
              return (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{a.employee_name}</p>
                    <p className="text-xs text-gray-400">{a.matricule}</p>
                  </td>
                  <td className="px-4 py-3 text-center"><span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">{a.type.replace(/_/g," ")}</span></td>
                  <td className="px-4 py-3 text-center text-xs text-gray-600">{new Date(a.date_from).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3 text-center text-xs text-gray-600">{new Date(a.date_to).toLocaleDateString("fr-FR")} <span className="text-gray-400">({days}j)</span></td>
                  <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span></td>
                  <td className="px-4 py-3 text-center">
                    {a.status === "soumise" && (
                      <div className="flex justify-center gap-1">
                        <button onClick={async () => { await apiClient.post(`/hr/absences/${a.id}/approve`, {}); refetch(); }} className="p-1.5 rounded hover:bg-green-100 text-green-600"><Check className="w-3.5 h-3.5"/></button>
                        <button onClick={async () => { await apiClient.post(`/hr/absences/${a.id}/reject`, {}); refetch(); }} className="p-1.5 rounded hover:bg-red-100 text-red-600"><X className="w-3.5 h-3.5"/></button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between"><h2 className="font-bold text-gray-900">Enregistrer une absence</h2><button onClick={() => setShowAdd(false)}><X className="w-5 h-5"/></button></div>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-gray-700">ID Employé *</label><input value={form.employeeId} onChange={e => setForm(f=>({...f,employeeId:e.target.value}))} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/></div>
              <div><label className="text-xs font-medium text-gray-700">Type</label>
                <select value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none">
                  {ABSENCE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g," ")}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-700">Du *</label><input type="date" value={form.dateFrom} onChange={e => setForm(f=>({...f,dateFrom:e.target.value}))} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/></div>
                <div><label className="text-xs font-medium text-gray-700">Au *</label><input type="date" value={form.dateTo} onChange={e => setForm(f=>({...f,dateTo:e.target.value}))} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/></div>
              </div>
              <div><label className="text-xs font-medium text-gray-700">Motif</label><textarea value={form.reason} onChange={e => setForm(f=>({...f,reason:e.target.value}))} rows={2} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none"/></div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={createAbsence} disabled={saving || !form.employeeId || !form.dateFrom || !form.dateTo}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? "…" : "Enregistrer"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
