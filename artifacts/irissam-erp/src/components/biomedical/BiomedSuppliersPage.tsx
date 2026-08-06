import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { getBiomedSuppliers, createBiomedSupplier } from "@/services/api/biomedical";

export default function BiomedSuppliersPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Record<string,string>>({});
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    getBiomedSuppliers().then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [tick]);

  const refetch = () => setTick(t => t + 1);
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await createBiomedSupplier(form); setShowCreate(false); setForm({}); refetch(); }
    catch(err: any) { toast({ variant: "destructive", title: "Erreur", description: err?.data?.error ?? err?.message ?? "Opération impossible" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Nouveau fournisseur
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading && <div className="col-span-3 text-center py-10 text-gray-400">Chargement…</div>}
        {!loading && !data?.data?.length && <div className="col-span-3 text-center py-10 text-gray-400">Aucun fournisseur</div>}
        {data?.data?.map((s: any) => (
          <div key={s.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-gray-900">{s.name}</p>
                <p className="text-xs font-mono text-gray-500">{s.code}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                {s.is_active ? "Actif" : "Inactif"}
              </span>
            </div>
            <div className="text-xs text-gray-500 space-y-0.5">
              {s.contact_name && <p>👤 {s.contact_name}</p>}
              {s.phone && <p>📞 {s.phone}</p>}
              {s.email && <p>✉ {s.email}</p>}
              {s.city && <p>📍 {s.city}</p>}
              {s.payment_terms_days && <p>💳 Paiement: {s.payment_terms_days}j</p>}
            </div>
          </div>
        ))}
      </div>
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Nouveau fournisseur biomédical</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Code *</label>
                  <input required className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.code ?? ""} onChange={f("code")} /></div>
                <div><label className="text-xs font-medium text-gray-600">Nom *</label>
                  <input required className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.name ?? ""} onChange={f("name")} /></div>
                <div><label className="text-xs font-medium text-gray-600">Contact</label>
                  <input className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.contact_name ?? ""} onChange={f("contact_name")} /></div>
                <div><label className="text-xs font-medium text-gray-600">Téléphone</label>
                  <input className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.phone ?? ""} onChange={f("phone")} /></div>
                <div><label className="text-xs font-medium text-gray-600">Email</label>
                  <input type="email" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.email ?? ""} onChange={f("email")} /></div>
                <div><label className="text-xs font-medium text-gray-600">Ville</label>
                  <input className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.city ?? ""} onChange={f("city")} /></div>
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
