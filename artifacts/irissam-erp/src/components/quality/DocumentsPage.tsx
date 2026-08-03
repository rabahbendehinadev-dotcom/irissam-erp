import { useState, useEffect } from "react";
import { getQualityDocuments, createQualityDocument, publishQualityDocument, archiveQualityDocument } from "@/services/api/quality";

const STATUS_BADGE: Record<string,string> = {
  brouillon:"bg-gray-100 text-gray-600", en_revue:"bg-amber-100 text-amber-700",
  approuve:"bg-indigo-100 text-indigo-700", publie:"bg-emerald-100 text-emerald-700",
  archive:"bg-red-100 text-red-600", obsolete:"bg-gray-100 text-gray-400",
};
const TYPE_LABELS: Record<string,string> = {
  procedure:"Procédure", instruction:"Instruction", formulaire:"Formulaire",
  politique:"Politique", plan:"Plan", rapport:"Rapport", autre:"Autre",
};

export default function DocumentsPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("");
  const [typeF, setTypeF] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Record<string,any>>({ type: "procedure" });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    getQualityDocuments({ page, q, status: statusF, type: typeF, limit: 20 })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, q, statusF, typeF, tick]);

  const refetch = () => setTick(t => t + 1);
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await createQualityDocument(form); setShowCreate(false); setForm({ type:"procedure" }); refetch(); }
    catch { alert("Erreur création document"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input type="search" placeholder="Titre, référence…" className="flex-1 min-w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={statusF} onChange={e => setStatusF(e.target.value)}>
          <option value="">Tous statuts</option>
          {["brouillon","en_revue","approuve","publie","archive","obsolete"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={typeF} onChange={e => setTypeF(e.target.value)}>
          <option value="">Tous types</option>
          {Object.entries(TYPE_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">+ Nouveau doc.</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading && <div className="col-span-3 text-center py-10 text-gray-400">Chargement…</div>}
        {!loading && !data?.data?.length && <div className="col-span-3 text-center py-10 text-gray-400">Aucun document</div>}
        {data?.data?.map((doc: any) => (
          <div key={doc.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="font-semibold text-gray-900 text-sm">{doc.title}</p>
                <p className="text-xs font-mono text-gray-400">{doc.document_number} — v{doc.version ?? "1.0"}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[doc.status]??""}`}>{doc.status}</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">{TYPE_LABELS[doc.type]??doc.type}</span>
              {doc.department && <span className="text-xs text-gray-400">🏥 {doc.department}</span>}
            </div>
            {doc.revision_date && (
              <p className="text-xs text-gray-400">Révision: {new Date(doc.revision_date).toLocaleDateString("fr-DZ")}</p>
            )}
            <div className="flex gap-2">
              {doc.status === "approuve" && (
                <button onClick={async () => { try { await publishQualityDocument(doc.id); refetch(); } catch { alert("Erreur"); } }}
                  className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg font-medium hover:bg-emerald-100">Publier</button>
              )}
              {["publie","approuve"].includes(doc.status) && (
                <button onClick={async () => { if (!confirm("Archiver ce document ?")) return; try { await archiveQualityDocument(doc.id); refetch(); } catch { alert("Erreur"); } }}
                  className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-lg font-medium hover:bg-gray-200">Archiver</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Nouveau document qualité</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600">N° document *</label>
                  <input required className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.document_number ?? ""} onChange={f("document_number")} /></div>
                <div><label className="text-xs font-medium text-gray-600">Type</label>
                  <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.type ?? "procedure"} onChange={e => setForm(p=>({...p,type:e.target.value}))}>
                    {Object.entries(TYPE_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              </div>
              <div><label className="text-xs font-medium text-gray-600">Titre *</label>
                <input required className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.title ?? ""} onChange={f("title")} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Service</label>
                  <input className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.department ?? ""} onChange={f("department")} /></div>
                <div><label className="text-xs font-medium text-gray-600">Date révision</label>
                  <input type="date" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.revision_date ?? ""} onChange={f("revision_date")} /></div>
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
