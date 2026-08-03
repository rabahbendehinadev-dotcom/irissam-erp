import { useState, useEffect } from "react";
import { getChecklists, createChecklist, getChecklistDetail, recordChecklistItem } from "@/services/api/quality";

const STATUS_BADGE: Record<string,string> = {
  planifie:"bg-blue-100 text-blue-700", en_cours:"bg-amber-100 text-amber-700",
  complete:"bg-emerald-100 text-emerald-700", annule:"bg-gray-100 text-gray-500",
};

export default function ChecklistsPage() {
  const [page, setPage] = useState(1);
  const [statusF, setStatusF] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string|null>(null);
  const [form, setForm] = useState<Record<string,any>>({ items: [] });
  const [itemInput, setItemInput] = useState("");
  const [detail, setDetail] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    getChecklists({ page, status: statusF, limit: 20 })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, statusF, tick]);

  useEffect(() => {
    if (selectedId) getChecklistDetail(selectedId).then(setDetail).catch(() => setDetail(null));
    else setDetail(null);
  }, [selectedId]);

  const refetch = () => setTick(t => t + 1);
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const addItem = () => {
    if (!itemInput.trim()) return;
    setForm(p => ({ ...p, items: [...(p.items??[]), { question: itemInput }] }));
    setItemInput("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await createChecklist(form); setShowCreate(false); setForm({ items:[] }); refetch(); }
    catch { alert("Erreur création checklist"); }
  };

  const handleItemCheck = async (checklistId: string, itemId: string, is_ok: boolean) => {
    try { await recordChecklistItem(checklistId, itemId, { is_ok }); setSelectedId(null); setTimeout(() => setSelectedId(checklistId), 50); }
    catch { alert("Erreur enregistrement réponse"); }
  };

  const completedCount = detail?.items?.filter((i: any) => i.is_ok !== null).length ?? 0;
  const totalCount = detail?.items?.length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={statusF} onChange={e => setStatusF(e.target.value)}>
          <option value="">Tous statuts</option>
          {["planifie","en_cours","complete","annule"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)} className="ml-auto bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">+ Nouvelle checklist</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          {loading && <div className="text-center py-10 text-gray-400">Chargement…</div>}
          {!loading && !data?.data?.length && <div className="text-center py-10 text-gray-400">Aucune checklist</div>}
          {data?.data?.map((cl: any) => {
            const pct = cl.total_items ? Math.round(cl.completed_items / cl.total_items * 100) : 0;
            return (
              <div key={cl.id}
                onClick={() => setSelectedId(selectedId === cl.id ? null : cl.id)}
                className={`bg-white rounded-xl border shadow-sm p-4 cursor-pointer transition-all ${selectedId===cl.id ? "border-indigo-300 bg-indigo-50/30" : "border-gray-100 hover:border-gray-200"}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-sm">{cl.title}</h3>
                    <p className="text-xs text-gray-400">{cl.department ?? "—"} · {cl.checklist_type ?? "—"}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[cl.status]??""}`}>{cl.status}</span>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">{cl.completed_items ?? 0}/{cl.total_items ?? 0} éléments</span>
                    <span className="text-xs font-bold text-gray-700">{pct}%</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${pct>=100?"bg-emerald-500":pct>50?"bg-amber-500":"bg-indigo-400"}`} style={{ width:`${pct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {selectedId && detail && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700 text-sm">{detail.title}</h3>
              <span className="text-xs text-gray-500">{completedCount}/{totalCount}</span>
            </div>
            <div className="space-y-2 overflow-y-auto max-h-80">
              {detail.items?.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <div className="flex gap-2">
                    <button onClick={() => handleItemCheck(selectedId, item.id, true)}
                      className={`w-7 h-7 rounded-full border-2 text-xs font-bold transition-all ${item.is_ok===true ? "border-emerald-500 bg-emerald-500 text-white" : "border-gray-300 text-gray-300 hover:border-emerald-400"}`}>
                      ✓
                    </button>
                    <button onClick={() => handleItemCheck(selectedId, item.id, false)}
                      className={`w-7 h-7 rounded-full border-2 text-xs font-bold transition-all ${item.is_ok===false ? "border-red-500 bg-red-500 text-white" : "border-gray-300 text-gray-300 hover:border-red-400"}`}>
                      ✗
                    </button>
                  </div>
                  <span className={`text-sm flex-1 ${item.is_ok===null ? "text-gray-600" : item.is_ok ? "text-emerald-700" : "text-red-700"}`}>
                    {item.question}
                  </span>
                  {item.is_critical && <span className="text-xs text-red-500 font-semibold">Critique</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Nouvelle checklist</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div><label className="text-xs font-medium text-gray-600">Titre *</label>
                <input required className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.title ?? ""} onChange={f("title")} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Type</label>
                  <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.checklist_type ?? "audit"} onChange={e => setForm(p=>({...p,checklist_type:e.target.value}))}>
                    {["audit","inspection","reception","maintenance","securite"].map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className="text-xs font-medium text-gray-600">Service</label>
                  <input className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.department ?? ""} onChange={f("department")} /></div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Éléments à vérifier</label>
                <div className="flex gap-2 mt-1">
                  <input className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Question ou point à vérifier…"
                    value={itemInput} onChange={e => setItemInput(e.target.value)}
                    onKeyDown={e => e.key==="Enter" && (e.preventDefault(), addItem())} />
                  <button type="button" onClick={addItem} className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">+</button>
                </div>
                {form.items?.map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-gray-400 w-5">{i+1}.</span>
                    <span className="text-sm flex-1">{item.question}</span>
                    <button type="button" className="text-red-400 text-xs"
                      onClick={() => setForm(p=>({...p,items:p.items.filter((_: any,j: number)=>j!==i)}))}>✕</button>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
