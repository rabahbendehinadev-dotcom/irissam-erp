import { useState, useCallback } from "react";
import { useQuery } from "@/hooks/useQuery";
import { stockApi } from "@/services/api/medical-stock";
import { Search, Plus, AlertTriangle, RefreshCw, Truck } from "lucide-react";

export default function SuppliersPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const limit = 25;

  const params: Record<string,string> = { limit: String(limit), offset: String(page * limit) };
  if (q) params.q = q;
  const qs = "?" + new URLSearchParams(params).toString();

  const { data, loading, error, refetch } = useQuery<any>(`/medical-stock/suppliers${qs}`);
  const suppliers = data?.data ?? [];
  const total = data?.total ?? 0;

  const handleCreate = useCallback(async () => {
    if (!form.code || !form.name) return;
    setSaving(true);
    try { await stockApi.createSupplier(form); setShowCreate(false); setForm({}); refetch(); }
    catch (e: any) { alert(e?.message ?? "Erreur"); }
    finally { setSaving(false); }
  }, [form, refetch]);

  const handleToggleActive = useCallback(async (s: any) => {
    try { await stockApi.updateSupplier(s.id, { is_active: !s.is_active }); refetch(); }
    catch (e: any) { alert(e?.message ?? "Erreur"); }
  }, [refetch]);

  const FIELDS = [
    { key: "code", label: "Code *", type: "text" },
    { key: "name", label: "Nom *", type: "text" },
    { key: "phone", label: "Téléphone", type: "tel" },
    { key: "email", label: "Email", type: "email" },
    { key: "address", label: "Adresse", type: "text" },
    { key: "city", label: "Ville", type: "text" },
    { key: "contact_name", label: "Contact", type: "text" },
    { key: "payment_terms_days", label: "Délai paiement (j)", type: "number" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={q} onChange={e => { setQ(e.target.value); setPage(0); }}
            placeholder="Rechercher un fournisseur…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500" />
        </div>
        <button onClick={() => { setForm({}); setShowCreate(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shrink-0">
          <Plus className="w-4 h-4" /> Nouveau
        </button>
      </div>

      {error && <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600"><AlertTriangle className="w-4 h-4 shrink-0" /> Erreur <button onClick={refetch} className="ml-auto text-xs flex items-center gap-1"><RefreshCw className="w-3 h-3" />Réessayer</button></div>}

      {loading ? (
        <div className="space-y-2 animate-pulse">{[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-lg" />)}</div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left pb-2">Code / Nom</th>
                  <th className="text-left pb-2 hidden md:table-cell">Contact</th>
                  <th className="text-center pb-2 hidden lg:table-cell">Commandes</th>
                  <th className="text-center pb-2">Statut</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {suppliers.map((s: any) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="py-2.5">
                      <div className="font-medium text-gray-900">{s.name}</div>
                      <div className="text-xs text-gray-400">{s.code}{s.city ? ` · ${s.city}` : ""}</div>
                    </td>
                    <td className="py-2.5 hidden md:table-cell text-gray-600 text-xs">
                      {s.contact_name && <div>{s.contact_name}</div>}
                      {s.phone && <div>{s.phone}</div>}
                    </td>
                    <td className="text-center py-2.5 hidden lg:table-cell text-gray-600">{s.po_count ?? 0}</td>
                    <td className="text-center py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {s.is_active ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="py-2.5 pr-1 text-right">
                      <button onClick={() => handleToggleActive(s)} className="text-xs text-blue-500 hover:text-blue-700">
                        {s.is_active ? "Désactiver" : "Activer"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {suppliers.length === 0 && <div className="text-center py-12 text-gray-400"><Truck className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">Aucun fournisseur</p></div>}
          </div>

          {/* Mobile */}
          <div className="sm:hidden space-y-2">
            {suppliers.map((s: any) => (
              <div key={s.id} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{s.name}</p>
                    <p className="text-xs text-gray-400">{s.code}{s.phone ? ` · ${s.phone}` : ""}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {s.is_active ? "Actif" : "Inactif"}
                  </span>
                </div>
              </div>
            ))}
            {suppliers.length === 0 && <p className="text-center text-sm text-gray-400 py-8">Aucun fournisseur</p>}
          </div>

          {total > limit && (
            <div className="flex items-center justify-between pt-2 text-sm text-gray-500">
              <span>{total} fournisseurs</span>
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
              <h3 className="font-semibold text-gray-900">Nouveau fournisseur</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {FIELDS.map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                  <input type={f.type} value={form[f.key] ?? ""} onChange={e => setForm((p: any) => ({ ...p, [f.key]: f.type === "number" ? parseInt(e.target.value) : e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                </div>
              ))}
            </div>
            <div className="p-4 border-t flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm">Annuler</button>
              <button onClick={handleCreate} disabled={saving || !form.code || !form.name}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? "Création…" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
