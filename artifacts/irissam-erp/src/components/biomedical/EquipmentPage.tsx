import { createSignal, createResource, For, Show } from "solid-js";
import { getEquipment, createEquipment, updateEquipment,
         getBiomedCategories, getBiomedLocations, getBiomedManufacturers } from "@/services/api/biomedical";

const STATUS_BADGE: Record<string,string> = {
  actif:"bg-emerald-100 text-emerald-700",
  en_maintenance:"bg-amber-100 text-amber-700",
  hors_service:"bg-red-100 text-red-700",
  retire:"bg-gray-100 text-gray-600",
  en_attente_installation:"bg-blue-100 text-blue-700",
  reserve:"bg-purple-100 text-purple-700",
};
const STATUS_LABELS: Record<string,string> = {
  actif:"Actif", en_maintenance:"En maintenance", hors_service:"Hors service",
  retire:"Retraité", en_attente_installation:"En attente", reserve:"Réservé",
};
const CRIT_BADGE: Record<string,string> = {
  critique:"bg-red-100 text-red-700", haute:"bg-orange-100 text-orange-700",
  normale:"bg-blue-100 text-blue-700", faible:"bg-gray-100 text-gray-600",
};

export default function EquipmentPage() {
  const [page, setPage] = createSignal(1);
  const [q, setQ] = createSignal("");
  const [statusFilter, setStatusFilter] = createSignal("");
  const [showCreate, setShowCreate] = createSignal(false);
  const [selected, setSelected] = createSignal<any>(null);
  const [form, setForm] = createSignal<Record<string,string>>({});

  const [categories] = createResource(getBiomedCategories);
  const [locations]  = createResource(getBiomedLocations);
  const [manufacturers] = createResource(getBiomedManufacturers);

  const [data, { refetch }] = createResource(
    () => ({ page: page(), q: q(), status: statusFilter() }),
    ({ page, q, status }) => getEquipment({ page, q, status, limit: 20 })
  );

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    try {
      await createEquipment(form());
      setShowCreate(false); setForm({}); refetch();
    } catch { alert("Erreur lors de la création"); }
  };

  const handleStatusChange = async (eq: any, newStatus: string) => {
    try {
      await updateEquipment(eq.id, { status: newStatus });
      refetch();
    } catch { alert("Erreur mise à jour statut"); }
  };

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div class="space-y-4">
      {/* Toolbar */}
      <div class="flex flex-col sm:flex-row gap-2">
        <input
          type="search" placeholder="Rechercher équipement, code, série…"
          class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={q()} onInput={e => { setQ(e.currentTarget.value); setPage(1); }}
        />
        <select class="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={statusFilter()} onChange={e => { setStatusFilter(e.currentTarget.value); setPage(1); }}>
          <option value="">Tous les statuts</option>
          <For each={Object.entries(STATUS_LABELS)}>
            {([v,l]) => <option value={v}>{l}</option>}
          </For>
        </select>
        <button onClick={() => setShowCreate(true)}
          class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Nouvel équipement
        </button>
      </div>

      {/* Table */}
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b border-gray-100">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Code</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Équipement</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Catégorie</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Localisation</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Criticité</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Statut</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Proch. maint.</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <Show when={data.loading}>
                <tr><td colspan="8" class="text-center py-10 text-gray-400">Chargement…</td></tr>
              </Show>
              <Show when={!data.loading && !data()?.data?.length}>
                <tr><td colspan="8" class="text-center py-10 text-gray-400">Aucun équipement trouvé</td></tr>
              </Show>
              <For each={data()?.data}>
                {(eq: any) => {
                  const isOverdue = eq.next_maintenance_date && new Date(eq.next_maintenance_date) < new Date();
                  const isCalibExpired = eq.calibration_expired;
                  return (
                    <tr class="hover:bg-gray-50 transition-colors">
                      <td class="px-4 py-3 font-mono text-xs text-gray-600">{eq.internal_code}</td>
                      <td class="px-4 py-3">
                        <div class="font-medium text-gray-900">{eq.name}</div>
                        <div class="text-xs text-gray-500">{eq.manufacturer_name} — {eq.model_name}</div>
                        {isCalibExpired && <span class="text-xs text-orange-600 font-semibold">⚠ Calibration expirée</span>}
                      </td>
                      <td class="px-4 py-3">
                        <span class="px-2 py-0.5 rounded-full text-xs" style={`background:${eq.category_color}20;color:${eq.category_color}`}>
                          {eq.category_name ?? "—"}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-xs text-gray-600">{eq.location_name ?? eq.department ?? "—"}</td>
                      <td class="px-4 py-3">
                        <span class={`px-2 py-0.5 rounded-full text-xs font-medium ${CRIT_BADGE[eq.criticality]??""}`}>
                          {eq.criticality}
                        </span>
                      </td>
                      <td class="px-4 py-3">
                        <select class={`text-xs font-medium px-2 py-1 rounded-full border-0 ${STATUS_BADGE[eq.status]??""}`}
                          value={eq.status}
                          onChange={e => handleStatusChange(eq, e.currentTarget.value)}>
                          <For each={Object.entries(STATUS_LABELS)}>
                            {([v,l]) => <option value={v}>{l}</option>}
                          </For>
                        </select>
                      </td>
                      <td class={`px-4 py-3 text-xs ${isOverdue ? "text-red-600 font-bold" : "text-gray-500"}`}>
                        {eq.next_maintenance_date
                          ? new Date(eq.next_maintenance_date).toLocaleDateString("fr-DZ")
                          : "—"}
                      </td>
                      <td class="px-4 py-3">
                        <button onClick={() => setSelected(eq)}
                          class="text-indigo-600 hover:text-indigo-800 text-xs font-medium">Détail</button>
                      </td>
                    </tr>
                  );
                }}
              </For>
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div class="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <p class="text-xs text-gray-500">Total: {data()?.total ?? 0} équipements</p>
          <div class="flex gap-2">
            <button disabled={page()===1} onClick={() => setPage(p => p-1)}
              class="px-3 py-1 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Préc.</button>
            <span class="px-3 py-1 text-xs text-gray-600">Page {page()}</span>
            <button disabled={(data()?.total??0) <= page()*20} onClick={() => setPage(p => p+1)}
              class="px-3 py-1 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Suiv.</button>
          </div>
        </div>
      </div>

      {/* Create modal */}
      <Show when={showCreate()}>
        <div class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between p-6 border-b">
              <h2 class="text-lg font-semibold">Nouvel équipement</h2>
              <button onClick={() => setShowCreate(false)} class="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleCreate} class="p-6 space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="text-xs font-medium text-gray-600">Nom *</label>
                  <input required class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="Ex: Moniteur multiparamètre" value={form().name ?? ""} onInput={f("name")} />
                </div>
                <div>
                  <label class="text-xs font-medium text-gray-600">Numéro de série</label>
                  <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form().serial_number ?? ""} onInput={f("serial_number")} />
                </div>
                <div>
                  <label class="text-xs font-medium text-gray-600">Catégorie</label>
                  <select class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form().category_id ?? ""} onChange={e => setForm(p=>({...p,category_id:e.currentTarget.value}))}>
                    <option value="">— Choisir —</option>
                    <For each={categories()?.data}>{(c:any) => <option value={c.id}>{c.name}</option>}</For>
                  </select>
                </div>
                <div>
                  <label class="text-xs font-medium text-gray-600">Fabricant</label>
                  <select class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form().manufacturer_id ?? ""} onChange={e => setForm(p=>({...p,manufacturer_id:e.currentTarget.value}))}>
                    <option value="">— Choisir —</option>
                    <For each={manufacturers()?.data}>{(m:any) => <option value={m.id}>{m.name}</option>}</For>
                  </select>
                </div>
                <div>
                  <label class="text-xs font-medium text-gray-600">Localisation</label>
                  <select class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form().location_id ?? ""} onChange={e => setForm(p=>({...p,location_id:e.currentTarget.value}))}>
                    <option value="">— Choisir —</option>
                    <For each={locations()?.data}>{(l:any) => <option value={l.id}>{l.name} ({l.department})</option>}</For>
                  </select>
                </div>
                <div>
                  <label class="text-xs font-medium text-gray-600">Criticité</label>
                  <select class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form().criticality ?? "normale"} onChange={e => setForm(p=>({...p,criticality:e.currentTarget.value}))}>
                    <option value="faible">Faible</option>
                    <option value="normale">Normale</option>
                    <option value="haute">Haute</option>
                    <option value="critique">Critique</option>
                  </select>
                </div>
                <div>
                  <label class="text-xs font-medium text-gray-600">Date achat</label>
                  <input type="date" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form().purchase_date ?? ""} onInput={f("purchase_date")} />
                </div>
                <div>
                  <label class="text-xs font-medium text-gray-600">Valeur achat (DA)</label>
                  <input type="number" min="0" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form().purchase_price ?? ""} onInput={f("purchase_price")} />
                </div>
                <div>
                  <label class="text-xs font-medium text-gray-600">Intervalle maint. (jours)</label>
                  <input type="number" min="1" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form().maintenance_interval_days ?? ""} onInput={f("maintenance_interval_days")} />
                </div>
                <div>
                  <label class="text-xs font-medium text-gray-600">Intervalle calibration (jours)</label>
                  <input type="number" min="1" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form().calibration_interval_days ?? ""} onInput={f("calibration_interval_days")} />
                </div>
              </div>
              <div>
                <label class="text-xs font-medium text-gray-600">Notes</label>
                <textarea rows="2" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form().notes ?? ""} onInput={f("notes")} />
              </div>
              <div class="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  class="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
                <button type="submit"
                  class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Créer</button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
