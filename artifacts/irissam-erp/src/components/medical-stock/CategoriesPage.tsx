import { useState, useCallback } from "react";
import { useQuery } from "@/hooks/useQuery";
import { stockApi } from "@/services/api/medical-stock";
import { toast } from "@/hooks/use-toast";
import { Plus, AlertTriangle, RefreshCw, Tag } from "lucide-react";

export default function CategoriesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<any>({ color: "#3B82F6", sort_order: 0 });
  const [saving, setSaving] = useState(false);

  const { data, loading, error, refetch } = useQuery<any>("/medical-stock/categories");
  const categories = data?.data ?? [];

  const handleCreate = useCallback(async () => {
    if (!form.code || !form.name) return;
    setSaving(true);
    try { await stockApi.createCategory(form); setShowCreate(false); setForm({ color: "#3B82F6", sort_order: 0 }); refetch(); }
    catch (e: any) { toast({ variant: "destructive", title: "Erreur", description: e?.message ?? "Opération impossible" }); }
    finally { setSaving(false); }
  }, [form, refetch]);

  const handleToggle = useCallback(async (cat: any) => {
    try { await stockApi.updateCategory(cat.id, { ...cat, is_active: !cat.is_active }); refetch(); }
    catch (e: any) { toast({ variant: "destructive", title: "Erreur", description: e?.message ?? "Opération impossible" }); }
  }, [refetch]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setForm({ color: "#3B82F6", sort_order: 0 }); setShowCreate(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> Nouvelle catégorie
        </button>
      </div>

      {error && <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600"><AlertTriangle className="w-4 h-4 shrink-0" /> Erreur <button onClick={refetch} className="ml-auto text-xs flex items-center gap-1"><RefreshCw className="w-3 h-3" />Réessayer</button></div>}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-pulse">
          {[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map((cat: any) => (
            <div key={cat.id} className={`rounded-xl border border-gray-100 p-4 flex items-center gap-3 ${!cat.is_active ? "opacity-50" : ""}`}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: cat.color + "20" }}>
                <Tag className="w-5 h-5" style={{ color: cat.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{cat.name}</p>
                <p className="text-xs text-gray-400">{cat.code} · {cat.items_count ?? 0} articles</p>
              </div>
              <button onClick={() => handleToggle(cat)} className="text-xs text-blue-500 hover:text-blue-700 shrink-0">
                {cat.is_active ? "Masquer" : "Activer"}
              </button>
            </div>
          ))}
          {categories.length === 0 && (
            <div className="col-span-3 text-center py-12 text-gray-400">
              <Tag className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucune catégorie</p>
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">Nouvelle catégorie</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="p-4 space-y-3">
              {[
                { key: "code",  label: "Code *",  type: "text" },
                { key: "name",  label: "Nom *",   type: "text" },
                { key: "description", label: "Description", type: "text" },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                  <input type={f.type} value={form[f.key] ?? ""} onChange={e => setForm((p: any) => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Couleur</label>
                <input type="color" value={form.color ?? "#3B82F6"} onChange={e => setForm((p: any) => ({ ...p, color: e.target.value }))}
                  className="w-full h-10 rounded-lg border border-gray-200 cursor-pointer" />
              </div>
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
