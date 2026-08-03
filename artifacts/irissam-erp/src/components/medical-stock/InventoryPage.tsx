import { useState, useCallback } from "react";
import { useQuery } from "@/hooks/useQuery";
import { stockApi } from "@/services/api/medical-stock";
import { Plus, AlertTriangle, RefreshCw, ClipboardList, CheckCircle } from "lucide-react";

const INV_STATUS: Record<string, { label: string; className: string }> = {
  en_cours:  { label: "En cours",  className: "bg-blue-100 text-blue-700" },
  suspendue: { label: "Suspendue", className: "bg-yellow-100 text-yellow-700" },
  terminee:  { label: "Terminée",  className: "bg-gray-100 text-gray-600" },
  validee:   { label: "Validée",   className: "bg-green-100 text-green-700" },
  annulee:   { label: "Annulée",   className: "bg-red-100 text-red-700" },
};

export default function InventoryPage() {
  const [page, setPage] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const limit = 20;

  const { data, loading, error, refetch } = useQuery<any>(`/medical-stock/inventory?limit=${limit}&offset=${page * limit}`);
  const sessions = data?.data ?? [];
  const total = data?.total ?? 0;

  const handleCreate = useCallback(async () => {
    if (!form.name) return;
    setSaving(true);
    try { await stockApi.createInventorySession(form); setShowCreate(false); setForm({}); refetch(); }
    catch (e: any) { alert(e?.message ?? "Erreur"); }
    finally { setSaving(false); }
  }, [form, refetch]);

  const handleValidate = useCallback(async (session: any) => {
    if (!confirm(`Valider l'inventaire "${session.name}" ? Cette action appliquera toutes les variations au stock.`)) return;
    try { await stockApi.validateInventory(session.id); refetch(); }
    catch (e: any) { alert(e?.message ?? "Erreur"); }
  }, [refetch]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setForm({}); setShowCreate(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> Nouveau inventaire
        </button>
      </div>

      {error && <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600"><AlertTriangle className="w-4 h-4 shrink-0" /> Erreur <button onClick={refetch} className="ml-auto text-xs flex items-center gap-1"><RefreshCw className="w-3 h-3" />Réessayer</button></div>}

      {loading ? (
        <div className="space-y-2 animate-pulse">{[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}</div>
      ) : (
        <>
          <div className="space-y-3">
            {sessions.map((s: any) => {
              const badge = INV_STATUS[s.status];
              const progress = s.total_items > 0 ? Math.round((s.items_counted / s.total_items) * 100) : 0;
              return (
                <div key={s.id} className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-blue-600 font-semibold">{s.session_number}</span>
                        <span className="font-medium text-gray-900">{s.name}</span>
                        {s.location && <span className="text-xs text-gray-400">({s.location})</span>}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        Début: {new Date(s.start_date).toLocaleDateString("fr-FR")} · {s.created_by_name}
                        {s.variance_count > 0 && ` · ${s.variance_count} écarts`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge?.className}`}>{badge?.label}</span>
                      {s.status === "en_cours" && (
                        <button onClick={() => handleValidate(s)}
                          className="flex items-center gap-1 px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700">
                          <CheckCircle className="w-3 h-3" /> Valider
                        </button>
                      )}
                    </div>
                  </div>
                  {s.total_items > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>{s.items_counted} / {s.total_items} articles comptés</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {sessions.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucune session d'inventaire</p>
              </div>
            )}
          </div>
          {total > limit && (
            <div className="flex items-center justify-between pt-2 text-sm text-gray-500">
              <span>{total} sessions</span>
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
              <h3 className="font-semibold text-gray-900">Nouvelle session d'inventaire</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                La création d'une session prend un snapshot de tout le stock actuel comme quantité théorique.
              </p>
              {[
                { key: "name",        label: "Nom de la session *", type: "text" },
                { key: "description", label: "Description",         type: "text" },
                { key: "location",    label: "Zone / Local",        type: "text" },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                  <input type={f.type} value={form[f.key] ?? ""} onChange={e => setForm((p: any) => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                </div>
              ))}
            </div>
            <div className="p-4 border-t flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm">Annuler</button>
              <button onClick={handleCreate} disabled={saving || !form.name}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? "Création…" : "Démarrer l'inventaire"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
