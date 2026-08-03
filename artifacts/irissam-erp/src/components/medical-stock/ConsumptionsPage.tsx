import { useState, useCallback } from "react";
import { useQuery } from "@/hooks/useQuery";
import { stockApi } from "@/services/api/medical-stock";
import { Plus, AlertTriangle, RefreshCw, Beaker, CheckCircle } from "lucide-react";

const DEPARTMENTS = [
  "Urgences","Réanimation","Bloc opératoire","Maternité","Hospitalisation",
  "Laboratoire","Imagerie","Pharmacie","Consultations","Banque de sang","Autre"
];

const CONS_STATUS: Record<string, { label: string; className: string }> = {
  brouillon: { label: "Brouillon", className: "bg-gray-100 text-gray-600" },
  validee:   { label: "Validée",   className: "bg-green-100 text-green-700" },
  annulee:   { label: "Annulée",   className: "bg-red-100 text-red-700" },
};

export default function ConsumptionsPage() {
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<any>({ items: [], auto_validate: true });
  const [saving, setSaving] = useState(false);
  const limit = 30;

  const params: Record<string,string> = { limit: String(limit), offset: String(page * limit) };
  if (department) params.department = department;
  if (status)     params.status = status;
  const qs = "?" + new URLSearchParams(params).toString();

  const { data, loading, error, refetch } = useQuery<any>(`/medical-stock/consumptions${qs}`);
  const { data: items } = useQuery<any>("/medical-stock/items?status=active&limit=200");
  const consumptions = data?.data ?? [];
  const total = data?.total ?? 0;
  const fmtCur = (n: number) => new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 }).format(n) + " DZD";

  const addItem = () => setForm((p: any) => ({ ...p, items: [...(p.items ?? []), { item_id: "", quantity: 1 }] }));

  const handleCreate = useCallback(async () => {
    if (!form.department || !form.items?.length) return;
    setSaving(true);
    try { await stockApi.createConsumption(form); setShowCreate(false); setForm({ items: [], auto_validate: true }); refetch(); }
    catch (e: any) { alert(e?.message ?? "Erreur"); }
    finally { setSaving(false); }
  }, [form, refetch]);

  const handleValidate = useCallback(async (cons: any) => {
    try { await stockApi.validateConsumption(cons.id); refetch(); }
    catch (e: any) { alert(e?.message ?? "Erreur"); }
  }, [refetch]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <select value={department} onChange={e => { setDepartment(e.target.value); setPage(0); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
          <option value="">Tous les services</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
          <option value="">Tous les statuts</option>
          {Object.entries(CONS_STATUS).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <div className="flex-1" />
        <button onClick={() => { setForm({ items: [], auto_validate: true }); setShowCreate(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shrink-0">
          <Plus className="w-4 h-4" /> Nouvelle consommation
        </button>
      </div>

      {error && <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600"><AlertTriangle className="w-4 h-4 shrink-0" /> Erreur <button onClick={refetch} className="ml-auto text-xs flex items-center gap-1"><RefreshCw className="w-3 h-3" />Réessayer</button></div>}

      {loading ? (
        <div className="space-y-2 animate-pulse">{[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-lg" />)}</div>
      ) : (
        <>
          <div className="space-y-2">
            {consumptions.map((c: any) => {
              const badge = CONS_STATUS[c.status];
              return (
                <div key={c.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5">
                  <Beaker className="w-5 h-5 text-purple-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-blue-600 font-semibold">{c.cons_number}</span>
                      <span className="text-sm font-medium text-gray-900">{c.department}</span>
                      {c.patient_name && <span className="text-xs text-gray-500">· {c.patient_name}</span>}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(c.consumption_date).toLocaleDateString("fr-FR")} · {c.items_count} articles ·{" "}
                      {c.total_value ? fmtCur(Number(c.total_value)) : "—"} · {c.created_by_name}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge?.className}`}>{badge?.label}</span>
                    {c.status === "brouillon" && (
                      <button onClick={() => handleValidate(c)}
                        className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800">
                        <CheckCircle className="w-3 h-3" /> Valider
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {consumptions.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <Beaker className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucune consommation</p>
              </div>
            )}
          </div>
          {total > limit && (
            <div className="flex items-center justify-between pt-2 text-sm text-gray-500">
              <span>{total} consommations</span>
              <div className="flex gap-2">
                <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40">Précédent</button>
                <button disabled={(page + 1) * limit >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40">Suivant</button>
              </div>
            </div>
          )}
        </>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">Enregistrer une consommation</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Service *</label>
                  <select value={form.department ?? ""} onChange={e => setForm((p: any) => ({ ...p, department: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">
                    <option value="">Sélectionner…</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" value={form.consumption_date ?? ""} onChange={e => setForm((p: any) => ({ ...p, consumption_date: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-700">Articles consommés *</label>
                  <button onClick={addItem} className="text-xs text-emerald-600 flex items-center gap-1"><Plus className="w-3 h-3" /> Ajouter</button>
                </div>
                {(form.items ?? []).map((it: any, idx: number) => (
                  <div key={idx} className="grid grid-cols-3 gap-2 mb-2 p-2 bg-gray-50 rounded-lg">
                    <div className="col-span-2">
                      <select value={it.item_id} onChange={e => setForm((p: any) => { const arr = [...p.items]; arr[idx] = { ...arr[idx], item_id: e.target.value }; return { ...p, items: arr }; })}
                        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded">
                        <option value="">Article…</option>
                        {(items?.data ?? []).map((i: any) => <option key={i.id} value={i.id}>{i.name} (dispo: {Number(i.quantity_on_hand).toFixed(0)})</option>)}
                      </select>
                    </div>
                    <div className="flex gap-1">
                      <input type="number" min="1" placeholder="Qté" value={it.quantity}
                        onChange={e => setForm((p: any) => { const arr = [...p.items]; arr[idx] = { ...arr[idx], quantity: parseFloat(e.target.value) }; return { ...p, items: arr }; })}
                        className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded" />
                      <button onClick={() => setForm((p: any) => { const arr = p.items.filter((_: any, i: number) => i !== idx); return { ...p, items: arr }; })} className="text-red-400 hover:text-red-600 px-1">×</button>
                    </div>
                  </div>
                ))}
                {(form.items ?? []).length === 0 && <p className="text-xs text-gray-400 text-center py-2">Aucun article ajouté</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes ?? ""} onChange={e => setForm((p: any) => ({ ...p, notes: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.auto_validate ?? true} onChange={e => setForm((p: any) => ({ ...p, auto_validate: e.target.checked }))} className="rounded" />
                <span className="text-xs text-gray-700">Valider immédiatement (décrémenter le stock maintenant)</span>
              </label>
            </div>
            <div className="p-4 border-t flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm">Annuler</button>
              <button onClick={handleCreate} disabled={saving || !form.department || !form.items?.length || form.items.some((it: any) => !it.item_id)}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
