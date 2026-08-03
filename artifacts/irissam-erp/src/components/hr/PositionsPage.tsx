/** Postes & Départements page */
import { useState } from "react";
import { useQuery } from "@/hooks/useQuery";
import { apiClient } from "@/lib/api-client";
import { Building2, Briefcase, Plus, RefreshCw, X, ChevronRight, Users } from "lucide-react";

export default function PositionsPage() {
  const [view, setView] = useState<"departments" | "positions">("departments");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", description: "", category: "", type: "" });

  const { data: depts, loading: dLoading, refetch: refetchDepts } = useQuery<any>("/hr/positions/departments");
  const { data: positions, loading: pLoading, refetch: refetchPos } = useQuery<any>("/hr/positions?limit=100");

  const departments: any[] = Array.isArray(depts) ? depts : (depts?.data ?? []);
  const positionList: any[] = positions?.data ?? [];

  async function createDepartment() {
    setSaving(true);
    try {
      await apiClient.post("/hr/positions/departments", form);
      setShowAdd(false); setForm({ name:"", code:"", description:"", category:"", type:"" }); refetchDepts();
    } finally { setSaving(false); }
  }
  async function createPosition() {
    setSaving(true);
    try {
      await apiClient.post("/hr/positions", form);
      setShowAdd(false); setForm({ name:"", code:"", description:"", category:"", type:"" }); refetchPos();
    } finally { setSaving(false); }
  }

  const loading = view === "departments" ? dLoading : pLoading;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Postes & Départements</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { view === "departments" ? refetchDepts() : refetchPos(); }} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"><RefreshCw className="w-4 h-4"/></button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4"/> Créer
          </button>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(["departments","positions"] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${view === v ? "bg-white text-gray-900 shadow-sm font-medium" : "text-gray-500 hover:text-gray-700"}`}>
            {v === "departments" ? "Départements" : "Postes"}
          </button>
        ))}
      </div>

      {/* Departments */}
      {view === "departments" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading && Array.from({length:6}).map((_,i) => <div key={i} className="h-28 bg-gray-100 animate-pulse rounded-xl"/>)}
          {!loading && departments.length === 0 && (
            <div className="col-span-3 py-12 text-center text-gray-400">
              <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30"/>
              <p>Aucun département créé</p>
            </div>
          )}
          {departments.map((d: any) => (
            <div key={d.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-blue-600"/>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 truncate">{d.name}</h3>
                  {d.code && <p className="text-xs text-gray-400 font-mono">{d.code}</p>}
                  {d.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{d.description}</p>}
                </div>
              </div>
              <div className="mt-3 flex gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Users className="w-3 h-3"/>{d.headcount ?? 0} employés</span>
                <span className="flex items-center gap-1"><Briefcase className="w-3 h-3"/>{d.open_vacancies ?? 0} postes ouverts</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Positions */}
      {view === "positions" && (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Poste</th>
                <th className="px-4 py-3 text-center hidden sm:table-cell">Code</th>
                <th className="px-4 py-3 text-center hidden sm:table-cell">Catégorie</th>
                <th className="px-4 py-3 text-center">Effectif</th>
                <th className="px-4 py-3 text-center hidden sm:table-cell">Postes ouverts</th>
                <th className="px-4 py-3 text-center hidden sm:table-cell">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && Array.from({length:5}).map((_,i) => (
                <tr key={i} className="animate-pulse"><td colSpan={6} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded"/></td></tr>
              ))}
              {!loading && positionList.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Aucun poste créé</td></tr>
              )}
              {positionList.map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{p.name}</p>
                    <p className="text-xs text-gray-400 sm:hidden">{p.code ?? "—"} · {p.category ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-xs text-gray-500 hidden sm:table-cell">{p.code ?? "—"}</td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    {p.category && <span className="px-2 py-0.5 bg-sky-100 text-sky-700 rounded text-xs">{p.category}</span>}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-gray-700">{p.headcount ?? 0}</td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    {p.open_vacancies > 0
                      ? <span className="text-green-600 font-medium">{p.open_vacancies}</span>
                      : <span className="text-gray-300">0</span>}
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${p.status === "actif" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{p.status ?? "—"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">{view === "departments" ? "Nouveau département" : "Nouveau poste"}</h2>
              <button onClick={() => setShowAdd(false)}><X className="w-5 h-5"/></button>
            </div>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-gray-700">Nom *</label><input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/></div>
              <div><label className="text-xs font-medium text-gray-700">Code</label><input value={form.code} onChange={e => setForm(f=>({...f,code:e.target.value}))} placeholder="Ex: MED-CHIR" className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/></div>
              <div><label className="text-xs font-medium text-gray-700">Description</label><textarea value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} rows={2} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none"/></div>
              {view === "positions" && (
                <div><label className="text-xs font-medium text-gray-700">Catégorie</label>
                  <select value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none">
                    <option value="">—</option>
                    {["medical","paramedical","administratif","technique","support"].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={view === "departments" ? createDepartment : createPosition} disabled={saving || !form.name}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? "…" : "Créer"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
