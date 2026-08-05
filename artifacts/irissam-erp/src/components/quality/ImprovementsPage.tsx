import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { getImprovements, createImprovement, transitionImprovement } from "@/services/api/quality";

const STATUS_BADGE: Record<string,string> = {
  propose:"bg-blue-100 text-blue-700", accepte:"bg-indigo-100 text-indigo-700",
  en_cours:"bg-amber-100 text-amber-700", implante:"bg-emerald-100 text-emerald-700",
  rejete:"bg-red-100 text-red-700", abandonne:"bg-gray-100 text-gray-500",
};
const CATEGORY_BADGE: Record<string,string> = {
  processus:"bg-teal-100 text-teal-700", securite:"bg-red-100 text-red-700",
  qualite:"bg-indigo-100 text-indigo-700", efficacite:"bg-amber-100 text-amber-700",
  satisfaction:"bg-purple-100 text-purple-700", autre:"bg-gray-100 text-gray-600",
};
const TRANSITIONS: Record<string,{action:string;label:string}[]> = {
  propose:   [{ action:"accept",   label:"Accepter" }, { action:"reject", label:"Rejeter" }],
  accepte:   [{ action:"start",    label:"Démarrer" }],
  en_cours:  [{ action:"complete", label:"Implanter" }],
};

export default function ImprovementsPage() {
  const [page, setPage] = useState(1);
  const [statusF, setStatusF] = useState("");
  const [categoryF, setCategoryF] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Record<string,any>>({ category: "processus", priority: "normale" });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    getImprovements({ page, status: statusF, category: categoryF, limit: 20 })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, statusF, categoryF, tick]);

  const refetch = () => setTick(t => t + 1);
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await createImprovement(form); setShowCreate(false); setForm({ category:"processus", priority:"normale" }); refetch(); }
    catch { toast({ variant: "destructive", title: "Erreur", description: "Impossible de créer l'amélioration" }); }
  };

  const handleTransition = async (imp: any, action: string) => {
    const notes = prompt("Notes :", ""); if (notes === null) return;
    try { await transitionImprovement(imp.id, action, { notes }); refetch(); }
    catch { toast({ variant: "destructive", title: "Erreur", description: "Transition impossible" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={statusF} onChange={e => setStatusF(e.target.value)}>
          <option value="">Tous statuts</option>
          {["propose","accepte","en_cours","implante","rejete","abandonne"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={categoryF} onChange={e => setCategoryF(e.target.value)}>
          <option value="">Toutes catégories</option>
          {["processus","securite","qualite","efficacite","satisfaction","autre"].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)} className="ml-auto bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">+ Proposer amélioration</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading && <div className="col-span-2 text-center py-10 text-gray-400">Chargement…</div>}
        {!loading && !data?.data?.length && <div className="col-span-2 text-center py-10 text-gray-400">Aucune amélioration</div>}
        {data?.data?.map((imp: any) => (
          <div key={imp.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="font-semibold text-gray-900 text-sm">{imp.title}</p>
                <p className="text-xs font-mono text-gray-400">{imp.improvement_number}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[imp.status]??""}`}>{imp.status}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_BADGE[imp.category]??""}`}>{imp.category}</span>
              <span className="text-xs text-gray-400 capitalize">{imp.priority}</span>
              {imp.expected_gain && <span className="text-xs text-emerald-600 font-medium">✓ {imp.expected_gain}</span>}
            </div>
            {imp.proposer_name && <p className="text-xs text-gray-500">👤 {imp.proposer_name}</p>}
            <div className="flex gap-2">
              {TRANSITIONS[imp.status]?.map(tr => (
                <button key={tr.action} onClick={() => handleTransition(imp, tr.action)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium ${tr.action==="reject" ? "bg-red-50 text-red-700 hover:bg-red-100" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"}`}>
                  {tr.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Total: {data?.total ?? 0}</span>
        <div className="flex gap-2">
          <button disabled={page===1} onClick={() => setPage(p=>p-1)} className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-40">Préc.</button>
          <span>{page}</span>
          <button disabled={(data?.total??0)<=page*20} onClick={() => setPage(p=>p+1)} className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-40">Suiv.</button>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Proposer une amélioration</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div><label className="text-xs font-medium text-gray-600">Titre *</label>
                <input required className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.title ?? ""} onChange={f("title")} /></div>
              <div><label className="text-xs font-medium text-gray-600">Description *</label>
                <textarea required rows={3} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.description ?? ""} onChange={f("description")} /></div>
              <div><label className="text-xs font-medium text-gray-600">Gain attendu</label>
                <input className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Ex: réduction de 30% des délais" value={form.expected_gain ?? ""} onChange={f("expected_gain")} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Catégorie</label>
                  <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.category ?? "processus"} onChange={e => setForm(p=>({...p,category:e.target.value}))}>
                    {["processus","securite","qualite","efficacite","satisfaction","autre"].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div><label className="text-xs font-medium text-gray-600">Priorité</label>
                  <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.priority ?? "normale"} onChange={e => setForm(p=>({...p,priority:e.target.value}))}>
                    {["faible","normale","haute"].map(p => <option key={p} value={p}>{p}</option>)}</select></div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Proposer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
