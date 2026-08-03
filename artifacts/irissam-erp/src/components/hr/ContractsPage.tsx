/** Contracts management page */
import { useState } from "react";
import { useQuery } from "@/hooks/useQuery";
import { apiClient } from "@/lib/api-client";
import { FileText, Plus, AlertTriangle, RefreshCw, Check, X } from "lucide-react";

const STATUS: Record<string, { label: string; cls: string }> = {
  brouillon:     { label: "Brouillon",       cls: "bg-gray-100 text-gray-600" },
  actif:         { label: "Actif",            cls: "bg-green-100 text-green-700" },
  periode_essai: { label: "Période d'essai",  cls: "bg-blue-100 text-blue-700" },
  suspendu:      { label: "Suspendu",         cls: "bg-orange-100 text-orange-700" },
  expire:        { label: "Expiré",           cls: "bg-red-100 text-red-700" },
  resilie:       { label: "Résilié",          cls: "bg-rose-100 text-rose-700" },
  renouvele:     { label: "Renouvelé",        cls: "bg-purple-100 text-purple-700" },
};

export default function ContractsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [expiringDays, setExpiringDays] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const params = new URLSearchParams({ limit: "50", offset: "0", ...(statusFilter && { status: statusFilter }), ...(expiringDays && { expiring_days: expiringDays }) });
  const { data, loading, refetch } = useQuery<any>(`/hr/contracts?${params}`);
  const contracts = data?.data ?? [];
  const total = data?.total ?? 0;

  const [form, setForm] = useState({ employeeId: "", type: "CDI", startDate: "", endDate: "", weeklyHours: "40", notes: "" });

  async function createContract() {
    if (!form.employeeId || !form.startDate) return;
    setSaving(true); setActionError(null);
    try {
      await apiClient.post("/hr/contracts", { ...form, weeklyHours: parseFloat(form.weeklyHours) });
      setShowModal(false);
      refetch();
    } catch (e: any) { setActionError(e.message); }
    finally { setSaving(false); }
  }

  async function terminate(id: string) {
    const reason = prompt("Motif de résiliation:");
    if (reason === null) return;
    await apiClient.post(`/hr/contracts/${id}/terminate`, { reason });
    refetch();
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Contrats</h1>
          <p className="text-sm text-gray-500">{total} contrat{total !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={refetch} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"><RefreshCw className="w-4 h-4"/></button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4"/> Nouveau contrat
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none">
          <option value="">Tous statuts</option>
          {Object.entries(STATUS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={expiringDays} onChange={e => setExpiringDays(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none">
          <option value="">Toutes échéances</option>
          <option value="7">Expirant dans 7 jours</option>
          <option value="30">Expirant dans 30 jours</option>
          <option value="90">Expirant dans 90 jours</option>
        </select>
      </div>

      {/* Table */}
      <div className="hidden sm:block bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">N° Contrat</th>
              <th className="px-4 py-3 text-left">Employé</th>
              <th className="px-4 py-3 text-center">Type</th>
              <th className="px-4 py-3 text-center">Début</th>
              <th className="px-4 py-3 text-center">Fin</th>
              <th className="px-4 py-3 text-center">Jours restants</th>
              <th className="px-4 py-3 text-center">Statut</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && Array.from({length:4}).map((_,i) => (
              <tr key={i} className="animate-pulse">{Array.from({length:8}).map((_,j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded"/></td>)}</tr>
            ))}
            {!loading && contracts.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Aucun contrat</td></tr>}
            {contracts.map((c: any) => {
              const st = STATUS[c.status] ?? { label: c.status, cls: "bg-gray-100 text-gray-600" };
              const isExpiring = c.days_remaining !== null && c.days_remaining <= 30 && c.days_remaining >= 0;
              return (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{c.contract_number}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{c.employee_name}</p>
                    <p className="text-xs text-gray-400">{c.matricule}</p>
                  </td>
                  <td className="px-4 py-3 text-center"><span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">{c.type}</span></td>
                  <td className="px-4 py-3 text-center text-xs text-gray-600">{c.start_date ? new Date(c.start_date).toLocaleDateString("fr-FR") : "—"}</td>
                  <td className="px-4 py-3 text-center text-xs text-gray-600">{c.end_date ? new Date(c.end_date).toLocaleDateString("fr-FR") : "CDI"}</td>
                  <td className="px-4 py-3 text-center">
                    {c.days_remaining !== null
                      ? <span className={`font-bold text-xs ${isExpiring ? "text-orange-600" : "text-gray-700"}`}>
                          {isExpiring && <AlertTriangle className="w-3 h-3 inline mr-1"/>}
                          {c.days_remaining}j
                        </span>
                      : <span className="text-gray-400 text-xs">∞</span>}
                  </td>
                  <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs ${st.cls}`}>{st.label}</span></td>
                  <td className="px-4 py-3 text-center">
                    {c.status === "actif" && (
                      <button onClick={() => terminate(c.id)} className="text-xs text-red-600 hover:underline">Résilier</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {contracts.map((c: any) => {
          const st = STATUS[c.status] ?? { label: c.status, cls: "bg-gray-100 text-gray-600" };
          return (
            <div key={c.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{c.employee_name}</p>
                  <p className="text-xs text-gray-400">{c.contract_number} · {c.type}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs ${st.cls}`}>{st.label}</span>
              </div>
              <div className="mt-2 text-xs text-gray-500 flex gap-3">
                <span>Début: {c.start_date ? new Date(c.start_date).toLocaleDateString("fr-FR") : "—"}</span>
                <span>Fin: {c.end_date ? new Date(c.end_date).toLocaleDateString("fr-FR") : "CDI"}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Nouveau contrat</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5"/></button>
            </div>
            {actionError && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{actionError}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-700">ID Employé</label>
                <input value={form.employeeId} onChange={e => setForm(f => ({...f, employeeId: e.target.value}))} placeholder="UUID de l'employé"
                  className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Type</label>
                <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}
                  className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none">
                  {["CDI","CDD","vacataire","garde","stage","prestataire","convention"].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Heures/sem.</label>
                <input type="number" value={form.weeklyHours} onChange={e => setForm(f => ({...f, weeklyHours: e.target.value}))}
                  className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Date début *</label>
                <input type="date" value={form.startDate} onChange={e => setForm(f => ({...f, startDate: e.target.value}))}
                  className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Date fin</label>
                <input type="date" value={form.endDate} onChange={e => setForm(f => ({...f, endDate: e.target.value}))}
                  className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={createContract} disabled={saving || !form.employeeId || !form.startDate}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? "…" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
