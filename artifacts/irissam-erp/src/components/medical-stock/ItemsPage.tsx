import { useState, useCallback } from "react";
import { useQuery } from "@/hooks/useQuery";
import { stockApi } from "@/services/api/medical-stock";
import { Search, Plus, Filter, AlertTriangle, RefreshCw, Package, ChevronRight, Edit2, Trash2 } from "lucide-react";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  normal:   { label: "Normal",   className: "bg-green-100 text-green-700" },
  faible:   { label: "Faible",   className: "bg-yellow-100 text-yellow-700" },
  critique: { label: "Critique", className: "bg-orange-100 text-orange-700" },
  rupture:  { label: "Rupture",  className: "bg-red-100 text-red-700" },
  surstock: { label: "Surstock", className: "bg-blue-100 text-blue-700" },
};

const ITEM_TYPES = [
  { value: "", label: "Tous les types" },
  { value: "medicament",       label: "Médicament" },
  { value: "consommable",      label: "Consommable" },
  { value: "reactif",          label: "Réactif" },
  { value: "equipement",       label: "Équipement" },
  { value: "dispositif_medical", label: "Dispositif médical" },
  { value: "autre",            label: "Autre" },
];

const STOCK_FILTERS = [
  { value: "",          label: "Tout le stock" },
  { value: "low_stock", label: "Stock faible" },
  { value: "rupture",   label: "Rupture" },
  { value: "expiring",  label: "Expire bientôt" },
  { value: "active",    label: "Actifs" },
  { value: "inactive",  label: "Inactifs" },
];

export default function ItemsPage() {
  const [q, setQ] = useState("");
  const [itemType, setItemType] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [page, setPage] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});
  const limit = 25;

  const params: Record<string,string> = { limit: String(limit), offset: String(page * limit) };
  if (q)           params.q = q;
  if (itemType)    params.item_type = itemType;
  if (stockFilter) params.status = stockFilter;
  const qs = "?" + new URLSearchParams(params).toString();

  const { data, loading, error, refetch } = useQuery<any>(`/medical-stock/items${qs}`);
  const { data: cats } = useQuery<any>("/medical-stock/categories");
  const { data: units } = useQuery<any>("/medical-stock/units");

  const items = data?.data ?? [];
  const total = data?.total ?? 0;

  const handleCreate = useCallback(async () => {
    if (!form.code || !form.name || !form.item_type || !form.unit_id) return;
    setSaving(true);
    try {
      await stockApi.createItem(form);
      setShowCreate(false);
      setForm({});
      refetch();
    } catch (e: any) {
      alert(e?.message ?? "Erreur lors de la création");
    } finally { setSaving(false); }
  }, [form, refetch]);

  const handleDelete = useCallback(async (item: any) => {
    if (!confirm(`Supprimer l'article "${item.name}" ?`)) return;
    try { await stockApi.deleteItem(item.id); refetch(); }
    catch (e: any) { alert(e?.message ?? "Impossible de supprimer"); }
  }, [refetch]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={q} onChange={e => { setQ(e.target.value); setPage(0); }}
            placeholder="Rechercher un article, code, DCI…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
        </div>
        <select value={itemType} onChange={e => { setItemType(e.target.value); setPage(0); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500">
          {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={stockFilter} onChange={e => { setStockFilter(e.target.value); setPage(0); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500">
          {STOCK_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <button onClick={() => { setForm({}); setShowCreate(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shrink-0">
          <Plus className="w-4 h-4" /> Nouvel article
        </button>
      </div>

      {/* Error / Loading */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Erreur de chargement
          <button onClick={refetch} className="ml-auto flex items-center gap-1 text-xs"><RefreshCw className="w-3 h-3" /> Réessayer</button>
        </div>
      )}

      {loading && (
        <div className="space-y-2 animate-pulse">
          {[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-lg" />)}
        </div>
      )}

      {/* Desktop table */}
      {!loading && !error && (
        <>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left pb-2 pl-1">Code / Article</th>
                  <th className="text-right pb-2">Qté disponible</th>
                  <th className="text-right pb-2 hidden md:table-cell">Coût moyen</th>
                  <th className="text-right pb-2 hidden lg:table-cell">Valeur stock</th>
                  <th className="text-center pb-2">Statut</th>
                  <th className="text-right pb-2 hidden xl:table-cell">Péremption</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item: any) => {
                  const badge = STATUS_BADGE[item.stock_status ?? "normal"];
                  const expiry = item.nearest_expiry ? new Date(item.nearest_expiry) : null;
                  const daysLeft = expiry ? Math.ceil((expiry.getTime() - Date.now()) / 86400000) : null;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 group cursor-pointer" onClick={() => setSelectedItem(item)}>
                      <td className="py-2.5 pl-1">
                        <div className="font-medium text-gray-900">{item.name}</div>
                        <div className="text-xs text-gray-400">{item.code}{item.generic_name ? ` · ${item.generic_name}` : ""}{item.category_name ? ` · ${item.category_name}` : ""}</div>
                      </td>
                      <td className="text-right py-2.5 font-semibold">
                        {Number(item.quantity_on_hand).toFixed(0)} <span className="text-xs text-gray-400">{item.unit_symbol}</span>
                      </td>
                      <td className="text-right py-2.5 text-gray-600 hidden md:table-cell">
                        {Number(item.average_cost).toFixed(2)} DZD
                      </td>
                      <td className="text-right py-2.5 font-medium hidden lg:table-cell">
                        {(Number(item.quantity_on_hand) * Number(item.average_cost)).toFixed(0)} DZD
                      </td>
                      <td className="text-center py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badge?.className ?? ""}`}>
                          {badge?.label}
                        </span>
                      </td>
                      <td className="text-right py-2.5 text-xs hidden xl:table-cell">
                        {daysLeft !== null ? (
                          <span className={daysLeft < 0 ? "text-red-600 font-medium" : daysLeft < 30 ? "text-orange-600" : "text-gray-500"}>
                            {daysLeft < 0 ? "Expiré" : `${daysLeft}j`}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-2.5 pr-1">
                        <button onClick={e => { e.stopPropagation(); handleDelete(item); }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {items.length === 0 && !loading && (
              <div className="text-center py-12 text-gray-400">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucun article trouvé</p>
              </div>
            )}
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {items.map((item: any) => {
              const badge = STATUS_BADGE[item.stock_status ?? "normal"];
              return (
                <div key={item.id} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between" onClick={() => setSelectedItem(item)}>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">{item.code} · {Number(item.quantity_on_hand).toFixed(0)} {item.unit_symbol}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge?.className ?? ""}`}>{badge?.label}</span>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </div>
              );
            })}
            {items.length === 0 && <p className="text-center text-sm text-gray-400 py-8">Aucun article</p>}
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between pt-2 text-sm text-gray-500">
              <span>{total} articles au total</span>
              <div className="flex gap-2">
                <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Précédent</button>
                <button disabled={(page + 1) * limit >= total} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Suivant</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">Nouvel article</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {[
                { key: "code",         label: "Code *",         type: "text" },
                { key: "name",         label: "Nom *",          type: "text" },
                { key: "generic_name", label: "DCI / Générique", type: "text" },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                  <input type={f.type} value={form[f.key] ?? ""} onChange={e => setForm((p: any) => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Type *</label>
                <select value={form.item_type ?? ""} onChange={e => setForm((p: any) => ({ ...p, item_type: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500">
                  <option value="">Sélectionner…</option>
                  {ITEM_TYPES.slice(1).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Unité *</label>
                <select value={form.unit_id ?? ""} onChange={e => setForm((p: any) => ({ ...p, unit_id: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500">
                  <option value="">Sélectionner…</option>
                  {(units?.data ?? []).map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Catégorie</label>
                <select value={form.category_id ?? ""} onChange={e => setForm((p: any) => ({ ...p, category_id: e.target.value || undefined }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500">
                  <option value="">Aucune</option>
                  {(cats?.data ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "reorder_point", label: "Seuil réappro." },
                  { key: "min_stock_level", label: "Stock min" },
                  { key: "unit_cost", label: "Coût unitaire" },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                    <input type="number" min="0" value={form[f.key] ?? ""} onChange={e => setForm((p: any) => ({ ...p, [f.key]: parseFloat(e.target.value) }))}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500" />
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Annuler</button>
              <button onClick={handleCreate} disabled={saving || !form.code || !form.name || !form.item_type || !form.unit_id}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-emerald-700">
                {saving ? "Création…" : "Créer l'article"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
