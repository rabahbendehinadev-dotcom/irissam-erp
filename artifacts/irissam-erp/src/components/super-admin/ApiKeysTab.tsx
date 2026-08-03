import { useState, useEffect, useCallback } from "react";
import { Key, Plus, Trash2, Copy, Check, AlertTriangle, ShieldOff } from "lucide-react";
import { getApiKeys, createApiKey, revokeApiKey, stepUpAuth } from "@/services/api/system";
import StepUpDialog from "./StepUpDialog";

function Spinner() { return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"/></div>; }
function StatusBadge({ status }: { status: string }) {
  const c: Record<string,string> = { active:"bg-green-100 text-green-800", revoked:"bg-red-100 text-red-800", expired:"bg-gray-100 text-gray-600" };
  return <span className={"px-2 py-0.5 rounded-full text-xs font-medium "+(c[status]||"bg-gray-100 text-gray-600")}>{status}</span>;
}

interface ApiKey { id: string; name: string; key_prefix: string; scopes: string[]; status: string; expires_at: string|null; last_used_at: string|null; created_at: string; revoked_at: string|null; }

const SCOPE_OPTIONS = ["read","write","admin","webhooks","reports"];

export default function ApiKeysTab() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [pendingCreate, setPendingCreate] = useState<{ name: string; scopes: string[]; expiresAt?: string }|null>(null);
  const [newKeyReveal, setNewKeyReveal] = useState<{ key: string; name: string }|null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<string|null>(null);
  // Create form state
  const [form, setForm] = useState({ name: "", scopes: ["read"] as string[], expiresAt: "" });

  const load = useCallback(() => {
    setLoading(true);
    getApiKeys()
      .then(d => setKeys(d.keys || []))
      .catch(e => setError(e?.response?.data?.message || "Erreur serveur"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreateInit = () => {
    setPendingCreate({ name: form.name, scopes: form.scopes, expiresAt: form.expiresAt || undefined });
    setStepUpOpen(true);
  };

  const handleStepUpSuccess = async (token: string) => {
    if (!pendingCreate) return;
    try {
      const result = await createApiKey(pendingCreate, token);
      setNewKeyReveal({ key: result.key, name: result.record.name });
      setShowCreate(false);
      setForm({ name: "", scopes: ["read"], expiresAt: "" });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Erreur lors de la création de la clé");
    }
    setPendingCreate(null);
  };

  const handleRevoke = async (id: string) => {
    try { await revokeApiKey(id); load(); } 
    catch (e: any) { setError(e?.response?.data?.message || "Erreur"); }
    setConfirmRevoke(null);
  };

  const copyKey = () => {
    if (newKeyReveal) { navigator.clipboard.writeText(newKeyReveal.key).then(() => { setCopied(true); setTimeout(() => setCopied(false), 3000); }); }
  };

  if (loading) return <Spinner />;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {/* One-time key reveal modal */}
      {newKeyReveal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold">Clé API créée — copiez-la maintenant</h3>
            </div>
            <p className="text-sm text-gray-600">
              ⚠️ Cette clé <strong>n'est affichée qu'une seule fois</strong>. Elle ne pourra plus être récupérée après fermeture de cette fenêtre.
            </p>
            <div className="bg-gray-900 text-green-400 font-mono text-sm p-4 rounded-lg break-all select-all">
              {newKeyReveal.key}
            </div>
            <button onClick={copyKey} className={`flex items-center gap-2 w-full justify-center py-2 rounded-lg text-sm font-medium transition-colors ${copied ? "bg-green-600 text-white" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}>
              {copied ? <><Check className="w-4 h-4"/> Copié !</> : <><Copy className="w-4 h-4"/> Copier la clé</>}
            </button>
            <button onClick={() => setNewKeyReveal(null)} className="w-full py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              J'ai copié la clé — Fermer
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-indigo-600"/>
          <h2 className="text-lg font-semibold text-gray-900">Clés API</h2>
          <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{keys.length}</span>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 bg-indigo-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-indigo-700">
          <Plus className="w-4 h-4"/> Créer une clé
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="border border-indigo-200 bg-indigo-50 rounded-xl p-4 space-y-3">
          <h3 className="font-medium text-indigo-900">Nouvelle clé API</h3>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nom *</label>
            <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="ex: CI/CD Pipeline" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Permissions</label>
            <div className="flex flex-wrap gap-2">
              {SCOPE_OPTIONS.map(s => (
                <label key={s} className="flex items-center gap-1 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.scopes.includes(s)} onChange={e => setForm(f => ({...f, scopes: e.target.checked ? [...f.scopes,s] : f.scopes.filter(x=>x!==s)}))} className="rounded"/>
                  {s}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Expiration (optionnel)</label>
            <input type="date" value={form.expiresAt} onChange={e => setForm(f => ({...f, expiresAt: e.target.value}))} className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"/>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreateInit} disabled={!form.name} className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">Créer (Step-up requis)</button>
            <button onClick={() => setShowCreate(false)} className="border text-sm px-4 py-2 rounded-lg hover:bg-gray-50">Annuler</button>
          </div>
        </div>
      )}

      {/* Keys list */}
      {keys.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Key className="w-12 h-12 mx-auto mb-3 opacity-30"/>
          <p>Aucune clé API</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map(k => (
            <div key={k.id} className="border rounded-xl p-4 bg-white">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{k.name}</span>
                    <StatusBadge status={k.status}/>
                  </div>
                  <div className="font-mono text-xs text-gray-500 mt-1">{k.key_prefix}••••••••••••••••••••••••</div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {k.scopes.map(s => <span key={s} className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded">{s}</span>)}
                  </div>
                  <div className="text-xs text-gray-400 mt-2">
                    Créée le {new Date(k.created_at).toLocaleDateString("fr-FR")}
                    {k.last_used_at && <span> · Dernière utilisation {new Date(k.last_used_at).toLocaleDateString("fr-FR")}</span>}
                    {k.expires_at && <span> · Expire le {new Date(k.expires_at).toLocaleDateString("fr-FR")}</span>}
                  </div>
                </div>
                {k.status === "active" && (
                  <button onClick={() => setConfirmRevoke(k.id)} className="text-red-600 hover:text-red-700 shrink-0 p-1">
                    <ShieldOff className="w-4 h-4"/>
                  </button>
                )}
              </div>
              {confirmRevoke === k.id && (
                <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm text-red-700 mb-2">Révoquer cette clé ? Cette action est irréversible.</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleRevoke(k.id)} className="bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg">Révoquer</button>
                    <button onClick={() => setConfirmRevoke(null)} className="border text-xs px-3 py-1.5 rounded-lg">Annuler</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <StepUpDialog open={stepUpOpen} onClose={() => setStepUpOpen(false)} onSuccess={handleStepUpSuccess} title="Créer une clé API" description="La création d'une clé API nécessite une authentification renforcée."/>
    </div>
  );
}
