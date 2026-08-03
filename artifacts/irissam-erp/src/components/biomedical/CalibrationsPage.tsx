import { createSignal, createResource, For, Show } from "solid-js";
import { getCalibrations, createCalibration, recordCalibration, getEquipment } from "@/services/api/biomedical";

const STATUS_BADGE: Record<string,string> = {
  planifiee:"bg-blue-100 text-blue-700", en_cours:"bg-amber-100 text-amber-700",
  conforme:"bg-emerald-100 text-emerald-700", non_conforme:"bg-red-100 text-red-700",
  a_refaire:"bg-orange-100 text-orange-700", annulee:"bg-gray-100 text-gray-500",
};

export default function CalibrationsPage() {
  const [page, setPage] = createSignal(1);
  const [statusF, setStatusF] = createSignal("");
  const [showCreate, setShowCreate] = createSignal(false);
  const [showRecord, setShowRecord] = createSignal<string|null>(null);
  const [form, setForm] = createSignal<Record<string,string>>({});
  const [recordForm, setRecordForm] = createSignal<Record<string,any>>({});
  const [equipSearch, setEquipSearch] = createSignal("");
  const [equipList] = createResource(() => equipSearch(), q => getEquipment({ q, limit: 15 }));

  const [data, { refetch }] = createResource(
    () => ({ page: page(), status: statusF() }),
    p => getCalibrations({ ...p, limit: 20 })
  );

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    try { await createCalibration(form()); setShowCreate(false); setForm({}); refetch(); }
    catch { alert("Erreur création calibration"); }
  };

  const handleRecord = async (e: Event) => {
    e.preventDefault();
    try { await recordCalibration(showRecord()!, recordForm()); setShowRecord(null); setRecordForm({}); refetch(); }
    catch { alert("Erreur enregistrement résultat"); }
  };

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));
  const rf = (k: string) => (e: any) => setRecordForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div class="space-y-4">
      <div class="flex flex-col sm:flex-row gap-2">
        <select class="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={statusF()} onChange={e => setStatusF(e.currentTarget.value)}>
          <option value="">Tous statuts</option>
          {["planifiee","en_cours","conforme","non_conforme","a_refaire","annulee"].map(s =>
            <option value={s}>{s.replace(/_/g," ")}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)}
          class="ml-auto bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Planifier calibration
        </button>
      </div>

      <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b">
              <tr>
                {["N° Cal.","Équipement","Statut","Type","Date planifiée","Réalisée","Conforme","Prochaine","Actions"].map(h =>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <Show when={data.loading}><tr><td colspan="9" class="text-center py-10 text-gray-400">Chargement…</td></tr></Show>
              <Show when={!data.loading && !data()?.data?.length}><tr><td colspan="9" class="text-center py-10 text-gray-400">Aucune calibration</td></tr></Show>
              <For each={data()?.data}>
                {(c: any) => (
                  <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3 font-mono text-xs">{c.calibration_number}</td>
                    <td class="px-4 py-3 text-xs">
                      <div class="font-medium text-gray-900">{c.equipment_name}</div>
                      <div class="text-gray-400">{c.internal_code}</div>
                    </td>
                    <td class="px-4 py-3"><span class={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[c.status]??""}`}>{c.status}</span></td>
                    <td class="px-4 py-3 text-xs capitalize text-gray-600">{c.calibration_type}</td>
                    <td class="px-4 py-3 text-xs text-gray-500">{c.planned_date ? new Date(c.planned_date).toLocaleDateString("fr-DZ") : "—"}</td>
                    <td class="px-4 py-3 text-xs text-gray-500">{c.performed_date ? new Date(c.performed_date).toLocaleDateString("fr-DZ") : "—"}</td>
                    <td class="px-4 py-3 text-center">
                      {c.is_compliant === true && <span class="text-emerald-600">✓</span>}
                      {c.is_compliant === false && <span class="text-red-600">✗</span>}
                      {c.is_compliant === null && <span class="text-gray-300">—</span>}
                    </td>
                    <td class="px-4 py-3 text-xs text-gray-500">{c.next_due_date ? new Date(c.next_due_date).toLocaleDateString("fr-DZ") : "—"}</td>
                    <td class="px-4 py-3">
                      {["planifiee","en_cours"].includes(c.status) &&
                        <button onClick={() => setShowRecord(c.id)}
                          class="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Enregistrer</button>}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
        <div class="flex items-center justify-between px-4 py-3 border-t text-xs text-gray-500">
          <span>Total: {data()?.total ?? 0}</span>
          <div class="flex gap-2">
            <button disabled={page()===1} onClick={() => setPage(p=>p-1)} class="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-40">Préc.</button>
            <span class="px-2">{page()}</span>
            <button disabled={(data()?.total??0)<=page()*20} onClick={() => setPage(p=>p+1)} class="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-40">Suiv.</button>
          </div>
        </div>
      </div>

      {/* Create modal */}
      <Show when={showCreate()}>
        <div class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between p-6 border-b">
              <h2 class="text-lg font-semibold">Planifier une calibration</h2>
              <button onClick={() => setShowCreate(false)} class="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} class="p-6 space-y-4">
              <div>
                <label class="text-xs font-medium text-gray-600">Équipement *</label>
                <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Rechercher…" value={equipSearch()} onInput={e => setEquipSearch(e.currentTarget.value)} />
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
                <div>
                  <label class="text-xs font-medium text-gray-600">Date planifiée *</label>
                  <input required type="date" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form().planned_date ?? ""} onInput={f("planned_date")} />
                </div>
                <div>
                  <label class="text-xs font-medium text-gray-600">Type</label>
                  <select class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form().calibration_type ?? "interne"} onChange={e => setForm(p=>({...p,calibration_type:e.currentTarget.value}))}>
                    <option value="interne">Interne</option>
                    <option value="externe">Externe</option>
                    <option value="constructeur">Constructeur</option>
                  </select>
                </div>
              </div>
              <div>
                <label class="text-xs font-medium text-gray-600">Laboratoire externe</label>
                <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form().external_lab ?? ""} onInput={f("external_lab")} />
              </div>
              <div class="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} class="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Planifier</button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Record result modal */}
      <Show when={showRecord()}>
        <div class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div class="flex items-center justify-between p-6 border-b">
              <h2 class="text-lg font-semibold">Enregistrer résultat</h2>
              <button onClick={() => setShowRecord(null)} class="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleRecord} class="p-6 space-y-4">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="text-xs font-medium text-gray-600">Date réalisation *</label>
                  <input required type="date" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={recordForm().performed_date ?? ""} onInput={rf("performed_date")} />
                </div>
                <div>
                  <label class="text-xs font-medium text-gray-600">Prochaine date</label>
                  <input type="date" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={recordForm().next_due_date ?? ""} onInput={rf("next_due_date")} />
                </div>
              </div>
              <div>
                <label class="text-xs font-medium text-gray-600">Résultat</label>
                <div class="flex gap-4 mt-2">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="compliant" value="true"
                      checked={recordForm().is_compliant === "true"}
                      onChange={() => setRecordForm(p=>({...p,is_compliant:"true"}))} />
                    <span class="text-sm text-emerald-600 font-medium">Conforme ✓</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="compliant" value="false"
                      checked={recordForm().is_compliant === "false"}
                      onChange={() => setRecordForm(p=>({...p,is_compliant:"false"}))} />
                    <span class="text-sm text-red-600 font-medium">Non conforme ✗</span>
                  </label>
                </div>
              </div>
              <div>
                <label class="text-xs font-medium text-gray-600">Notes</label>
                <textarea rows="2" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={recordForm().notes ?? ""} onInput={rf("notes")} />
              </div>
              <div class="flex justify-end gap-3">
                <button type="button" onClick={() => setShowRecord(null)} class="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
