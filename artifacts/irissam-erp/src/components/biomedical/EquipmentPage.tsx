import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { getEquipment, createEquipment, updateEquipment,
         getBiomedCategories, getBiomedLocations, getBiomedManufacturers } from "@/services/api/biomedical";

const STATUS_BADGE: Record<string,string> = {
  actif:"bg-emerald-100 text-emerald-700",
  en_maintenance:"bg-amber-100 text-amber-700",
  hors_service:"bg-red-100 text-red-700",
  retire:"bg-gray-100 text-gray-600",
  en_attente_installation:"bg-blue-100 text-blue-700",
  reserve:"bg-purple-100 text-purple-700",
};
const STATUS_LABELS: Record<string,string> = {
  actif:"Actif", en_maintenance:"En maintenance", hors_service:"Hors service",
  retire:"Retraité", en_attente_installation:"En attente", reserve:"Réservé",
};
const CRIT_BADGE: Record<string,string> = {
  critique:"bg-red-100 text-red-700", haute:"bg-orange-100 text-orange-700",
  normale:"bg-blue-100 text-blue-700", faible:"bg-gray-100 text-gray-600",
};

export default function EquipmentPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState<Record<string,string>>({});
  const [tick, setTick] = useState(0);

  const [categories, setCategories] = useState<any>(null);
  const [locations, setLocations] = useState<any>(null);
  const [manufacturers, setManufacturers] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getBiomedCategories().then(setCategories).catch(() => {}); }, []);
  useEffect(() => { getBiomedLocations().then(setLocations).catch(() => {}); }, []);
  useEffect(() => { getBiomedManufacturers().then(setManufacturers).catch(() => {}); }, []);

  useEffect(() => {
    setLoading(true);
    getEquipment({ page, q, status: statusFilter, limit: 20 })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, q, statusFilter, tick]);

  const refetch = () => setTick(t => t + 1);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await createEquipment(form); setShowCreate(false); setForm({}); refetch(); }
    catch { toast({ variant: "destructive", title: "Erreur", description: "Création impossible" }); }
  };

  const handleStatusChange = async (eq: any, newStatus: string) => {
    try { await updateEquipment(eq.id, { status: newStatus }); refetch(); }
    catch { toast({ variant: "destructive", title: "Erreur", description: "Mise à jour impossible" }); }
  };

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="search" placeholder="Rechercher équipement, code, série…"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={q} onChange={e => { setQ(e.target.value); setPage(1); }}
        />
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Nouvel équipement
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Code","Équipement","Catégorie","Localisation","Criticité","Statut","Proch. maint.","Actions"].map(h =>
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && <tr><td colSpan={8} className="text-center py-10 text-gray-400">Chargement…</td></tr>}
              {!loading && !data?.data?.length && <tr><td colSpan={8} className="text-center py-10 text-gray-400">Aucun équipement trouvé</td></tr>}
              {data?.data?.map((eq: any) => {
                const isOverdue = eq.next_maintenance_date && new Date(eq.next_maintenance_date) < new Date();
                const isCalibExpired = eq.calibration_expired;
                return (
                  <tr key={eq.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{eq.internal_code}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{eq.name}</div>
                      <div className="text-xs text-gray-500">{eq.manufacturer_name} — {eq.model_name}</div>
                      {isCalibExpired && <span className="text-xs text-orange-600 font-semibold">⚠ Calibration expirée</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: `${eq.category_color}20`, color: eq.category_color }}>
                        {eq.category_name ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{eq.location_name ?? eq.department ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CRIT_BADGE[eq.criticality]??""}`}>
                        {eq.criticality}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select className={`text-xs font-medium px-2 py-1 rounded-full border-0 ${STATUS_BADGE[eq.status]??""}`}
                        value={eq.status}
                        onChange={e => handleStatusChange(eq, e.target.value)}>
                        {Object.entries(STATUS_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                    <td className={`px-4 py-3 text-xs ${isOverdue ? "text-red-600 font-bold" : "text-gray-500"}`}>
                      {eq.next_maintenance_date ? new Date(eq.next_maintenance_date).toLocaleDateString("fr-DZ") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelected(eq)}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">Détail</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">Total: {data?.total ?? 0} équipements</p>
          <div className="flex gap-2">
            <button disabled={page===1} onClick={() => setPage(p => p-1)}
              className="px-3 py-1 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Préc.</button>
            <span className="px-3 py-1 text-xs text-gray-600">Page {page}</span>
            <button disabled={(data?.total??0) <= page*20} onClick={() => setPage(p => p+1)}
              className="px-3 py-1 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Suiv.</button>
          </div>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Nouvel équipement</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600">Nom *</label>
                  <input required className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="Ex: Moniteur multiparamètre" value={form.name ?? ""} onChange={f("name")} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Numéro de série</label>
                  <input className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.serial_number ?? ""} onChange={f("serial_number")} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Catégorie</label>
                  <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.category_id ?? ""} onChange={e => setForm(p=>({...p,category_id:e.target.value}))}>
                    <option value="">— Choisir —</option>
                    {categories?.data?.map((c:any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Fabricant</label>
                  <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.manufacturer_id ?? ""} onChange={e => setForm(p=>({...p,manufacturer_id:e.target.value}))}>
                    <option value="">— Choisir —</option>
                    {manufacturers?.data?.map((m:any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Localisation</label>
                  <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.location_id ?? ""} onChange={e => setForm(p=>({...p,location_id:e.target.value}))}>
                    <option value="">— Choisir —</option>
                    {locations?.data?.map((l:any) => <option key={l.id} value={l.id}>{l.name} ({l.department})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Criticité</label>
                  <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.criticality ?? "normale"} onChange={e => setForm(p=>({...p,criticality:e.target.value}))}>
                    <option value="faible">Faible</option>
                    <option value="normale">Normale</option>
                    <option value="haute">Haute</option>
                    <option value="critique">Critique</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Date achat</label>
                  <input type="date" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.purchase_date ?? ""} onChange={f("purchase_date")} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Valeur achat (DA)</label>
                  <input type="number" min="0" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.purchase_price ?? ""} onChange={f("purchase_price")} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Intervalle maint. (jours)</label>
                  <input type="number" min="1" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.maintenance_interval_days ?? ""} onChange={f("maintenance_interval_days")} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Intervalle calibration (jours)</label>
                  <input type="number" min="1" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.calibration_interval_days ?? ""} onChange={f("calibration_interval_days")} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Notes</label>
                <textarea rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.notes ?? ""} onChange={f("notes")} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
                <button type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
