import { createSignal, createResource, For, Show } from "solid-js";
import { getIncidents, createIncident, advanceIncident } from "@/services/api/quality";

const STATUS_BADGE: Record<string,string> = {
  declare:"bg-blue-100 text-blue-700", qualification:"bg-indigo-100 text-indigo-700",
  investigation:"bg-purple-100 text-purple-700", analyse:"bg-amber-100 text-amber-700",
  cause_racine:"bg-orange-100 text-orange-700", correction:"bg-yellow-100 text-yellow-700",
  validation:"bg-emerald-100 text-emerald-700", clos:"bg-gray-100 text-gray-600",
};
const SEV_BADGE: Record<string,string> = {
  mineur:"bg-green-100 text-green-700", modere:"bg-amber-100 text-amber-700",
  grave:"bg-red-100 text-red-700", critique:"bg-purple-100 text-purple-700",
};
const WORKFLOW_LABEL: Record<string,string> = {
  declare:"Qualifier", qualification:"Investiguer", investigation:"Analyser",
  analyse:"Cause racine", cause_racine:"Correction", correction:"Valider",
  validation:"Clore",
};

export default function IncidentsPage() {
  const [page, setPage] = createSignal(1);
  const [q, setQ] = createSignal("");
  const [statusF, setStatusF] = createSignal("");
  const [severityF, setSeverityF] = createSignal("");
  const [showCreate, setShowCreate] = createSignal(false);
  const [form, setForm] = createSignal<Record<string,any>>({ incident_type:"evenement_indesirable", severity:"modere" });

  const [data, { refetch }] = createResource(
    () => ({ page: page(), q: q(), status: statusF(), severity: severityF() }),
    p => getIncidents({ ...p, limit: 20 })
  );

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    try { await createIncident(form()); setShowCreate(false); setForm({ incident_type:"evenement_indesirable", severity:"modere" }); refetch(); }
    catch(err: any) { alert(err?.response?.data?.error ?? "Erreur"); }
  };

  const handleAdvance = async (inc: any) => {
    if (!confirm(`Avancer l'incident "${inc.reference}" vers l'étape suivante ?`)) return;
    try { await advanceIncident(inc.id); refetch(); }
    catch { alert("Erreur avancement"); }
  };

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div class="space-y-4">
      <div class="flex flex-col sm:flex-row gap-2">
        <input type="search" placeholder="Rechercher incident…" class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={q()} onInput={e => { setQ(e.currentTarget.value); setPage(1); }} />
        <select class="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={statusF()} onChange={e => setStatusF(e.currentTarget.value)}>
          <option value="">Tous statuts</option>
          {["declare","qualification","investigation","analyse","cause_racine","correction","validation","clos"].map(s =>
            <option value={s}>{s.replace(/_/g," ")}</option>)}
        </select>
        <select class="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={severityF()} onChange={e => setSeverityF(e.currentTarget.value)}>
          <option value="">Toutes sévérités</option>
          {["mineur","modere","grave","critique"].map(s => <option value={s}>{s}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)} class="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 whitespace-nowrap">
          + Déclarer incident
        </button>
      </div>

      <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b">
              <tr>
                {["Référence","Titre","Type","Sévérité","Statut","Date","Localisation","Action"].map(h =>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <Show when={data.loading}><tr><td colspan="8" class="text-center py-10 text-gray-400">Chargement…</td></tr></Show>
              <Show when={!data.loading && !data()?.data?.length}><tr><td colspan="8" class="text-center py-10 text-gray-400">Aucun incident</td></tr></Show>
              <For each={data()?.data}>
                {(inc: any) => (
                  <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3 font-mono text-xs text-indigo-700 font-semibold">{inc.reference}</td>
                    <td class="px-4 py-3"><p class="font-medium text-gray-900 text-sm max-w-xs truncate">{inc.title}</p>{inc.is_sentinel_event && <span class="text-xs text-red-600 font-bold">🚨 Sentinel</span>}</td>
                    <td class="px-4 py-3 text-xs text-gray-500 capitalize">{inc.incident_type?.replace(/_/g," ")}</td>
                    <td class="px-4 py-3"><span class={`px-2 py-0.5 rounded-full text-xs font-medium ${SEV_BADGE[inc.severity]??""}`}>{inc.severity}</span></td>
                    <td class="px-4 py-3"><span class={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[inc.status]??""}`}>{inc.status?.replace(/_/g," ")}</span></td>
                    <td class="px-4 py-3 text-xs text-gray-500">{new Date(inc.occurrence_date).toLocaleDateString("fr-DZ")}</td>
                    <td class="px-4 py-3 text-xs text-gray-500">{inc.department ?? inc.location ?? "—"}</td>
                    <td class="px-4 py-3">
                      <Show when={inc.status !== "clos"}>
                        <button onClick={() => handleAdvance(inc)}
                          class="text-xs text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap">
                          {WORKFLOW_LABEL[inc.status] ?? "Avancer"} →
                        </button>
                      </Show>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
        <div class="flex items-center justify-between px-4 py-3 border-t text-xs text-gray-500">
          <span>Total: {data()?.total ?? 0}</span>
          <div class="flex gap-2">
            <button disabled={page()===1} onClick={() => setPage(p=>p-1)} class="px-3 py-1 border rounded-lg disabled:opacity-40">Préc.</button>
            <span>{page()}</span>
            <button disabled={(data()?.total??0)<=page()*20} onClick={() => setPage(p=>p+1)} class="px-3 py-1 border rounded-lg disabled:opacity-40">Suiv.</button>
          </div>
        </div>
      </div>

      <Show when={showCreate()}>
        <div class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between p-6 border-b">
              <h2 class="text-lg font-semibold text-red-700">Déclarer un incident</h2>
              <button onClick={() => setShowCreate(false)} class="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} class="p-6 space-y-4">
              <div><label class="text-xs font-medium text-gray-600">Titre *</label>
                <input required class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().title ?? ""} onInput={f("title")} /></div>
              <div class="grid grid-cols-2 gap-3">
                <div><label class="text-xs font-medium text-gray-600">Type</label>
                  <select class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().incident_type ?? "evenement_indesirable"} onChange={e => setForm(p=>({...p,incident_type:e.currentTarget.value}))}>
                    {["evenement_indesirable","presque_accident","dysfonctionnement","plainte","autre"].map(t => <option value={t}>{t.replace(/_/g," ")}</option>)}</select></div>
                <div><label class="text-xs font-medium text-gray-600">Sévérité</label>
                  <select class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().severity ?? "modere"} onChange={e => setForm(p=>({...p,severity:e.currentTarget.value}))}>
                    {["mineur","modere","grave","critique"].map(s => <option value={s}>{s}</option>)}</select></div>
                <div><label class="text-xs font-medium text-gray-600">Date occurrence *</label>
                  <input required type="datetime-local" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().occurrence_date ?? ""} onInput={f("occurrence_date")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Service</label>
                  <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().department ?? ""} onInput={f("department")} /></div>
              </div>
              <div><label class="text-xs font-medium text-gray-600">Description</label>
                <textarea rows="3" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().description ?? ""} onInput={f("description")} /></div>
              <div><label class="text-xs font-medium text-gray-600">Action immédiate</label>
                <textarea rows="2" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().immediate_action ?? ""} onInput={f("immediate_action")} /></div>
              <label class="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form().is_sentinel_event ?? false} onChange={e => setForm(p=>({...p,is_sentinel_event:e.currentTarget.checked}))} />
                Événement sentinelle (alerte haute sévérité)
              </label>
              <div class="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} class="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Déclarer</button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
