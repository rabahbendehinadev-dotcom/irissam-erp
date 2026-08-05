import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { getCapas, createCapa, transitionCapa } from "@/services/api/quality";

const STATUS_BADGE: Record<string,string> = {
  ouvert:"bg-blue-100 text-blue-700", en_cours:"bg-amber-100 text-amber-700",
  valide:"bg-indigo-100 text-indigo-700", clos:"bg-emerald-100 text-emerald-700",
  abandonne:"bg-gray-100 text-gray-500",
};
const TYPE_BADGE: Record<string,string> = {
  corrective:"bg-orange-100 text-orange-700", preventive:"bg-teal-100 text-teal-700",
  amelioration:"bg-purple-100 text-purple-700",
};
const TRANSITIONS: Record<string,{action:string;label:string}> = {
  ouvert:   { action:"start",    label:"Démarrer" },
  en_cours: { action:"validate", label:"Valider" },
  valide:   { action:"close",    label:"Clôturer" },
};

export default function CapaPage() {
  const [page, setPage] = useState(1);
  const [statusF, setStatusF] = useState("");
  const [typeF, setTypeF] = useState("");
  const [priorityF, setPriorityF] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Record<string,any>>({ type: "corrective", priority: "normale" });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    getCapas({ page, status: statusF, type: typeF, priority: priorityF, limit: 20 })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, statusF, typeF, priorityF, tick]);

  const refetch = () => setTick(t => t + 1);
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await createCapa(form); setShowCreate(false); setForm({ type:"corrective", priority:"normale" }); refetch(); }
    catch { toast({ variant: "destructive", title: "Erreur", description: "Impossible de créer le CAPA" }); }
  };

  const handleTransition = async (capa: any) => {
    const tr = TRANSITIONS[capa.status]; if (!tr) return;
    const notes = prompt(`Notes (${tr.label}) :`, ""); if (notes === null) return;
    try { await transitionCapa(capa.id, tr.action, { notes }); refetch(); }
    catch { toast({ variant: "destructive", title: "Erreur", description: "Transition impossible" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={statusF} onChange={e => setStatusF(e.target.value)}>
          <option value="">Tous statuts</option>
          {["ouvert","en_cours","valide","clos","abandonne"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={typeF} onChange={e => setTypeF(e.target.value)}>
          <option value="">Tous types</option>
          {["corrective","preventive","amelioration"].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={priorityF} onChange={e => setPriorityF(e.target.value)}>
          <option value="">Toutes priorités</option>
          {["faible","normale","haute","critique"].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)} className="ml-auto bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">+ Nouvelle CAPA</button>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{["N°","Titre","Type","Priorité","Statut","Responsable","Date limite","Actions"].map(h =>
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && <tr><td colSpan={8} className="text-center py-10 text-gray-400">Chargement…</td></tr>}
              {!loading && !data?.data?.length && <tr><td colSpan={8} className="text-center py-10 text-gray-400">Aucune CAPA</td></tr>}
              {data?.data?.map((c: any) => {
                const isOverdue = c.due_date && new Date(c.due_date) < new Date() && !["clos","abandonne"].includes(c.status);
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{c.capa_number}</td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-900 max-w-48">{c.title}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[c.type]??""}`}>{c.type}</span></td>
                    <td className="px-4 py-3 text-xs capitalize text-gray-600">{c.priority}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[c.status]??""}`}>{c.status}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-600">{c.responsible_name ?? "—"}</td>
                    <td className={`px-4 py-3 text-xs ${isOverdue?"text-red-600 font-bold":"text-gray-500"}`}>{c.due_date ? new Date(c.due_date).toLocaleDateString("fr-DZ") : "—"}</td>
                    <td className="px-4 py-3">{TRANSITIONS[c.status] && (
                      <button onClick={() => handleTransition(c)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">{TRANSITIONS[c.status].label} →</button>
                    )}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-gray-500">
          <span>Total: {data?.total ?? 0}</span>
          <div className="flex gap-2">
            <button disabled={page===1} onClick={() => setPage(p=>p-1)} className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-40">Préc.</button>
            <span>{page}</span>
            <button disabled={(data?.total??0)<=page*20} onClick={() => setPage(p=>p+1)} className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-40">Suiv.</button>
          </div>
        </div>
      </div>
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Nouvelle CAPA</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div><label className="text-xs font-medium text-gray-600">Titre *</label>
                <input required className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.title ?? ""} onChange={f("title")} /></div>
              <div><label className="text-xs font-medium text-gray-600">Description du problème *</label>
                <textarea required rows={3} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.problem_description ?? ""} onChange={f("problem_description")} /></div>
              <div><label className="text-xs font-medium text-gray-600">Action planifiée</label>
                <textarea rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.planned_action ?? ""} onChange={f("planned_action")} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Type</label>
                  <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.type ?? "corrective"} onChange={e => setForm(p=>({...p,type:e.target.value}))}>
                    {["corrective","preventive","amelioration"].map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className="text-xs font-medium text-gray-600">Priorité</label>
                  <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.priority ?? "normale"} onChange={e => setForm(p=>({...p,priority:e.target.value}))}>
                    {["faible","normale","haute","critique"].map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                <div><label className="text-xs font-medium text-gray-600">Date limite</label>
                  <input type="date" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.due_date ?? ""} onChange={f("due_date")} /></div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Créer CAPA</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
