import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { getIncidents, createIncident, transitionIncident } from "@/services/api/biomedical";

const STATUS_BADGE: Record<string,string> = {
  declare:"bg-blue-100 text-blue-700", en_analyse:"bg-amber-100 text-amber-700",
  en_correction:"bg-orange-100 text-orange-700", valide:"bg-indigo-100 text-indigo-700",
  clos:"bg-emerald-100 text-emerald-700",
};
const SEV_BADGE: Record<string,string> = {
  critique:"bg-red-100 text-red-700", majeur:"bg-orange-100 text-orange-700",
  modere:"bg-amber-100 text-amber-700", mineur:"bg-gray-100 text-gray-600",
};
const TRANSITIONS: Record<string,{action:string;label:string;next:string}> = {
  declare:      { action:"analyse",  label:"Analyser",   next:"en_analyse" },
  en_analyse:   { action:"correct",  label:"Corriger",   next:"en_correction" },
  en_correction:{ action:"validate", label:"Valider",    next:"valide" },
  valide:       { action:"close",    label:"Clôturer",   next:"clos" },
};

export default function IncidentsPage() {
  const [page, setPage] = useState(1);
  const [statusF, setStatusF] = useState("");
  const [severityF, setSeverityF] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Record<string,any>>({});
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    getIncidents({ page, status: statusF, severity: severityF, limit: 20 })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, statusF, severityF, tick]);

  const refetch = () => setTick(t => t + 1);
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await createIncident(form); setShowCreate(false); setForm({}); refetch(); }
    catch { toast({ variant: "destructive", title: "Erreur", description: "Impossible de créer l'incident" }); }
  };

  const handleTransition = async (inc: any) => {
    const tr = TRANSITIONS[inc.status];
    if (!tr) return;
    const notes = prompt(`Notes pour "${tr.label}" :`, ""); if (notes === null) return;
    try { await transitionIncident(inc.id, tr.action, { notes }); refetch(); }
    catch { toast({ variant: "destructive", title: "Erreur", description: "Transition impossible" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={statusF} onChange={e => setStatusF(e.target.value)}>
          <option value="">Tous statuts</option>
          {["declare","en_analyse","en_correction","valide","clos"].map(s =>
            <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
        </select>
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={severityF} onChange={e => setSeverityF(e.target.value)}>
          <option value="">Toutes gravités</option>
          {["mineur","modere","majeur","critique"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)}
          className="ml-auto bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700">
          + Déclarer incident
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {["N°","Titre","Équipement","Gravité","Statut","Date","Impact patient","Actions"].map(h =>
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && <tr><td colSpan={8} className="text-center py-10 text-gray-400">Chargement…</td></tr>}
              {!loading && !data?.data?.length && <tr><td colSpan={8} className="text-center py-10 text-gray-400">Aucun incident</td></tr>}
              {data?.data?.map((inc: any) => (
                <tr key={inc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{inc.incident_number}</td>
                  <td className="px-4 py-3 text-xs font-medium text-gray-900 max-w-48">{inc.title}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{inc.equipment_name ?? "—"}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEV_BADGE[inc.severity]??""}`}>{inc.severity}</span></td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[inc.status]??""}`}>{inc.status.replace(/_/g," ")}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(inc.incident_date).toLocaleDateString("fr-DZ")}</td>
                  <td className="px-4 py-3 text-center">
                    {inc.patient_safety_alert ? <span className="text-red-600 font-bold text-xs">ALERTE</span> :
                     inc.patient_impact ? <span className="text-orange-600 text-xs">Oui</span> :
                     <span className="text-gray-300 text-xs">Non</span>}
                  </td>
                  <td className="px-4 py-3">
                    {TRANSITIONS[inc.status] && (
                      <button onClick={() => handleTransition(inc)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                        {TRANSITIONS[inc.status].label} →
                      </button>
                    )}
                  </td>
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
              <h2 className="text-lg font-semibold">Déclarer un incident</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600">Titre *</label>
                <input required className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.title ?? ""} onChange={f("title")} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Description *</label>
                <textarea required rows={3} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.description ?? ""} onChange={f("description")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Gravité</label>
                  <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.severity ?? "modere"} onChange={e => setForm(p=>({...p,severity:e.target.value}))}>
                    {["mineur","modere","majeur","critique"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Date incident</label>
                  <input type="datetime-local" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.incident_date ?? ""} onChange={f("incident_date")} />
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!form.patient_impact}
                    onChange={e => setForm(p=>({...p,patient_impact:e.target.checked}))} />
                  <span className="text-sm">Impact patient</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!form.patient_safety_alert}
                    onChange={e => setForm(p=>({...p,patient_safety_alert:e.target.checked}))} />
                  <span className="text-sm text-red-600">Alerte sécurité patient</span>
                </label>
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
