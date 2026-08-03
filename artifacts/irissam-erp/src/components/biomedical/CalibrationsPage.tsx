import { useState, useEffect } from "react";
import { getCalibrations, createCalibration, recordCalibration, getEquipment } from "@/services/api/biomedical";

const STATUS_BADGE: Record<string,string> = {
  planifiee:"bg-blue-100 text-blue-700", en_cours:"bg-amber-100 text-amber-700",
  conforme:"bg-emerald-100 text-emerald-700", non_conforme:"bg-red-100 text-red-700",
  a_refaire:"bg-orange-100 text-orange-700", annulee:"bg-gray-100 text-gray-500",
};

export default function CalibrationsPage() {
  const [page, setPage] = useState(1);
  const [statusF, setStatusF] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showRecord, setShowRecord] = useState<string|null>(null);
  const [form, setForm] = useState<Record<string,string>>({});
  const [recordForm, setRecordForm] = useState<Record<string,any>>({});
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
    getCalibrations({ page, status: statusF, limit: 20 })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, statusF, tick]);

  const refetch = () => setTick(t => t + 1);
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));
  const rf = (k: string) => (e: any) => setRecordForm(p => ({ ...p, [k]: e.target.value }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await createCalibration(form); setShowCreate(false); setForm({}); refetch(); }
    catch { alert("Erreur création calibration"); }
  };

  const handleRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await recordCalibration(showRecord!, recordForm); setShowRecord(null); setRecordForm({}); refetch(); }
    catch { alert("Erreur enregistrement résultat"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={statusF} onChange={e => setStatusF(e.target.value)}>
          <option value="">Tous statuts</option>
          {["planifiee","en_cours","conforme","non_conforme","a_refaire","annulee"].map(s =>
            <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)}
          className="ml-auto bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Planifier calibration
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {["N° Cal.","Équipement","Statut","Type","Date planifiée","Réalisée","Conforme","Prochaine","Actions"].map(h =>
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && <tr><td colSpan={9} className="text-center py-10 text-gray-400">Chargement…</td></tr>}
              {!loading && !data?.data?.length && <tr><td colSpan={9} className="text-center py-10 text-gray-400">Aucune calibration</td></tr>}
              {data?.data?.map((c: any) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{c.calibration_number}</td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-medium text-gray-900">{c.equipment_name}</div>
                    <div className="text-gray-400">{c.internal_code}</div>
                  </td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[c.status]??""}`}>{c.status}</span></td>
                  <td className="px-4 py-3 text-xs capitalize text-gray-600">{c.calibration_type}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{c.planned_date ? new Date(c.planned_date).toLocaleDateString("fr-DZ") : "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{c.performed_date ? new Date(c.performed_date).toLocaleDateString("fr-DZ") : "—"}</td>
                  <td className="px-4 py-3 text-center">
                    {c.is_compliant === true && <span className="text-emerald-600">✓</span>}
                    {c.is_compliant === false && <span className="text-red-600">✗</span>}
                    {c.is_compliant === null && <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{c.next_due_date ? new Date(c.next_due_date).toLocaleDateString("fr-DZ") : "—"}</td>
                  <td className="px-4 py-3">
                    {["planifiee","en_cours"].includes(c.status) &&
                      <button onClick={() => setShowRecord(c.id)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Enregistrer</button>}
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
            <span className="px-2">{page}</span>
            <button disabled={(data?.total??0)<=page*20} onClick={() => setPage(p=>p+1)} className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-40">Suiv.</button>
          </div>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Planifier une calibration</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600">Équipement *</label>
                <input className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Rechercher…" value={equipSearch} onChange={e => setEquipSearch(e.target.value)} />
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
                <div>
                  <label className="text-xs font-medium text-gray-600">Date planifiée *</label>
                  <input required type="date" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.planned_date ?? ""} onChange={f("planned_date")} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Type</label>
                  <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.calibration_type ?? "interne"} onChange={e => setForm(p=>({...p,calibration_type:e.target.value}))}>
                    <option value="interne">Interne</option>
                    <option value="externe">Externe</option>
                    <option value="constructeur">Constructeur</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Laboratoire externe</label>
                <input className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.external_lab ?? ""} onChange={f("external_lab")} />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Planifier</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRecord && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Enregistrer résultat</h2>
              <button onClick={() => setShowRecord(null)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleRecord} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Date réalisation *</label>
                  <input required type="date" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={recordForm.performed_date ?? ""} onChange={rf("performed_date")} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Prochaine date</label>
                  <input type="date" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={recordForm.next_due_date ?? ""} onChange={rf("next_due_date")} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Résultat</label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="compliant" value="true"
                      checked={recordForm.is_compliant === "true"}
                      onChange={() => setRecordForm(p=>({...p,is_compliant:"true"}))} />
                    <span className="text-sm text-emerald-600 font-medium">Conforme ✓</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="compliant" value="false"
                      checked={recordForm.is_compliant === "false"}
                      onChange={() => setRecordForm(p=>({...p,is_compliant:"false"}))} />
                    <span className="text-sm text-red-600 font-medium">Non conforme ✗</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Notes</label>
                <textarea rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={recordForm.notes ?? ""} onChange={rf("notes")} />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowRecord(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
