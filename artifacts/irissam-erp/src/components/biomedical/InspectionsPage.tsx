import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { getInspections, createInspection, getEquipment } from "@/services/api/biomedical";

const RESULT_BADGE: Record<string,string> = {
  conforme:"bg-emerald-100 text-emerald-700",
  non_conforme:"bg-red-100 text-red-700",
  a_surveiller:"bg-amber-100 text-amber-700",
};

export default function InspectionsPage() {
  const [page, setPage] = useState(1);
  const [resultF, setResultF] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Record<string,any>>({ result: "conforme" });
  const [equipSearch, setEquipSearch] = useState("");
  const [equipList, setEquipList] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (equipSearch) getEquipment({ q: equipSearch, limit: 15 }).then(setEquipList).catch(() => {});
    else setEquipList(null);
  }, [equipSearch]);

  useEffect(() => {
    setLoading(true);
    getInspections({ page, result: resultF, limit: 20 })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, resultF, tick]);

  const refetch = () => setTick(t => t + 1);
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await createInspection(form); setShowCreate(false); setForm({ result: "conforme" }); refetch(); }
    catch { toast({ variant: "destructive", title: "Erreur", description: "Impossible de créer l'inspection" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={resultF} onChange={e => setResultF(e.target.value)}>
          <option value="">Tous résultats</option>
          {["conforme","non_conforme","a_surveiller"].map(r => <option key={r} value={r}>{r.replace(/_/g," ")}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)}
          className="ml-auto bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Nouvelle inspection
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {["Équipement","Type","Date","Résultat","Inspecteur","Prochaine","Constats"].map(h =>
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && <tr><td colSpan={7} className="text-center py-10 text-gray-400">Chargement…</td></tr>}
              {!loading && !data?.data?.length && <tr><td colSpan={7} className="text-center py-10 text-gray-400">Aucune inspection</td></tr>}
              {data?.data?.map((insp: any) => (
                <tr key={insp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs"><p className="font-medium text-gray-900">{insp.equipment_name}</p><p className="text-gray-400">{insp.internal_code}</p></td>
                  <td className="px-4 py-3 text-xs text-gray-600 capitalize">{insp.inspection_type}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(insp.inspection_date).toLocaleDateString("fr-DZ")}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RESULT_BADGE[insp.result]??""}`}>{insp.result.replace(/_/g," ")}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-600">{insp.inspector_name ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{insp.next_due_date ? new Date(insp.next_due_date).toLocaleDateString("fr-DZ") : "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-40 truncate">{insp.findings ?? "—"}</td>
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
              <h2 className="text-lg font-semibold">Nouvelle inspection</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600">Équipement *</label>
                <input className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Rechercher…"
                  value={equipSearch} onChange={e => setEquipSearch(e.target.value)} />
                {equipList?.data?.length > 0 && (
                  <div className="mt-1 border rounded-lg max-h-32 overflow-y-auto">
                    {equipList.data.map((eq: any) => (
                      <button key={eq.id} type="button" className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-sm border-b last:border-0"
                        onClick={() => { setForm(p=>({...p,equipment_id:eq.id})); setEquipSearch(eq.name); }}>
                        {eq.name} <span className="text-gray-400 text-xs">{eq.internal_code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Date inspection *</label>
                  <input required type="date" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.inspection_date ?? ""} onChange={f("inspection_date")} /></div>
                <div><label className="text-xs font-medium text-gray-600">Prochaine inspection</label>
                  <input type="date" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.next_due_date ?? ""} onChange={f("next_due_date")} /></div>
                <div><label className="text-xs font-medium text-gray-600">Type</label>
                  <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.inspection_type ?? "reglementaire"} onChange={e => setForm(p=>({...p,inspection_type:e.target.value}))}>
                    {["reglementaire","periodique","inopiné","reception"].map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className="text-xs font-medium text-gray-600">Résultat</label>
                  <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.result ?? "conforme"} onChange={e => setForm(p=>({...p,result:e.target.value}))}>
                    <option value="conforme">Conforme</option>
                    <option value="non_conforme">Non conforme</option>
                    <option value="a_surveiller">À surveiller</option>
                  </select></div>
              </div>
              <div><label className="text-xs font-medium text-gray-600">Constats</label>
                <textarea rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.findings ?? ""} onChange={f("findings")} /></div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
