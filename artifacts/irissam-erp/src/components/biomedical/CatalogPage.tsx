import { createSignal, createResource, For, Show } from "solid-js";
import { getBiomedCategories, getBiomedManufacturers, getBiomedModels, getBiomedLocations,
         createBiomedCategory, createBiomedManufacturer, createBiomedModel, createBiomedLocation } from "@/services/api/biomedical";

type SubTab = "categories" | "manufacturers" | "models" | "locations";

export default function CatalogPage() {
  const [tab, setTab] = createSignal<SubTab>("categories");
  const [showCreate, setShowCreate] = createSignal(false);
  const [form, setForm] = createSignal<Record<string,string>>({});

  const [categories,   { refetch: rCat }]  = createResource(getBiomedCategories);
  const [manufacturers,{ refetch: rMfr }]  = createResource(getBiomedManufacturers);
  const [models,       { refetch: rMod }]  = createResource(() => getBiomedModels({}));
  const [locations,    { refetch: rLoc }]  = createResource(getBiomedLocations);

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    try {
      if (tab() === "categories")    { await createBiomedCategory(form());    rCat(); }
      if (tab() === "manufacturers") { await createBiomedManufacturer(form()); rMfr(); }
      if (tab() === "models")        { await createBiomedModel(form());        rMod(); }
      if (tab() === "locations")     { await createBiomedLocation(form());     rLoc(); }
      setShowCreate(false); setForm({});
    } catch(err: any) { alert(err?.response?.data?.error ?? "Erreur"); }
  };

  const SUB_TABS: { id: SubTab; label: string }[] = [
    { id:"categories",   label:"Catégories" },
    { id:"manufacturers",label:"Fabricants" },
    { id:"models",       label:"Modèles" },
    { id:"locations",    label:"Localisations" },
  ];

  return (
    <div class="space-y-4">
      <div class="flex gap-1 bg-gray-100 rounded-xl p-1">
        <For each={SUB_TABS}>
          {(t) => (
            <button onClick={() => { setTab(t.id); setShowCreate(false); }}
              class={`flex-1 text-sm py-1.5 rounded-lg font-medium transition-all ${tab()===t.id ? "bg-white shadow-sm text-indigo-700" : "text-gray-500 hover:text-gray-700"}`}>
              {t.label}
            </button>
          )}
        </For>
      </div>

      <div class="flex justify-end">
        <button onClick={() => setShowCreate(true)}
          class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Ajouter
        </button>
      </div>

      {/* Categories */}
      <Show when={tab() === "categories"}>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <For each={categories()?.data}>
            {(c: any) => (
              <div class="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div class="w-8 h-8 rounded-lg mb-2" style={`background:${c.color}20`}>
                  <div class="w-3 h-3 rounded-full m-2.5" style={`background:${c.color}`}/>
                </div>
                <p class="font-semibold text-gray-900 text-sm">{c.name}</p>
                <p class="text-xs font-mono text-gray-400">{c.code}</p>
                {c.description && <p class="text-xs text-gray-500 mt-1">{c.description}</p>}
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Manufacturers */}
      <Show when={tab() === "manufacturers"}>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <For each={manufacturers()?.data}>
            {(m: any) => (
              <div class="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <p class="font-semibold text-gray-900">{m.name}</p>
                <p class="text-xs font-mono text-gray-400">{m.code} {m.country && `· ${m.country}`}</p>
                {m.contact_name && <p class="text-xs text-gray-500 mt-1">👤 {m.contact_name}</p>}
                {m.phone && <p class="text-xs text-gray-500">📞 {m.phone}</p>}
                {m.email && <p class="text-xs text-gray-500">✉ {m.email}</p>}
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Models */}
      <Show when={tab() === "models"}>
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b">
              <tr>
                {["Modèle","Fabricant","Référence","Vie (ans)","Int. maint.","Int. calib."].map(h =>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <For each={models()?.data}>
                {(m: any) => (
                  <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3 font-medium text-sm text-gray-900">{m.name}</td>
                    <td class="px-4 py-3 text-xs text-gray-600">{m.manufacturer_name}</td>
                    <td class="px-4 py-3 text-xs text-gray-500 font-mono">{m.reference ?? "—"}</td>
                    <td class="px-4 py-3 text-xs text-gray-500">{m.expected_life_years ?? "—"}</td>
                    <td class="px-4 py-3 text-xs text-gray-500">{m.maintenance_interval_days ? `${m.maintenance_interval_days}j` : "—"}</td>
                    <td class="px-4 py-3 text-xs text-gray-500">{m.calibration_interval_days ? `${m.calibration_interval_days}j` : "—"}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>

      {/* Locations */}
      <Show when={tab() === "locations"}>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <For each={locations()?.data}>
            {(l: any) => (
              <div class="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <p class="font-semibold text-gray-900">{l.name}</p>
                <p class="text-xs font-mono text-gray-400">{l.code}</p>
                {l.department && <p class="text-xs text-gray-500 mt-1">🏥 {l.department}</p>}
                {l.building && <p class="text-xs text-gray-400">🏢 Bât. {l.building}{l.floor ? `, Ét. ${l.floor}` : ""}{l.room ? `, Salle ${l.room}` : ""}</p>}
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Create modal */}
      <Show when={showCreate()}>
        <div class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div class="flex items-center justify-between p-6 border-b">
              <h2 class="text-lg font-semibold">Ajouter {SUB_TABS.find(t=>t.id===tab())?.label}</h2>
              <button onClick={() => setShowCreate(false)} class="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} class="p-6 space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div><label class="text-xs font-medium text-gray-600">Code *</label>
                  <input required class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().code ?? ""} onInput={f("code")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Nom *</label>
                  <input required class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().name ?? ""} onInput={f("name")} /></div>
              </div>
              <Show when={tab() === "categories"}>
                <div><label class="text-xs font-medium text-gray-600">Couleur</label>
                  <input type="color" class="mt-1 w-12 h-8 border border-gray-300 rounded cursor-pointer" value={form().color ?? "#6366F1"} onInput={f("color")} /></div>
              </Show>
              <Show when={tab() === "manufacturers"}>
                <div class="grid grid-cols-2 gap-3">
                  <div><label class="text-xs font-medium text-gray-600">Pays</label>
                    <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().country ?? ""} onInput={f("country")} /></div>
                  <div><label class="text-xs font-medium text-gray-600">Email</label>
                    <input type="email" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().email ?? ""} onInput={f("email")} /></div>
                </div>
              </Show>
              <Show when={tab() === "models"}>
                <div class="grid grid-cols-2 gap-3">
                  <div><label class="text-xs font-medium text-gray-600">Référence</label>
                    <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().reference ?? ""} onInput={f("reference")} /></div>
                  <div><label class="text-xs font-medium text-gray-600">Durée vie (ans)</label>
                    <input type="number" min="1" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().expected_life_years ?? ""} onInput={f("expected_life_years")} /></div>
                </div>
              </Show>
              <Show when={tab() === "locations"}>
                <div class="grid grid-cols-2 gap-3">
                  <div><label class="text-xs font-medium text-gray-600">Service</label>
                    <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().department ?? ""} onInput={f("department")} /></div>
                  <div><label class="text-xs font-medium text-gray-600">Bâtiment</label>
                    <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().building ?? ""} onInput={f("building")} /></div>
                </div>
              </Show>
              <div class="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} class="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Ajouter</button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
