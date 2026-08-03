import { createSignal, createResource, For, Show } from "solid-js";
import { getMeetings, createMeeting, updateMeeting, addMinutes, getCommittees } from "@/services/api/quality";

const STATUS_BADGE: Record<string,string> = {
  planifiee:"bg-blue-100 text-blue-700", tenue:"bg-emerald-100 text-emerald-700", annulee:"bg-gray-100 text-gray-500",
};

export default function MeetingsPage() {
  const [page, setPage] = createSignal(1);
  const [statusF, setStatusF] = createSignal("");
  const [showCreate, setShowCreate] = createSignal(false);
  const [minutesTarget, setMinutesTarget] = createSignal<any>(null);
  const [form, setForm] = createSignal<Record<string,any>>({});
  const [mForm, setMForm] = createSignal<Record<string,any>>({});
  const [committees] = createResource(getCommittees);

  const [data, { refetch }] = createResource(
    () => ({ page: page(), status: statusF() }),
    p => getMeetings({ ...p, limit: 20 })
  );

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    try { await createMeeting(form()); setShowCreate(false); setForm({}); refetch(); }
    catch(err: any) { alert(err?.response?.data?.error ?? "Erreur"); }
  };

  const handleStatus = async (m: any, status: string) => {
    try { await updateMeeting(m.id, { status }); refetch(); }
    catch { alert("Erreur"); }
  };

  const handleMinutes = async (e: Event) => {
    e.preventDefault();
    try { await addMinutes(minutesTarget().id, mForm()); setMinutesTarget(null); setMForm({}); refetch(); }
    catch { alert("Erreur PV"); }
  };

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));
  const mf = (k: string) => (e: any) => setMForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div class="space-y-4">
      <div class="flex gap-2">
        <select class="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={statusF()} onChange={e => setStatusF(e.currentTarget.value)}>
          <option value="">Tous statuts</option>
          <option value="planifiee">Planifiée</option>
          <option value="tenue">Tenue</option>
          <option value="annulee">Annulée</option>
        </select>
        <button onClick={() => setShowCreate(true)} class="ml-auto bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Planifier réunion
        </button>
      </div>

      <div class="space-y-3">
        <Show when={data.loading}><div class="text-center py-10 text-gray-400">Chargement…</div></Show>
        <Show when={!data.loading && !data()?.data?.length}><div class="text-center py-10 text-gray-400">Aucune réunion</div></Show>
        <For each={data()?.data}>
          {(m: any) => (
            <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div class="flex flex-col sm:flex-row sm:items-center gap-3">
                <div class="flex-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[m.status]??""}`}>{m.status}</span>
                    {m.committee_name && <span class="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{m.committee_name}</span>}
                  </div>
                  <p class="font-semibold text-gray-900 mt-1">{m.title}</p>
                  <div class="text-xs text-gray-500 mt-1 flex gap-4 flex-wrap">
                    <span>📅 {new Date(m.meeting_date).toLocaleDateString("fr-DZ")}</span>
                    {m.location && <span>📍 {m.location}</span>}
                    {m.chaired_by_name && <span>👤 Présidé par: {m.chaired_by_name}</span>}
                  </div>
                </div>
                <div class="flex gap-2 shrink-0">
                  {m.status === "planifiee" && <>
                    <button onClick={() => handleStatus(m, "tenue")}
                      class="text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg font-medium hover:bg-emerald-100">Marquer tenue</button>
                    <button onClick={() => handleStatus(m, "annulee")}
                      class="text-xs bg-gray-100 text-gray-500 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-200">Annuler</button>
                  </>}
                  {m.status === "tenue" && (
                    <button onClick={() => setMinutesTarget(m)}
                      class="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-100">+ PV / Compte-rendu</button>
                  )}
                </div>
              </div>
            </div>
          )}
        </For>
      </div>

      <Show when={showCreate()}>
        <div class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div class="flex items-center justify-between p-6 border-b">
              <h2 class="text-lg font-semibold">Planifier une réunion qualité</h2>
              <button onClick={() => setShowCreate(false)} class="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} class="p-6 space-y-4">
              <div><label class="text-xs font-medium text-gray-600">Titre *</label>
                <input required class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().title ?? ""} onInput={f("title")} /></div>
              <div class="grid grid-cols-2 gap-3">
                <div><label class="text-xs font-medium text-gray-600">Comité</label>
                  <select class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().committee_id ?? ""} onChange={e => setForm(p=>({...p,committee_id:e.currentTarget.value}))}>
                    <option value="">— Aucun —</option>
                    <For each={committees()?.data}>{(c: any) => <option value={c.id}>{c.name}</option>}</For>
                  </select></div>
                <div><label class="text-xs font-medium text-gray-600">Date *</label>
                  <input required type="date" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().meeting_date ?? ""} onInput={f("meeting_date")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Lieu</label>
                  <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().location ?? ""} onInput={f("location")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Président</label>
                  <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().chaired_by_name ?? ""} onInput={f("chaired_by_name")} /></div>
              </div>
              <div><label class="text-xs font-medium text-gray-600">Ordre du jour</label>
                <textarea rows="3" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().agenda ?? ""} onInput={f("agenda")} /></div>
              <div class="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} class="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Planifier</button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      <Show when={minutesTarget()}>
        <div class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div class="flex items-center justify-between p-6 border-b">
              <h2 class="text-lg font-semibold">Compte-rendu — {minutesTarget()?.title}</h2>
              <button onClick={() => setMinutesTarget(null)} class="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleMinutes} class="p-6 space-y-4">
              <div><label class="text-xs font-medium text-gray-600">Section</label>
                <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={mForm().section_title ?? ""} onInput={mf("section_title")} /></div>
              <div><label class="text-xs font-medium text-gray-600">Contenu *</label>
                <textarea required rows="4" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={mForm().content ?? ""} onInput={mf("content")} /></div>
              <div><label class="text-xs font-medium text-gray-600">Décisions</label>
                <textarea rows="2" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={mForm().decisions ?? ""} onInput={mf("decisions")} /></div>
              <div><label class="text-xs font-medium text-gray-600">Points d'action</label>
                <textarea rows="2" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={mForm().action_items ?? ""} onInput={mf("action_items")} /></div>
              <div class="flex justify-end gap-3">
                <button type="button" onClick={() => setMinutesTarget(null)} class="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Enregistrer PV</button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
