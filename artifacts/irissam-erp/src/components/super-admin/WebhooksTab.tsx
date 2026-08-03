import { useState, useEffect, useCallback } from "react";
import { Webhook, Plus, Trash2, Play, RotateCw, ChevronDown, ChevronRight, CheckCircle, XCircle } from "lucide-react";
import { getWebhooks, createWebhook, updateWebhook, deleteWebhook, testWebhook, getWebhookDeliveries, retryWebhookDelivery } from "@/services/api/system";

function Spinner() { return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"/></div>; }

const EVENTS = ["patient.created","admission.created","lab.result.validated","invoice.paid","claim.approved","stock.low","employee.created","discharge.completed"];

interface WebhookItem { id: string; name: string; endpoint_url: string; events: string[]; active: boolean; last_delivery_at: string|null; last_status: number|null; failure_count: number; created_at: string; }
interface Delivery { id: string; event: string; status_code: number|null; response_body: string|null; error_message: string|null; attempt: number; delivered_at: string; }

export default function WebhooksTab() {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedLogs, setSelectedLogs] = useState<string|null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [testResult, setTestResult] = useState<Record<string,{statusCode?:number;success?:boolean;error?:string}>>({});
  const [form, setForm] = useState({ name:"", endpointUrl:"", events:[] as string[], secret:"" });
  const [deleting, setDeleting] = useState<string|null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getWebhooks().then(d => setWebhooks(d.webhooks||[])).catch(e => setError(e?.response?.data?.message||"Erreur serveur")).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadDeliveries = (id: string) => {
    if (selectedLogs === id) { setSelectedLogs(null); return; }
    setSelectedLogs(id); setDeliveriesLoading(true);
    getWebhookDeliveries(id).then(d => setDeliveries(d.deliveries||[])).catch(() => setDeliveries([])).finally(() => setDeliveriesLoading(false));
  };

  const handleTest = async (id: string) => {
    try {
      const r = await testWebhook(id);
      setTestResult(prev => ({...prev, [id]: r}));
    } catch (e: any) { setTestResult(prev => ({...prev, [id]: { error: e?.response?.data?.message||"Erreur" }})); }
  };

  const handleCreate = async () => {
    try {
      await createWebhook({ name: form.name, endpointUrl: form.endpointUrl, events: form.events, secret: form.secret });
      setForm({ name:"", endpointUrl:"", events:[], secret:"" }); setShowCreate(false); load();
    } catch (e: any) { setError(e?.response?.data?.message||"Erreur"); }
  };

  const handleDelete = async (id: string) => {
    try { await deleteWebhook(id); load(); } catch (e: any) { setError(e?.response?.data?.message||"Erreur"); }
    setDeleting(null);
  };

  if (loading) return <Spinner />;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Webhook className="w-5 h-5 text-indigo-600"/>
          <h2 className="text-lg font-semibold text-gray-900">Webhooks</h2>
          <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{webhooks.length}</span>
        </div>
        <button onClick={() => setShowCreate(v => !v)} className="flex items-center gap-1 bg-indigo-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-indigo-700">
          <Plus className="w-4 h-4"/> Ajouter
        </button>
      </div>

      {showCreate && (
        <div className="border border-indigo-200 bg-indigo-50 rounded-xl p-4 space-y-3">
          <h3 className="font-medium text-indigo-900">Nouveau webhook</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nom *</label>
              <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Mon webhook"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">URL endpoint *</label>
              <input value={form.endpointUrl} onChange={e => setForm(f=>({...f,endpointUrl:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="https://"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Secret HMAC</label>
            <input type="password" value={form.secret} onChange={e => setForm(f=>({...f,secret:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Clé secrète pour la signature"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Événements</label>
            <div className="flex flex-wrap gap-2">
              {EVENTS.map(ev => (
                <label key={ev} className="flex items-center gap-1 text-xs cursor-pointer">
                  <input type="checkbox" checked={form.events.includes(ev)} onChange={e => setForm(f => ({...f, events: e.target.checked ? [...f.events,ev] : f.events.filter(x=>x!==ev)}))}/>
                  {ev}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={!form.name||!form.endpointUrl} className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">Créer</button>
            <button onClick={() => setShowCreate(false)} className="border text-sm px-4 py-2 rounded-lg hover:bg-gray-50">Annuler</button>
          </div>
        </div>
      )}

      {webhooks.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Webhook className="w-12 h-12 mx-auto mb-3 opacity-30"/>
          <p>Aucun webhook configuré</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map(w => (
            <div key={w.id} className="border rounded-xl bg-white overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{w.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${w.active ? "bg-green-100 text-green-700":"bg-gray-100 text-gray-500"}`}>{w.active?"Actif":"Inactif"}</span>
                      {w.failure_count > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{w.failure_count} échec(s)</span>}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 truncate">{w.endpoint_url}</div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {w.events.slice(0,4).map(ev => <span key={ev} className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded">{ev}</span>)}
                      {w.events.length > 4 && <span className="text-xs text-gray-400">+{w.events.length-4}</span>}
                    </div>
                    {w.last_delivery_at && (
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                        {w.last_status && w.last_status < 300 ? <CheckCircle className="w-3 h-3 text-green-500"/> : <XCircle className="w-3 h-3 text-red-500"/>}
                        Dernier envoi {new Date(w.last_delivery_at).toLocaleString("fr-FR")}
                        {w.last_status && <span> · HTTP {w.last_status}</span>}
                      </div>
                    )}
                    {testResult[w.id] && (
                      <div className={`text-xs mt-1 ${testResult[w.id].success ? "text-green-700":"text-red-700"}`}>
                        {testResult[w.id].success ? `✓ Test réussi (HTTP ${testResult[w.id].statusCode})` : `✗ ${testResult[w.id].error || `HTTP ${testResult[w.id].statusCode}`}`}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleTest(w.id)} title="Tester" className="p-1.5 text-gray-400 hover:text-indigo-600 rounded"><Play className="w-4 h-4"/></button>
                    <button onClick={() => loadDeliveries(w.id)} title="Logs livraison" className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
                      {selectedLogs===w.id ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                    </button>
                    <button onClick={() => setDeleting(w.id)} title="Supprimer" className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 className="w-4 h-4"/></button>
                  </div>
                </div>
                {deleting === w.id && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700 mb-2">Supprimer ce webhook ?</p>
                    <div className="flex gap-2">
                      <button onClick={() => handleDelete(w.id)} className="bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg">Supprimer</button>
                      <button onClick={() => setDeleting(null)} className="border text-xs px-3 py-1.5 rounded-lg">Annuler</button>
                    </div>
                  </div>
                )}
              </div>
              {selectedLogs === w.id && (
                <div className="border-t bg-gray-50 p-3">
                  <h4 className="text-xs font-medium text-gray-600 mb-2">Journaux de livraison</h4>
                  {deliveriesLoading ? <div className="text-xs text-gray-400">Chargement…</div> : deliveries.length === 0 ? <div className="text-xs text-gray-400">Aucune livraison enregistrée</div> : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {deliveries.map(d => (
                        <div key={d.id} className="flex items-start gap-2 text-xs">
                          {d.status_code && d.status_code < 300 ? <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 shrink-0"/> : <XCircle className="w-3 h-3 text-red-500 mt-0.5 shrink-0"/>}
                          <div className="min-w-0">
                            <span className="font-medium">{d.event}</span> · HTTP {d.status_code||"N/A"} · {new Date(d.delivered_at).toLocaleString("fr-FR")}
                            {d.error_message && <div className="text-red-600 truncate">{d.error_message}</div>}
                          </div>
                          {d.status_code && d.status_code >= 400 && (
                            <button onClick={() => retryWebhookDelivery(w.id, d.id).then(() => loadDeliveries(w.id)).catch(()=>{})} className="ml-auto shrink-0 p-1 text-gray-400 hover:text-indigo-600"><RotateCw className="w-3 h-3"/></button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
