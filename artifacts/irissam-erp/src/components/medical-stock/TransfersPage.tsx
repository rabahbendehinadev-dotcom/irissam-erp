import { useState, useCallback } from "react";
import { useQuery } from "@/hooks/useQuery";
import { stockApi } from "@/services/api/medical-stock";
import { toast } from "@/hooks/use-toast";
import { Plus, AlertTriangle, RefreshCw, ArrowRightLeft, CheckCircle } from "lucide-react";

const TRF_STATUS: Record<string, { label: string; className: string }> = {
  brouillon:  { label: "Brouillon", className: "bg-gray-100 text-gray-600" },
  soumise:    { label: "Soumis",    className: "bg-blue-100 text-blue-700" },
  approuvee:  { label: "Approuvé",  className: "bg-emerald-100 text-emerald-700" },
  en_transit: { label: "En transit",className: "bg-yellow-100 text-yellow-700" },
  recue:      { label: "Reçu",      className: "bg-green-100 text-green-700" },
  annulee:    { label: "Annulé",    className: "bg-red-100 text-red-700" },
};

export default function TransfersPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<any>({ items: [] });
  const [saving, setSaving] = useState(false);
  const limit = 25;

  const params: Record<string,string> = { limit: String(limit), offset: String(page * limit) };
  if (status) params.status = status;
  const qs = "?" + new URLSearchParams(params).toString();

  const { data, loading, error, refetch } = useQuery<any>(`/medical-stock/transfers${qs}`);
  const { data: items } = useQuery<any>("/medical-stock/items?limit=200");
  const transfers = data?.data ?? [];
  const total = data?.total ?? 0;

  const addItem = () => setForm((p: any) => ({ ...p, items: [...(p.items ?? []), { item_id: "", quantity: 1, unit_cost: 0 }] }));

  const handleCreate = useCallback(async () => {
    if (!form.from_location || !form.to_location || !form.items?.length) return;
    setSaving(true);
    try { await stockApi.createTransfer(form); setShowCreate(false); setForm({ items: [] }); refetch(); }
    catch (e: any) { toast({ variant: "destructive", title: "Erreur", description: e?.message ?? "Impossible de créer le transfert" }); }
    finally { setSaving(false); }
  }, [form, refetch]);

  const handleAction = useCallback(async (trf: any, action: string) => {
    try {
      if (action === "submit")  await stockApi.submitTransfer(trf.id);
      if (action === "approve") await stockApi.approveTransfer(trf.id);
      refetch();
    } catch (e: any) { toast({ variant: "destructive", title: "Erreur", description: e?.message ?? "Action impossible" }); }
  }, [refetch]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
          <option value="">Tous les statuts</option>
          {Object.entries(TRF_STATUS).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <div className="flex-1" />
        <button onClick={() => { setForm({ items: [] }); setShowCreate(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shrink-0">
          <Plus className="w-4 h-4" /> Nouveau transfert
        </button>
      </div>

      {error && <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600"><AlertTriangle className="w-4 h-4 shrink-0" /> Erreur <button onClick={refetch} className="ml-auto text-xs flex items-center gap-1"><RefreshCw className="w-3 h-3" />Réessayer</button></div>}

      {loading ? (
        <div className="space-y-2 animate-pulse">{[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-lg" />)}</div>
      ) : (
        <>
          <div className="space-y-2">
            {transfers.map((t: any) => {
              const badge = TRF_STATUS[t.status];
              return (
                <div key={t.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5">
                  <ArrowRightLeft className="w-5 h-5 text-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-blue-600 font-semibold">{t.transfer_number}</span>
                      <span className="text-sm text-gray-900">{t.from_location} → {t.to_location}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(t.transfer_date).toLocaleDateString("fr-FR")} · {t.items_count} articles · {t.created_by_name}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge?.className}`}>{badge?.label}</span>
                    {t.status === "brouillon" && (
                      <button onClick={() => handleAction(t, "submit")} className="text-xs text-blue-600 hover:text-blue-800">Soumettre</button>
                    )}
                    {t.status === "soumise" && (
                      <button onClick={() => handleAction(t, "approve")} className="text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Approuver
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {transfers.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <ArrowRightLeft className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucun transfert</p>
              </div>
            )}
          </div>
          {total > limit && (
            <div className="flex items-center justify-between pt-2 text-sm text-gray-500">
              <span>{total} transferts</span>
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
              <h3 className="font-semibold text-gray-900">Nouveau transfert</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Service source *</label>
                  <input value={form.from_location ?? ""} onChange={e => setForm((p: any) => ({ ...p, from_location: e.target.value }))}
                    placeholder="ex: Pharmacie centrale"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Service destinataire *</label>
                  <input value={form.to_location ?? ""} onChange={e => setForm((p: any) => ({ ...p, to_location: e.target.value }))}
                    placeholder="ex: Urgences"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-700">Articles *</label>
                  <button onClick={addItem} className="text-xs text-emerald-600 flex items-center gap-1"><Plus className="w-3 h-3" /> Ajouter</button>
                </div>
                {(form.items ?? []).map((it: any, idx: number) => (
                  <div key={idx} className="grid grid-cols-3 gap-2 mb-2 p-2 bg-gray-50 rounded-lg">
                    <div className="col-span-2">
                      <select value={it.item_id} onChange={e => setForm((p: any) => { const arr = [...p.items]; arr[idx] = { ...arr[idx], item_id: e.target.value }; return { ...p, items: arr }; })}
                        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded">
                        <option value="">Article…</option>
                        {(items?.data ?? []).map((i: any) => <option key={i.id} value={i.id}>{i.name}</option>)}
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
            </div>
            <div className="p-4 border-t flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm">Annuler</button>
              <button onClick={handleCreate} disabled={saving || !form.from_location || !form.to_location || !form.items?.length || form.items.some((it: any) => !it.item_id)}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? "Création…" : "Créer le transfert"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
