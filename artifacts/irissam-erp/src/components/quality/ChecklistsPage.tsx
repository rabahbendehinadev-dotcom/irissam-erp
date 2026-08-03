import { createSignal, createResource, For, Show } from "solid-js";
import { getChecklists, createChecklist, getChecklist, updateChecklistItem, addChecklistItems } from "@/services/api/quality";

export default function ChecklistsPage() {
  const [selected, setSelected] = createSignal<any>(null);
  const [showCreate, setShowCreate] = createSignal(false);
  const [showAddItems, setShowAddItems] = createSignal(false);
  const [form, setForm] = createSignal<Record<string,any>>({});
  const [newItem, setNewItem] = createSignal("");

  const [list, { refetch: refetchList }] = createResource(getChecklists);
  const [detail, { refetch: refetchDetail }] = createResource(
    () => selected()?.id ?? null, id => id ? getChecklist(id) : null
  );

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    try { await createChecklist(form()); setShowCreate(false); setForm({}); refetchList(); }
    catch(err: any) { alert(err?.response?.data?.error ?? "Erreur"); }
  };

  const handleAddItem = async () => {
    const q = newItem().trim();
    if (!q || !selected()?.id) return;
    try { await addChecklistItems(selected().id, [{ question: q }]); setNewItem(""); refetchDetail(); }
    catch { alert("Erreur ajout item"); }
  };

  const handleCheck = async (item: any, compliant: boolean) => {
    try { await updateChecklistItem(item.id, { is_compliant: compliant }); refetchDetail(); }
    catch { alert("Erreur mise à jour"); }
  };

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const compliantCount = () => detail()?.items?.filter((i: any) => i.is_compliant === true).length ?? 0;
  const nonCompliantCount = () => detail()?.items?.filter((i: any) => i.is_compliant === false).length ?? 0;
  const totalChecked = () => detail()?.items?.filter((i: any) => i.is_compliant !== null).length ?? 0;
  const totalItems = () => detail()?.items?.length ?? 0;

  return (
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
      {/* Left: list */}
      <div class="space-y-3">
        <button onClick={() => setShowCreate(true)} class="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Nouvelle checklist
        </button>
        <Show when={list.loading}><p class="text-center text-gray-400 text-sm py-8">Chargement…</p></Show>
        <Show when={!list.loading && !list()?.data?.length}><p class="text-center text-gray-400 text-sm py-8">Aucune checklist</p></Show>
        <For each={list()?.data}>
          {(cl: any) => (
            <button onClick={() => setSelected(cl)}
              class={`w-full text-left bg-white rounded-xl border p-3 shadow-sm hover:border-indigo-300 transition-colors ${selected()?.id === cl.id ? "border-indigo-400 bg-indigo-50" : "border-gray-100"}`}>
              <p class="font-medium text-gray-900 text-sm">{cl.title}</p>
              <p class="text-xs font-mono text-gray-400">{cl.reference}</p>
              {cl.department && <p class="text-xs text-gray-500 mt-0.5">🏥 {cl.department}</p>}
              {cl.frequency && <p class="text-xs text-gray-400">{cl.frequency}</p>}
            </button>
          )}
        </For>
      </div>

      {/* Right: detail */}
      <div class="md:col-span-2">
        <Show when={!selected()}>
          <div class="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400">
            Sélectionnez une checklist
          </div>
        </Show>
        <Show when={selected()}>
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div class="p-4 border-b flex items-center justify-between">
              <div>
                <p class="font-semibold text-gray-900">{selected()?.title}</p>
                {detail()?.description && <p class="text-xs text-gray-500">{detail()?.description}</p>}
              </div>
              <div class="flex items-center gap-3">
                <Show when={totalItems() > 0}>
                  <div class="text-right">
                    <p class="text-xs text-gray-500">{totalChecked()}/{totalItems()} vérifiés</p>
                    <div class="flex items-center gap-1 text-xs">
                      <span class="text-emerald-600 font-semibold">✓ {compliantCount()}</span>
                      <span class="text-red-600 font-semibold">✗ {nonCompliantCount()}</span>
                    </div>
                  </div>
                </Show>
                <button onClick={() => setShowAddItems(true)} class="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-100">+ Item</button>
              </div>
            </div>
            <div class="divide-y divide-gray-50">
              <Show when={detail.loading}><p class="text-center py-8 text-gray-400">Chargement…</p></Show>
              <Show when={!detail.loading && !detail()?.items?.length}><p class="text-center py-8 text-gray-400 text-sm">Aucun item — cliquez "+ Item" pour commencer</p></Show>
              <For each={detail()?.items}>
                {(item: any) => (
                  <div class={`px-4 py-3 flex items-start gap-3 ${item.is_compliant === false ? "bg-red-50/30" : ""}`}>
                    <span class="text-gray-400 text-xs w-6 pt-0.5 shrink-0">{item.item_order}.</span>
                    <div class="flex-1">
                      <p class="text-sm text-gray-900">{item.question}</p>
                      {item.observation && <p class="text-xs text-gray-500 mt-0.5 italic">{item.observation}</p>}
                    </div>
                    <div class="flex gap-2 shrink-0">
                      <button onClick={() => handleCheck(item, true)}
                        class={`w-8 h-8 rounded-lg text-sm font-bold border transition-all ${item.is_compliant === true ? "bg-emerald-500 text-white border-emerald-500" : "border-gray-200 text-gray-300 hover:border-emerald-300 hover:text-emerald-500"}`}>
                        ✓
                      </button>
                      <button onClick={() => handleCheck(item, false)}
                        class={`w-8 h-8 rounded-lg text-sm font-bold border transition-all ${item.is_compliant === false ? "bg-red-500 text-white border-red-500" : "border-gray-200 text-gray-300 hover:border-red-300 hover:text-red-500"}`}>
                        ✗
                      </button>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>

      {/* Create checklist modal */}
      <Show when={showCreate()}>
        <div class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div class="flex items-center justify-between p-6 border-b">
              <h2 class="text-lg font-semibold">Nouvelle checklist</h2>
              <button onClick={() => setShowCreate(false)} class="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} class="p-6 space-y-4">
              <div><label class="text-xs font-medium text-gray-600">Titre *</label>
                <input required class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().title ?? ""} onInput={f("title")} /></div>
              <div class="grid grid-cols-2 gap-3">
                <div><label class="text-xs font-medium text-gray-600">Service</label>
                  <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().department ?? ""} onInput={f("department")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Fréquence</label>
                  <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().frequency ?? ""} onInput={f("frequency")} /></div>
              </div>
              <div class="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} class="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Créer</button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Add item modal */}
      <Show when={showAddItems()}>
        <div class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div class="flex items-center justify-between p-6 border-b">
              <h2 class="text-lg font-semibold">Ajouter un item</h2>
              <button onClick={() => setShowAddItems(false)} class="text-gray-400">✕</button>
            </div>
            <div class="p-6 space-y-3">
              <div class="flex gap-2">
                <input class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Question / critère de vérification"
                  value={newItem()} onInput={e => setNewItem(e.currentTarget.value)}
                  onKeyDown={async (e) => { if (e.key === "Enter") { e.preventDefault(); await handleAddItem(); }}} />
                <button onClick={handleAddItem} class="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">+</button>
              </div>
              <p class="text-xs text-gray-400">Appuyez Entrée ou cliquez + pour ajouter</p>
              <Show when={detail()?.items?.length}>
                <div class="mt-2 text-xs text-gray-500 font-medium">{detail()?.items?.length} item(s) dans cette checklist</div>
              </Show>
              <div class="flex justify-end">
                <button onClick={() => setShowAddItems(false)} class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Terminer</button>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
