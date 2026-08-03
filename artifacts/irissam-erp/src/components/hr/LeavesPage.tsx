/** Congés / Leave Requests page */
import { useState } from "react";
import { useQuery } from "@/hooks/useQuery";
import { apiClient } from "@/lib/api-client";
import { Plane, Plus, RefreshCw, Check, X, ChevronDown } from "lucide-react";

const STATUS: Record<string, { label: string; cls: string }> = {
  brouillon:          { label: "Brouillon",         cls: "bg-gray-100 text-gray-600" },
  soumise:            { label: "Soumise",            cls: "bg-blue-100 text-blue-700" },
  validation_manager: { label: "Attente manager",    cls: "bg-amber-100 text-amber-700" },
  validation_rh:      { label: "Attente RH",         cls: "bg-orange-100 text-orange-700" },
  approuvee:          { label: "Approuvée",          cls: "bg-green-100 text-green-700" },
  rejetee:            { label: "Rejetée",            cls: "bg-red-100 text-red-700" },
  annulee:            { label: "Annulée",            cls: "bg-gray-200 text-gray-500" },
};

const LEAVE_TYPES = ["annuel","maladie","maternite","paternite","mariage","deces_familial","sans_solde","recuperation","formation","exceptionnel"];

export default function LeavesPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [form, setForm] = useState({ employeeId: "", leaveType: "annuel", dateFrom: "", dateTo: "", numberOfDays: "", reason: "" });

  const params = new URLSearchParams({ limit: "50", ...(statusFilter && { status: statusFilter }) });
  const { data, loading, refetch } = useQuery<any>(`/hr/leaves?${params}`);
  const leaves: any[] = data?.data ?? [];
  const total = data?.total ?? 0;

  async function createLeave() {
    if (!form.employeeId || !form.dateFrom || !form.dateTo || !form.numberOfDays) return;
    setSaving(true); setAddError(null);
    try {
      await apiClient.post("/hr/leaves", { ...form, numberOfDays: parseFloat(form.numberOfDays) });
      setShowAdd(false); refetch();
    } catch (e: any) {
      setAddError(e.message ?? "Erreur lors de la création");
    } finally { setSaving(false); }
  }

  async function managerApprove(id: string) {
    await apiClient.post(`/hr/leaves/${id}/manager-approve`, { comment: "" });
    refetch();
  }
  async function hrApprove(id: string) {
    const comment = prompt("Commentaire RH (optionnel):") ?? "";
    await apiClient.post(`/hr/leaves/${id}/hr-approve`, { comment });
    refetch();
  }
  async function reject(id: string) {
    const comment = prompt("Motif de rejet:") ?? "";
    await apiClient.post(`/hr/leaves/${id}/reject`, { comment });
    refetch();
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Congés</h1>
          <p className="text-sm text-gray-500">{total} demande{total !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={refetch} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"><RefreshCw className="w-4 h-4"/></button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4"/> Nouvelle demande
          </button>
        </div>
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

      {/* Desktop table */}
      <div className="hidden sm:block bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Employé</th>
              <th className="px-4 py-3 text-center">Type</th>
              <th className="px-4 py-3 text-center">Période</th>
              <th className="px-4 py-3 text-center">Jours</th>
              <th className="px-4 py-3 text-center">Statut</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && Array.from({length:4}).map((_,i) => (
              <tr key={i} className="animate-pulse">{Array.from({length:6}).map((_,j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded"/></td>)}</tr>
            ))}
            {!loading && leaves.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Aucune demande de congé</td></tr>}
            {leaves.map((lr: any) => {
              const st = STATUS[lr.status] ?? { label: lr.status, cls: "bg-gray-100 text-gray-500" };
              const canManagerApprove = ["soumise","validation_manager"].includes(lr.status);
              const canHrApprove = ["soumise","validation_manager","validation_rh"].includes(lr.status);
              const canReject = !["rejetee","annulee","approuvee"].includes(lr.status);
              return (
                <tr key={lr.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{lr.employee_name}</p>
                    <p className="text-xs text-gray-400">{lr.matricule}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 bg-sky-100 text-sky-700 rounded text-xs">{lr.leave_type}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-gray-600">
                    {new Date(lr.date_from).toLocaleDateString("fr-FR")} → {new Date(lr.date_to).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-gray-700">{lr.number_of_days}j</td>
                  <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span></td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {canManagerApprove && <button onClick={() => managerApprove(lr.id)} title="Approuver (Manager)" className="p-1.5 rounded hover:bg-green-100 text-green-600"><Check className="w-3.5 h-3.5"/></button>}
                      {canHrApprove && <button onClick={() => hrApprove(lr.id)} title="Approuver (RH)" className="px-2 py-1 text-[10px] bg-green-50 text-green-700 rounded hover:bg-green-100">RH ✓</button>}
                      {canReject && <button onClick={() => reject(lr.id)} title="Rejeter" className="p-1.5 rounded hover:bg-red-100 text-red-600"><X className="w-3.5 h-3.5"/></button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {leaves.map((lr: any) => {
          const st = STATUS[lr.status] ?? { label: lr.status, cls: "bg-gray-100 text-gray-500" };
          return (
            <div key={lr.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-800">{lr.employee_name}</p>
                  <p className="text-xs text-gray-400">{lr.leave_type} · {lr.number_of_days}j</p>
                  <p className="text-xs text-gray-400">{new Date(lr.date_from).toLocaleDateString("fr-FR")} → {new Date(lr.date_to).toLocaleDateString("fr-FR")}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${st.cls}`}>{st.label}</span>
              </div>
              {["soumise","validation_manager","validation_rh"].includes(lr.status) && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => hrApprove(lr.id)} className="flex-1 py-1.5 text-xs bg-green-50 text-green-700 rounded-lg hover:bg-green-100">Approuver</button>
                  <button onClick={() => reject(lr.id)} className="flex-1 py-1.5 text-xs bg-red-50 text-red-700 rounded-lg hover:bg-red-100">Rejeter</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between"><h2 className="font-bold text-gray-900">Nouvelle demande de congé</h2><button onClick={() => setShowAdd(false)}><X className="w-5 h-5"/></button></div>
            {addError && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{addError}</div>}
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-gray-700">ID Employé *</label><input value={form.employeeId} onChange={e => setForm(f=>({...f,employeeId:e.target.value}))} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/></div>
              <div><label className="text-xs font-medium text-gray-700">Type de congé</label>
                <select value={form.leaveType} onChange={e => setForm(f=>({...f,leaveType:e.target.value}))} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none">
                  {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-700">Du *</label><input type="date" value={form.dateFrom} onChange={e => setForm(f=>({...f,dateFrom:e.target.value}))} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/></div>
                <div><label className="text-xs font-medium text-gray-700">Au *</label><input type="date" value={form.dateTo} onChange={e => setForm(f=>({...f,dateTo:e.target.value}))} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/></div>
              </div>
              <div><label className="text-xs font-medium text-gray-700">Nombre de jours *</label><input type="number" step="0.5" value={form.numberOfDays} onChange={e => setForm(f=>({...f,numberOfDays:e.target.value}))} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/></div>
              <div><label className="text-xs font-medium text-gray-700">Motif</label><textarea value={form.reason} onChange={e => setForm(f=>({...f,reason:e.target.value}))} rows={2} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none"/></div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={createLeave} disabled={saving || !form.employeeId || !form.dateFrom || !form.dateTo || !form.numberOfDays}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? "…" : "Soumettre"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
