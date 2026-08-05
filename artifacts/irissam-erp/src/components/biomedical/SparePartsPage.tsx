import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { getSpareParts, createSparePart, sparePartMovement } from "@/services/api/biomedical";

export default function SparePartsPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [movementTarget, setMovementTarget] = useState<any>(null);
  const [form, setForm] = useState<Record<string,string>>({});
  const [mvtForm, setMvtForm] = useState<Record<string,string>>({ movement_type: "entree", quantity: "" });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    getSpareParts({ page, q, low_stock: lowStock ? "1" : "", limit: 20 })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, q, lowStock, tick]);

  const refetch = () => setTick(t => t + 1);
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));
  const mf = (k: string) => (e: any) => setMvtForm(p => ({ ...p, [k]: e.target.value }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await createSparePart(form); setShowCreate(false); setForm({}); refetch(); }
    catch { toast({ variant: "destructive", title: "Erreur", description: "Impossible de créer la pièce" }); }
  };

  const handleMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sparePartMovement(movementTarget.id, mvtForm);
      setMovementTarget(null); setMvtForm({ movement_type: "entree", quantity: "" }); refetch();
    } catch(err: any) { toast({ variant: "destructive", title: "Erreur", description: err?.response?.data?.error ?? "Mouvement impossible" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <input type="search" placeholder="Rechercher pièce, code, référence…"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
        <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer">
          <input type="checkbox" checked={lowStock} onChange={e => setLowStock(e.target.checked)} />
          Stock faible
        </label>
        <button onClick={() => setShowCreate(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Nouvelle pièce
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {["Code","Désignation","Référence","Stock","Min.","Valeur unit.","Stockage","Actions"].map(h =>
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && <tr><td colSpan={8} className="text-center py-10 text-gray-400">Chargement…</td></tr>}
              {!loading && !data?.data?.length && <tr><td colSpan={8} className="text-center py-10 text-gray-400">Aucune pièce</td></tr>}
              {data?.data?.map((p: any) => (
                <tr key={p.id} className={`hover:bg-gray-50 ${p.is_low ? "bg-red-50/30" : ""}`}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.code}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 text-sm">{p.name}</p>
                    {p.is_low && <p className="text-xs text-red-600 font-semibold">⚠ Stock faible</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{p.reference ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-bold ${p.is_low ? "text-red-600" : "text-gray-900"}`}>
                      {Number(p.quantity_on_hand).toFixed(0)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{Number(p.min_quantity).toFixed(0)}</td>
                  <td className="px-4 py-3 text-xs text-gray-700">{p.unit_cost ? Number(p.unit_cost).toLocaleString("fr-DZ")+" DA" : "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{p.storage_location ?? "—"}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setMovementTarget(p)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Mouvement</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-gray-500">
          <span>Total: {data?.total ?? 0} pièces</span>
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
              <h2 className="text-lg font-semibold">Nouvelle pièce détachée</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Code *</label>
                  <input required className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.code ?? ""} onChange={f("code")} /></div>
                <div><label className="text-xs font-medium text-gray-600">Désignation *</label>
                  <input required className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.name ?? ""} onChange={f("name")} /></div>
                <div><label className="text-xs font-medium text-gray-600">Référence</label>
                  <input className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.reference ?? ""} onChange={f("reference")} /></div>
                <div><label className="text-xs font-medium text-gray-600">Stock initial</label>
                  <input type="number" min="0" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.quantity_on_hand ?? "0"} onChange={f("quantity_on_hand")} /></div>
                <div><label className="text-xs font-medium text-gray-600">Stock minimum</label>
                  <input type="number" min="0" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.min_quantity ?? "0"} onChange={f("min_quantity")} /></div>
                <div><label className="text-xs font-medium text-gray-600">Coût unitaire (DA)</label>
                  <input type="number" min="0" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.unit_cost ?? ""} onChange={f("unit_cost")} /></div>
              </div>
              <div><label className="text-xs font-medium text-gray-600">Emplacement stockage</label>
                <input className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.storage_location ?? ""} onChange={f("storage_location")} /></div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {movementTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Mouvement — {movementTarget.name}</h2>
              <button onClick={() => setMovementTarget(null)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleMovement} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Type</label>
                  <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={mvtForm.movement_type} onChange={mf("movement_type")}>
                    <option value="entree">Entrée</option>
                    <option value="sortie">Sortie</option>
                    <option value="ajustement">Ajustement</option>
                  </select>
                </div>
                <div><label className="text-xs font-medium text-gray-600">Quantité *</label>
                  <input required type="number" min="1" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={mvtForm.quantity} onChange={mf("quantity")} /></div>
              </div>
              <div><label className="text-xs font-medium text-gray-600">Motif</label>
                <input className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={mvtForm.notes ?? ""} onChange={mf("notes")} /></div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setMovementTarget(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Valider</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
