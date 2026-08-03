import { useState, useEffect } from "react";
import { getWorkOrders, createWorkOrder, startWorkOrder, closeWorkOrder, getEquipment } from "@/services/api/biomedical";

const STATUS_BADGE: Record<string,string> = {
  ouvert:"bg-blue-100 text-blue-700", en_cours:"bg-amber-100 text-amber-700",
  en_attente_pieces:"bg-purple-100 text-purple-700", suspendu:"bg-gray-100 text-gray-600",
  termine:"bg-emerald-100 text-emerald-700", annule:"bg-red-100 text-red-700",
};
const TYPE_BADGE: Record<string,string> = {
  preventive:"bg-teal-100 text-teal-700", corrective:"bg-orange-100 text-orange-700",
  urgente:"bg-red-100 text-red-700", inspection:"bg-blue-100 text-blue-700",
  calibration:"bg-purple-100 text-purple-700", installation:"bg-indigo-100 text-indigo-700",
};

export default function WorkOrdersPage() {
  const [page, setPage] = useState(1);
  const [statusF, setStatusF] = useState("");
  const [typeF, setTypeF] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Record<string,any>>({ tasks: [] });
  const [taskInput, setTaskInput] = useState("");
  const [equipSearch, setEquipSearch] = useState("");
  const [equipList, setEquipList] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (equipSearch) getEquipment({ q: equipSearch, limit: 20 }).then(setEquipList).catch(() => {});
    else setEquipList(null);
  }, [equipSearch]);

  useEffect(() => {
    setLoading(true);
    getWorkOrders({ page, status: statusF, order_type: typeF, limit: 20 })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, statusF, typeF, tick]);

  const refetch = () => setTick(t => t + 1);
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const addTask = () => {
    if (!taskInput.trim()) return;
    setForm(p => ({ ...p, tasks: [...(p.tasks??[]), { task_name: taskInput }] }));
    setTaskInput("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await createWorkOrder(form); setShowCreate(false); setForm({ tasks:[] }); refetch(); }
    catch { alert("Erreur création OT"); }
  };

  const handleAction = async (wo: any, action: string) => {
    try {
      if (action === "start") { await startWorkOrder(wo.id); }
      else if (action === "close") {
        const h = prompt("Heures passées ?", "2"); if (h === null) return;
        const notes = prompt("Résolution ?", ""); if (notes === null) return;
        await closeWorkOrder(wo.id, { actual_hours: Number(h), resolution_notes: notes });
      }
      refetch();
    } catch { alert("Erreur"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={statusF} onChange={e => setStatusF(e.target.value)}>
          <option value="">Tous statuts</option>
          {["ouvert","en_cours","en_attente_pieces","suspendu","termine","annule"].map(s =>
            <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
        </select>
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={typeF} onChange={e => setTypeF(e.target.value)}>
          <option value="">Tous types</option>
          {["preventive","corrective","urgente","inspection","calibration","installation"].map(t =>
            <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)}
          className="ml-auto bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Nouvel OT
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["N° OT","Équipement","Type","Priorité","Statut","Date planif.","Coût total","Actions"].map(h =>
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && <tr><td colSpan={8} className="text-center py-10 text-gray-400">Chargement…</td></tr>}
              {!loading && !data?.data?.length && <tr><td colSpan={8} className="text-center py-10 text-gray-400">Aucun ordre de travail</td></tr>}
              {data?.data?.map((wo: any) => (
                <tr key={wo.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{wo.order_number}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 text-xs">{wo.equipment_name}</div>
                    <div className="text-xs text-gray-400">{wo.internal_code}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[wo.order_type]??""}`}>{wo.order_type}</span>
                  </td>
                  <td className="px-4 py-3 text-xs capitalize text-gray-600">{wo.priority}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[wo.status]??""}`}>
                      {wo.status.replace(/_/g," ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {wo.scheduled_date ? new Date(wo.scheduled_date).toLocaleDateString("fr-DZ") : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700 font-medium">
                    {wo.total_cost ? Number(wo.total_cost).toLocaleString("fr-DZ")+" DA" : "—"}
                  </td>
                  <td className="px-4 py-3 flex gap-1">
                    {wo.status === "ouvert" &&
                      <button onClick={() => handleAction(wo,"start")}
                        className="text-xs text-amber-600 hover:text-amber-800 font-medium">Démarrer</button>}
                    {["ouvert","en_cours","en_attente_pieces"].includes(wo.status) &&
                      <button onClick={() => handleAction(wo,"close")}
                        className="text-xs text-emerald-600 hover:text-emerald-800 font-medium ml-2">Clôturer</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">Total: {data?.total ?? 0}</p>
          <div className="flex gap-2">
            <button disabled={page===1} onClick={() => setPage(p=>p-1)}
              className="px-3 py-1 text-xs border border-gray-300 rounded-lg disabled:opacity-40">Préc.</button>
            <span className="px-3 py-1 text-xs">{page}</span>
            <button disabled={(data?.total??0)<=page*20} onClick={() => setPage(p=>p+1)}
              className="px-3 py-1 text-xs border border-gray-300 rounded-lg disabled:opacity-40">Suiv.</button>
          </div>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Nouvel ordre de travail</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600">Titre *</label>
                <input required className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.title ?? ""} onChange={f("title")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Type</label>
                  <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.order_type ?? "corrective"} onChange={e => setForm(p=>({...p,order_type:e.target.value}))}>
                    {["preventive","corrective","urgente","inspection","calibration","installation"].map(t =>
                      <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Priorité</label>
                  <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.priority ?? "normale"} onChange={e => setForm(p=>({...p,priority:e.target.value}))}>
                    {["faible","normale","haute","critique"].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Rechercher équipement *</label>
                <input className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Nom ou code…" value={equipSearch} onChange={e => setEquipSearch(e.target.value)} />
                {equipList?.data?.length > 0 && (
                  <div className="mt-1 border border-gray-200 rounded-lg max-h-36 overflow-y-auto">
                    {equipList.data.map((eq: any) => (
                      <button key={eq.id} type="button" className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-sm border-b last:border-0"
                        onClick={() => { setForm(p=>({...p,equipment_id:eq.id})); setEquipSearch(eq.name); }}>
                        <span className="font-medium">{eq.name}</span>
                        <span className="text-gray-400 ml-2 text-xs">{eq.internal_code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Date planifiée</label>
                  <input type="date" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.scheduled_date ?? ""} onChange={f("scheduled_date")} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Heures estimées</label>
                  <input type="number" min="0" step="0.5" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.estimated_hours ?? ""} onChange={f("estimated_hours")} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Description</label>
                <textarea rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.description ?? ""} onChange={f("description")} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Tâches</label>
                <div className="flex gap-2 mt-1">
                  <input className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="Ajouter une tâche…" value={taskInput} onChange={e => setTaskInput(e.target.value)}
                    onKeyDown={e => e.key==="Enter" && (e.preventDefault(), addTask())} />
                  <button type="button" onClick={addTask}
                    className="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">+</button>
                </div>
                {form.tasks?.map((t: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500 w-5">{i+1}.</span>
                    <span className="text-sm flex-1">{t.task_name}</span>
                    <button type="button" className="text-red-400 text-xs"
                      onClick={() => setForm(p=>({...p,tasks:p.tasks.filter((_:any,j:number)=>j!==i)}))}>✕</button>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Créer OT</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
