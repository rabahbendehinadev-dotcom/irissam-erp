import { useState, useEffect, useCallback } from "react";
import { Settings, Save, RotateCcw } from "lucide-react";
import { getSystemSettings, updateSystemSettings, resetPasswordPolicy } from "@/services/api/system";
import StepUpDialog from "./StepUpDialog";

function Spinner() { return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"/></div>; }

interface SystemSettings {
  hospital_name: string; hospital_name_ar: string; logo_url: string; address: string; phone: string; email: string;
  currency: string; timezone: string; date_format: string; default_language: string;
  mrn_format: string; encounter_number_format: string; invoice_number_format: string; admission_number_format: string;
  backup_retention_days: number; session_duration_hours: number;
  password_policy: { minLength: number; requireUppercase: boolean; requireNumber: boolean; requireSymbol: boolean; maxAgeDays: number };
  notification_settings: { emailEnabled: boolean; smsEnabled: boolean; whatsappEnabled: boolean };
  pwa_settings: { offlineEnabled: boolean; pushEnabled: boolean };
}

const TIMEZONES = ["Africa/Algiers","Europe/Paris","Europe/London","UTC","America/New_York","Asia/Dubai"];
const LANGUAGES = [{ value:"fr",label:"Français" },{ value:"ar",label:"العربية" },{ value:"en",label:"English" }];
const DATE_FORMATS = ["DD/MM/YYYY","MM/DD/YYYY","YYYY-MM-DD","DD-MM-YYYY"];

export default function SettingsTab() {
  const [settings, setSettings] = useState<SystemSettings|null>(null);
  const [form, setForm] = useState<Partial<SystemSettings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [success, setSuccess] = useState<string|null>(null);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("identity");

  const load = useCallback(() => {
    setLoading(true);
    getSystemSettings().then(d => { const s = d.settings||d; setSettings(s); setForm(s); }).catch(e => setError(e?.response?.data?.message||"Erreur serveur")).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      await updateSystemSettings(form as Record<string,unknown>);
      setSuccess("Paramètres enregistrés."); setTimeout(() => setSuccess(null), 3000);
      load();
    } catch (e: any) { setError(e?.response?.data?.message||"Erreur lors de la sauvegarde"); }
    finally { setSaving(false); }
  };

  const handleResetPasswordPolicy = async (token: string) => {
    try {
      await resetPasswordPolicy(token);
      setSuccess("Politique de mots de passe réinitialisée."); setTimeout(() => setSuccess(null), 3000); load();
    } catch (e: any) { setError(e?.response?.data?.message||"Erreur"); }
  };

  const upd = (key: keyof SystemSettings, val: unknown) => setForm(f => ({ ...f, [key]: val }));
  const updPolicy = (key: string, val: unknown) => setForm(f => ({ ...f, password_policy: { ...(f.password_policy||settings?.password_policy||{}), [key]: val } as SystemSettings["password_policy"] }));
  const updNotif = (key: string, val: boolean) => setForm(f => ({ ...f, notification_settings: { ...(f.notification_settings||settings?.notification_settings||{}), [key]: val } as SystemSettings["notification_settings"] }));
  const updPwa = (key: string, val: boolean) => setForm(f => ({ ...f, pwa_settings: { ...(f.pwa_settings||settings?.pwa_settings||{}), [key]: val } as SystemSettings["pwa_settings"] }));

  if (loading) return <Spinner />;

  const SECTIONS = [
    { id:"identity",   label:"Identité" },
    { id:"regional",   label:"Régional" },
    { id:"formats",    label:"Formats" },
    { id:"security",   label:"Sécurité" },
    { id:"notifs",     label:"Notifications" },
    { id:"pwa",        label:"PWA" },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2"><Settings className="w-5 h-5 text-indigo-600"/><h2 className="text-lg font-semibold text-gray-900">Paramètres système</h2></div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          <Save className="w-4 h-4"/>{saving?"Enregistrement…":"Enregistrer tout"}
        </button>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 flex-wrap border-b pb-1">
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)} className={`px-3 py-1.5 text-sm rounded-t-lg transition-colors ${activeSection===s.id?"bg-indigo-50 text-indigo-700 border border-b-0 border-indigo-200":"text-gray-500 hover:text-gray-700"}`}>{s.label}</button>
        ))}
      </div>

      <div className="bg-white border rounded-xl p-4 space-y-4">
        {activeSection === "identity" && (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Nom de l'hôpital (Français) *</label><input value={form.hospital_name||""} onChange={e => upd("hospital_name",e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm"/></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">اسم المستشفى (Arabe)</label><input value={form.hospital_name_ar||""} onChange={e => upd("hospital_name_ar",e.target.value)} dir="rtl" className="w-full border rounded-lg px-3 py-2 text-sm"/></div>
            </div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">URL du logo</label><input value={form.logo_url||""} onChange={e => upd("logo_url",e.target.value)} placeholder="https://..." className="w-full border rounded-lg px-3 py-2 text-sm"/></div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Adresse</label><textarea value={form.address||""} onChange={e => upd("address",e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm"/></div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Téléphone</label><input value={form.phone||""} onChange={e => upd("phone",e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm"/></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Email</label><input type="email" value={form.email||""} onChange={e => upd("email",e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm"/></div>
            </div>
          </>
        )}

        {activeSection === "regional" && (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Devise</label><input value={form.currency||""} maxLength={3} onChange={e => upd("currency",e.target.value.toUpperCase())} className="w-full border rounded-lg px-3 py-2 text-sm font-mono"/></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Fuseau horaire</label>
                <select value={form.timezone||""} onChange={e => upd("timezone",e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {TIMEZONES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Format de date</label>
                <select value={form.date_format||""} onChange={e => upd("date_format",e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {DATE_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Langue par défaut</label>
                <select value={form.default_language||""} onChange={e => upd("default_language",e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
            </div>
          </>
        )}

        {activeSection === "formats" && (
          <>
            <div className="space-y-3">
              {[
                { key:"mrn_format",               label:"Format IPP / MRN",         hint:"{YYYY} {SEQ6}" },
                { key:"encounter_number_format",   label:"Format numéro d'encounter", hint:"ENC-{YYYY}-{SEQ6}" },
                { key:"invoice_number_format",     label:"Format numéro de facture",  hint:"INV-{YYYY}-{SEQ6}" },
                { key:"admission_number_format",   label:"Format numéro d'admission", hint:"ADM-{YYYY}-{SEQ6}" },
              ].map(({ key, label, hint }) => (
                <div key={key}><label className="block text-xs font-medium text-gray-700 mb-1">{label}</label><input value={(form as any)[key]||""} onChange={e => upd(key as keyof SystemSettings,e.target.value)} placeholder={hint} className="w-full border rounded-lg px-3 py-2 text-sm font-mono"/></div>
              ))}
            </div>
          </>
        )}

        {activeSection === "security" && (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Durée de session (heures, 1–72)</label><input type="number" min={1} max={72} value={form.session_duration_hours||8} onChange={e => upd("session_duration_hours",Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm"/></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Rétention sauvegardes (jours, 1–365)</label><input type="number" min={1} max={365} value={form.backup_retention_days||30} onChange={e => upd("backup_retention_days",Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm"/></div>
            </div>
            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-700">Politique de mots de passe</span>
                <button onClick={() => setStepUpOpen(true)} className="flex items-center gap-1 text-xs text-orange-600 hover:underline"><RotateCcw className="w-3 h-3"/> Réinitialiser</button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-600 mb-1">Longueur minimale</label><input type="number" min={6} max={32} value={form.password_policy?.minLength||8} onChange={e => updPolicy("minLength",Number(e.target.value))} className="w-full border rounded-lg px-2 py-1.5 text-sm"/></div>
                <div><label className="block text-xs text-gray-600 mb-1">Age max (jours, 0=illimité)</label><input type="number" min={0} max={365} value={form.password_policy?.maxAgeDays||90} onChange={e => updPolicy("maxAgeDays",Number(e.target.value))} className="w-full border rounded-lg px-2 py-1.5 text-sm"/></div>
              </div>
              <div className="flex flex-wrap gap-4">
                {[{key:"requireUppercase",label:"Majuscule requise"},{key:"requireNumber",label:"Chiffre requis"},{key:"requireSymbol",label:"Symbole requis"}].map(({key,label}) => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={!!(form.password_policy as any)?.[key]} onChange={e => updPolicy(key,e.target.checked)} className="rounded"/>
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {activeSection === "notifs" && (
          <div className="space-y-3">
            {[{key:"emailEnabled",label:"Email activé"},{key:"smsEnabled",label:"SMS activé"},{key:"whatsappEnabled",label:"WhatsApp activé"}].map(({key,label}) => (
              <label key={key} className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <span className="text-sm font-medium text-gray-700">{label}</span>
                <input type="checkbox" checked={!!(form.notification_settings as any)?.[key]} onChange={e => updNotif(key,e.target.checked)} className="rounded w-4 h-4"/>
              </label>
            ))}
          </div>
        )}

        {activeSection === "pwa" && (
          <div className="space-y-3">
            {[{key:"offlineEnabled",label:"Mode hors ligne activé"},{key:"pushEnabled",label:"Notifications push activées"}].map(({key,label}) => (
              <label key={key} className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <span className="text-sm font-medium text-gray-700">{label}</span>
                <input type="checkbox" checked={!!(form.pwa_settings as any)?.[key]} onChange={e => updPwa(key,e.target.checked)} className="rounded w-4 h-4"/>
              </label>
            ))}
          </div>
        )}
      </div>

      <StepUpDialog open={stepUpOpen} onClose={() => setStepUpOpen(false)} onSuccess={handleResetPasswordPolicy} title="Réinitialiser la politique" description="Cette action réinitialise la politique de mots de passe aux valeurs par défaut."/>
    </div>
  );
}
