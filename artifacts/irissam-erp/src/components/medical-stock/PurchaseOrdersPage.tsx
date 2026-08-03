import { useState, useCallback } from "react";
import { useQuery } from "@/hooks/useQuery";
import { stockApi } from "@/services/api/medical-stock";
import { Search, Plus, AlertTriangle, RefreshCw, ShoppingCart, ChevronRight, CheckCircle, Truck } from "lucide-react";

const PO_STATUS: Record<string, { label: string; className: string }> = {
  brouillon:            { label: "Brouillon",     className: "bg-gray-100 text-gray-600" },
  soumise:              { label: "Soumise",        className: "bg-blue-100 text-blue-700" },
  approuvee:            { label: "Approuvée",      className: "bg-emerald-100 text-emerald-700" },
  partiellement_recue:  { label: "Partielle",      className: "bg-yellow-100 text-yellow-700" },
  recue:                { label: "Reçue",          className: "bg-green-100 text-green-700" },
  annulee:              { label: "Annulée",        className: "bg-red-100 text-red-700" },
};

export default function PurchaseOrdersPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [form, setForm] = useState<any>({ items: [] });
  const [saving, setSaving] = useState(false);
  const limit = 25;

  const params: Record<string,string> = { limit: String(limit), offset: String(page * limit) };
  if (status) params.status = status;
  const qs = "?" + new URLSearchParams(params).toString();

  const { data, loading, error, refetch } = useQuery<any>(`/medical-stock/purchase-orders${qs}`);
  const { data: suppliers } = useQuery<any>("/medical-stock/suppliers?is_active=true&limit=200");
  const { data: items } = useQuery<any>("/medical-stock/items?limit=200");
  const pos = data?.data ?? [];
  const total = data?.total ?? 0;

  const fmtCur = (n: number) => new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 }).format(n) + " DZD";

  const addItem = () => setForm((p: any) => ({
    ...p, items: [...(p.items ?? []), { item_id: "", quantity_ordered: 1, unit_cost: 0, discount_percent: 0, tax_percent: 0 }]
  }));

  const handleCreate = useCallback(async () => {
    if (!form.supplier_id || !form.items?.length) return;
    setSaving(true);
    try { await stockApi.createPurchaseOrder(form); setShowCreate(false); setForm({ items: [] }); refetch(); }
    catch (e: any) { alert(e?.message ?? "Erreur"); }
    finally { setSaving(false); }
  }, [form, refetch]);

  const handleAction = useCallback(async (po: any, action: string) => {
    try {
      if (action === "submit")   await stockApi.submitPurchaseOrder(po.id);
      if (action === "approve")  await stockApi.approvePurchaseOrder(po.id);
      refetch();
    } catch (e: any) { alert(e?.message ?? "Erreur"); }
  }, [refetch]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
          <option value="">Tous les statuts</option>
          {Object.entries(PO_STATUS).map(([v, {label}]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <div className="flex-1" />
        <button onClick={() => { setForm({ items: [] }); setShowCreate(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shrink-0">
          <Plus className="w-4 h-4" /> Nouvelle commande
        </button>
      </div>

      {error && <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600"><AlertTriangle className="w-4 h-4 shrink-0" /> Erreur <button onClick={refetch} className="ml-auto text-xs flex items-center gap-1"><RefreshCw className="w-3 h-3" />Réessayer</button></div>}

      {loading ? (
        <div className="space-y-2 animate-pulse">{[...Array(8)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-lg" />)}</div>
      ) : (
        <>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left pb-2">N° Commande</th>
                  <th className="text-left pb-2">Fournisseur</th>
                  <th className="text-right pb-2 hidden md:table-cell">Date</th>
                  <th className="text-right pb-2 hidden lg:table-cell">Montant</th>
                  <th className="text-center pb-2">Statut</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pos.map((po: any) => {
                  const badge = PO_STATUS[po.status];
                  return (
                    <tr key={po.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedPO(po)}>
                      <td className="py-2.5 pl-1">
                        <div className="font-mono text-xs text-blue-600 font-semibold">{po.po_number}</div>
                        <div className="text-xs text-gray-400">{po.items_count} articles</div>
                      </td>
                      <td className="py-2.5 text-gray-900">{po.supplier_name}</td>
                      <td className="text-right py-2.5 text-gray-500 hidden md:table-cell text-xs">
                        {new Date(po.order_date).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="text-right py-2.5 font-medium hidden lg:table-cell">{fmtCur(Number(po.net_amount))}</td>
                      <td className="text-center py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge?.className}`}>{badge?.label}</span>
                      </td>
                      <td className="py-2.5 pl-2">
                        {po.status === "brouillon" && (
                          <button onClick={e => { e.stopPropagation(); handleAction(po, "submit"); }}
                            className="text-xs text-blue-600 hover:text-blue-800 mr-2">Soumettre</button>
                        )}
                        {po.status === "soumise" && (
                          <button onClick={e => { e.stopPropagation(); handleAction(po, "approve"); }}
                            className="text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Approuver
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {pos.length === 0 && <div className="text-center py-12 text-gray-400"><ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">Aucune commande</p></div>}
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {pos.map((po: any) => {
              const badge = PO_STATUS[po.status];
              return (
                <div key={po.id} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between" onClick={() => setSelectedPO(po)}>
                  <div>
                    <p className="font-mono text-xs text-blue-600 font-semibold">{po.po_number}</p>
                    <p className="text-sm font-medium text-gray-900">{po.supplier_name}</p>
                    <p className="text-xs text-gray-400">{fmtCur(Number(po.net_amount))}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge?.className}`}>{badge?.label}</span>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </div>
              );
            })}
            {pos.length === 0 && <p className="text-center text-sm text-gray-400 py-8">Aucune commande</p>}
          </div>

          {total > limit && (
            <div className="flex items-center justify-between pt-2 text-sm text-gray-500">
              <span>{total} commandes</span>
              <div className="flex gap-2">
                <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40">Précédent</button>
                <button disabled={(page + 1) * limit >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40">Suivant</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create PO modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">Nouvelle commande d'achat</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Fournisseur *</label>
                  <select value={form.supplier_id ?? ""} onChange={e => setForm((p: any) => ({ ...p, supplier_id: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">
                    <option value="">Sélectionner…</option>
                    {(suppliers?.data ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date livraison prévue</label>
                  <input type="date" value={form.expected_date ?? ""} onChange={e => setForm((p: any) => ({ ...p, expected_date: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-700">Articles *</label>
                  <button onClick={addItem} className="text-xs text-emerald-600 flex items-center gap-1"><Plus className="w-3 h-3" /> Ajouter</button>
                </div>
                {(form.items ?? []).map((it: any, idx: number) => (
                  <div key={idx} className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2 p-2 bg-gray-50 rounded-lg">
                    <div className="col-span-2">
                      <select value={it.item_id} onChange={e => setForm((p: any) => { const items = [...p.items]; items[idx] = { ...items[idx], item_id: e.target.value }; return { ...p, items }; })}
                        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded">
                        <option value="">Article…</option>
                        {(items?.data ?? []).map((i: any) => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </select>
                    </div>
                    <input type="number" min="1" placeholder="Qté" value={it.quantity_ordered}
                      onChange={e => setForm((p: any) => { const items = [...p.items]; items[idx] = { ...items[idx], quantity_ordered: parseFloat(e.target.value) }; return { ...p, items }; })}
                      className="px-2 py-1.5 text-xs border border-gray-200 rounded" />
                    <div className="flex gap-1">
                      <input type="number" min="0" placeholder="Prix u." value={it.unit_cost}
                        onChange={e => setForm((p: any) => { const items = [...p.items]; items[idx] = { ...items[idx], unit_cost: parseFloat(e.target.value) }; return { ...p, items }; })}
                        className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded" />
                      <button onClick={() => setForm((p: any) => { const items = p.items.filter((_: any, i: number) => i !== idx); return { ...p, items }; })}
                        className="text-red-400 hover:text-red-600 px-1">×</button>
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
              <button onClick={handleCreate} disabled={saving || !form.supplier_id || !form.items?.length || form.items.some((it: any) => !it.item_id)}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? "Création…" : "Créer la commande"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
