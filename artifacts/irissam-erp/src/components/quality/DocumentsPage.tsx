import { createSignal, createResource, For, Show } from "solid-js";
import { getDocuments, createDocument, updateDocument } from "@/services/api/quality";

const STATUS_BADGE: Record<string,string> = {
  brouillon:"bg-gray-100 text-gray-600", en_revision:"bg-amber-100 text-amber-700",
  en_approbation:"bg-indigo-100 text-indigo-700", approuve:"bg-blue-100 text-blue-700",
  publie:"bg-emerald-100 text-emerald-700", archive:"bg-gray-100 text-gray-400",
  expire:"bg-red-100 text-red-700",
};
const TYPE_ICON: Record<string,string> = {
  procedure:"📋", protocole:"📄", instruction:"📝", formulaire:"📑",
  enregistrement:"🗂️", politique:"📜", charte:"🏛️", autre:"📁",
};

export default function DocumentsPage() {
  const [page, setPage] = createSignal(1);
  const [q, setQ] = createSignal("");
  const [statusF, setStatusF] = createSignal("");
  const [docTypeF, setDocTypeF] = createSignal("");
  const [showCreate, setShowCreate] = createSignal(false);
  const [form, setForm] = createSignal<Record<string,any>>({ doc_type:"procedure", current_version:"1.0" });

  const [data, { refetch }] = createResource(
    () => ({ page: page(), q: q(), status: statusF(), doc_type: docTypeF() }),
    p => getDocuments({ ...p, limit: 20 })
  );

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    try { await createDocument(form()); setShowCreate(false); setForm({ doc_type:"procedure", current_version:"1.0" }); refetch(); }
    catch(err: any) { alert(err?.response?.data?.error ?? "Erreur"); }
  };

  const handlePublish = async (doc: any) => {
    if (!confirm(`Publier "${doc.title}" ?`)) return;
    try { await updateDocument(doc.id, { status:"publie" }); refetch(); }
    catch { alert("Erreur publication"); }
  };

  const handleArchive = async (doc: any) => {
    if (!confirm(`Archiver "${doc.title}" ?`)) return;
    try { await updateDocument(doc.id, { status:"archive" }); refetch(); }
    catch { alert("Erreur archivage"); }
  };

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const daysToExpiry = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);

  return (
    <div class="space-y-4">
      <div class="flex flex-col sm:flex-row gap-2 flex-wrap">
        <input type="search" placeholder="Rechercher document…" class="flex-1 min-w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={q()} onInput={e => { setQ(e.currentTarget.value); setPage(1); }} />
        <select class="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={statusF()} onChange={e => setStatusF(e.currentTarget.value)}>
          <option value="">Tous statuts</option>
          {["brouillon","en_revision","en_approbation","approuve","publie","archive","expire"].map(s =>
            <option value={s}>{s.replace(/_/g," ")}</option>)}
        </select>
        <select class="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={docTypeF()} onChange={e => setDocTypeF(e.currentTarget.value)}>
          <option value="">Tous types</option>
          {["procedure","protocole","instruction","formulaire","enregistrement","politique","charte","autre"].map(t =>
            <option value={t}>{t}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)} class="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 whitespace-nowrap">
          + Nouveau document
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Show when={data.loading}><div class="col-span-3 text-center py-10 text-gray-400">Chargement…</div></Show>
        <Show when={!data.loading && !data()?.data?.length}><div class="col-span-3 text-center py-10 text-gray-400">Aucun document</div></Show>
        <For each={data()?.data}>
          {(doc: any) => {
            const days = doc.expiry_date ? daysToExpiry(doc.expiry_date) : null;
            const isExpiring = days !== null && days <= 60 && days > 0;
            const isExpired = days !== null && days <= 0;
            return (
              <div class={`bg-white rounded-xl border shadow-sm p-4 space-y-3 ${isExpired ? "border-red-200" : isExpiring ? "border-amber-200" : "border-gray-100"}`}>
                <div class="flex items-start justify-between">
                  <div class="flex items-center gap-2">
                    <span class="text-xl">{TYPE_ICON[doc.doc_type] ?? "📁"}</span>
                    <div>
                      <p class="font-semibold text-gray-900 text-sm leading-tight">{doc.title}</p>
                      <p class="text-xs font-mono text-gray-400">{doc.reference} v{doc.current_version}</p>
                    </div>
                  </div>
                  <span class={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${STATUS_BADGE[doc.status]??""}`}>{doc.status?.replace(/_/g," ")}</span>
                </div>
                <div class="text-xs text-gray-500 space-y-0.5">
                  {doc.department && <p>🏥 {doc.department}</p>}
                  {doc.owner_name && <p>👤 {doc.owner_name}</p>}
                  {doc.expiry_date && (
                    <p class={isExpired ? "text-red-600 font-bold" : isExpiring ? "text-amber-600 font-semibold" : ""}>
                      {isExpired ? `⛔ Expiré (${Math.abs(days!)}j)` :
                       isExpiring ? `⚠ Expire dans ${days}j` :
                       `📅 Expire: ${new Date(doc.expiry_date).toLocaleDateString("fr-DZ")}`}
                    </p>
                  )}
                </div>
                <div class="flex gap-2">
                  {["brouillon","en_revision","approuve"].includes(doc.status) && (
                    <button onClick={() => handlePublish(doc)}
                      class="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg font-medium hover:bg-emerald-100">Publier</button>
                  )}
                  {doc.status === "publie" && (
                    <button onClick={() => handleArchive(doc)}
                      class="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-lg font-medium hover:bg-gray-200">Archiver</button>
                  )}
                </div>
              </div>
            );
          }}
        </For>
      </div>

      <div class="flex items-center justify-between px-2 py-2 text-xs text-gray-500">
        <span>Total: {data()?.total ?? 0}</span>
        <div class="flex gap-2">
          <button disabled={page()===1} onClick={() => setPage(p=>p-1)} class="px-3 py-1 border rounded-lg disabled:opacity-40">Préc.</button>
          <span>{page()}</span>
          <button disabled={(data()?.total??0)<=page()*20} onClick={() => setPage(p=>p+1)} class="px-3 py-1 border rounded-lg disabled:opacity-40">Suiv.</button>
        </div>
      </div>

      <Show when={showCreate()}>
        <div class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between p-6 border-b">
              <h2 class="text-lg font-semibold">Nouveau document qualité</h2>
              <button onClick={() => setShowCreate(false)} class="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} class="p-6 space-y-4">
              <div><label class="text-xs font-medium text-gray-600">Titre *</label>
                <input required class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().title ?? ""} onInput={f("title")} /></div>
              <div class="grid grid-cols-2 gap-3">
                <div><label class="text-xs font-medium text-gray-600">Type</label>
                  <select class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().doc_type ?? "procedure"} onChange={e => setForm(p=>({...p,doc_type:e.currentTarget.value}))}>
                    {["procedure","protocole","instruction","formulaire","enregistrement","politique","charte","autre"].map(t => <option value={t}>{t}</option>)}</select></div>
                <div><label class="text-xs font-medium text-gray-600">Version</label>
                  <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().current_version ?? "1.0"} onInput={f("current_version")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Service</label>
                  <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().department ?? ""} onInput={f("department")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Propriétaire</label>
                  <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().owner_name ?? ""} onInput={f("owner_name")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Date révision</label>
                  <input type="date" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().review_date ?? ""} onInput={f("review_date")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Date expiration</label>
                  <input type="date" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().expiry_date ?? ""} onInput={f("expiry_date")} /></div>
              </div>
              <div><label class="text-xs font-medium text-gray-600">Résumé</label>
                <textarea rows="2" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().summary ?? ""} onInput={f("summary")} /></div>
              <div class="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} class="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" class="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Créer</button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
