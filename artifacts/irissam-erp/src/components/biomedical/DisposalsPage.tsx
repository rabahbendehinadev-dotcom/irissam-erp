import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { getDisposals, createDisposal, approveDisposal, finalizeDisposal, getEquipment } from "@/services/api/biomedical";

const STATUS_BADGE: Record<string,string> = {
  propose:"bg-blue-100 text-blue-700", approuve:"bg-amber-100 text-amber-700",
  en_cours:"bg-indigo-100 text-indigo-700", finalise:"bg-emerald-100 text-emerald-700",
  annule:"bg-gray-100 text-gray-500",
};
const METHOD_LABELS: Record<string,string> = {
  vente:"Vente", don:"Don", destruction:"Destruction",
  restitution_fournisseur:"Restitution fournisseur", reprise:"Reprise", autre:"Autre",
};

export default function DisposalsPage() {
  const [page, setPage] = useState(1);
  const [statusF, setStatusF] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Record<string,string>>({ method: "autre" });
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
    getDisposals({ page, status: statusF, limit: 20 })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, statusF, tick]);

  const refetch = () => setTick(t => t + 1);
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await createDisposal(form); setShowCreate(false); setForm({ method:"autre" }); refetch(); }
    catch { toast({ variant: "destructive", title: "Erreur", description: "Impossible de créer la réforme" }); }
  };

  const handleApprove = async (d: any) => {
    if (!confirm(`Approuver la réforme de "${d.equipment_name}" ?`)) return;
    try { await approveDisposal(d.id); refetch(); }
    catch { toast({ variant: "destructive", title: "Erreur", description: "Approbation impossible" }); }
  };

  const handleFinalize = async (d: any) => {
    const date = prompt("Date de réforme (YYYY-MM-DD):", new Date().toISOString().split("T")[0]);
    if (!date) return;
    try { await finalizeDisposal(d.id, { disposal_date: date }); refetch(); }
    catch { toast({ variant: "destructive", title: "Erreur", description: "Finalisation impossible" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={statusF} onChange={e => setStatusF(e.target.value)}>
          <option value="">Tous statuts</option>
          {["propose","approuve","en_cours","finalise","annule"].map(s =>
            <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)}
          className="ml-auto bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700">
          + Proposer réforme
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {["Équipement","Code","Méthode","Statut","Motif","Valeur cession","Date réforme","Actions"].map(h =>
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && <tr><td colSpan={8} className="text-center py-10 text-gray-400">Chargement…</td></tr>}
              {!loading && !data?.data?.length && <tr><td colSpan={8} className="text-center py-10 text-gray-400">Aucune réforme</td></tr>}
              {data?.data?.map((d: any) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs font-medium text-gray-900">{d.equipment_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{d.internal_code}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{METHOD_LABELS[d.method]??d.method}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[d.status]??""}`}>{d.status}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-40 truncate">{d.reason}</td>
                  <td className="px-4 py-3 text-xs text-gray-700">{d.sale_value ? Number(d.sale_value).toLocaleString("fr-DZ")+" DA" : "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{d.disposal_date ? new Date(d.disposal_date).toLocaleDateString("fr-DZ") : "—"}</td>
                  <td className="px-4 py-3 flex gap-2">
                    {d.status === "propose" && (
                      <button onClick={() => handleApprove(d)}
                        className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">Approuver</button>
                    )}
                    {["approuve","en_cours"].includes(d.status) && (
                      <button onClick={() => handleFinalize(d)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Finaliser</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t text-xs text-gray-500">Total: {data?.total ?? 0}</div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Proposer une réforme</h2>
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
                <div><label className="text-xs font-medium text-gray-600">Méthode</label>
                  <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.method ?? "autre"} onChange={e => setForm(p=>({...p,method:e.target.value}))}>
                    {Object.entries(METHOD_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select></div>
                <div><label className="text-xs font-medium text-gray-600">Valeur cession (DA)</label>
                  <input type="number" min="0" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.sale_value ?? ""} onChange={f("sale_value")} /></div>
              </div>
              <div><label className="text-xs font-medium text-gray-600">Motif *</label>
                <textarea required rows={3} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.reason ?? ""} onChange={f("reason")} /></div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700">Proposer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
