/**
 * PositionsPage — Postes & Départements (référentiels RH gérés depuis l'UI).
 *
 * Corrections : lecture du tableau brut renvoyé par l'API (plus de `.data`
 * fantôme), vraies colonnes (`vacancies`, `active`, `department_name`),
 * sélection du département à la création d'un poste, effectif max,
 * édition / activation-désactivation, et affichage des erreurs API.
 */
import { useState } from "react";
import { useQuery } from "@/hooks/useQuery";
import { apiClient } from "@/lib/api-client";
import { Building2, Briefcase, Plus, RefreshCw, X, Users, Pencil } from "lucide-react";

const CATEGORIES = ["medical", "paramedical", "administratif", "technique", "support"];

type ModalState =
  | { kind: "create" }
  | { kind: "edit"; target: any }
  | null;

const EMPTY_FORM = {
  name: "", code: "", description: "", category: "",
  departmentId: "", maxHeadcount: "", active: true,
};

export default function PositionsPage() {
  const [view, setView] = useState<"departments" | "positions">("departments");
  const [modal, setModal] = useState<ModalState>(null);
  const [saving, setSaving] = useState(false);
  const [modalErr, setModalErr] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const { data: depts, loading: dLoading, refetch: refetchDepts } = useQuery<any>("/hr/positions/departments");
  const { data: positions, loading: pLoading, refetch: refetchPos } = useQuery<any>("/hr/positions");

  const departments: any[] = Array.isArray(depts) ? depts : (depts?.data ?? []);
  const positionList: any[] = Array.isArray(positions) ? positions : (positions?.data ?? []);

  const loading = view === "departments" ? dLoading : pLoading;

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setModalErr(null);
    setModal({ kind: "create" });
  }
  function openEdit(target: any) {
    setForm({
      name: target.name ?? "",
      code: target.code ?? "",
      description: target.description ?? "",
      category: target.category ?? "",
      departmentId: target.department_id ?? "",
      maxHeadcount: target.max_headcount != null ? String(target.max_headcount) : "",
      active: target.active !== false,
    });
    setModalErr(null);
    setModal({ kind: "edit", target });
  }

  async function save() {
    setSaving(true);
    setModalErr(null);
    try {
      if (view === "departments") {
        const body = { name: form.name, code: form.code, description: form.description, active: form.active };
        if (modal?.kind === "edit") await apiClient.patch(`/hr/positions/departments/${modal.target.id}`, body);
        else await apiClient.post("/hr/positions/departments", body);
        refetchDepts();
      } else {
        const body = {
          name: form.name, code: form.code, description: form.description,
          category: form.category, departmentId: form.departmentId,
          maxHeadcount: form.maxHeadcount ? parseInt(form.maxHeadcount, 10) : null,
          active: form.active,
        };
        if (modal?.kind === "edit") await apiClient.patch(`/hr/positions/${modal.target.id}`, body);
        else await apiClient.post("/hr/positions", body);
        refetchPos();
      }
      setModal(null);
    } catch (e: any) {
      setModalErr(e?.data?.error ?? e?.message ?? "Erreur lors de l'enregistrement");
    } finally { setSaving(false); }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Postes & Départements</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { view === "departments" ? refetchDepts() : refetchPos(); }} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"><RefreshCw className="w-4 h-4"/></button>
          <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
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
                <button onClick={() => openEdit(d)} title="Modifier"
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 shrink-0">
                  <Pencil className="w-4 h-4"/>
                </button>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Users className="w-3 h-3"/>{d.headcount ?? 0} employés</span>
                {d.manager_name && <span className="truncate">Resp. : {d.manager_name}</span>}
                <span className={`ml-auto px-2 py-0.5 rounded-full ${d.active !== false ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {d.active !== false ? "Actif" : "Inactif"}
                </span>
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
                <th className="px-4 py-3 text-center hidden sm:table-cell">Postes vacants</th>
                <th className="px-4 py-3 text-center hidden sm:table-cell">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && Array.from({length:5}).map((_,i) => (
                <tr key={i} className="animate-pulse"><td colSpan={7} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded"/></td></tr>
              ))}
              {!loading && positionList.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Aucun poste créé</td></tr>
              )}
              {positionList.map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{p.name}</p>
                    <p className="text-xs text-gray-400">
                      {p.department_name ?? "Sans département"}
                      <span className="sm:hidden"> · {p.code ?? "—"} · {p.category ?? "—"}</span>
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-xs text-gray-500 hidden sm:table-cell">{p.code ?? "—"}</td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    {p.category && <span className="px-2 py-0.5 bg-sky-100 text-sky-700 rounded text-xs">{p.category}</span>}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-gray-700">
                    {p.headcount ?? 0}{p.max_headcount != null ? <span className="text-gray-400 font-normal"> / {p.max_headcount}</span> : ""}
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    {p.max_headcount != null
                      ? (Number(p.vacancies) > 0
                        ? <span className="text-green-600 font-medium">{p.vacancies}</span>
                        : <span className="text-gray-300">0</span>)
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${p.active !== false ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {p.active !== false ? "Actif" : "Inactif"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(p)} title="Modifier"
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                      <Pencil className="w-4 h-4"/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">
                {modal.kind === "edit"
                  ? (view === "departments" ? "Modifier le département" : "Modifier le poste")
                  : (view === "departments" ? "Nouveau département" : "Nouveau poste")}
              </h2>
              <button onClick={() => setModal(null)}><X className="w-5 h-5"/></button>
            </div>
            {modalErr && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{modalErr}</div>
            )}
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-gray-700">Nom *</label><input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/></div>
              {modal.kind === "create" && (
                <div><label className="text-xs font-medium text-gray-700">Code</label><input value={form.code} onChange={e => setForm(f=>({...f,code:e.target.value}))} placeholder="Ex: MED-CHIR" className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/></div>
              )}
              <div><label className="text-xs font-medium text-gray-700">Description</label><textarea value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} rows={2} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none"/></div>
              {view === "positions" && (
                <>
                  <div><label className="text-xs font-medium text-gray-700">Département</label>
                    <select value={form.departmentId} onChange={e => setForm(f=>({...f,departmentId:e.target.value}))} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none">
                      <option value="">— Sans département —</option>
                      {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs font-medium text-gray-700">Catégorie</label>
                      <select value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none">
                        <option value="">—</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div><label className="text-xs font-medium text-gray-700">Effectif max</label>
                      <input type="number" min="0" value={form.maxHeadcount} onChange={e => setForm(f=>({...f,maxHeadcount:e.target.value}))} placeholder="Illimité" className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/>
                    </div>
                  </div>
                </>
              )}
              {modal.kind === "edit" && (
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={form.active} onChange={e => setForm(f=>({...f,active:e.target.checked}))} className="w-4 h-4 rounded border-gray-300"/>
                  {view === "departments" ? "Département actif" : "Poste actif"}
                </label>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={save} disabled={saving || !form.name.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? "…" : modal.kind === "edit" ? "Enregistrer" : "Créer"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
