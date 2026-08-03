import { createSignal, createResource, For, Show } from "solid-js";
import { getRisks, createRisk, updateRisk, getRiskHeatmap } from "@/services/api/quality";

const STATUS_BADGE: Record<string,string> = {
  identifie:"bg-blue-100 text-blue-700", evalue:"bg-amber-100 text-amber-700",
  traitement:"bg-indigo-100 text-indigo-700", accepte:"bg-green-100 text-green-700",
  surveille:"bg-purple-100 text-purple-700", clos:"bg-gray-100 text-gray-500",
};
const CAT_BADGE: Record<string,string> = {
  clinique:"bg-red-100 text-red-700", organisationnel:"bg-blue-100 text-blue-700",
  financier:"bg-green-100 text-green-700", legal:"bg-purple-100 text-purple-700",
  securite:"bg-orange-100 text-orange-700", it:"bg-cyan-100 text-cyan-700",
  infrastructure:"bg-gray-100 text-gray-700", autre:"bg-gray-50 text-gray-500",
};

function critBadge(c: number) {
  if (c >= 20) return "bg-red-600 text-white";
  if (c >= 15) return "bg-red-400 text-white";
  if (c >= 10) return "bg-orange-400 text-white";
  if (c >= 5)  return "bg-yellow-300 text-gray-800";
  return "bg-green-200 text-gray-700";
}

function heatColor(c: number) {
  if (c >= 20) return "bg-red-600 text-white";
  if (c >= 15) return "bg-red-400 text-white";
  if (c >= 10) return "bg-orange-400 text-white";
  if (c >= 5)  return "bg-yellow-300 text-gray-800";
  return "bg-green-200 text-gray-700";
}

export default function RisksPage() {
  const [page, setPage] = createSignal(1);
  const [q, setQ] = createSignal("");
  const [statusF, setStatusF] = createSignal("");
  const [showCreate, setShowCreate] = createSignal(false);
  const [showHeatmap, setShowHeatmap] = createSignal(false);
  const [form, setForm] = createSignal<Record<string,any>>({ category:"organisationnel", probability:"3", impact:"3" });

  const [data, { refetch }] = createResource(
    () => ({ page: page(), q: q(), status: statusF() }),
    p => getRisks({ ...p, limit: 25 })
  );
  const [heatmap] = createResource(getRiskHeatmap);

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    try { await createRisk(form()); setShowCreate(false); setForm({ category:"organisationnel", probability:"3", impact:"3" }); refetch(); }
    catch(err: any) { alert(err?.response?.data?.error ?? "Erreur"); }
  };

  const handleStatusChange = async (risk: any, status: string) => {
    try { await updateRisk(risk.id, { status }); refetch(); }
    catch { alert("Erreur"); }
  };

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const heatCells = () => {
    const map: Record<string, any> = {};
    for (const r of (heatmap()?.data ?? [])) {
      map[`${r.probability}-${r.impact}`] = r;
    }
    return map;
  };

  return (
    <div class="space-y-4">
      <div class="flex gap-2 flex-wrap">
        <input type="search" placeholder="Rechercher risque…" class="flex-1 min-w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={q()} onInput={e => { setQ(e.currentTarget.value); setPage(1); }} />
        <select class="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={statusF()} onChange={e => setStatusF(e.currentTarget.value)}>
          <option value="">Tous statuts</option>
          {["identifie","evalue","traitement","accepte","surveille","clos"].map(s => <option value={s}>{s}</option>)}
        </select>
        <button onClick={() => setShowHeatmap(!showHeatmap())}
          class="px-4 py-2 border border-indigo-300 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-50">
          {showHeatmap() ? "Masquer" : "Voir"} Heatmap
        </button>
        <button onClick={() => setShowCreate(true)} class="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 whitespace-nowrap">
          + Nouveau risque
        </button>
      </div>

      <Show when={showHeatmap()}>
        <div class="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 class="text-sm font-semibold text-gray-700 mb-3">Heatmap des risques actifs (probabilité × impact)</h3>
          <div class="overflow-x-auto">
            <table class="border-collapse text-xs">
              <thead>
                <tr>
                  <th class="w-16 h-8 text-gray-400 text-right pr-2 text-xs">P \ I</th>
                  {[1,2,3,4,5].map(i => <th class="w-14 h-8 text-center text-gray-500 font-semibold text-sm">{i}</th>)}
                </tr>
              </thead>
              <tbody>
                {[5,4,3,2,1].map(p => (
                  <tr>
                    <td class="text-right pr-2 text-gray-500 font-semibold">{p}</td>
                    {[1,2,3,4,5].map(i => {
                      const cell = heatCells()[`${p}-${i}`];
                      const crit = p * i;
                      return (
                        <td class={`w-14 h-14 text-center rounded-sm border border-white cursor-default ${heatColor(crit)}`}
                          title={cell?.risk_titles?.join(", ") ?? ""}>
                          {cell ? <span class="font-bold text-base">{cell.risk_count}</span> : <span class="opacity-25">·</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p class="text-xs text-gray-400 mt-2">Survol pour voir les noms des risques</p>
          </div>
        </div>
      </Show>

      <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b">
              <tr>
                {["Réf.","Titre","Catégorie","P","I","Criticité","Statut","Propriétaire","Action"].map(h =>
                  <th class="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <Show when={data.loading}><tr><td colspan="9" class="text-center py-10 text-gray-400">Chargement…</td></tr></Show>
              <Show when={!data.loading && !data()?.data?.length}><tr><td colspan="9" class="text-center py-10 text-gray-400">Aucun risque</td></tr></Show>
              <For each={data()?.data}>
                {(r: any) => (
                  <tr class="hover:bg-gray-50">
                    <td class="px-3 py-3 font-mono text-xs text-purple-700 font-semibold">{r.reference}</td>
                    <td class="px-3 py-3 font-medium text-gray-900 text-sm max-w-52 truncate">{r.title}</td>
                    <td class="px-3 py-3"><span class={`px-2 py-0.5 rounded-full text-xs font-medium ${CAT_BADGE[r.category]??""}`}>{r.category}</span></td>
                    <td class="px-3 py-3 text-xs font-bold text-center text-gray-700">{r.probability}</td>
                    <td class="px-3 py-3 text-xs font-bold text-center text-gray-700">{r.impact}</td>
                    <td class="px-3 py-3 text-center"><span class={`inline-block w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${critBadge(Number(r.criticality))}`}>{r.criticality}</span></td>
                    <td class="px-3 py-3"><span class={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status]??""}`}>{r.status}</span></td>
                    <td class="px-3 py-3 text-xs text-gray-600">{r.owner_name ?? "—"}</td>
                    <td class="px-3 py-3">
                      <Show when={r.status !== "clos" && r.status !== "accepte"}>
                        <button onClick={() => handleStatusChange(r, r.status === "identifie" ? "evalue" : r.status === "evalue" ? "traitement" : "surveille")}
                          class="text-xs text-purple-600 hover:text-purple-800 font-medium">Avancer →</button>
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
            <button disabled={(data()?.total??0)<=page()*25} onClick={() => setPage(p=>p+1)} class="px-3 py-1 border rounded-lg disabled:opacity-40">Suiv.</button>
          </div>
        </div>
      </div>

      <Show when={showCreate()}>
        <div class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between p-6 border-b">
              <h2 class="text-lg font-semibold">Nouveau risque</h2>
              <button onClick={() => setShowCreate(false)} class="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} class="p-6 space-y-4">
              <div><label class="text-xs font-medium text-gray-600">Titre *</label>
                <input required class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().title ?? ""} onInput={f("title")} /></div>
              <div class="grid grid-cols-2 gap-3">
                <div><label class="text-xs font-medium text-gray-600">Catégorie</label>
                  <select class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().category ?? "organisationnel"} onChange={e => setForm(p=>({...p,category:e.currentTarget.value}))}>
                    {["clinique","organisationnel","financier","legal","securite","it","infrastructure","autre"].map(c => <option value={c}>{c}</option>)}</select></div>
                <div><label class="text-xs font-medium text-gray-600">Service</label>
                  <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().department ?? ""} onInput={f("department")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Probabilité (1-5)</label>
                  <input type="range" min="1" max="5" class="mt-2 w-full" value={form().probability ?? "3"} onInput={f("probability")} />
                  <span class="text-xs text-gray-500">Valeur: {form().probability ?? "3"}</span></div>
                <div><label class="text-xs font-medium text-gray-600">Impact (1-5)</label>
                  <input type="range" min="1" max="5" class="mt-2 w-full" value={form().impact ?? "3"} onInput={f("impact")} />
                  <span class="text-xs text-gray-500">Valeur: {form().impact ?? "3"}</span></div>
              </div>
              <div class={`text-center py-2 rounded-lg font-bold text-lg ${critBadge((form().probability??3)*(form().impact??3))}`}>
                Criticité: {(Number(form().probability??3) * Number(form().impact??3))}
              </div>
              <div><label class="text-xs font-medium text-gray-600">Description</label>
                <textarea rows="2" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().description ?? ""} onInput={f("description")} /></div>
              <div><label class="text-xs font-medium text-gray-600">Contrôles existants</label>
                <textarea rows="2" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().controls_existing ?? ""} onInput={f("controls_existing")} /></div>
              <div><label class="text-xs font-medium text-gray-600">Propriétaire du risque</label>
                <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().owner_name ?? ""} onInput={f("owner_name")} /></div>
              <div class="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} class="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" class="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700">Créer</button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
