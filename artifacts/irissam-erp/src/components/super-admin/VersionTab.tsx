import { useState, useEffect, useCallback } from "react";
import { Tag, Plus, GitCommit, Server, Clock, Package } from "lucide-react";
import { getSystemVersion, getReleaseNotes, createReleaseNote } from "@/services/api/system";
import { useAuth } from "@/store/AuthContext";

function Spinner() { return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"/></div>; }

function formatUptime(seconds: number): string {
  if (!seconds) return "0s";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}j`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (parts.length === 0) parts.push(`${s}s`);
  return parts.join(" ");
}

interface VersionInfo { appVersion: string; buildId: string; gitCommit: string; buildDate: string; apiVersion: string; environment: string; lastMigration: string; nodeVersion: string; uptimeSeconds: number; }
interface ReleaseNote { id: string; version: string; title: string; body: string; environment: string; published_at: string|null; published_by_name: string|null; created_at: string; }

const ENV_COLORS: Record<string,string> = { production:"bg-red-100 text-red-700", staging:"bg-yellow-100 text-yellow-700", development:"bg-blue-100 text-blue-700" };

export default function VersionTab() {
  const { user } = useAuth();
  const [version, setVersion] = useState<VersionInfo|null>(null);
  const [notes, setNotes] = useState<ReleaseNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ version:"", title:"", body:"", publishedAt:"" });
  const [creating, setCreating] = useState(false);

  const isSuperAdmin = user?.role === "super_admin" || user?.role === "system_administrator";

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getSystemVersion(), getReleaseNotes()])
      .then(([v, n]) => { setVersion(v); setNotes(n.notes||[]); })
      .catch(e => setError(e?.response?.data?.message||"Erreur serveur"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await createReleaseNote({ version: form.version, title: form.title, body: form.body, publishedAt: form.publishedAt || undefined });
      setForm({ version:"", title:"", body:"", publishedAt:"" }); setShowCreate(false); load();
    } catch (e: any) { setError(e?.response?.data?.message||"Erreur"); }
    finally { setCreating(false); }
  };

  if (loading) return <Spinner />;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {/* Version info card */}
      {version && (
        <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-200 rounded-xl p-6">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <Package className="w-6 h-6 text-indigo-600"/>
                <span className="text-2xl font-bold text-gray-900">v{version.appVersion}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ENV_COLORS[version.environment]||"bg-gray-100 text-gray-600"}`}>{version.environment}</span>
                <span className="text-xs text-gray-400">{version.apiVersion}</span>
              </div>
            </div>
            <div className="text-right text-xs text-gray-400">
              <div>Construit le {new Date(version.buildDate).toLocaleString("fr-FR")}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { icon: <GitCommit className="w-4 h-4"/>, label:"Commit Git",     value: version.gitCommit === "unknown" ? "—" : version.gitCommit.slice(0,8) },
              { icon: <Tag className="w-4 h-4"/>,       label:"Build ID",       value: version.buildId },
              { icon: <Server className="w-4 h-4"/>,    label:"Node.js",        value: version.nodeVersion },
              { icon: <Package className="w-4 h-4"/>,   label:"API",            value: version.apiVersion },
              { icon: <Tag className="w-4 h-4"/>,       label:"Dern. migration",value: version.lastMigration || "—" },
              { icon: <Clock className="w-4 h-4"/>,     label:"Uptime",         value: formatUptime(version.uptimeSeconds) },
            ].map(item => (
              <div key={item.label} className="bg-white rounded-lg p-3 border">
                <div className="flex items-center gap-1 text-gray-400 mb-1">{item.icon}<span className="text-xs">{item.label}</span></div>
                <div className="font-mono text-sm font-medium text-gray-800 truncate">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Release notes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Notes de version</h3>
          {isSuperAdmin && (
            <button onClick={() => setShowCreate(v=>!v)} className="flex items-center gap-1 text-sm text-indigo-600 hover:underline">
              <Plus className="w-4 h-4"/> Ajouter
            </button>
          )}
        </div>

        {showCreate && (
          <div className="border border-indigo-200 bg-indigo-50 rounded-xl p-4 space-y-3 mb-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Version *</label><input value={form.version} onChange={e => setForm(f=>({...f,version:e.target.value}))} placeholder="1.2.0" className="w-full border rounded-lg px-3 py-2 text-sm font-mono"/></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Titre *</label><input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm"/></div>
            </div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Contenu *</label><textarea value={form.body} onChange={e => setForm(f=>({...f,body:e.target.value}))} rows={4} placeholder="Décrivez les changements de cette version…" className="w-full border rounded-lg px-3 py-2 text-sm"/></div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Date de publication (optionnel)</label><input type="datetime-local" value={form.publishedAt} onChange={e => setForm(f=>({...f,publishedAt:e.target.value}))} className="border rounded-lg px-3 py-2 text-sm"/></div>
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={creating||!form.version||!form.title||!form.body} className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">{creating?"Création…":"Créer"}</button>
              <button onClick={() => setShowCreate(false)} className="border text-sm px-4 py-2 rounded-lg hover:bg-gray-50">Annuler</button>
            </div>
          </div>
        )}

        {notes.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Tag className="w-12 h-12 mx-auto mb-3 opacity-30"/>
            <p>Aucune note de version</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notes.map(note => (
              <div key={note.id} className="border rounded-xl bg-white p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold">v{note.version}</span>
                    <span className="font-semibold text-gray-900">{note.title}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {note.published_at ? new Date(note.published_at).toLocaleDateString("fr-FR") : new Date(note.created_at).toLocaleDateString("fr-FR")}
                    {note.published_by_name && <span> · {note.published_by_name}</span>}
                  </div>
                </div>
                <div className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{note.body}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
