import { useState, useEffect, useCallback } from "react";
import { Mail, MessageSquare, Server, Database, Activity, CreditCard, Wifi, WifiOff, TestTube, Settings, X, Eye, EyeOff } from "lucide-react";
import { getIntegrations, seedIntegrations, testIntegration, updateIntegration } from "@/services/api/system";
import StepUpDialog from "./StepUpDialog";

function Spinner() { return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"/></div>; }

const INTEGRATION_META: Record<string, { label: string; icon: React.ReactNode; fields: Array<{ key: string; label: string; secret?: boolean }> }> = {
  smtp:            { label: "SMTP / Email",         icon: <Mail className="w-6 h-6"/>,         fields: [{key:"host",label:"Hôte"},{key:"port",label:"Port"},{key:"from",label:"Expéditeur"},{key:"username",label:"Utilisateur"},{key:"password",label:"Mot de passe",secret:true}] },
  sms:             { label: "SMS",                   icon: <MessageSquare className="w-6 h-6"/>, fields: [{key:"provider",label:"Fournisseur"},{key:"apiUrl",label:"URL API"},{key:"apiKey",label:"Clé API",secret:true}] },
  whatsapp:        { label: "WhatsApp",              icon: <MessageSquare className="w-6 h-6"/>, fields: [{key:"apiUrl",label:"URL API"},{key:"token",label:"Token",secret:true}] },
  object_storage:  { label: "Stockage objet",        icon: <Server className="w-6 h-6"/>,        fields: [{key:"bucketId",label:"Bucket ID"},{key:"region",label:"Région"}] },
  pacs:            { label: "PACS Radiologie",       icon: <Activity className="w-6 h-6"/>,      fields: [{key:"host",label:"Hôte"},{key:"port",label:"Port"},{key:"aeTitle",label:"AE Title"}] },
  hl7:             { label: "HL7",                   icon: <Database className="w-6 h-6"/>,      fields: [{key:"host",label:"Hôte"},{key:"port",label:"Port"},{key:"version",label:"Version"}] },
  fhir:            { label: "FHIR",                  icon: <Database className="w-6 h-6"/>,      fields: [{key:"baseUrl",label:"URL de base"},{key:"apiKey",label:"Clé API",secret:true}] },
  payment_gateway: { label: "Passerelle de paiement",icon: <CreditCard className="w-6 h-6"/>,   fields: [{key:"provider",label:"Fournisseur"},{key:"apiKey",label:"Clé API",secret:true},{key:"webhookSecret",label:"Secret Webhook",secret:true}] },
};

interface Integration { id: string; type: string; label: string; configured: boolean; enabled: boolean; config_masked: Record<string,string>; last_test_at: string|null; last_success_at: string|null; last_error: string|null; }

export default function IntegrationsTab() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [selected, setSelected] = useState<Integration|null>(null);
  const [configForm, setConfigForm] = useState<Record<string,string>>({});
  const [showSecrets, setShowSecrets] = useState<Set<string>>(new Set());
  const [testResults, setTestResults] = useState<Record<string,string>>({});
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState<{id:string;data:Record<string,unknown>}|null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getIntegrations()
      .then(d => {
        const list = d.integrations || [];
        if (list.length === 0) return seedIntegrations().then(() => getIntegrations().then(d2 => setIntegrations(d2.integrations||[])));
        setIntegrations(list);
      })
      .catch(e => setError(e?.response?.data?.message||"Erreur serveur"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openConfig = (integ: Integration) => {
    setSelected(integ);
    const meta = INTEGRATION_META[integ.type];
    const initial: Record<string,string> = {};
    if (meta) meta.fields.forEach(f => { initial[f.key] = (integ.config_masked[f.key] === "****" ? "" : integ.config_masked[f.key]) || ""; });
    setConfigForm(initial);
  };

  const handleTest = async (id: string) => {
    setTestResults(prev => ({...prev,[id]:"testing"}));
    try {
      const r = await testIntegration(id);
      setTestResults(prev => ({...prev,[id]:r.note||"Testé"}));
    } catch (e: any) {
      setTestResults(prev => ({...prev,[id]:e?.response?.data?.message||"Erreur"}));
    }
  };

  const handleSaveInit = () => {
    if (!selected) return;
    const hasSecret = Object.keys(configForm).some(k => {
      const meta = INTEGRATION_META[selected.type];
      const field = meta?.fields.find(f => f.key===k);
      return field?.secret && configForm[k];
    });
    if (hasSecret) { setPendingSave({id:selected.id,data:{config:configForm}}); setStepUpOpen(true); }
    else handleSave(selected.id, {config:configForm});
  };

  const handleSave = async (id: string, data: Record<string,unknown>, _token?: string) => {
    setSaving(true);
    try {
      await updateIntegration(id, data);
      load(); setSelected(null);
    } catch (e: any) { setError(e?.response?.data?.message||"Erreur lors de la sauvegarde"); }
    finally { setSaving(false); }
  };

  const handleStepUpSuccess = (token: string) => {
    if (pendingSave) { handleSave(pendingSave.id, pendingSave.data, token); setPendingSave(null); }
  };

  if (loading) return <Spinner />;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-gray-900">Intégrations</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {integrations.map(integ => {
          const meta = INTEGRATION_META[integ.type] || { label: integ.label, icon: <Server className="w-6 h-6"/>, fields: [] };
          return (
            <div key={integ.id} className={`border-2 rounded-xl p-4 space-y-3 bg-white transition-colors ${integ.configured ? "border-green-200":"border-gray-200"}`}>
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-lg ${integ.configured ? "bg-green-50 text-green-700":"bg-gray-50 text-gray-400"}`}>{meta.icon}</div>
                <div className="flex items-center gap-1">
                  {integ.enabled ? <Wifi className="w-4 h-4 text-green-500"/> : <WifiOff className="w-4 h-4 text-gray-300"/>}
                </div>
              </div>
              <div>
                <div className="font-medium text-sm text-gray-900">{meta.label}</div>
                <div className={`text-xs mt-0.5 ${integ.configured ? "text-green-600":"text-gray-400"}`}>
                  {integ.configured ? "Configurée" : "Non configurée"}
                </div>
                {integ.last_error && <div className="text-xs text-red-500 mt-1 truncate">{integ.last_error}</div>}
                {testResults[integ.id] && testResults[integ.id] !== "testing" && (
                  <div className="text-xs text-blue-600 mt-1 line-clamp-2">{testResults[integ.id]}</div>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => openConfig(integ)} className="flex-1 flex items-center justify-center gap-1 text-xs border rounded-lg px-2 py-1.5 hover:bg-gray-50">
                  <Settings className="w-3 h-3"/> Config
                </button>
                <button onClick={() => handleTest(integ.id)} disabled={testResults[integ.id]==="testing"} className="flex-1 flex items-center justify-center gap-1 text-xs border rounded-lg px-2 py-1.5 hover:bg-gray-50 disabled:opacity-50">
                  <TestTube className="w-3 h-3"/> Tester
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Config panel */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-end sm:items-center justify-end">
          <div className="bg-white w-full sm:max-w-md h-full sm:h-auto sm:max-h-screen overflow-y-auto p-6 space-y-4 sm:m-4 sm:rounded-xl shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{INTEGRATION_META[selected.type]?.label || selected.label}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            {INTEGRATION_META[selected.type]?.fields.map(field => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{field.label}</label>
                <div className="relative">
                  <input
                    type={field.secret && !showSecrets.has(field.key) ? "password" : "text"}
                    value={configForm[field.key]||""}
                    onChange={e => setConfigForm(f=>({...f,[field.key]:e.target.value}))}
                    placeholder={field.secret && selected.config_masked[field.key]==="****" ? "••••••••" : ""}
                    className="w-full border rounded-lg px-3 py-2 text-sm pr-8"
                  />
                  {field.secret && (
                    <button onClick={() => setShowSecrets(s => { const n=new Set(s); n.has(field.key)?n.delete(field.key):n.add(field.key); return n; })} className="absolute right-2 top-2 text-gray-400">
                      {showSecrets.has(field.key) ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={!!selected.enabled} onChange={e => setSelected(s => s ? {...s,enabled:e.target.checked} : s)} className="rounded"/>
                Activée
              </label>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSaveInit} disabled={saving} className="flex-1 bg-indigo-600 text-white text-sm py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
              <button onClick={() => setSelected(null)} className="flex-1 border text-sm py-2 rounded-lg hover:bg-gray-50">Annuler</button>
            </div>
          </div>
        </div>
      )}
      <StepUpDialog open={stepUpOpen} onClose={() => setStepUpOpen(false)} onSuccess={handleStepUpSuccess} title="Modifier les identifiants" description="La modification de clés secrètes nécessite une authentification renforcée."/>
    </div>
  );
}
