import { createSignal, createResource, For, Show } from "solid-js";
import { getCAPAs, createCAPA, advanceCAPA } from "@/services/api/quality";

const STATUS_BADGE: Record<string,string> = {
  ouverte:"bg-blue-100 text-blue-700", en_cours:"bg-amber-100 text-amber-700",
  en_verification:"bg-indigo-100 text-indigo-700", efficace:"bg-emerald-100 text-emerald-700",
  inefficace:"bg-red-100 text-red-700", annulee:"bg-gray-100 text-gray-500",
};
const NEXT_LABEL: Record<string,string> = {
  ouverte:"Démarrer", en_cours:"Mettre en vérification", en_verification:"Valider efficace",
};

export default function CapaPage() {
  const [page, setPage] = createSignal(1);
  const [q, setQ] = createSignal("");
  const [capaType, setCapaType] = createSignal<"corrective"|"preventive">("corrective");
  const [statusF, setStatusF] = createSignal("");
  const [overdue, setOverdue] = createSignal(false);
  const [showCreate, setShowCreate] = createSignal(false);
  const [form, setForm] = createSignal<Record<string,any>>({ capa_type:"corrective" });

  const [data, { refetch }] = createResource(
    () => ({ page: page(), q: q(), status: statusF(), capa_type: capaType(), overdue: overdue() ? "1" : "" }),
    p => getCAPAs({ ...p, limit: 20 })
  );

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    try { await createCAPA(form()); setShowCreate(false); setForm({ capa_type:"corrective" }); refetch(); }
    catch(err: any) { alert(err?.response?.data?.error ?? "Erreur"); }
  };

  const handleAdvance = async (capa: any) => {
    if (!confirm(`Avancer "${capa.reference}" ?`)) return;
    try { await advanceCAPA(capa.id, { capa_type: capa.capa_type }); refetch(); }
    catch { alert("Erreur avancement"); }
  };

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div class="space-y-4">
      {/* Type switcher */}
      <div class="flex bg-gray-100 rounded-xl p-1 gap-1 max-w-sm">
        {(["corrective","preventive"] as const).map(t => (
          <button onClick={() => setCapaType(t)}
            class={`flex-1 py-1.5 text-sm rounded-lg font-medium transition-all ${capaType()===t ? "bg-white shadow-sm text-indigo-700" : "text-gray-500 hover:text-gray-700"}`}>
            {t === "corrective" ? "Corrective (CA)" : "Préventive (PA)"}
          </button>
        ))}
      </div>

      <div class="flex flex-col sm:flex-row gap-2">
        <input type="search" placeholder="Rechercher CAPA…" class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={q()} onInput={e => { setQ(e.currentTarget.value); setPage(1); }} />
        <select class="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={statusF()} onChange={e => setStatusF(e.currentTarget.value)}>
          <option value="">Tous statuts</option>
          {["ouverte","en_cours","en_verification","efficace","inefficace","annulee"].map(s => <option value={s}>{s.replace(/_/g," ")}</option>)}
        </select>
        <label class="flex items-center gap-2 px-3 py-2 border border-red-300 rounded-lg text-sm cursor-pointer">
          <input type="checkbox" checked={overdue()} onChange={e => setOverdue(e.currentTarget.checked)} />
          <span class="text-red-600 text-xs font-medium">En retard</span>
        </label>
        <button onClick={() => setShowCreate(true)} class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 whitespace-nowrap">
          + Nouvelle CAPA
        </button>
      </div>

      <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b">
              <tr>
                {["Référence","Titre","Type","Statut","Responsable","Échéance","Coût est.","Action"].map(h =>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <Show when={data.loading}><tr><td colspan="8" class="text-center py-10 text-gray-400">Chargement…</td></tr></Show>
              <Show when={!data.loading && !data()?.data?.length}><tr><td colspan="8" class="text-center py-10 text-gray-400">Aucune CAPA</td></tr></Show>
              <For each={data()?.data}>
                {(capa: any) => {
                  const isOverdue = capa.due_date && new Date(capa.due_date) < new Date()
                    && !["efficace","inefficace","annulee"].includes(capa.status);
                  return (
                    <tr class={`hover:bg-gray-50 ${isOverdue ? "bg-red-50/30" : ""}`}>
                      <td class="px-4 py-3 font-mono text-xs text-indigo-700 font-semibold">{capa.reference}</td>
                      <td class="px-4 py-3 font-medium text-gray-900 text-sm max-w-xs truncate">{capa.title}</td>
                      <td class="px-4 py-3"><span class={`px-2 py-0.5 rounded-full text-xs font-medium ${capa.capa_type==="corrective" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>{capa.capa_type}</span></td>
                      <td class="px-4 py-3"><span class={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[capa.status]??""}`}>{capa.status?.replace(/_/g," ")}</span></td>
                      <td class="px-4 py-3 text-xs text-gray-600">{capa.responsible_name ?? "—"}</td>
                      <td class={`px-4 py-3 text-xs ${isOverdue ? "text-red-600 font-bold" : "text-gray-500"}`}>{capa.due_date ? new Date(capa.due_date).toLocaleDateString("fr-DZ") : "—"}</td>
                      <td class="px-4 py-3 text-xs text-gray-600">{capa.estimated_cost ? Number(capa.estimated_cost).toLocaleString("fr-DZ")+" DA" : "—"}</td>
                      <td class="px-4 py-3">
                        <Show when={NEXT_LABEL[capa.status]}>
                          <button onClick={() => handleAdvance(capa)} class="text-xs text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap">{NEXT_LABEL[capa.status]} →</button>
                        </Show>
                      </td>
                    </tr>
                  );
                }}
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
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between p-6 border-b">
              <h2 class="text-lg font-semibold">Nouvelle CAPA</h2>
              <button onClick={() => setShowCreate(false)} class="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} class="p-6 space-y-4">
              <div><label class="text-xs font-medium text-gray-600">Titre *</label>
                <input required class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().title ?? ""} onInput={f("title")} /></div>
              <div class="grid grid-cols-2 gap-3">
                <div><label class="text-xs font-medium text-gray-600">Type</label>
                  <select class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().capa_type ?? "corrective"} onChange={e => setForm(p=>({...p,capa_type:e.currentTarget.value}))}>
                    <option value="corrective">Corrective</option>
                    <option value="preventive">Préventive</option>
                  </select></div>
                <div><label class="text-xs font-medium text-gray-600">Échéance *</label>
                  <input required type="date" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().due_date ?? ""} onInput={f("due_date")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Responsable</label>
                  <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().responsible_name ?? ""} onInput={f("responsible_name")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Service</label>
                  <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().department ?? ""} onInput={f("department")} /></div>
                <div class="col-span-2"><label class="text-xs font-medium text-gray-600">Coût estimé (DA)</label>
                  <input type="number" min="0" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().estimated_cost ?? ""} onInput={f("estimated_cost")} /></div>
              </div>
              <div><label class="text-xs font-medium text-gray-600">Description</label>
                <textarea rows="3" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().description ?? ""} onInput={f("description")} /></div>
              <div class="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} class="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Créer</button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
