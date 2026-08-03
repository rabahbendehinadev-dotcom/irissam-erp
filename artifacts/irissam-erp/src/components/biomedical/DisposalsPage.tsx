import { createSignal, createResource, For, Show } from "solid-js";
import { getDisposals, createDisposal, approveDisposal, finalizeDisposal, getEquipment } from "@/services/api/biomedical";

const STATUS_BADGE: Record<string,string> = {
  propose:"bg-blue-100 text-blue-700", approuve:"bg-amber-100 text-amber-700",
  en_cours:"bg-indigo-100 text-indigo-700", finalise:"bg-emerald-100 text-emerald-700",
  annule:"bg-gray-100 text-gray-500",
};
const METHOD_LABELS: Record<string,string> = {
  vente:"Vente", don:"Don", destruction:"Destruction",
  restitution_fournisseur:"Restitution fournisseur", reprise:"Reprise", autre:"Autre",
};

export default function DisposalsPage() {
  const [page, setPage] = createSignal(1);
  const [statusF, setStatusF] = createSignal("");
  const [showCreate, setShowCreate] = createSignal(false);
  const [form, setForm] = createSignal<Record<string,string>>({ method: "autre" });
  const [equipSearch, setEquipSearch] = createSignal("");
  const [equipList] = createResource(() => equipSearch(), q => getEquipment({ q, limit: 15 }));

  const [data, { refetch }] = createResource(
    () => ({ page: page(), status: statusF() }),
    p => getDisposals({ ...p, limit: 20 })
  );

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    try { await createDisposal(form()); setShowCreate(false); setForm({ method:"autre" }); refetch(); }
    catch { alert("Erreur création réforme"); }
  };

  const handleApprove = async (d: any) => {
    if (!confirm(`Approuver la réforme de "${d.equipment_name}" ?`)) return;
    try { await approveDisposal(d.id); refetch(); }
    catch { alert("Erreur approbation"); }
  };

  const handleFinalize = async (d: any) => {
    const date = prompt("Date de réforme (YYYY-MM-DD):", new Date().toISOString().split("T")[0]);
    if (!date) return;
    try { await finalizeDisposal(d.id, { disposal_date: date }); refetch(); }
    catch { alert("Erreur finalisation"); }
  };

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div class="space-y-4">
      <div class="flex gap-2">
        <select class="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={statusF()} onChange={e => setStatusF(e.currentTarget.value)}>
          <option value="">Tous statuts</option>
          {["propose","approuve","en_cours","finalise","annule"].map(s =>
            <option value={s}>{s.replace(/_/g," ")}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)}
          class="ml-auto bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700">
          + Proposer réforme
        </button>
      </div>

      <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b">
              <tr>
                {["Équipement","Code","Méthode","Statut","Motif","Valeur cession","Date réforme","Actions"].map(h =>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <Show when={data.loading}><tr><td colspan="8" class="text-center py-10 text-gray-400">Chargement…</td></tr></Show>
              <Show when={!data.loading && !data()?.data?.length}><tr><td colspan="8" class="text-center py-10 text-gray-400">Aucune réforme</td></tr></Show>
              <For each={data()?.data}>
                {(d: any) => (
                  <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3 text-xs font-medium text-gray-900">{d.equipment_name}</td>
                    <td class="px-4 py-3 font-mono text-xs text-gray-500">{d.internal_code}</td>
                    <td class="px-4 py-3 text-xs text-gray-600">{METHOD_LABELS[d.method]??d.method}</td>
                    <td class="px-4 py-3"><span class={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[d.status]??""}`}>{d.status}</span></td>
                    <td class="px-4 py-3 text-xs text-gray-500 max-w-40 truncate">{d.reason}</td>
                    <td class="px-4 py-3 text-xs text-gray-700">{d.sale_value ? Number(d.sale_value).toLocaleString("fr-DZ")+" DA" : "—"}</td>
                    <td class="px-4 py-3 text-xs text-gray-500">{d.disposal_date ? new Date(d.disposal_date).toLocaleDateString("fr-DZ") : "—"}</td>
                    <td class="px-4 py-3 flex gap-2">
                      {d.status === "propose" && (
                        <button onClick={() => handleApprove(d)}
                          class="text-xs text-emerald-600 hover:text-emerald-800 font-medium">Approuver</button>
                      )}
                      {["approuve","en_cours"].includes(d.status) && (
                        <button onClick={() => handleFinalize(d)}
                          class="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Finaliser</button>
                      )}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
        <div class="px-4 py-3 border-t text-xs text-gray-500">Total: {data()?.total ?? 0}</div>
      </div>

      <Show when={showCreate()}>
        <div class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between p-6 border-b">
              <h2 class="text-lg font-semibold">Proposer une réforme</h2>
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
                <div><label class="text-xs font-medium text-gray-600">Méthode</label>
                  <select class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().method ?? "autre"} onChange={e => setForm(p=>({...p,method:e.currentTarget.value}))}>
                    <For each={Object.entries(METHOD_LABELS)}>{([v,l]) => <option value={v}>{l}</option>}</For>
                  </select></div>
                <div><label class="text-xs font-medium text-gray-600">Valeur cession (DA)</label>
                  <input type="number" min="0" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().sale_value ?? ""} onInput={f("sale_value")} /></div>
              </div>
              <div><label class="text-xs font-medium text-gray-600">Motif *</label>
                <textarea required rows="3" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().reason ?? ""} onInput={f("reason")} /></div>
              <div class="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} class="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" class="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700">Proposer</button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
