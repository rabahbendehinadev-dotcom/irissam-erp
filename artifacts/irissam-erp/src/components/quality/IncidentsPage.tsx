import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { getQualityIncidents, createQualityIncident, transitionQualityIncident } from "@/services/api/quality";

const STATUS_BADGE: Record<string,string> = {
  ouvert:"bg-blue-100 text-blue-700", en_analyse:"bg-amber-100 text-amber-700",
  en_correction:"bg-orange-100 text-orange-700", valide:"bg-indigo-100 text-indigo-700",
  clos:"bg-emerald-100 text-emerald-700",
};
const SEV_BADGE: Record<string,string> = {
  critique:"bg-red-100 text-red-700", majeur:"bg-orange-100 text-orange-700",
  modere:"bg-amber-100 text-amber-700", mineur:"bg-gray-100 text-gray-600",
};
const TRANSITIONS: Record<string,{action:string;label:string}> = {
  ouvert:       { action:"analyse",  label:"Analyser" },
  en_analyse:   { action:"correct",  label:"Corriger" },
  en_correction:{ action:"validate", label:"Valider" },
  valide:       { action:"close",    label:"Clôturer" },
};
const CATEGORIES = ["soins_patient","securite","documentation","processus","materiel","hygiene","autre"];

export default function IncidentsPage() {
  const [page, setPage] = useState(1);
  const [statusF, setStatusF] = useState("");
  const [severityF, setSeverityF] = useState("");
  const [categoryF, setCategoryF] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Record<string,any>>({ severity: "modere", category: "processus" });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    getQualityIncidents({ page, status: statusF, severity: severityF, category: categoryF, limit: 20 })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, statusF, severityF, categoryF, tick]);

  const refetch = () => setTick(t => t + 1);
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await createQualityIncident(form); setShowCreate(false); setForm({ severity:"modere",category:"processus" }); refetch(); }
    catch { toast({ variant: "destructive", title: "Erreur", description: "Impossible de créer l'incident" }); }
  };

  const handleTransition = async (inc: any) => {
    const tr = TRANSITIONS[inc.status]; if (!tr) return;
    const notes = prompt(`Notes (${tr.label}) :`, ""); if (notes === null) return;
    try { await transitionQualityIncident(inc.id, tr.action, { notes }); refetch(); }
    catch { toast({ variant: "destructive", title: "Erreur", description: "Transition impossible" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={statusF} onChange={e => setStatusF(e.target.value)}>
          <option value="">Tous statuts</option>
          {["ouvert","en_analyse","en_correction","valide","clos"].map(s => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
        </select>
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={severityF} onChange={e => setSeverityF(e.target.value)}>
          <option value="">Toutes gravités</option>
          {["mineur","modere","majeur","critique"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={categoryF} onChange={e => setCategoryF(e.target.value)}>
          <option value="">Toutes catégories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g," ")}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)} className="ml-auto bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700">+ Déclarer</button>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{["N°","Titre","Catégorie","Gravité","Statut","Date","Actions"].map(h =>
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && <tr><td colSpan={7} className="text-center py-10 text-gray-400">Chargement…</td></tr>}
              {!loading && !data?.data?.length && <tr><td colSpan={7} className="text-center py-10 text-gray-400">Aucun incident</td></tr>}
              {data?.data?.map((inc: any) => (
                <tr key={inc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{inc.incident_number}</td>
                  <td className="px-4 py-3 text-xs font-medium text-gray-900">{inc.title}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 capitalize">{inc.category?.replace(/_/g," ")}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEV_BADGE[inc.severity]??""}`}>{inc.severity}</span></td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[inc.status]??""}`}>{inc.status.replace(/_/g," ")}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(inc.incident_date).toLocaleDateString("fr-DZ")}</td>
                  <td className="px-4 py-3">{TRANSITIONS[inc.status] && (
                    <button onClick={() => handleTransition(inc)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">{TRANSITIONS[inc.status].label} →</button>
                  )}</td>
                </tr>
              ))}
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
              <h2 className="text-lg font-semibold">Déclarer un incident qualité</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div><label className="text-xs font-medium text-gray-600">Titre *</label>
                <input required className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.title ?? ""} onChange={f("title")} /></div>
              <div><label className="text-xs font-medium text-gray-600">Description *</label>
                <textarea required rows={3} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.description ?? ""} onChange={f("description")} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Catégorie</label>
                  <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.category ?? "processus"} onChange={e => setForm(p=>({...p,category:e.target.value}))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g," ")}</option>)}</select></div>
                <div><label className="text-xs font-medium text-gray-600">Gravité</label>
                  <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.severity ?? "modere"} onChange={e => setForm(p=>({...p,severity:e.target.value}))}>
                    {["mineur","modere","majeur","critique"].map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                <div><label className="text-xs font-medium text-gray-600">Date incident</label>
                  <input type="date" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.incident_date ?? ""} onChange={f("incident_date")} /></div>
                <div><label className="text-xs font-medium text-gray-600">Service concerné</label>
                  <input className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.department ?? ""} onChange={f("department")} /></div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Déclarer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
