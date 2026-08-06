import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { getContracts, createContract, updateContract, getBiomedSuppliers } from "@/services/api/biomedical";

const STATUS_BADGE: Record<string,string> = {
  actif:"bg-emerald-100 text-emerald-700", expire:"bg-red-100 text-red-700",
  resilie:"bg-gray-100 text-gray-600", en_renouvellement:"bg-amber-100 text-amber-700",
  brouillon:"bg-blue-100 text-blue-700",
};

export default function ContractsPage() {
  const [page, setPage] = useState(1);
  const [statusF, setStatusF] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Record<string,string>>({});
  const [suppliers, setSuppliers] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => { getBiomedSuppliers().then(setSuppliers).catch(() => {}); }, []);
  useEffect(() => {
    setLoading(true);
    getContracts({ page, status: statusF, limit: 20 })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, statusF, tick]);

  const refetch = () => setTick(t => t + 1);
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await createContract(form); setShowCreate(false); setForm({}); refetch(); }
    catch(err: any) { toast({ variant: "destructive", title: "Erreur", description: err?.data?.error ?? err?.message ?? "Création de contrat impossible" }); }
  };

  const handleStatusChange = async (c: any, status: string) => {
    try { await updateContract(c.id, { status }); refetch(); }
    catch { toast({ variant: "destructive", title: "Erreur", description: "Mise à jour impossible" }); }
  };

  const daysUntil = (dateStr: string) => Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={statusF} onChange={e => setStatusF(e.target.value)}>
          <option value="">Tous statuts</option>
          {["brouillon","actif","expire","resilie","en_renouvellement"].map(s =>
            <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)}
          className="ml-auto bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Nouveau contrat
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading && <div className="col-span-3 text-center py-10 text-gray-400">Chargement…</div>}
        {!loading && !data?.data?.length && <div className="col-span-3 text-center py-10 text-gray-400">Aucun contrat</div>}
        {data?.data?.map((c: any) => {
          const days = c.end_date ? daysUntil(c.end_date) : null;
          const isExpiringSoon = days !== null && days <= (c.renewal_reminder_days ?? 30) && days > 0;
          const isExpired = days !== null && days <= 0;
          return (
            <div key={c.id} className={`bg-white rounded-xl border shadow-sm p-4 space-y-3 ${isExpired ? "border-red-200" : isExpiringSoon ? "border-amber-200" : "border-gray-100"}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{c.title}</p>
                  <p className="text-xs text-gray-500 font-mono">{c.contract_number}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[c.status]??""}`}>{c.status.replace(/_/g," ")}</span>
              </div>
              <div className="text-xs text-gray-600 space-y-1">
                <p>🏢 {c.supplier_name}</p>
                <p>📋 {c.contract_type}</p>
                {c.value && <p>💰 {Number(c.value).toLocaleString("fr-DZ")} {c.currency}</p>}
                <p className={isExpired ? "text-red-600 font-bold" : isExpiringSoon ? "text-amber-600 font-semibold" : ""}>
                  {isExpired ? `⛔ Expiré (${Math.abs(days!)} jours)` :
                   isExpiringSoon ? `⚠ Expire dans ${days} jours` :
                   `📅 Jusqu'au ${new Date(c.end_date).toLocaleDateString("fr-DZ")}`}
                </p>
                {c.sla_response_hours && <p>⚡ SLA réponse: {c.sla_response_hours}h</p>}
              </div>
              <div className="flex gap-2">
                {c.status === "brouillon" && (
                  <button onClick={() => handleStatusChange(c, "actif")}
                    className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg font-medium hover:bg-emerald-100">Activer</button>
                )}
                {c.status === "actif" && isExpiringSoon && (
                  <button onClick={() => handleStatusChange(c, "en_renouvellement")}
                    className="text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-lg font-medium hover:bg-amber-100">Renouveler</button>
                )}
                {["actif","en_renouvellement"].includes(c.status) && (
                  <button onClick={() => handleStatusChange(c, "resilie")}
                    className="text-xs bg-red-50 text-red-700 px-3 py-1 rounded-lg font-medium hover:bg-red-100">Résilier</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Nouveau contrat</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600">N° contrat *</label>
                  <input required className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.contract_number ?? ""} onChange={f("contract_number")} /></div>
                <div><label className="text-xs font-medium text-gray-600">Type</label>
                  <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.contract_type ?? "maintenance"} onChange={e => setForm(p=>({...p,contract_type:e.target.value}))}>
                    {["maintenance","garantie","support","location","autre"].map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              </div>
              <div><label className="text-xs font-medium text-gray-600">Titre *</label>
                <input required className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.title ?? ""} onChange={f("title")} /></div>
              <div><label className="text-xs font-medium text-gray-600">Fournisseur *</label>
                <select required className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.supplier_id ?? ""} onChange={e => setForm(p=>({...p,supplier_id:e.target.value}))}>
                  <option value="">— Choisir —</option>
                  {suppliers?.data?.map((s:any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Début *</label>
                  <input required type="date" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.start_date ?? ""} onChange={f("start_date")} /></div>
                <div><label className="text-xs font-medium text-gray-600">Fin *</label>
                  <input required type="date" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.end_date ?? ""} onChange={f("end_date")} /></div>
                <div><label className="text-xs font-medium text-gray-600">Valeur (DA)</label>
                  <input type="number" min="0" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.value ?? ""} onChange={f("value")} /></div>
                <div><label className="text-xs font-medium text-gray-600">SLA réponse (h)</label>
                  <input type="number" min="1" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.sla_response_hours ?? ""} onChange={f("sla_response_hours")} /></div>
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
