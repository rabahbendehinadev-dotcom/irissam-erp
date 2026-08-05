import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { getAudits, createAudit, transitionAudit } from "@/services/api/quality";

const STATUS_BADGE: Record<string,string> = {
  planifie:"bg-blue-100 text-blue-700", en_cours:"bg-amber-100 text-amber-700",
  cloture:"bg-emerald-100 text-emerald-700", annule:"bg-gray-100 text-gray-500",
};
const TYPE_BADGE: Record<string,string> = {
  interne:"bg-indigo-100 text-indigo-700", externe:"bg-purple-100 text-purple-700",
  certification:"bg-rose-100 text-rose-700", surveillance:"bg-teal-100 text-teal-700",
};
const TRANSITIONS: Record<string,{action:string;label:string}> = {
  planifie: { action:"start",  label:"Démarrer" },
  en_cours: { action:"close",  label:"Clôturer" },
};

export default function AuditsPage() {
  const [page, setPage] = useState(1);
  const [statusF, setStatusF] = useState("");
  const [typeF, setTypeF] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Record<string,any>>({ type: "interne" });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    getAudits({ page, status: statusF, type: typeF, limit: 20 })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, statusF, typeF, tick]);

  const refetch = () => setTick(t => t + 1);
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await createAudit(form); setShowCreate(false); setForm({ type:"interne" }); refetch(); }
    catch { toast({ variant: "destructive", title: "Erreur", description: "Impossible de créer l'audit" }); }
  };

  const handleTransition = async (audit: any) => {
    const tr = TRANSITIONS[audit.status]; if (!tr) return;
    const notes = audit.status === "en_cours" ? prompt("Résumé de l'audit :", "") : undefined;
    if (notes === null) return;
    try { await transitionAudit(audit.id, tr.action, notes ? { summary: notes } : {}); refetch(); }
    catch { toast({ variant: "destructive", title: "Erreur", description: "Transition impossible" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={statusF} onChange={e => setStatusF(e.target.value)}>
          <option value="">Tous statuts</option>
          {["planifie","en_cours","cloture","annule"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={typeF} onChange={e => setTypeF(e.target.value)}>
          <option value="">Tous types</option>
          {["interne","externe","certification","surveillance"].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)} className="ml-auto bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">+ Planifier audit</button>
      </div>

      <div className="space-y-3">
        {loading && <div className="text-center py-10 text-gray-400">Chargement…</div>}
        {!loading && !data?.data?.length && <div className="text-center py-10 text-gray-400">Aucun audit</div>}
        {data?.data?.map((a: any) => (
          <div key={a.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900 text-sm">{a.title}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[a.type]??""}`}>{a.type}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[a.status]??""}`}>{a.status}</span>
                </div>
                <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
                  {a.department && <span>🏥 {a.department}</span>}
                  {a.planned_date && <span>📅 Planifié: {new Date(a.planned_date).toLocaleDateString("fr-DZ")}</span>}
                  {a.lead_auditor_name && <span>👤 {a.lead_auditor_name}</span>}
                  {a.nc_count > 0 && <span className="text-orange-600 font-semibold">⚠ {a.nc_count} NC</span>}
                  {a.observations && <span className="text-blue-600">{a.observations} observations</span>}
                </div>
              </div>
              {TRANSITIONS[a.status] && (
                <button onClick={() => handleTransition(a)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap">
                  {TRANSITIONS[a.status].label} →
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Planifier un audit</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div><label className="text-xs font-medium text-gray-600">Titre *</label>
                <input required className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.title ?? ""} onChange={f("title")} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Type</label>
                  <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.type ?? "interne"} onChange={e => setForm(p=>({...p,type:e.target.value}))}>
                    {["interne","externe","certification","surveillance"].map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className="text-xs font-medium text-gray-600">Date planifiée *</label>
                  <input required type="date" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.planned_date ?? ""} onChange={f("planned_date")} /></div>
                <div><label className="text-xs font-medium text-gray-600">Service audité</label>
                  <input className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.department ?? ""} onChange={f("department")} /></div>
                <div><label className="text-xs font-medium text-gray-600">Référentiel</label>
                  <input className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="ISO 9001, etc." value={form.standard_reference ?? ""} onChange={f("standard_reference")} /></div>
              </div>
              <div><label className="text-xs font-medium text-gray-600">Périmètre</label>
                <textarea rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.scope ?? ""} onChange={f("scope")} /></div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Planifier</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
