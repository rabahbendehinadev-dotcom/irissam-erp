import { useState, useEffect, useCallback } from "react";
import { Flag, Plus, Check, X } from "lucide-react";
import { getFeatureFlags, updateFeatureFlag, createFeatureFlag } from "@/services/api/system";

function Spinner() { return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"/></div>; }

interface FeatureFlag { id: string; key: string; name: string; description: string|null; enabled: boolean; environment: string; rollout_percentage: number; allowed_roles: string[]|null; updated_by_name: string|null; updated_at: string; }

const ROLES = ["super_admin","system_administrator","doctor","nurse","pharmacist","lab_technician","radiologist","billing_staff","hr_manager","accountant"];

export default function FeatureFlagsTab() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [editing, setEditing] = useState<string|null>(null);
  const [editData, setEditData] = useState<{ rollout_percentage: number; allowed_roles: string[]|null }>({ rollout_percentage: 100, allowed_roles: null });
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ key:"", name:"", description:"", environment:"production" });
  const [togglingId, setTogglingId] = useState<string|null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getFeatureFlags().then(d => setFlags(d.flags||[])).catch(e => setError(e?.response?.data?.message||"Erreur serveur")).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (flag: FeatureFlag) => {
    setTogglingId(flag.id);
    const optimistic = flags.map(f => f.id===flag.id ? {...f,enabled:!f.enabled} : f);
    setFlags(optimistic);
    try { await updateFeatureFlag(flag.id, { enabled: !flag.enabled }); load(); }
    catch (e: any) { setFlags(flags); setError(e?.response?.data?.message||"Erreur"); }
    finally { setTogglingId(null); }
  };

  const handleEditSave = async (id: string) => {
    try { await updateFeatureFlag(id, editData); load(); setEditing(null); }
    catch (e: any) { setError(e?.response?.data?.message||"Erreur"); }
  };

  const handleCreate = async () => {
    try { await createFeatureFlag({ ...form }); setForm({ key:"", name:"", description:"", environment:"production" }); setShowCreate(false); load(); }
    catch (e: any) { setError(e?.response?.data?.message||"Erreur"); }
  };

  if (loading) return <Spinner />;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flag className="w-5 h-5 text-indigo-600"/>
          <h2 className="text-lg font-semibold text-gray-900">Feature Flags</h2>
          <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{flags.length}</span>
        </div>
        <button onClick={() => setShowCreate(v=>!v)} className="flex items-center gap-1 bg-indigo-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-indigo-700">
          <Plus className="w-4 h-4"/> Ajouter
        </button>
      </div>

      {showCreate && (
        <div className="border border-indigo-200 bg-indigo-50 rounded-xl p-4 space-y-3">
          <h3 className="font-medium text-indigo-900">Nouveau flag</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Clé (snake_case) *</label>
              <input value={form.key} onChange={e => setForm(f=>({...f,key:e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,"_")}))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="mon_flag"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nom *</label>
              <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <input value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Environnement</label>
            <select value={form.environment} onChange={e => setForm(f=>({...f,environment:e.target.value}))} className="border rounded-lg px-3 py-2 text-sm">
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={!form.key||!form.name} className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">Créer</button>
            <button onClick={() => setShowCreate(false)} className="border text-sm px-4 py-2 rounded-lg hover:bg-gray-50">Annuler</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {flags.map(flag => (
          <div key={flag.id} className="border rounded-xl bg-white overflow-hidden">
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700">{flag.key}</code>
                    <span className="font-medium text-sm text-gray-900">{flag.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${flag.environment==="production"?"bg-blue-50 text-blue-700":"bg-gray-50 text-gray-600"}`}>{flag.environment}</span>
                  </div>
                  {flag.description && <p className="text-xs text-gray-500 mt-1">{flag.description}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>Déploiement: {flag.rollout_percentage}%</span>
                    {flag.updated_by_name && <span>· Par {flag.updated_by_name}</span>}
                    <span>· {new Date(flag.updated_at).toLocaleDateString("fr-FR")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => { setEditing(editing===flag.id?null:flag.id); setEditData({rollout_percentage:flag.rollout_percentage,allowed_roles:flag.allowed_roles}); }} className="text-xs text-gray-400 hover:text-indigo-600 px-2 py-1 border rounded">Modifier</button>
                  <button
                    onClick={() => handleToggle(flag)}
                    disabled={togglingId===flag.id}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${flag.enabled?"bg-indigo-600":"bg-gray-200"} ${togglingId===flag.id?"opacity-50":""}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${flag.enabled?"translate-x-6":"translate-x-1"}`}/>
                  </button>
                </div>
              </div>
              {editing === flag.id && (
                <div className="mt-3 pt-3 border-t space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Déploiement progressif: {editData.rollout_percentage}%</label>
                    <input type="range" min="0" max="100" value={editData.rollout_percentage} onChange={e => setEditData(d=>({...d,rollout_percentage:Number(e.target.value)}))} className="w-full"/>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Rôles autorisés (vide = tous)</label>
                    <div className="flex flex-wrap gap-1">
                      {ROLES.map(r => {
                        const active = !editData.allowed_roles || editData.allowed_roles.includes(r);
                        return (
                          <button key={r} onClick={() => setEditData(d => {
                            const cur = d.allowed_roles ?? ROLES;
                            const next = cur.includes(r) ? cur.filter(x=>x!==r) : [...cur,r];
                            return {...d, allowed_roles: next.length===ROLES.length ? null : next};
                          })} className={`text-xs px-2 py-0.5 rounded border transition-colors ${active?"bg-indigo-100 border-indigo-300 text-indigo-700":"bg-white border-gray-200 text-gray-500"}`}>{r}</button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEditSave(flag.id)} className="flex items-center gap-1 bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg"><Check className="w-3 h-3"/> Enregistrer</button>
                    <button onClick={() => setEditing(null)} className="flex items-center gap-1 border text-xs px-3 py-1.5 rounded-lg"><X className="w-3 h-3"/> Annuler</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
