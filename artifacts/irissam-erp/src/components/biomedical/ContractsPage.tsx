import { createSignal, createResource, For, Show } from "solid-js";
import { getContracts, createContract, updateContract, getBiomedSuppliers } from "@/services/api/biomedical";

const STATUS_BADGE: Record<string,string> = {
  actif:"bg-emerald-100 text-emerald-700", expire:"bg-red-100 text-red-700",
  resilie:"bg-gray-100 text-gray-600", en_renouvellement:"bg-amber-100 text-amber-700",
  brouillon:"bg-blue-100 text-blue-700",
};

export default function ContractsPage() {
  const [page, setPage] = createSignal(1);
  const [statusF, setStatusF] = createSignal("");
  const [showCreate, setShowCreate] = createSignal(false);
  const [form, setForm] = createSignal<Record<string,string>>({});
  const [suppliers] = createResource(getBiomedSuppliers);

  const [data, { refetch }] = createResource(
    () => ({ page: page(), status: statusF() }),
    p => getContracts({ ...p, limit: 20 })
  );

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    try { await createContract(form()); setShowCreate(false); setForm({}); refetch(); }
    catch(err: any) { alert(err?.response?.data?.error ?? "Erreur création contrat"); }
  };

  const handleStatusChange = async (c: any, status: string) => {
    try { await updateContract(c.id, { status }); refetch(); }
    catch { alert("Erreur mise à jour statut"); }
  };

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const daysUntil = (dateStr: string) => {
    const d = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
    return d;
  };

  return (
    <div class="space-y-4">
      <div class="flex gap-2">
        <select class="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={statusF()} onChange={e => setStatusF(e.currentTarget.value)}>
          <option value="">Tous statuts</option>
          {["brouillon","actif","expire","resilie","en_renouvellement"].map(s =>
            <option value={s}>{s.replace(/_/g," ")}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)}
          class="ml-auto bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Nouveau contrat
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Show when={data.loading}><div class="col-span-3 text-center py-10 text-gray-400">Chargement…</div></Show>
        <Show when={!data.loading && !data()?.data?.length}><div class="col-span-3 text-center py-10 text-gray-400">Aucun contrat</div></Show>
        <For each={data()?.data}>
          {(c: any) => {
            const days = c.end_date ? daysUntil(c.end_date) : null;
            const isExpiringSoon = days !== null && days <= (c.renewal_reminder_days ?? 30) && days > 0;
            const isExpired = days !== null && days <= 0;
            return (
              <div class={`bg-white rounded-xl border shadow-sm p-4 space-y-3 ${isExpired ? "border-red-200" : isExpiringSoon ? "border-amber-200" : "border-gray-100"}`}>
                <div class="flex items-start justify-between">
                  <div>
                    <p class="font-semibold text-gray-900 text-sm">{c.title}</p>
                    <p class="text-xs text-gray-500 font-mono">{c.contract_number}</p>
                  </div>
                  <span class={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[c.status]??""}`}>{c.status.replace(/_/g," ")}</span>
                </div>
                <div class="text-xs text-gray-600 space-y-1">
                  <p>🏢 {c.supplier_name}</p>
                  <p>📋 {c.contract_type}</p>
                  {c.value && <p>💰 {Number(c.value).toLocaleString("fr-DZ")} {c.currency}</p>}
                  <p class={isExpired ? "text-red-600 font-bold" : isExpiringSoon ? "text-amber-600 font-semibold" : ""}>
                    {isExpired ? `⛔ Expiré (${Math.abs(days!)} jours)` :
                     isExpiringSoon ? `⚠ Expire dans ${days} jours` :
                     `📅 Jusqu'au ${new Date(c.end_date).toLocaleDateString("fr-DZ")}`}
                  </p>
                  {c.sla_response_hours && <p>⚡ SLA réponse: {c.sla_response_hours}h</p>}
                </div>
                <div class="flex gap-2">
                  {c.status === "brouillon" && (
                    <button onClick={() => handleStatusChange(c, "actif")}
                      class="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg font-medium hover:bg-emerald-100">Activer</button>
                  )}
                  {c.status === "actif" && isExpiringSoon && (
                    <button onClick={() => handleStatusChange(c, "en_renouvellement")}
                      class="text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-lg font-medium hover:bg-amber-100">Renouveler</button>
                  )}
                  {["actif","en_renouvellement"].includes(c.status) && (
                    <button onClick={() => handleStatusChange(c, "resilie")}
                      class="text-xs bg-red-50 text-red-700 px-3 py-1 rounded-lg font-medium hover:bg-red-100">Résilier</button>
                  )}
                </div>
              </div>
            );
          }}
        </For>
      </div>

      <Show when={showCreate()}>
        <div class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between p-6 border-b">
              <h2 class="text-lg font-semibold">Nouveau contrat</h2>
              <button onClick={() => setShowCreate(false)} class="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} class="p-6 space-y-4">
              <div class="grid grid-cols-2 gap-3">
                <div><label class="text-xs font-medium text-gray-600">N° contrat *</label>
                  <input required class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().contract_number ?? ""} onInput={f("contract_number")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Type</label>
                  <select class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().contract_type ?? "maintenance"} onChange={e => setForm(p=>({...p,contract_type:e.currentTarget.value}))}>
                    {["maintenance","garantie","support","location","autre"].map(t => <option value={t}>{t}</option>)}</select></div>
              </div>
              <div><label class="text-xs font-medium text-gray-600">Titre *</label>
                <input required class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().title ?? ""} onInput={f("title")} /></div>
              <div><label class="text-xs font-medium text-gray-600">Fournisseur *</label>
                <select required class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().supplier_id ?? ""} onChange={e => setForm(p=>({...p,supplier_id:e.currentTarget.value}))}>
                  <option value="">— Choisir —</option>
                  <For each={suppliers()?.data}>{(s:any) => <option value={s.id}>{s.name}</option>}</For>
                </select></div>
              <div class="grid grid-cols-2 gap-3">
                <div><label class="text-xs font-medium text-gray-600">Début *</label>
                  <input required type="date" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().start_date ?? ""} onInput={f("start_date")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Fin *</label>
                  <input required type="date" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().end_date ?? ""} onInput={f("end_date")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Valeur (DA)</label>
                  <input type="number" min="0" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().value ?? ""} onInput={f("value")} /></div>
                <div><label class="text-xs font-medium text-gray-600">SLA réponse (h)</label>
                  <input type="number" min="1" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().sla_response_hours ?? ""} onInput={f("sla_response_hours")} /></div>
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
