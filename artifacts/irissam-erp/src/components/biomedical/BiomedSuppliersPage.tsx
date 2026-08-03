import { createSignal, createResource, For, Show } from "solid-js";
import { getBiomedSuppliers, createBiomedSupplier } from "@/services/api/biomedical";

export default function BiomedSuppliersPage() {
  const [showCreate, setShowCreate] = createSignal(false);
  const [form, setForm] = createSignal<Record<string,string>>({});
  const [data, { refetch }] = createResource(getBiomedSuppliers);
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    try { await createBiomedSupplier(form()); setShowCreate(false); setForm({}); refetch(); }
    catch(err: any) { alert(err?.response?.data?.error ?? "Erreur"); }
  };

  return (
    <div class="space-y-4">
      <div class="flex justify-end">
        <button onClick={() => setShowCreate(true)}
          class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Nouveau fournisseur
        </button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <Show when={data.loading}><div class="col-span-3 text-center py-10 text-gray-400">Chargement…</div></Show>
        <Show when={!data.loading && !data()?.data?.length}><div class="col-span-3 text-center py-10 text-gray-400">Aucun fournisseur</div></Show>
        <For each={data()?.data}>
          {(s: any) => (
            <div class="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-2">
              <div class="flex justify-between items-start">
                <div>
                  <p class="font-semibold text-gray-900">{s.name}</p>
                  <p class="text-xs font-mono text-gray-500">{s.code}</p>
                </div>
                <span class={`text-xs px-2 py-0.5 rounded-full font-medium ${s.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                  {s.is_active ? "Actif" : "Inactif"}
                </span>
              </div>
              <div class="text-xs text-gray-500 space-y-0.5">
                {s.contact_name && <p>👤 {s.contact_name}</p>}
                {s.phone && <p>📞 {s.phone}</p>}
                {s.email && <p>✉ {s.email}</p>}
                {s.city && <p>📍 {s.city}</p>}
                {s.payment_terms_days && <p>💳 Paiement: {s.payment_terms_days}j</p>}
              </div>
            </div>
          )}
        </For>
      </div>
      <Show when={showCreate()}>
        <div class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div class="flex items-center justify-between p-6 border-b">
              <h2 class="text-lg font-semibold">Nouveau fournisseur biomédical</h2>
              <button onClick={() => setShowCreate(false)} class="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} class="p-6 space-y-4">
              <div class="grid grid-cols-2 gap-3">
                <div><label class="text-xs font-medium text-gray-600">Code *</label>
                  <input required class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().code ?? ""} onInput={f("code")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Nom *</label>
                  <input required class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().name ?? ""} onInput={f("name")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Contact</label>
                  <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().contact_name ?? ""} onInput={f("contact_name")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Téléphone</label>
                  <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().phone ?? ""} onInput={f("phone")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Email</label>
                  <input type="email" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().email ?? ""} onInput={f("email")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Ville</label>
                  <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().city ?? ""} onInput={f("city")} /></div>
              </div>
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
