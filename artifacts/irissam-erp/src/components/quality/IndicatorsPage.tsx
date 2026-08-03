import { createSignal, createResource, For, Show } from "solid-js";
import { getIndicators, createIndicator, addIndicatorValue, getIndicatorValues } from "@/services/api/quality";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

export default function IndicatorsPage() {
  const [showCreate, setShowCreate] = createSignal(false);
  const [valueTarget, setValueTarget] = createSignal<any>(null);
  const [expandedId, setExpandedId] = createSignal<string|null>(null);
  const [form, setForm] = createSignal<Record<string,any>>({ unit:"%", frequency:"mensuel" });
  const [vForm, setVForm] = createSignal<Record<string,any>>({});

  const [data, { refetch }] = createResource(getIndicators);
  const [histData] = createResource(expandedId, id => id ? getIndicatorValues(id) : null);

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    try { await createIndicator(form()); setShowCreate(false); setForm({ unit:"%", frequency:"mensuel" }); refetch(); }
    catch(err: any) { alert(err?.response?.data?.error ?? "Erreur"); }
  };

  const handleAddValue = async (e: Event) => {
    e.preventDefault();
    try {
      await addIndicatorValue(valueTarget().id, vForm());
      setValueTarget(null); setVForm({}); refetch();
    } catch(err: any) { alert(err?.response?.data?.error ?? "Erreur"); }
  };

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));
  const vf = (k: string) => (e: any) => setVForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div class="space-y-4">
      <div class="flex justify-end">
        <button onClick={() => setShowCreate(true)} class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Nouvel indicateur
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Show when={data.loading}><div class="col-span-3 text-center py-10 text-gray-400">Chargement…</div></Show>
        <For each={data()?.data}>
          {(ind: any) => {
            const lastVal = ind.last_value !== null ? Number(ind.last_value) : null;
            const target = ind.target_value !== null ? Number(ind.target_value) : null;
            const alert = ind.alert_threshold !== null ? Number(ind.alert_threshold) : null;
            const isAlert = lastVal !== null && alert !== null && lastVal > alert;
            const isExpanded = expandedId() === ind.id;
            return (
              <div class={`bg-white rounded-xl border shadow-sm p-4 ${isAlert ? "border-red-200" : "border-gray-100"}`}>
                <div class="flex items-start justify-between mb-2">
                  <div>
                    <p class="font-semibold text-gray-900 text-sm">{ind.name}</p>
                    <p class="text-xs font-mono text-gray-400">{ind.reference}</p>
                  </div>
                  <div class="text-right">
                    <p class={`text-2xl font-bold ${isAlert ? "text-red-600" : "text-gray-900"}`}>
                      {lastVal !== null ? lastVal.toFixed(1) : "—"}
                      <span class="text-xs font-normal ml-1">{ind.unit}</span>
                    </p>
                    {target !== null && <p class="text-xs text-gray-400">Cible: {target} {ind.unit}</p>}
                  </div>
                </div>
                <div class="flex items-center gap-2 text-xs text-gray-500">
                  {ind.category && <span class="px-2 py-0.5 bg-gray-100 rounded-full">{ind.category}</span>}
                  <span>{ind.frequency}</span>
                  {ind.trend === "amelioration" && <span class="text-emerald-600">📈</span>}
                  {ind.trend === "degradation" && <span class="text-red-600">📉</span>}
                  {ind.trend === "stable" && <span class="text-gray-500">➡️</span>}
                </div>
                <div class="flex gap-2 mt-3">
                  <button onClick={() => setValueTarget(ind)} class="text-xs text-indigo-600 hover:text-indigo-800 font-medium">+ Saisir valeur</button>
                  <button onClick={() => setExpandedId(isExpanded ? null : ind.id)} class="text-xs text-gray-500 hover:text-gray-700">
                    {isExpanded ? "Masquer courbe" : "Voir courbe"}
                  </button>
                </div>
                <Show when={isExpanded && histData()?.data?.length}>
                  <div class="mt-3">
                    <ResponsiveContainer width="100%" height={140}>
                      <LineChart data={[...(histData()?.data ?? [])].reverse().map((v: any) => ({
                        p: v.period_label, v: Number(v.value),
                      }))}>
                        <XAxis dataKey="p" tick={{ fontSize: 8 }} />
                        <YAxis tick={{ fontSize: 9 }} />
                        <Tooltip formatter={(v: any) => `${v} ${ind.unit}`} />
                        {target !== null && <ReferenceLine y={target} stroke="#10B981" strokeDasharray="4 2" label={{ value:"Cible", fontSize:8, fill:"#10B981" }} />}
                        <Line type="monotone" dataKey="v" stroke="#6366F1" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Show>
              </div>
            );
          }}
        </For>
      </div>

      {/* Create indicator modal */}
      <Show when={showCreate()}>
        <div class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div class="flex items-center justify-between p-6 border-b">
              <h2 class="text-lg font-semibold">Nouvel indicateur qualité</h2>
              <button onClick={() => setShowCreate(false)} class="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} class="p-6 space-y-4">
              <div><label class="text-xs font-medium text-gray-600">Nom *</label>
                <input required class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().name ?? ""} onInput={f("name")} /></div>
              <div class="grid grid-cols-2 gap-3">
                <div><label class="text-xs font-medium text-gray-600">Unité</label>
                  <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().unit ?? "%"} onInput={f("unit")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Fréquence</label>
                  <select class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().frequency ?? "mensuel"} onChange={e => setForm(p=>({...p,frequency:e.currentTarget.value}))}>
                    {["quotidien","hebdomadaire","mensuel","trimestriel","annuel"].map(t => <option value={t}>{t}</option>)}</select></div>
                <div><label class="text-xs font-medium text-gray-600">Valeur cible</label>
                  <input type="number" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().target_value ?? ""} onInput={f("target_value")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Seuil alerte</label>
                  <input type="number" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().alert_threshold ?? ""} onInput={f("alert_threshold")} /></div>
                <div class="col-span-2"><label class="text-xs font-medium text-gray-600">Catégorie</label>
                  <input class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form().category ?? ""} onInput={f("category")} /></div>
              </div>
              <div class="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} class="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Créer</button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Add value modal */}
      <Show when={valueTarget()}>
        <div class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div class="flex items-center justify-between p-6 border-b">
              <h2 class="text-lg font-semibold">Saisir valeur — {valueTarget()?.name}</h2>
              <button onClick={() => setValueTarget(null)} class="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleAddValue} class="p-6 space-y-4">
              <div class="grid grid-cols-2 gap-3">
                <div class="col-span-2"><label class="text-xs font-medium text-gray-600">Période *</label>
                  <input required placeholder="ex: 2026-07" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={vForm().period_label ?? ""} onInput={vf("period_label")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Début période</label>
                  <input type="date" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={vForm().period_start ?? ""} onInput={vf("period_start")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Fin période</label>
                  <input type="date" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={vForm().period_end ?? ""} onInput={vf("period_end")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Valeur * ({valueTarget()?.unit})</label>
                  <input required type="number" step="any" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={vForm().value ?? ""} onInput={vf("value")} /></div>
                <div><label class="text-xs font-medium text-gray-600">Tendance</label>
                  <select class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={vForm().trend ?? ""} onChange={vf("trend")}>
                    <option value="">—</option>
                    <option value="amelioration">📈 Amélioration</option>
                    <option value="stable">➡️ Stable</option>
                    <option value="degradation">📉 Dégradation</option>
                  </select></div>
              </div>
              <div class="flex justify-end gap-3">
                <button type="button" onClick={() => setValueTarget(null)} class="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
