import { useState } from "react";
import { useQuery } from "@/hooks/useQuery";
import { stockApi } from "@/services/api/medical-stock";
import { Search, Plus, AlertTriangle, RefreshCw, Layers } from "lucide-react";

const BATCH_STATUS: Record<string, string> = {
  actif:        "bg-green-100 text-green-700",
  epuise:       "bg-gray-100 text-gray-600",
  expire:       "bg-red-100 text-red-700",
  rappele:      "bg-purple-100 text-purple-700",
  en_quarantaine: "bg-yellow-100 text-yellow-700",
  annule:       "bg-gray-100 text-gray-500",
};

export default function BatchesPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [expiringFilter, setExpiringFilter] = useState("");
  const [page, setPage] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const limit = 30;

  const params: Record<string,string> = { limit: String(limit), offset: String(page * limit) };
  if (q)              params.q = q;
  if (status)         params.status = status;
  if (expiringFilter) params.expiring_in_days = expiringFilter;
  const qs = "?" + new URLSearchParams(params).toString();

  const { data, loading, error, refetch } = useQuery<any>(`/medical-stock/batches${qs}`);
  const { data: items } = useQuery<any>("/medical-stock/items?limit=200");
  const batches = data?.data ?? [];
  const total = data?.total ?? 0;

  const handleCreate = async () => {
    if (!form.item_id || !form.quantity_received) return;
    setSaving(true);
    try {
      await stockApi.createBatch(form);
      setShowCreate(false); setForm({}); refetch();
    } catch (e: any) { alert(e?.message ?? "Erreur"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={q} onChange={e => { setQ(e.target.value); setPage(0); }}
            placeholder="N° lot, article…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500" />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
          <option value="">Tous les statuts</option>
          <option value="actif">Actif</option>
          <option value="expire">Expiré</option>
          <option value="rappele">Rappelé</option>
          <option value="en_quarantaine">Quarantaine</option>
        </select>
        <select value={expiringFilter} onChange={e => { setExpiringFilter(e.target.value); setPage(0); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
          <option value="">Toutes dates</option>
          <option value="7">Expire dans 7j</option>
          <option value="30">Expire dans 30j</option>
          <option value="90">Expire dans 90j</option>
        </select>
        <button onClick={() => { setForm({}); setShowCreate(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shrink-0">
          <Plus className="w-4 h-4" /> Nouveau lot
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
          <AlertTriangle className="w-4 h-4 shrink-0" /> Erreur de chargement
          <button onClick={refetch} className="ml-auto text-xs flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Réessayer</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2 animate-pulse">{[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-lg" />)}</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left pb-2">N° Lot / Article</th>
                  <th className="text-right pb-2">Reçu</th>
                  <th className="text-right pb-2">Disponible</th>
                  <th className="text-center pb-2">Péremption</th>
                  <th className="text-right pb-2 hidden md:table-cell">Coût unit.</th>
                  <th className="text-center pb-2">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {batches.map((b: any) => {
                  const days = b.days_until_expiry !== null ? Number(b.days_until_expiry) : null;
                  const expiryColor = days === null ? "text-gray-400" : days < 0 ? "text-red-600 font-medium" : days < 30 ? "text-orange-600" : "text-gray-600";
                  return (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="py-2.5">
                        <div className="font-mono text-xs text-blue-600">{b.batch_number}</div>
                        <div className="font-medium text-gray-900">{b.item_name}</div>
                        {b.lot_number && <div className="text-xs text-gray-400">N° fabricant: {b.lot_number}</div>}
                      </td>
                      <td className="text-right py-2.5">{Number(b.quantity_received).toFixed(0)} <span className="text-xs text-gray-400">{b.unit_symbol}</span></td>
                      <td className="text-right py-2.5 font-semibold">{Number(b.quantity_on_hand).toFixed(0)} <span className="text-xs text-gray-400">{b.unit_symbol}</span></td>
                      <td className={`text-center py-2.5 text-sm ${expiryColor}`}>
                        {b.expiry_date ? new Date(b.expiry_date).toLocaleDateString("fr-FR") : <span className="text-gray-300">—</span>}
                        {days !== null && <div className="text-xs">{days < 0 ? `${Math.abs(days)}j dep.` : `${days}j rest.`}</div>}
                      </td>
                      <td className="text-right py-2.5 text-gray-600 hidden md:table-cell">{Number(b.unit_cost).toFixed(2)} DZD</td>
                      <td className="text-center py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${BATCH_STATUS[b.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {batches.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <Layers className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucun lot trouvé</p>
              </div>
            )}
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {batches.map((b: any) => (
              <div key={b.id} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{b.item_name}</p>
                    <p className="text-xs font-mono text-blue-600">{b.batch_number}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${BATCH_STATUS[b.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {b.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span>Dispo: <strong>{Number(b.quantity_on_hand).toFixed(0)}</strong></span>
                  {b.expiry_date && <span>Péremption: {new Date(b.expiry_date).toLocaleDateString("fr-FR")}</span>}
                </div>
              </div>
            ))}
            {batches.length === 0 && <p className="text-center text-sm text-gray-400 py-8">Aucun lot</p>}
          </div>

          {total > limit && (
            <div className="flex items-center justify-between pt-2 text-sm text-gray-500">
              <span>{total} lots au total</span>
              <div className="flex gap-2">
                <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40">Précédent</button>
                <button disabled={(page + 1) * limit >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40">Suivant</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">Nouveau lot</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Article *</label>
                <select value={form.item_id ?? ""} onChange={e => setForm((p: any) => ({ ...p, item_id: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">
                  <option value="">Sélectionner…</option>
                  {(items?.data ?? []).map((it: any) => <option key={it.id} value={it.id}>{it.name} ({it.code})</option>)}
                </select>
              </div>
              {[
                { key: "lot_number",        label: "N° de lot fabricant",  type: "text" },
                { key: "quantity_received", label: "Quantité reçue *",     type: "number" },
                { key: "unit_cost",         label: "Coût unitaire",        type: "number" },
                { key: "manufacture_date",  label: "Date fabrication",     type: "date" },
                { key: "expiry_date",       label: "Date péremption",      type: "date" },
                { key: "storage_location",  label: "Emplacement",          type: "text" },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                  <input type={f.type} value={form[f.key] ?? ""} onChange={e => setForm((p: any) => ({ ...p, [f.key]: f.type === "number" ? parseFloat(e.target.value) : e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                </div>
              ))}
            </div>
            <div className="p-4 border-t flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm">Annuler</button>
              <button onClick={handleCreate} disabled={saving || !form.item_id || !form.quantity_received}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? "Enregistrement…" : "Créer le lot"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
