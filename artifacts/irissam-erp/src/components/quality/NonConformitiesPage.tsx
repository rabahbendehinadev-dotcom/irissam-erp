import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { getNonConformities, createNonConformity, transitionNC } from "@/services/api/quality";

const STATUS_BADGE: Record<string,string> = {
  detectee:"bg-red-100 text-red-700", en_traitement:"bg-amber-100 text-amber-700",
  traitee:"bg-blue-100 text-blue-700", verifiee:"bg-indigo-100 text-indigo-700",
  cloturee:"bg-emerald-100 text-emerald-700",
};
const GRAVITY_BADGE: Record<string,string> = {
  critique:"bg-red-100 text-red-700", majeur:"bg-orange-100 text-orange-700",
  mineur:"bg-gray-100 text-gray-600",
};
const TRANSITIONS: Record<string,{action:string;label:string}> = {
  detectee:      { action:"treat",  label:"Traiter" },
  en_traitement: { action:"verify", label:"Vérifier" },
  traitee:       { action:"close",  label:"Clôturer" },
};
const NC_TYPES = ["produit","processus","service","documentation","hygiene","securite","autre"];

export default function NonConformitiesPage() {
  const [page, setPage] = useState(1);
  const [statusF, setStatusF] = useState("");
  const [gravityF, setGravityF] = useState("");
  const [typeF, setTypeF] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Record<string,any>>({ type: "processus", gravity: "mineur" });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    getNonConformities({ page, status: statusF, gravity: gravityF, type: typeF, limit: 20 })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, statusF, gravityF, typeF, tick]);

  const refetch = () => setTick(t => t + 1);
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await createNonConformity(form); setShowCreate(false); setForm({ type:"processus",gravity:"mineur" }); refetch(); }
    catch { toast({ variant: "destructive", title: "Erreur", description: "Impossible de créer la NC" }); }
  };

  const handleTransition = async (nc: any) => {
    const tr = TRANSITIONS[nc.status]; if (!tr) return;
    const notes = prompt(`Notes (${tr.label}) :`, ""); if (notes === null) return;
    try { await transitionNC(nc.id, tr.action, { notes }); refetch(); }
    catch { toast({ variant: "destructive", title: "Erreur", description: "Transition impossible" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={statusF} onChange={e => setStatusF(e.target.value)}>
          <option value="">Tous statuts</option>
          {["detectee","en_traitement","traitee","verifiee","cloturee"].map(s => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
        </select>
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={gravityF} onChange={e => setGravityF(e.target.value)}>
          <option value="">Toutes gravités</option>
          {["mineur","majeur","critique"].map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={typeF} onChange={e => setTypeF(e.target.value)}>
          <option value="">Tous types</option>
          {NC_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g," ")}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)} className="ml-auto bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700">+ Nouvelle NC</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{["N°","Titre","Type","Gravité","Statut","Service","Date limite","Actions"].map(h =>
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && <tr><td colSpan={8} className="text-center py-10 text-gray-400">Chargement…</td></tr>}
              {!loading && !data?.data?.length && <tr><td colSpan={8} className="text-center py-10 text-gray-400">Aucune non-conformité</td></tr>}
              {data?.data?.map((nc: any) => {
                const isOverdue = nc.due_date && new Date(nc.due_date) < new Date() && !["cloturee","verifiee"].includes(nc.status);
                return (
                  <tr key={nc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{nc.nc_number}</td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-900 max-w-48">{nc.title}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 capitalize">{nc.type?.replace(/_/g," ")}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${GRAVITY_BADGE[nc.gravity]??""}`}>{nc.gravity}</span></td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[nc.status]??""}`}>{nc.status.replace(/_/g," ")}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-500">{nc.department ?? "—"}</td>
                    <td className={`px-4 py-3 text-xs ${isOverdue ? "text-red-600 font-bold" : "text-gray-500"}`}>{nc.due_date ? new Date(nc.due_date).toLocaleDateString("fr-DZ") : "—"}</td>
                    <td className="px-4 py-3">{TRANSITIONS[nc.status] && (
                      <button onClick={() => handleTransition(nc)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">{TRANSITIONS[nc.status].label} →</button>
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
              <h2 className="text-lg font-semibold">Nouvelle non-conformité</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div><label className="text-xs font-medium text-gray-600">Titre *</label>
                <input required className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.title ?? ""} onChange={f("title")} /></div>
              <div><label className="text-xs font-medium text-gray-600">Description *</label>
                <textarea required rows={3} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.description ?? ""} onChange={f("description")} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Type</label>
                  <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.type ?? "processus"} onChange={e => setForm(p=>({...p,type:e.target.value}))}>
                    {NC_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g," ")}</option>)}</select></div>
                <div><label className="text-xs font-medium text-gray-600">Gravité</label>
                  <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.gravity ?? "mineur"} onChange={e => setForm(p=>({...p,gravity:e.target.value}))}>
                    {["mineur","majeur","critique"].map(g => <option key={g} value={g}>{g}</option>)}</select></div>
                <div><label className="text-xs font-medium text-gray-600">Service</label>
                  <input className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.department ?? ""} onChange={f("department")} /></div>
                <div><label className="text-xs font-medium text-gray-600">Date limite</label>
                  <input type="date" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.due_date ?? ""} onChange={f("due_date")} /></div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700">Créer NC</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
