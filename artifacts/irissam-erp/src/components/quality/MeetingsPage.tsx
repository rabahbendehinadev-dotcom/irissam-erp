import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { getMeetings, createMeeting, closeMeeting, getCommittees, createCommittee } from "@/services/api/quality";

const STATUS_BADGE: Record<string,string> = {
  planifie:"bg-blue-100 text-blue-700", en_cours:"bg-amber-100 text-amber-700",
  tenu:"bg-emerald-100 text-emerald-700", annule:"bg-gray-100 text-gray-500",
  reporte:"bg-orange-100 text-orange-700",
};

export default function MeetingsPage() {
  const [page, setPage] = useState(1);
  const [committeeF, setCommitteeF] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showCommittee, setShowCommittee] = useState(false);
  const [form, setForm] = useState<Record<string,any>>({});
  const [committeeForm, setCommitteeForm] = useState<Record<string,string>>({});
  const [committees, setCommittees] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => { getCommittees().then(setCommittees).catch(() => {}); }, [tick]);
  useEffect(() => {
    setLoading(true);
    getMeetings({ page, committee_id: committeeF, limit: 20 })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, committeeF, tick]);

  const refetch = () => setTick(t => t + 1);
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));
  const cf = (k: string) => (e: any) => setCommitteeForm(p => ({ ...p, [k]: e.target.value }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await createMeeting(form); setShowCreate(false); setForm({}); refetch(); }
    catch { toast({ variant: "destructive", title: "Erreur", description: "Impossible de créer la réunion" }); }
  };

  const handleCreateCommittee = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await createCommittee(committeeForm); setShowCommittee(false); setCommitteeForm({}); refetch(); }
    catch { toast({ variant: "destructive", title: "Erreur", description: "Impossible de créer le comité" }); }
  };

  const handleClose = async (m: any) => {
    const pv = prompt("Résumé du PV :", ""); if (pv === null) return;
    try { await closeMeeting(m.id, { minutes_summary: pv }); refetch(); }
    catch { toast({ variant: "destructive", title: "Erreur", description: "Clôture impossible" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={committeeF} onChange={e => setCommitteeF(e.target.value)}>
          <option value="">Tous comités</option>
          {committees?.data?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={() => setShowCommittee(true)} className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">+ Comité</button>
        <button onClick={() => setShowCreate(true)} className="ml-auto bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">+ Planifier réunion</button>
      </div>

      <div className="space-y-3">
        {loading && <div className="text-center py-10 text-gray-400">Chargement…</div>}
        {!loading && !data?.data?.length && <div className="text-center py-10 text-gray-400">Aucune réunion</div>}
        {data?.data?.map((m: any) => (
          <div key={m.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900 text-sm">{m.title}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[m.status]??""}`}>{m.status}</span>
                </div>
                <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
                  <span>📋 {m.committee_name}</span>
                  <span>📅 {new Date(m.scheduled_date).toLocaleString("fr-DZ",{dateStyle:"medium",timeStyle:"short"})}</span>
                  {m.location && <span>📍 {m.location}</span>}
                  {m.attendee_count > 0 && <span>👥 {m.attendee_count} participants</span>}
                  {m.action_count > 0 && <span className="text-amber-600">⚡ {m.action_count} actions</span>}
                </div>
              </div>
              {m.status === "tenu" && (
                <button onClick={() => handleClose(m)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap">Clôturer →</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Planifier une réunion</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div><label className="text-xs font-medium text-gray-600">Titre *</label>
                <input required className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.title ?? ""} onChange={f("title")} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Comité *</label>
                  <select required className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.committee_id ?? ""} onChange={e => setForm(p=>({...p,committee_id:e.target.value}))}>
                    <option value="">— Choisir —</option>
                    {committees?.data?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div><label className="text-xs font-medium text-gray-600">Date *</label>
                  <input required type="datetime-local" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.scheduled_date ?? ""} onChange={f("scheduled_date")} /></div>
                <div><label className="text-xs font-medium text-gray-600">Lieu</label>
                  <input className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.location ?? ""} onChange={f("location")} /></div>
                <div><label className="text-xs font-medium text-gray-600">Durée (min)</label>
                  <input type="number" min="15" step="15" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.duration_minutes ?? ""} onChange={f("duration_minutes")} /></div>
              </div>
              <div><label className="text-xs font-medium text-gray-600">Ordre du jour</label>
                <textarea rows={3} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.agenda ?? ""} onChange={f("agenda")} /></div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Planifier</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCommittee && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Nouveau comité</h2>
              <button onClick={() => setShowCommittee(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreateCommittee} className="p-6 space-y-4">
              <div><label className="text-xs font-medium text-gray-600">Nom *</label>
                <input required className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={committeeForm.name ?? ""} onChange={cf("name")} /></div>
              <div><label className="text-xs font-medium text-gray-600">Description</label>
                <textarea rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={committeeForm.description ?? ""} onChange={cf("description")} /></div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCommittee(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
