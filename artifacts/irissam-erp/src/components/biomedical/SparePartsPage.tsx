import { createSignal, createResource, For, Show } from "solid-js";
import { getSpareParts, createSparePart, sparePartMovement } from "@/services/api/biomedical";

export default function SparePartsPage() {
  const [page, setPage] = createSignal(1);
  const [q, setQ] = createSignal("");
  const [lowStock, setLowStock] = createSignal(false);
  const [showCreate, setShowCreate] = createSignal(false);
  const [movementTarget, setMovementTarget] = createSignal<any>(null);
  const [form, setForm] = createSignal<Record<string,string>>({});
  const [mvtForm, setMvtForm] = createSignal<Record<string,string>>({ movement_type: "entree", quantity: "" });

  const [data, { refetch }] = createResource(
    () => ({ page: page(), q: q(), low_stock: lowStock() ? "1" : "" }),
    p => getSpareParts({ ...p, limit: 20 })
  );

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    try { await createSparePart(form()); setShowCreate(false); setForm({}); refetch(); }
    catch { alert("Erreur création pièce"); }
  };

  const handleMovement = async (e: Event) => {
    e.preventDefault();
    try {
      await sparePartMovement(movementTarget().id, mvtForm());
      setMovementTarget(null); setMvtForm({ movement_type: "entree", quantity: "" }); refetch();
    } catch(err: any) { alert(err?.response?.data?.error ?? "Erreur mouvement"); }
  };

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));
  const mf = (k: string) => (e: any) => setMvtForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div class="space-y-4">
      <div class="flex flex-col sm:flex-row gap-2">
        <input type="search" placeholder="Rechercher pièce, code, référence…"
          class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={q()} onInput={e => { setQ(e.currentTarget.value); setPage(1); }} />
        <label class="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer">
          <input type="checkbox" checked={lowStock()} onChange={e => setLowStock(e.currentTarget.checked)} />
          Stock faible
        </label>
        <button onClick={() => setShowCreate(true)}
          class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Nouvelle pièce
        </button>
      </div>

      <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b">
              <tr>
                {["Code","Désignation","Référence","Stock","Min.","Valeur unit.","Stockage","Actions"].map(h =>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <Show when={data.loading}><tr><td colspan="8" class="text-center py-10 text-gray-400">Chargement…</td></tr></Show>
              <Show when={!data.loading && !data()?.data?.length}><tr><td colspan="8" class="text-center py-10 text-gray-400">Aucune pièce</td></tr></Show>
              <For each={data()?.data}>
                {(p: any) => (
                  <tr class={`hover:bg-gray-50 ${p.is_low ? "bg-red-50/30" : ""}`}>
                    <td class="px-4 py-3 font-mono text-xs text-gray-600">{p.code}</td>
                    <td class="px-4 py-3">
                      <p class="font-medium text-gray-900 text-sm">{p.name}</p>
                      {p.is_low && <p class="text-xs text-red-600 font-semibold">⚠ Stock faible</p>}
                    </td>
                    <td class="px-4 py-3 text-xs text-gray-500">{p.reference ?? "—"}</td>
                    <td class="px-4 py-3">
                      <span class={`text-sm font-bold ${p.is_low ? "text-red-600" : "text-gray-900"}`}>
                        {Number(p.quantity_on_hand).toFixed(0)}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-xs text-gray-500">{Number(p.min_quantity).toFixed(0)}</td>
                    <td class="px-4 py-3 text-xs text-gray-700">{p.unit_cost ? Number(p.unit_cost).toLocaleString("fr-DZ")+" DA" : "—"}</td>
                    <td class="px-4 py-3 text-xs text-gray-500">{p.storage_location ?? "—"}</td>
                    <td class="px-4 py-3">
                      <button onClick={() => setMovementTarget(p)}
                        class="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Mouvement</button>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
        <div class="flex items-center justify-between px-4 py-3 border-t text-xs text-gray-500">
          <span>Total: {data()?.total ?? 0} pièces</span>
          <div class="flex gap-2">
            <button disabled={page()===1} onClick={() => setPage(p=>p-1)} class="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-40">Préc.</button>
            <span>{page()}</span>
            <button disabled={(data()?.total??0)<=page()*20} onClick={() => setPage(p=>p+1)} class="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-40">Suiv.</button>
          </div>
        </div>
      </div>

      {/* Create modal */}
      <Show when={showCreate()}>
        <div class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between p-6 border-b">
              <h2 class="text-lg font-semibold">Nouvelle pièce détachée</h2>
              <button onClick={() => setShowCreate(false)} class="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} class="p-6 space-y-4">
              <div class="grid grid-cols-2 gap-3">
                <div><label class="text-xs font-medium text-gray-600">Code *</label>
                  <input required class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().code ?? ""} onInput={f("code")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Désignation *</label>
                  <input required class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().name ?? ""} onInput={f("name")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Référence</label>
                  <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().reference ?? ""} onInput={f("reference")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Stock initial</label>
                  <input type="number" min="0" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().quantity_on_hand ?? "0"} onInput={f("quantity_on_hand")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Stock minimum</label>
                  <input type="number" min="0" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().min_quantity ?? "0"} onInput={f("min_quantity")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Coût unitaire (DA)</label>
                  <input type="number" min="0" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().unit_cost ?? ""} onInput={f("unit_cost")} /></div>
              </div>
              <div><label class="text-xs font-medium text-gray-600">Emplacement stockage</label>
                <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().storage_location ?? ""} onInput={f("storage_location")} /></div>
              <div class="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} class="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Créer</button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Movement modal */}
      <Show when={movementTarget()}>
        <div class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div class="flex items-center justify-between p-6 border-b">
              <h2 class="text-lg font-semibold">Mouvement — {movementTarget().name}</h2>
              <button onClick={() => setMovementTarget(null)} class="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleMovement} class="p-6 space-y-4">
              <div class="grid grid-cols-2 gap-3">
                <div><label class="text-xs font-medium text-gray-600">Type</label>
                  <select class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={mvtForm().movement_type} onChange={mf("movement_type")}>
                    <option value="entree">Entrée</option>
                    <option value="sortie">Sortie</option>
                    <option value="ajustement">Ajustement</option>
                  </select>
                </div>
                <div><label class="text-xs font-medium text-gray-600">Quantité *</label>
                  <input required type="number" min="1" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={mvtForm().quantity} onInput={mf("quantity")} /></div>
              </div>
              <div><label class="text-xs font-medium text-gray-600">Motif</label>
                <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={mvtForm().notes ?? ""} onInput={mf("notes")} /></div>
              <div class="flex justify-end gap-3">
                <button type="button" onClick={() => setMovementTarget(null)} class="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Valider</button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
