import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { getRisks, createRisk, getRiskMatrix } from "@/services/api/quality";

const STATUS_BADGE: Record<string,string> = {
  identifie:"bg-blue-100 text-blue-700", analyse:"bg-amber-100 text-amber-700",
  traite:"bg-indigo-100 text-indigo-700", accepte:"bg-emerald-100 text-emerald-700",
  surveille:"bg-purple-100 text-purple-700", clos:"bg-gray-100 text-gray-500",
};

function riskColor(score: number) {
  if (score >= 15) return "bg-red-500 text-white";
  if (score >= 9)  return "bg-orange-400 text-white";
  if (score >= 5)  return "bg-amber-300 text-gray-900";
  return "bg-emerald-200 text-gray-900";
}

export default function RisksPage() {
  const [page, setPage] = useState(1);
  const [statusF, setStatusF] = useState("");
  const [categoryF, setCategoryF] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Record<string,any>>({ probability: 3, impact: 3, category: "operationnel" });
  const [data, setData] = useState<any>(null);
  const [matrix, setMatrix] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    getRisks({ page, status: statusF, category: categoryF, limit: 20 })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, statusF, categoryF, tick]);

  useEffect(() => { getRiskMatrix().then(setMatrix).catch(() => {}); }, [tick]);

  const refetch = () => setTick(t => t + 1);
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const score = Number(form.probability ?? 3) * Number(form.impact ?? 3);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await createRisk(form); setShowCreate(false); setForm({ probability:3, impact:3, category:"operationnel" }); refetch(); }
    catch { toast({ variant: "destructive", title: "Erreur", description: "Impossible de créer le risque" }); }
  };

  const heatCells = Array.from({ length: 5 }, (_, pi) => {
    const prob = 5 - pi;
    return Array.from({ length: 5 }, (_, ii) => {
      const impact = ii + 1;
      const cell = matrix?.find((r: any) => Number(r.probability) === prob && Number(r.impact) === impact);
      return { prob, impact, count: cell?.count ?? 0, score: prob * impact };
    });
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={statusF} onChange={e => setStatusF(e.target.value)}>
          <option value="">Tous statuts</option>
          {["identifie","analyse","traite","accepte","surveille","clos"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={categoryF} onChange={e => setCategoryF(e.target.value)}>
          <option value="">Toutes catégories</option>
          {["clinique","operationnel","financier","reglementaire","securite","autre"].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)} className="ml-auto bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-rose-700">+ Nouveau risque</button>
      </div>

      {matrix && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Matrice des risques (nombre de risques par case)</h3>
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr>
                  <th className="p-2 text-gray-400 font-normal text-center">Prob ↓ / Impact →</th>
                  {["Mineur(1)","Modéré(2)","Majeur(3)","Critique(4)","Catastrophique(5)"].map(h =>
                    <th key={h} className="p-2 text-center text-gray-500 font-medium w-20">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {heatCells.map((row, ri) => (
                  <tr key={ri}>
                    <td className="p-2 text-center font-medium text-gray-500">{5-ri}</td>
                    {row.map(cell => (
                      <td key={cell.impact} className={`p-2 text-center font-bold rounded m-0.5 ${riskColor(cell.score)}`}>
                        {cell.count || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex gap-4 mt-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-4 h-3 bg-emerald-200 rounded inline-block"/> Faible (&lt;5)</span>
              <span className="flex items-center gap-1"><span className="w-4 h-3 bg-amber-300 rounded inline-block"/> Modéré (5-8)</span>
              <span className="flex items-center gap-1"><span className="w-4 h-3 bg-orange-400 rounded inline-block"/> Élevé (9-14)</span>
              <span className="flex items-center gap-1"><span className="w-4 h-3 bg-red-500 rounded inline-block"/> Critique (≥15)</span>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{["Titre","Catégorie","P","I","Score","Statut","Responsable","Révision"].map(h =>
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && <tr><td colSpan={8} className="text-center py-10 text-gray-400">Chargement…</td></tr>}
              {!loading && !data?.data?.length && <tr><td colSpan={8} className="text-center py-10 text-gray-400">Aucun risque</td></tr>}
              {data?.data?.map((r: any) => {
                const s = Number(r.probability) * Number(r.impact);
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs font-medium text-gray-900 max-w-48">{r.title}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 capitalize">{r.category}</td>
                    <td className="px-4 py-3 text-xs text-center font-bold text-gray-700">{r.probability}</td>
                    <td className="px-4 py-3 text-xs text-center font-bold text-gray-700">{r.impact}</td>
                    <td className="px-4 py-3 text-xs text-center">
                      <span className={`px-2 py-0.5 rounded font-bold text-xs ${riskColor(s)}`}>{s}</span>
                    </td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status]??""}`}>{r.status}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-500">{r.responsible_name ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{r.next_review_date ? new Date(r.next_review_date).toLocaleDateString("fr-DZ") : "—"}</td>
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
              <h2 className="text-lg font-semibold">Nouveau risque</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div><label className="text-xs font-medium text-gray-600">Titre *</label>
                <input required className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.title ?? ""} onChange={f("title")} /></div>
              <div><label className="text-xs font-medium text-gray-600">Description *</label>
                <textarea required rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.description ?? ""} onChange={f("description")} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Catégorie</label>
                  <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.category ?? "operationnel"} onChange={e => setForm(p=>({...p,category:e.target.value}))}>
                    {["clinique","operationnel","financier","reglementaire","securite","autre"].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div><label className="text-xs font-medium text-gray-600">Probabilité (1-5)</label>
                  <input type="range" min={1} max={5} className="mt-3 w-full" value={form.probability ?? 3} onChange={f("probability")} />
                  <p className="text-center text-sm font-bold text-gray-700">{form.probability ?? 3}</p></div>
                <div><label className="text-xs font-medium text-gray-600">Impact (1-5)</label>
                  <input type="range" min={1} max={5} className="mt-3 w-full" value={form.impact ?? 3} onChange={f("impact")} />
                  <p className="text-center text-sm font-bold text-gray-700">{form.impact ?? 3}</p></div>
              </div>
              <div className={`text-center p-3 rounded-lg text-sm font-bold ${riskColor(score)}`}>
                Score de risque: {score}/25
              </div>
              <div><label className="text-xs font-medium text-gray-600">Mesures de mitigation</label>
                <textarea rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.mitigation_measures ?? ""} onChange={f("mitigation_measures")} /></div>
              <div><label className="text-xs font-medium text-gray-600">Date prochaine révision</label>
                <input type="date" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.next_review_date ?? ""} onChange={f("next_review_date")} /></div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" className="px-4 py-2 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
