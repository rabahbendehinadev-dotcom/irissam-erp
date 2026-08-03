import { createSignal, createResource, For, Show } from "solid-js";
import { getImprovements, createImprovement, updateImprovement } from "@/services/api/quality";

const STATUS_BADGE: Record<string,string> = {
  propose:"bg-blue-100 text-blue-700", etudie:"bg-amber-100 text-amber-700",
  approuve:"bg-indigo-100 text-indigo-700", en_cours:"bg-purple-100 text-purple-700",
  realise:"bg-emerald-100 text-emerald-700", abandonne:"bg-gray-100 text-gray-400",
};
const PRIORITY_BADGE: Record<string,string> = {
  basse:"bg-gray-100 text-gray-500", normale:"bg-blue-100 text-blue-600",
  haute:"bg-amber-100 text-amber-700", urgente:"bg-red-100 text-red-700",
};
const NEXT_STATUS: Record<string,string> = {
  propose:"etudie", etudie:"approuve", approuve:"en_cours", en_cours:"realise",
};

export default function ImprovementsPage() {
  const [page, setPage] = createSignal(1);
  const [statusF, setStatusF] = createSignal("");
  const [showCreate, setShowCreate] = createSignal(false);
  const [form, setForm] = createSignal<Record<string,any>>({ priority:"normale" });

  const [data, { refetch }] = createResource(
    () => ({ page: page(), status: statusF() }),
    p => getImprovements({ ...p, limit: 20 })
  );

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    try { await createImprovement(form()); setShowCreate(false); setForm({ priority:"normale" }); refetch(); }
    catch(err: any) { alert(err?.response?.data?.error ?? "Erreur"); }
  };

  const handleAdvance = async (imp: any) => {
    const next = NEXT_STATUS[imp.status];
    if (!next) return;
    try { await updateImprovement(imp.id, { status: next }); refetch(); }
    catch { alert("Erreur"); }
  };

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div class="space-y-4">
      <div class="flex gap-2">
        <select class="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={statusF()} onChange={e => setStatusF(e.currentTarget.value)}>
          <option value="">Tous statuts</option>
          {["propose","etudie","approuve","en_cours","realise","abandonne"].map(s =>
            <option value={s}>{s.replace(/_/g," ")}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)} class="ml-auto bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Proposer amélioration
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Show when={data.loading}><div class="col-span-3 text-center py-10 text-gray-400">Chargement…</div></Show>
        <Show when={!data.loading && !data()?.data?.length}><div class="col-span-3 text-center py-10 text-gray-400">Aucune amélioration</div></Show>
        <For each={data()?.data}>
          {(imp: any) => (
            <div class="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-3">
              <div class="flex items-start justify-between gap-2">
                <p class="font-semibold text-gray-900 text-sm flex-1">{imp.title}</p>
                <span class={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${PRIORITY_BADGE[imp.priority]??""}`}>{imp.priority}</span>
              </div>
              <span class={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[imp.status]??""}`}>{imp.status?.replace(/_/g," ")}</span>
              <div class="text-xs text-gray-500 space-y-0.5">
                {imp.source && <p>🔍 Source: {imp.source}</p>}
                {imp.responsible_name && <p>👤 {imp.responsible_name}</p>}
                {imp.department && <p>🏥 {imp.department}</p>}
                {imp.due_date && <p>📅 {new Date(imp.due_date).toLocaleDateString("fr-DZ")}</p>}
              </div>
              {imp.expected_benefit && <p class="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1">💡 {imp.expected_benefit}</p>}
              <Show when={NEXT_STATUS[imp.status]}>
                <button onClick={() => handleAdvance(imp)}
                  class="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                  Avancer vers "{NEXT_STATUS[imp.status]?.replace(/_/g," ")}" →
                </button>
              </Show>
            </div>
          )}
        </For>
      </div>

      <Show when={showCreate()}>
        <div class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div class="flex items-center justify-between p-6 border-b">
              <h2 class="text-lg font-semibold">Proposer une amélioration</h2>
              <button onClick={() => setShowCreate(false)} class="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} class="p-6 space-y-4">
              <div><label class="text-xs font-medium text-gray-600">Titre *</label>
                <input required class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().title ?? ""} onInput={f("title")} /></div>
              <div class="grid grid-cols-2 gap-3">
                <div><label class="text-xs font-medium text-gray-600">Source</label>
                  <select class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().source ?? ""} onChange={e => setForm(p=>({...p,source:e.currentTarget.value}))}>
                    <option value="">—</option>
                    {["indicateur","audit","incident","suggestion","nc"].map(s => <option value={s}>{s}</option>)}</select></div>
                <div><label class="text-xs font-medium text-gray-600">Priorité</label>
                  <select class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().priority ?? "normale"} onChange={e => setForm(p=>({...p,priority:e.currentTarget.value}))}>
                    {["basse","normale","haute","urgente"].map(p => <option value={p}>{p}</option>)}</select></div>
                <div><label class="text-xs font-medium text-gray-600">Responsable</label>
                  <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().responsible_name ?? ""} onInput={f("responsible_name")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Échéance</label>
                  <input type="date" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().due_date ?? ""} onInput={f("due_date")} /></div>
              </div>
              <div><label class="text-xs font-medium text-gray-600">Description</label>
                <textarea rows="2" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().description ?? ""} onInput={f("description")} /></div>
              <div><label class="text-xs font-medium text-gray-600">Bénéfice attendu</label>
                <textarea rows="2" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().expected_benefit ?? ""} onInput={f("expected_benefit")} /></div>
              <div class="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} class="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Proposer</button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
