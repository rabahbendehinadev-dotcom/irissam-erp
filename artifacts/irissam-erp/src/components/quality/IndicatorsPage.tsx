import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { getIndicators, createIndicator, recordIndicatorValue, getIndicatorHistory } from "@/services/api/quality";

const STATUS_BADGE: Record<string,string> = {
  actif:"bg-emerald-100 text-emerald-700", inactif:"bg-gray-100 text-gray-500",
};

export default function IndicatorsPage() {
  const [page, setPage] = useState(1);
  const [statusF, setStatusF] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string|null>(null);
  const [recordTarget, setRecordTarget] = useState<any>(null);
  const [form, setForm] = useState<Record<string,any>>({ frequency: "mensuel" });
  const [recordForm, setRecordForm] = useState<Record<string,string>>({});
  const [history, setHistory] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    getIndicators({ page, status: statusF, limit: 20 })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, statusF, tick]);

  useEffect(() => {
    if (selectedId) getIndicatorHistory(selectedId).then(setHistory).catch(() => setHistory(null));
    else setHistory(null);
  }, [selectedId]);

  const refetch = () => setTick(t => t + 1);
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));
  const rf = (k: string) => (e: any) => setRecordForm(p => ({ ...p, [k]: e.target.value }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await createIndicator(form); setShowCreate(false); setForm({ frequency:"mensuel" }); refetch(); }
    catch { toast({ variant: "destructive", title: "Erreur", description: "Impossible de créer l'indicateur" }); }
  };

  const handleRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await recordIndicatorValue(recordTarget.id, recordForm);
      setRecordTarget(null); setRecordForm({}); refetch();
      if (selectedId === recordTarget.id) setSelectedId(prev => { setSelectedId(null); setTimeout(()=>setSelectedId(prev),10); return null; });
    } catch { toast({ variant: "destructive", title: "Erreur", description: "Enregistrement impossible" }); }
  };

  const trendsColor = (ind: any) => {
    if (!ind.last_value || !ind.target_value) return "text-gray-500";
    const ratio = Number(ind.last_value) / Number(ind.target_value);
    if (ind.higher_is_better) return ratio >= 1 ? "text-emerald-600" : ratio >= 0.8 ? "text-amber-600" : "text-red-600";
    return ratio <= 1 ? "text-emerald-600" : ratio <= 1.2 ? "text-amber-600" : "text-red-600";
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={statusF} onChange={e => setStatusF(e.target.value)}>
          <option value="">Tous statuts</option>
          <option value="actif">Actif</option>
          <option value="inactif">Inactif</option>
        </select>
        <button onClick={() => setShowCreate(true)} className="ml-auto bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">+ Nouvel indicateur</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          {loading && <div className="text-center py-10 text-gray-400">Chargement…</div>}
          {!loading && !data?.data?.length && <div className="text-center py-10 text-gray-400">Aucun indicateur</div>}
          {data?.data?.map((ind: any) => (
            <div key={ind.id}
              onClick={() => setSelectedId(selectedId === ind.id ? null : ind.id)}
              className={`bg-white rounded-xl border shadow-sm p-4 cursor-pointer transition-all ${selectedId===ind.id ? "border-indigo-300 bg-indigo-50/30" : "border-gray-100 hover:border-gray-200"}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-sm">{ind.name}</p>
                  <p className="text-xs text-gray-400">{ind.department ?? "—"} · {ind.frequency}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[ind.status]??""}`}>{ind.status}</span>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <div>
                  <p className="text-xs text-gray-500">Dernière valeur</p>
                  <p className={`text-lg font-bold ${trendsColor(ind)}`}>{ind.last_value ?? "—"} {ind.unit}</p>
                </div>
                {ind.target_value && (
                  <div>
                    <p className="text-xs text-gray-500">Cible</p>
                    <p className="text-lg font-bold text-gray-700">{ind.target_value} {ind.unit}</p>
                  </div>
                )}
                <button onClick={e => { e.stopPropagation(); setRecordTarget(ind); }}
                  className="ml-auto text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-100">
                  + Valeur
                </button>
              </div>
            </div>
          ))}
        </div>

        {selectedId && history && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Historique</h3>
            <div className="overflow-y-auto max-h-80 space-y-2">
              {history?.data?.length === 0 && <p className="text-xs text-gray-400">Aucune valeur enregistrée</p>}
              {history?.data?.map((v: any, i: number) => (
                <div key={i} className="flex items-center gap-3 border-b border-gray-50 pb-2">
                  <span className="text-xs text-gray-400 w-24">{new Date(v.recorded_at).toLocaleDateString("fr-DZ")}</span>
                  <span className="font-bold text-gray-900 text-sm">{v.value} {v.unit}</span>
                  {v.notes && <span className="text-xs text-gray-500 italic">{v.notes}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Nouvel indicateur qualité</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div><label className="text-xs font-medium text-gray-600">Nom *</label>
                <input required className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.name ?? ""} onChange={f("name")} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Unité</label>
                  <input className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="%, nb, …" value={form.unit ?? ""} onChange={f("unit")} /></div>
                <div><label className="text-xs font-medium text-gray-600">Valeur cible</label>
                  <input type="number" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.target_value ?? ""} onChange={f("target_value")} /></div>
                <div><label className="text-xs font-medium text-gray-600">Fréquence</label>
                  <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.frequency ?? "mensuel"} onChange={e => setForm(p=>({...p,frequency:e.target.value}))}>
                    {["hebdomadaire","mensuel","trimestriel","semestriel","annuel"].map(f2 => <option key={f2} value={f2}>{f2}</option>)}</select></div>
              </div>
              <div><label className="text-xs font-medium text-gray-600">Service</label>
                <input className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.department ?? ""} onChange={f("department")} /></div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="hib" checked={!!form.higher_is_better}
                  onChange={e => setForm(p=>({...p,higher_is_better:e.target.checked}))} />
                <label htmlFor="hib" className="text-sm text-gray-600">Plus élevé = meilleur</label>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {recordTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Enregistrer valeur — {recordTarget.name}</h2>
              <button onClick={() => setRecordTarget(null)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleRecord} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Valeur * ({recordTarget.unit})</label>
                  <input required type="number" step="any" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={recordForm.value ?? ""} onChange={rf("value")} /></div>
                <div><label className="text-xs font-medium text-gray-600">Date</label>
                  <input type="date" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={recordForm.recorded_at ?? ""} onChange={rf("recorded_at")} /></div>
              </div>
              <div><label className="text-xs font-medium text-gray-600">Notes</label>
                <textarea rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={recordForm.notes ?? ""} onChange={rf("notes")} /></div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setRecordTarget(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
