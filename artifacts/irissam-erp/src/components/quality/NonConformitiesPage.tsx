import { createSignal, createResource, For, Show } from "solid-js";
import { getNCs, createNC, advanceNC } from "@/services/api/quality";

const STATUS_BADGE: Record<string,string> = {
  detectee:"bg-blue-100 text-blue-700", analysee:"bg-amber-100 text-amber-700",
  corrigee:"bg-indigo-100 text-indigo-700", validee:"bg-emerald-100 text-emerald-700",
  archivee:"bg-gray-100 text-gray-500",
};
const NC_NEXT: Record<string,string> = {
  detectee:"Analyser", analysee:"Corriger", corrigee:"Valider", validee:"Archiver",
};

export default function NonConformitiesPage() {
  const [page, setPage] = createSignal(1);
  const [q, setQ] = createSignal("");
  const [statusF, setStatusF] = createSignal("");
  const [showCreate, setShowCreate] = createSignal(false);
  const [form, setForm] = createSignal<Record<string,any>>({ nc_type:"processus", severity:"modere" });

  const [data, { refetch }] = createResource(
    () => ({ page: page(), q: q(), status: statusF() }),
    p => getNCs({ ...p, limit: 20 })
  );

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    try { await createNC(form()); setShowCreate(false); setForm({ nc_type:"processus", severity:"modere" }); refetch(); }
    catch(err: any) { alert(err?.response?.data?.error ?? "Erreur"); }
  };

  const handleAdvance = async (nc: any) => {
    if (!confirm(`Avancer "${nc.reference}" ?`)) return;
    try { await advanceNC(nc.id); refetch(); }
    catch { alert("Erreur avancement"); }
  };

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div class="space-y-4">
      <div class="flex flex-col sm:flex-row gap-2">
        <input type="search" placeholder="Rechercher NC…" class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={q()} onInput={e => { setQ(e.currentTarget.value); setPage(1); }} />
        <select class="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={statusF()} onChange={e => setStatusF(e.currentTarget.value)}>
          <option value="">Tous statuts</option>
          {["detectee","analysee","corrigee","validee","archivee"].map(s => <option value={s}>{s}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)} class="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 whitespace-nowrap">
          + Nouvelle NC
        </button>
      </div>

      <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b">
              <tr>
                {["Référence","Titre","Type","Sévérité","Statut","Détection","Échéance","Action"].map(h =>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <Show when={data.loading}><tr><td colspan="8" class="text-center py-10 text-gray-400">Chargement…</td></tr></Show>
              <Show when={!data.loading && !data()?.data?.length}><tr><td colspan="8" class="text-center py-10 text-gray-400">Aucune non-conformité</td></tr></Show>
              <For each={data()?.data}>
                {(nc: any) => {
                  const isOverdue = nc.due_date && new Date(nc.due_date) < new Date() && nc.status !== "archivee";
                  return (
                    <tr class={`hover:bg-gray-50 ${isOverdue ? "bg-red-50/30" : ""}`}>
                      <td class="px-4 py-3 font-mono text-xs text-orange-700 font-semibold">{nc.reference}</td>
                      <td class="px-4 py-3 font-medium text-gray-900 text-sm max-w-xs truncate">{nc.title}</td>
                      <td class="px-4 py-3 text-xs text-gray-500 capitalize">{nc.nc_type?.replace(/_/g," ")}</td>
                      <td class="px-4 py-3 text-xs capitalize text-gray-600">{nc.severity}</td>
                      <td class="px-4 py-3"><span class={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[nc.status]??""}`}>{nc.status}</span></td>
                      <td class="px-4 py-3 text-xs text-gray-500">{nc.detected_date ? new Date(nc.detected_date).toLocaleDateString("fr-DZ") : "—"}</td>
                      <td class={`px-4 py-3 text-xs ${isOverdue ? "text-red-600 font-bold" : "text-gray-500"}`}>{nc.due_date ? new Date(nc.due_date).toLocaleDateString("fr-DZ") : "—"}</td>
                      <td class="px-4 py-3">
                        <Show when={NC_NEXT[nc.status]}>
                          <button onClick={() => handleAdvance(nc)} class="text-xs text-orange-600 hover:text-orange-800 font-medium">{NC_NEXT[nc.status]} →</button>
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
              <h2 class="text-lg font-semibold">Nouvelle non-conformité</h2>
              <button onClick={() => setShowCreate(false)} class="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} class="p-6 space-y-4">
              <div><label class="text-xs font-medium text-gray-600">Titre *</label>
                <input required class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().title ?? ""} onInput={f("title")} /></div>
              <div class="grid grid-cols-2 gap-3">
                <div><label class="text-xs font-medium text-gray-600">Type</label>
                  <select class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().nc_type ?? "processus"} onChange={e => setForm(p=>({...p,nc_type:e.currentTarget.value}))}>
                    {["processus","produit","service","systeme","documentation","reglementaire","autre"].map(t => <option value={t}>{t}</option>)}</select></div>
                <div><label class="text-xs font-medium text-gray-600">Sévérité</label>
                  <select class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().severity ?? "modere"} onChange={e => setForm(p=>({...p,severity:e.currentTarget.value}))}>
                    {["mineur","modere","grave","critique"].map(s => <option value={s}>{s}</option>)}</select></div>
                <div><label class="text-xs font-medium text-gray-600">Date détection</label>
                  <input type="date" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().detected_date ?? ""} onInput={f("detected_date")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Échéance</label>
                  <input type="date" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().due_date ?? ""} onInput={f("due_date")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Service</label>
                  <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().department ?? ""} onInput={f("department")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Référence norme</label>
                  <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="ex: ISO 9001 §8.7" value={form().standard_clause ?? ""} onInput={f("standard_clause")} /></div>
              </div>
              <div><label class="text-xs font-medium text-gray-600">Description</label>
                <textarea rows="3" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().description ?? ""} onInput={f("description")} /></div>
              <div class="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} class="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" class="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700">Créer</button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
