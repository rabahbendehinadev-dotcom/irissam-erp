import { createSignal, createResource, For, Show } from "solid-js";
import { getInspections, createInspection, getEquipment } from "@/services/api/biomedical";

const RESULT_BADGE: Record<string,string> = {
  conforme:"bg-emerald-100 text-emerald-700",
  non_conforme:"bg-red-100 text-red-700",
  a_surveiller:"bg-amber-100 text-amber-700",
};

export default function InspectionsPage() {
  const [page, setPage] = createSignal(1);
  const [resultF, setResultF] = createSignal("");
  const [showCreate, setShowCreate] = createSignal(false);
  const [form, setForm] = createSignal<Record<string,any>>({ result: "conforme" });
  const [equipSearch, setEquipSearch] = createSignal("");
  const [equipList] = createResource(() => equipSearch(), q => getEquipment({ q, limit: 15 }));

  const [data, { refetch }] = createResource(
    () => ({ page: page(), result: resultF() }),
    p => getInspections({ ...p, limit: 20 })
  );

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    try { await createInspection(form()); setShowCreate(false); setForm({ result: "conforme" }); refetch(); }
    catch { alert("Erreur création inspection"); }
  };

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div class="space-y-4">
      <div class="flex gap-2">
        <select class="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={resultF()} onChange={e => setResultF(e.currentTarget.value)}>
          <option value="">Tous résultats</option>
          {["conforme","non_conforme","a_surveiller"].map(r => <option value={r}>{r.replace(/_/g," ")}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)}
          class="ml-auto bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Nouvelle inspection
        </button>
      </div>

      <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b">
              <tr>
                {["Équipement","Type","Date","Résultat","Inspecteur","Prochaine","Constats"].map(h =>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <Show when={data.loading}><tr><td colspan="7" class="text-center py-10 text-gray-400">Chargement…</td></tr></Show>
              <Show when={!data.loading && !data()?.data?.length}><tr><td colspan="7" class="text-center py-10 text-gray-400">Aucune inspection</td></tr></Show>
              <For each={data()?.data}>
                {(insp: any) => (
                  <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3 text-xs"><p class="font-medium text-gray-900">{insp.equipment_name}</p><p class="text-gray-400">{insp.internal_code}</p></td>
                    <td class="px-4 py-3 text-xs text-gray-600 capitalize">{insp.inspection_type}</td>
                    <td class="px-4 py-3 text-xs text-gray-500">{new Date(insp.inspection_date).toLocaleDateString("fr-DZ")}</td>
                    <td class="px-4 py-3"><span class={`px-2 py-0.5 rounded-full text-xs font-medium ${RESULT_BADGE[insp.result]??""}`}>{insp.result.replace(/_/g," ")}</span></td>
                    <td class="px-4 py-3 text-xs text-gray-600">{insp.inspector_name ?? "—"}</td>
                    <td class="px-4 py-3 text-xs text-gray-500">{insp.next_due_date ? new Date(insp.next_due_date).toLocaleDateString("fr-DZ") : "—"}</td>
                    <td class="px-4 py-3 text-xs text-gray-500 max-w-40 truncate">{insp.findings ?? "—"}</td>
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
              <h2 class="text-lg font-semibold">Nouvelle inspection</h2>
              <button onClick={() => setShowCreate(false)} class="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} class="p-6 space-y-4">
              <div>
                <label class="text-xs font-medium text-gray-600">Équipement *</label>
                <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Rechercher…"
                  value={equipSearch()} onInput={e => setEquipSearch(e.currentTarget.value)} />
                <Show when={equipList()?.data?.length}>
                  <div class="mt-1 border rounded-lg max-h-32 overflow-y-auto">
                    <For each={equipList()?.data}>
                      {(eq: any) => (
                        <button type="button" class="w-full text-left px-3 py-2 hover:bg-indigo-50 text-sm border-b last:border-0"
                          onClick={() => { setForm(p=>({...p,equipment_id:eq.id})); setEquipSearch(eq.name); }}>
                          {eq.name} <span class="text-gray-400 text-xs">{eq.internal_code}</span>
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div><label class="text-xs font-medium text-gray-600">Date inspection *</label>
                  <input required type="date" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().inspection_date ?? ""} onInput={f("inspection_date")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Prochaine inspection</label>
                  <input type="date" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().next_due_date ?? ""} onInput={f("next_due_date")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Type</label>
                  <select class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().inspection_type ?? "reglementaire"} onChange={e => setForm(p=>({...p,inspection_type:e.currentTarget.value}))}>
                    {["reglementaire","periodique","inopiné","reception"].map(t => <option value={t}>{t}</option>)}</select></div>
                <div><label class="text-xs font-medium text-gray-600">Résultat</label>
                  <select class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().result ?? "conforme"} onChange={e => setForm(p=>({...p,result:e.currentTarget.value}))}>
                    <option value="conforme">Conforme</option>
                    <option value="non_conforme">Non conforme</option>
                    <option value="a_surveiller">À surveiller</option>
                  </select></div>
              </div>
              <div><label class="text-xs font-medium text-gray-600">Constats</label>
                <textarea rows="2" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().findings ?? ""} onInput={f("findings")} /></div>
              <div class="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} class="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
