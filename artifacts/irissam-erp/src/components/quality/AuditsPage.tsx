import { createSignal, createResource, For, Show } from "solid-js";
import { getAudits, createAudit, updateAudit, addAuditFinding } from "@/services/api/quality";

const STATUS_BADGE: Record<string,string> = {
  planifie:"bg-blue-100 text-blue-700", en_cours:"bg-amber-100 text-amber-700",
  rapport_en_attente:"bg-indigo-100 text-indigo-700", clos:"bg-emerald-100 text-emerald-700",
  annule:"bg-gray-100 text-gray-500",
};
const FINDING_BADGE: Record<string,string> = {
  non_conformite:"bg-red-100 text-red-700", observation:"bg-amber-100 text-amber-700",
  opportunite_amelioration:"bg-blue-100 text-blue-700", bonne_pratique:"bg-emerald-100 text-emerald-700",
};

export default function AuditsPage() {
  const [page, setPage] = createSignal(1);
  const [q, setQ] = createSignal("");
  const [statusF, setStatusF] = createSignal("");
  const [showCreate, setShowCreate] = createSignal(false);
  const [findingTarget, setFindingTarget] = createSignal<any>(null);
  const [form, setForm] = createSignal<Record<string,any>>({ audit_type:"interne" });
  const [fForm, setFForm] = createSignal<Record<string,any>>({ finding_type:"observation" });

  const [data, { refetch }] = createResource(
    () => ({ page: page(), q: q(), status: statusF() }),
    p => getAudits({ ...p, limit: 20 })
  );

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    try { await createAudit(form()); setShowCreate(false); setForm({ audit_type:"interne" }); refetch(); }
    catch(err: any) { alert(err?.response?.data?.error ?? "Erreur"); }
  };

  const handleStatus = async (audit: any, status: string) => {
    try { await updateAudit(audit.id, { status }); refetch(); }
    catch { alert("Erreur"); }
  };

  const handleFinding = async (e: Event) => {
    e.preventDefault();
    try { await addAuditFinding(findingTarget().id, fForm()); setFindingTarget(null); setFForm({ finding_type:"observation" }); refetch(); }
    catch { alert("Erreur constat"); }
  };

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));
  const ff = (k: string) => (e: any) => setFForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div class="space-y-4">
      <div class="flex flex-col sm:flex-row gap-2">
        <input type="search" placeholder="Rechercher audit…" class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={q()} onInput={e => { setQ(e.currentTarget.value); setPage(1); }} />
        <select class="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={statusF()} onChange={e => setStatusF(e.currentTarget.value)}>
          <option value="">Tous statuts</option>
          {["planifie","en_cours","rapport_en_attente","clos","annule"].map(s => <option value={s}>{s.replace(/_/g," ")}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)} class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 whitespace-nowrap">
          + Planifier audit
        </button>
      </div>

      <div class="space-y-3">
        <Show when={data.loading}><div class="text-center py-10 text-gray-400">Chargement…</div></Show>
        <Show when={!data.loading && !data()?.data?.length}><div class="text-center py-10 text-gray-400">Aucun audit</div></Show>
        <For each={data()?.data}>
          {(audit: any) => (
            <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div class="flex flex-col sm:flex-row sm:items-start gap-3">
                <div class="flex-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-mono text-xs text-indigo-700 font-semibold">{audit.reference}</span>
                    <span class={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[audit.status]??""}`}>{audit.status?.replace(/_/g," ")}</span>
                    <span class="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{audit.audit_type}</span>
                  </div>
                  <p class="font-semibold text-gray-900 mt-1">{audit.title}</p>
                  <div class="text-xs text-gray-500 mt-1 flex gap-4 flex-wrap">
                    <span>📅 {new Date(audit.planned_start_date).toLocaleDateString("fr-DZ")} → {new Date(audit.planned_end_date).toLocaleDateString("fr-DZ")}</span>
                    {audit.lead_auditor_name && <span>👤 {audit.lead_auditor_name}</span>}
                    {audit.department && <span>🏥 {audit.department}</span>}
                    {audit.nc_count > 0 && <span class="text-red-600 font-semibold">❌ {audit.nc_count} NC</span>}
                    {audit.observation_count > 0 && <span class="text-amber-600 font-semibold">👁 {audit.observation_count} obs.</span>}
                  </div>
                </div>
                <div class="flex gap-2 shrink-0">
                  {audit.status === "planifie" && (
                    <button onClick={() => handleStatus(audit, "en_cours")}
                      class="text-xs bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg font-medium hover:bg-amber-100">Démarrer</button>
                  )}
                  {audit.status === "en_cours" && <>
                    <button onClick={() => setFindingTarget(audit)}
                      class="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-100">+ Constat</button>
                    <button onClick={() => handleStatus(audit, "rapport_en_attente")}
                      class="text-xs bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg font-medium hover:bg-purple-100">Rapport</button>
                  </>}
                  {audit.status === "rapport_en_attente" && (
                    <button onClick={() => handleStatus(audit, "clos")}
                      class="text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg font-medium hover:bg-emerald-100">Clore</button>
                  )}
                </div>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Create audit modal */}
      <Show when={showCreate()}>
        <div class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between p-6 border-b">
              <h2 class="text-lg font-semibold">Planifier un audit</h2>
              <button onClick={() => setShowCreate(false)} class="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} class="p-6 space-y-4">
              <div><label class="text-xs font-medium text-gray-600">Titre *</label>
                <input required class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().title ?? ""} onInput={f("title")} /></div>
              <div class="grid grid-cols-2 gap-3">
                <div><label class="text-xs font-medium text-gray-600">Type</label>
                  <select class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().audit_type ?? "interne"} onChange={e => setForm(p=>({...p,audit_type:e.currentTarget.value}))}>
                    {["interne","externe","certification","surveillance","suivi"].map(t => <option value={t}>{t}</option>)}</select></div>
                <div><label class="text-xs font-medium text-gray-600">Norme de référence</label>
                  <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="ex: ISO 9001:2015" value={form().standard_ref ?? ""} onInput={f("standard_ref")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Date début *</label>
                  <input required type="date" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().planned_start_date ?? ""} onInput={f("planned_start_date")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Date fin *</label>
                  <input required type="date" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().planned_end_date ?? ""} onInput={f("planned_end_date")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Auditeur principal</label>
                  <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().lead_auditor_name ?? ""} onInput={f("lead_auditor_name")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Service audité</label>
                  <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().department ?? ""} onInput={f("department")} /></div>
              </div>
              <div><label class="text-xs font-medium text-gray-600">Périmètre</label>
                <textarea rows="2" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().scope ?? ""} onInput={f("scope")} /></div>
              <div class="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} class="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Planifier</button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Add finding modal */}
      <Show when={findingTarget()}>
        <div class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div class="flex items-center justify-between p-6 border-b">
              <h2 class="text-lg font-semibold">Nouveau constat — {findingTarget()?.reference}</h2>
              <button onClick={() => setFindingTarget(null)} class="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleFinding} class="p-6 space-y-4">
              <div><label class="text-xs font-medium text-gray-600">Type</label>
                <select class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={fForm().finding_type ?? "observation"} onChange={ff("finding_type")}>
                  {["non_conformite","observation","opportunite_amelioration","bonne_pratique"].map(t =>
                    <option value={t}>{t.replace(/_/g," ")}</option>)}</select></div>
              <div><label class="text-xs font-medium text-gray-600">Titre *</label>
                <input required class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={fForm().title ?? ""} onInput={ff("title")} /></div>
              <div><label class="text-xs font-medium text-gray-600">Description</label>
                <textarea rows="3" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={fForm().description ?? ""} onInput={ff("description")} /></div>
              <div class="grid grid-cols-2 gap-3">
                <div><label class="text-xs font-medium text-gray-600">Clause norme</label>
                  <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="ex: §8.3.2" value={fForm().clause_ref ?? ""} onInput={ff("clause_ref")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Service</label>
                  <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={fForm().department ?? ""} onInput={ff("department")} /></div>
              </div>
              <div class="flex justify-end gap-3">
                <button type="button" onClick={() => setFindingTarget(null)} class="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Ajouter</button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
