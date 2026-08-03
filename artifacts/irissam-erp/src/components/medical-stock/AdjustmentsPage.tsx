import { useState, useCallback } from "react";
import { useQuery } from "@/hooks/useQuery";
import { stockApi } from "@/services/api/medical-stock";
import { Plus, AlertTriangle, RefreshCw, SlidersHorizontal } from "lucide-react";

const REASONS: { value: string; label: string }[] = [
  { value: "inventaire",           label: "Inventaire" },
  { value: "perte",                label: "Perte" },
  { value: "casse",                label: "Casse" },
  { value: "vol",                  label: "Vol" },
  { value: "peremption",           label: "Péremption" },
  { value: "don",                  label: "Don" },
  { value: "correction",           label: "Correction" },
  { value: "reception_non_conforme", label: "Réception non conforme" },
  { value: "retour_patient",       label: "Retour patient" },
  { value: "autre",                label: "Autre" },
];

export default function AdjustmentsPage() {
  const [page, setPage] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const limit = 30;

  const { data, loading, error, refetch } = useQuery<any>(`/medical-stock/adjustments?limit=${limit}&offset=${page * limit}`);
  const { data: items } = useQuery<any>("/medical-stock/items?limit=200");
  const adjs = data?.data ?? [];
  const total = data?.total ?? 0;

  const handleCreate = useCallback(async () => {
    if (!form.item_id || !form.reason || form.quantity_change === undefined) return;
    setSaving(true);
    try { await stockApi.createAdjustment(form); setShowCreate(false); setForm({}); refetch(); }
    catch (e: any) { alert(e?.message ?? "Erreur"); }
    finally { setSaving(false); }
  }, [form, refetch]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setForm({}); setShowCreate(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> Nouvel ajustement
        </button>
      </div>

      {error && <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600"><AlertTriangle className="w-4 h-4 shrink-0" /> Erreur <button onClick={refetch} className="ml-auto text-xs flex items-center gap-1"><RefreshCw className="w-3 h-3" />Réessayer</button></div>}

      {loading ? (
        <div className="space-y-2 animate-pulse">{[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-lg" />)}</div>
      ) : (
        <>
          <div className="space-y-2">
            {adjs.map((adj: any) => {
              const isPositive = Number(adj.quantity_change) >= 0;
              return (
                <div key={adj.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isPositive ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                    <SlidersHorizontal className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">{adj.item_name}</div>
                    <div className="text-xs text-gray-400">
                      {adj.adj_number} · {REASONS.find(r => r.value === adj.reason)?.label ?? adj.reason} ·{" "}
                      {new Date(adj.created_at).toLocaleDateString("fr-FR")}
                      {adj.created_by_name && ` · ${adj.created_by_name}`}
                    </div>
                    {adj.notes && <div className="text-xs text-gray-400 truncate">{adj.notes}</div>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-sm font-bold ${isPositive ? "text-green-700" : "text-red-700"}`}>
                      {isPositive ? "+" : ""}{Number(adj.quantity_change).toFixed(0)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {Number(adj.quantity_before).toFixed(0)} → {Number(adj.quantity_after).toFixed(0)}
                    </div>
                  </div>
                </div>
              );
            })}
            {adjs.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <SlidersHorizontal className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucun ajustement</p>
              </div>
            )}
          </div>
          {total > limit && (
            <div className="flex items-center justify-between pt-2 text-sm text-gray-500">
              <span>{total} ajustements</span>
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
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">Ajustement de stock</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Article *</label>
                <select value={form.item_id ?? ""} onChange={e => setForm((p: any) => ({ ...p, item_id: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">
                  <option value="">Sélectionner…</option>
                  {(items?.data ?? []).map((it: any) => <option key={it.id} value={it.id}>{it.name} ({it.code})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Raison *</label>
                <select value={form.reason ?? ""} onChange={e => setForm((p: any) => ({ ...p, reason: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">
                  <option value="">Sélectionner…</option>
                  {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Variation de quantité * <span className="text-gray-400 font-normal">(positif = ajout, négatif = retrait)</span>
                </label>
                <input type="number" value={form.quantity_change ?? ""} onChange={e => setForm((p: any) => ({ ...p, quantity_change: parseFloat(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" placeholder="ex: -5 ou +10" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes ?? ""} onChange={e => setForm((p: any) => ({ ...p, notes: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none" />
              </div>
            </div>
            <div className="p-4 border-t flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm">Annuler</button>
              <button onClick={handleCreate} disabled={saving || !form.item_id || !form.reason || form.quantity_change === undefined}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? "Enregistrement…" : "Valider l'ajustement"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
