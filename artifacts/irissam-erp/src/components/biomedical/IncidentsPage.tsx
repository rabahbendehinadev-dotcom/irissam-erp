import { createSignal, createResource, For, Show } from "solid-js";
import { getIncidents, createIncident, transitionIncident } from "@/services/api/biomedical";

const STATUS_BADGE: Record<string,string> = {
  declare:"bg-blue-100 text-blue-700", en_analyse:"bg-amber-100 text-amber-700",
  en_correction:"bg-orange-100 text-orange-700", valide:"bg-indigo-100 text-indigo-700",
  clos:"bg-emerald-100 text-emerald-700",
};
const SEV_BADGE: Record<string,string> = {
  critique:"bg-red-100 text-red-700", majeur:"bg-orange-100 text-orange-700",
  modere:"bg-amber-100 text-amber-700", mineur:"bg-gray-100 text-gray-600",
};
const TRANSITIONS: Record<string,{action:string;label:string;next:string}> = {
  declare:      { action:"analyse",  label:"Analyser",   next:"en_analyse" },
  en_analyse:   { action:"correct",  label:"Corriger",   next:"en_correction" },
  en_correction:{ action:"validate", label:"Valider",    next:"valide" },
  valide:       { action:"close",    label:"Clôturer",   next:"clos" },
};

export default function IncidentsPage() {
  const [page, setPage] = createSignal(1);
  const [statusF, setStatusF] = createSignal("");
  const [severityF, setSeverityF] = createSignal("");
  const [showCreate, setShowCreate] = createSignal(false);
  const [form, setForm] = createSignal<Record<string,any>>({});

  const [data, { refetch }] = createResource(
    () => ({ page: page(), status: statusF(), severity: severityF() }),
    p => getIncidents({ ...p, limit: 20 })
  );

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    try { await createIncident(form()); setShowCreate(false); setForm({}); refetch(); }
    catch { alert("Erreur création incident"); }
  };

  const handleTransition = async (inc: any) => {
    const tr = TRANSITIONS[inc.status];
    if (!tr) return;
    const notes = prompt(`Notes pour "${tr.label}" :`, ""); if (notes === null) return;
    try { await transitionIncident(inc.id, tr.action, { notes }); refetch(); }
    catch { alert("Transition impossible"); }
  };

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div class="space-y-4">
      <div class="flex flex-col sm:flex-row gap-2">
        <select class="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={statusF()} onChange={e => setStatusF(e.currentTarget.value)}>
          <option value="">Tous statuts</option>
          {["declare","en_analyse","en_correction","valide","clos"].map(s =>
            <option value={s}>{s.replace(/_/g," ")}</option>)}
        </select>
        <select class="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={severityF()} onChange={e => setSeverityF(e.currentTarget.value)}>
          <option value="">Toutes gravités</option>
          {["mineur","modere","majeur","critique"].map(s => <option value={s}>{s}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)}
          class="ml-auto bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700">
          + Déclarer incident
        </button>
      </div>

      <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b">
              <tr>
                {["N°","Titre","Équipement","Gravité","Statut","Date","Impact patient","Actions"].map(h =>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <Show when={data.loading}><tr><td colspan="8" class="text-center py-10 text-gray-400">Chargement…</td></tr></Show>
              <Show when={!data.loading && !data()?.data?.length}><tr><td colspan="8" class="text-center py-10 text-gray-400">Aucun incident</td></tr></Show>
              <For each={data()?.data}>
                {(inc: any) => (
                  <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3 font-mono text-xs">{inc.incident_number}</td>
                    <td class="px-4 py-3 text-xs font-medium text-gray-900 max-w-48">{inc.title}</td>
                    <td class="px-4 py-3 text-xs text-gray-500">{inc.equipment_name ?? "—"}</td>
                    <td class="px-4 py-3"><span class={`px-2 py-0.5 rounded-full text-xs font-medium ${SEV_BADGE[inc.severity]??""}`}>{inc.severity}</span></td>
                    <td class="px-4 py-3"><span class={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[inc.status]??""}`}>{inc.status.replace(/_/g," ")}</span></td>
                    <td class="px-4 py-3 text-xs text-gray-500">{new Date(inc.incident_date).toLocaleDateString("fr-DZ")}</td>
                    <td class="px-4 py-3 text-center">
                      {inc.patient_safety_alert ? <span class="text-red-600 font-bold text-xs">ALERTE</span> :
                       inc.patient_impact ? <span class="text-orange-600 text-xs">Oui</span> :
                       <span class="text-gray-300 text-xs">Non</span>}
                    </td>
                    <td class="px-4 py-3">
                      <Show when={TRANSITIONS[inc.status]}>
                        <button onClick={() => handleTransition(inc)}
                          class="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                          {TRANSITIONS[inc.status].label} →
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
            <button disabled={page()===1} onClick={() => setPage(p=>p-1)} class="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-40">Préc.</button>
            <span>{page()}</span>
            <button disabled={(data()?.total??0)<=page()*20} onClick={() => setPage(p=>p+1)} class="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-40">Suiv.</button>
          </div>
        </div>
      </div>

      <Show when={showCreate()}>
        <div class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between p-6 border-b">
              <h2 class="text-lg font-semibold">Déclarer un incident</h2>
              <button onClick={() => setShowCreate(false)} class="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} class="p-6 space-y-4">
              <div>
                <label class="text-xs font-medium text-gray-600">Titre *</label>
                <input required class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form().title ?? ""} onInput={f("title")} />
              </div>
              <div>
                <label class="text-xs font-medium text-gray-600">Description *</label>
                <textarea required rows="3" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form().description ?? ""} onInput={f("description")} />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="text-xs font-medium text-gray-600">Gravité</label>
                  <select class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form().severity ?? "modere"} onChange={e => setForm(p=>({...p,severity:e.currentTarget.value}))}>
                    {["mineur","modere","majeur","critique"].map(s => <option value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label class="text-xs font-medium text-gray-600">Date incident</label>
                  <input type="datetime-local" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form().incident_date ?? ""} onInput={f("incident_date")} />
                </div>
              </div>
              <div class="flex gap-4">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!form().patient_impact}
                    onChange={e => setForm(p=>({...p,patient_impact:e.currentTarget.checked}))} />
                  <span class="text-sm">Impact patient</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!form().patient_safety_alert}
                    onChange={e => setForm(p=>({...p,patient_safety_alert:e.currentTarget.checked}))} />
                  <span class="text-sm text-red-600">Alerte sécurité patient</span>
                </label>
              </div>
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
