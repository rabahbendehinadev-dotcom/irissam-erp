import { useState, useEffect, useCallback } from "react";
import { Wrench, AlertTriangle, CheckCircle, Shield, Trash2 } from "lucide-react";
import { getMaintenanceModeConfig, updateMaintenanceMode, purgeUatPatientData } from "@/services/api/system";
import { useAuth } from "@/store/AuthContext";
import StepUpDialog from "./StepUpDialog";

function Spinner() { return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"/></div>; }

interface MaintenanceConfig { id?: string; enabled: boolean; message: string; message_ar: string; message_en: string; start_at: string|null; end_at: string|null; allowed_roles: string[]; allowed_ips: string[]; updated_by?: string; updated_at?: string; }

const ROLES = ["super_admin","system_administrator","doctor","nurse"];
const CONFIRM_PHRASE = "MAINTENANCE";
const PURGE_PHRASE = "SUPPRIMER PATIENTS";

export default function MaintenanceTab() {
  const [config, setConfig] = useState<MaintenanceConfig|null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [success, setSuccess] = useState<string|null>(null);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<Record<string,unknown>|null>(null);
  const [confirmInput, setConfirmInput] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [editing, setEditing] = useState(false);

  // ── Purge des données patients UAT/Demo (Super Admin uniquement) ────────────
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);
  const [purgeInput, setPurgeInput] = useState("");
  const [purgeStepUpOpen, setPurgeStepUpOpen] = useState(false);
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [purgeCounts, setPurgeCounts] = useState<Record<string, number> | null>(null);

  const handlePurgeStepUp = async (token: string) => {
    setPurgeStepUpOpen(false);
    setPurgeBusy(true);
    setError(null);
    setPurgeCounts(null);
    try {
      const r = await purgeUatPatientData(token);
      setPurgeCounts(r?.counts ?? null);
      setSuccess(r?.message ?? "Purge UAT/Demo terminée.");
    } catch (e) {
      setError((e as { message?: string })?.message || "Erreur lors de la purge.");
    } finally {
      setPurgeBusy(false);
    }
  };
  const [form, setForm] = useState<Partial<MaintenanceConfig>>({});

  const load = useCallback(() => {
    setLoading(true);
    getMaintenanceModeConfig()
      .then(d => { setConfig(d.maintenance || d); setForm(d.maintenance || d); })
      .catch(e => setError(e?.response?.data?.message||"Erreur serveur"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const initiateToggle = (enable: boolean) => {
    setPendingUpdate({ enabled: enable, message: form.message, message_ar: form.message_ar, message_en: form.message_en, start_at: form.start_at || null, end_at: form.end_at || null, allowed_roles: form.allowed_roles, allowed_ips: form.allowed_ips });
    setConfirmInput("");
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    if (confirmInput !== CONFIRM_PHRASE) return;
    setShowConfirm(false);
    setStepUpOpen(true);
  };

  const handleStepUpSuccess = async (token: string) => {
    if (!pendingUpdate) return;
    try {
      await updateMaintenanceMode(pendingUpdate, token);
      setSuccess(pendingUpdate.enabled ? "Mode maintenance activé." : "Mode maintenance désactivé.");
      setTimeout(() => setSuccess(null), 4000);
      load(); setEditing(false);
    } catch (e: any) { setError(e?.response?.data?.message||"Erreur"); }
    setPendingUpdate(null);
  };

  const handleSaveSettings = () => {
    setPendingUpdate({ enabled: config?.enabled, ...form });
    setConfirmInput("");
    setShowConfirm(true);
  };

  if (loading) return <Spinner />;
  if (!config) return <div className="p-6 text-gray-400">Impossible de charger la configuration.</div>;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" onClick={() => setError(null)}>{error}</div>}
      {success && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="w-5 h-5"/>
              <h3 className="font-bold">Confirmer l'action</h3>
            </div>
            <p className="text-sm text-gray-600">
              Tapez <strong>{CONFIRM_PHRASE}</strong> pour confirmer cette opération sensible.
            </p>
            <input value={confirmInput} onChange={e => setConfirmInput(e.target.value)} placeholder={CONFIRM_PHRASE} className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-orange-400 focus:outline-none"/>
            <div className="flex gap-2">
              <button onClick={handleConfirm} disabled={confirmInput!==CONFIRM_PHRASE} className="flex-1 bg-orange-600 text-white py-2 rounded-lg text-sm disabled:opacity-40">Continuer</button>
              <button onClick={() => { setShowConfirm(false); setPendingUpdate(null); setConfirmInput(""); }} className="flex-1 border py-2 rounded-lg text-sm">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Status card */}
      <div className={`rounded-xl p-6 border-2 ${config.enabled ? "bg-orange-50 border-orange-300":"bg-green-50 border-green-200"}`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            {config.enabled ? <AlertTriangle className="w-8 h-8 text-orange-500"/> : <CheckCircle className="w-8 h-8 text-green-500"/>}
            <div>
              <div className={`text-xl font-bold ${config.enabled ? "text-orange-800":"text-green-800"}`}>
                {config.enabled ? "Mode Maintenance ACTIF" : "Système opérationnel"}
              </div>
              <div className={`text-sm ${config.enabled ? "text-orange-700":"text-green-700"}`}>
                {config.enabled ? "Les utilisateurs normaux voient une page 503." : "Tous les utilisateurs peuvent accéder au système."}
              </div>
            </div>
          </div>
          <button
            onClick={() => initiateToggle(!config.enabled)}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${config.enabled ? "bg-green-600 hover:bg-green-700 text-white":"bg-orange-600 hover:bg-orange-700 text-white"}`}
          >
            {config.enabled ? "Désactiver" : "Activer le mode maintenance"}
          </button>
        </div>
        {config.enabled && (
          <div className="mt-4 p-3 bg-orange-100 border border-orange-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-orange-600 mt-0.5 shrink-0"/>
              <div className="text-sm text-orange-800">
                <p className="font-medium">Message affiché aux utilisateurs :</p>
                <p className="mt-1 italic">"{config.message}"</p>
                {config.allowed_roles.length > 0 && (
                  <p className="mt-1">Rôles autorisés : {config.allowed_roles.join(", ")}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit settings */}
      <div className="border rounded-xl p-4 bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Configuration</h3>
          <button onClick={() => setEditing(!editing)} className="text-sm text-indigo-600 hover:underline">{editing?"Annuler":"Modifier"}</button>
        </div>
        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Message (Français)</label>
              <textarea value={form.message||""} onChange={e => setForm(f=>({...f,message:e.target.value}))} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Message (Arabe)</label>
              <textarea value={form.message_ar||""} onChange={e => setForm(f=>({...f,message_ar:e.target.value}))} rows={2} dir="rtl" className="w-full border rounded-lg px-3 py-2 text-sm"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Message (English)</label>
              <textarea value={form.message_en||""} onChange={e => setForm(f=>({...f,message_en:e.target.value}))} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm"/>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Début (optionnel)</label>
                <input type="datetime-local" value={form.start_at||""} onChange={e => setForm(f=>({...f,start_at:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Fin (optionnel)</label>
                <input type="datetime-local" value={form.end_at||""} onChange={e => setForm(f=>({...f,end_at:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm"/>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Rôles autorisés pendant la maintenance</label>
              <div className="flex flex-wrap gap-2">
                {ROLES.map(r => (
                  <label key={r} className="flex items-center gap-1 text-sm cursor-pointer">
                    <input type="checkbox" checked={(form.allowed_roles||[]).includes(r)} onChange={e => setForm(f => ({ ...f, allowed_roles: e.target.checked ? [...(f.allowed_roles||[]),r] : (f.allowed_roles||[]).filter(x=>x!==r) }))} className="rounded"/>
                    {r}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">IPs autorisées (séparées par virgule)</label>
              <input value={(form.allowed_ips||[]).join(",")} onChange={e => setForm(f=>({...f,allowed_ips:e.target.value.split(",").map(s=>s.trim()).filter(Boolean)}))} placeholder="127.0.0.1, 10.0.0.1" className="w-full border rounded-lg px-3 py-2 text-sm"/>
            </div>
            <button onClick={handleSaveSettings} className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700">
              Enregistrer (Step-up requis)
            </button>
          </div>
        ) : (
          <div className="space-y-2 text-sm text-gray-600">
            <div><span className="font-medium">Message FR:</span> {config.message}</div>
            <div><span className="font-medium">Message AR:</span> {config.message_ar}</div>
            <div><span className="font-medium">Rôles autorisés:</span> {config.allowed_roles.join(", ") || "Aucun"}</div>
            {config.start_at && <div><span className="font-medium">Début:</span> {new Date(config.start_at).toLocaleString("fr-FR")}</div>}
            {config.end_at && <div><span className="font-medium">Fin:</span> {new Date(config.end_at).toLocaleString("fr-FR")}</div>}
          </div>
        )}
      </div>

      {/* ── Zone de danger — purge des données patients UAT/Demo (Super Admin) ── */}
      {isSuperAdmin && (
        <div className="border-2 border-red-300 rounded-xl p-4 bg-red-50">
          <div className="flex flex-col sm:flex-row items-start gap-3">
            <Trash2 className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-red-800">Zone de danger — Données patients (UAT/Demo)</h3>
              <p className="text-sm text-red-700 mt-1">
                Supprime <strong>TOUTES</strong> les données patients : dossiers, épisodes, admissions,
                consultations, rendez-vous, urgences, hospitalisations, réanimation, bloc opératoire,
                laboratoire, imagerie, prescriptions, factures, paiements, assurance patient, documents,
                portail patient, historiques et notifications liés. Les lits, box et ambulances sont libérés.
              </p>
              <p className="text-xs text-red-600 mt-1">
                Sont CONSERVÉS : utilisateurs, rôles, permissions, départements, employés, médicaments,
                catalogues, stock, définitions des lits/salles, organismes d'assurance, paramètres système.
                Action IRRÉVERSIBLE — exécutée via le script sécurisé (transaction unique + garde-fou).
              </p>
              {purgeCounts && (
                <div className="mt-2 text-xs font-mono text-red-800 bg-red-100 border border-red-200 rounded-lg p-2 break-words">
                  {Object.entries(purgeCounts).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                </div>
              )}
            </div>
            <button
              onClick={() => { setPurgeInput(""); setPurgeConfirmOpen(true); }}
              disabled={purgeBusy}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 shrink-0 w-full sm:w-auto"
            >
              {purgeBusy ? "Purge en cours…" : "Supprimer toutes les données patients UAT/Demo"}
            </button>
          </div>
        </div>
      )}

      {/* Confirmation très forte : phrase exacte à saisir avant le step-up */}
      {purgeConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold">Purge TOTALE des données patients</h3>
            </div>
            <p className="text-sm text-gray-600">
              Cette action supprime définitivement TOUS les patients et leurs données liées.
              Elle est <strong>IRRÉVERSIBLE</strong>. Tapez{" "}
              <strong className="font-mono">{PURGE_PHRASE}</strong> pour continuer,
              puis confirmez avec votre mot de passe.
            </p>
            <input
              value={purgeInput}
              onChange={e => setPurgeInput(e.target.value)}
              placeholder={PURGE_PHRASE}
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-red-400 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { if (purgeInput === PURGE_PHRASE) { setPurgeConfirmOpen(false); setPurgeStepUpOpen(true); } }}
                disabled={purgeInput !== PURGE_PHRASE}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm disabled:opacity-40"
              >
                Continuer
              </button>
              <button
                onClick={() => { setPurgeConfirmOpen(false); setPurgeInput(""); }}
                className="flex-1 border py-2 rounded-lg text-sm"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      <StepUpDialog open={stepUpOpen} onClose={() => setStepUpOpen(false)} onSuccess={handleStepUpSuccess} title="Modifier le mode maintenance" description="Cette opération sensible nécessite une re-authentification."/>
      <StepUpDialog open={purgeStepUpOpen} onClose={() => setPurgeStepUpOpen(false)} onSuccess={handlePurgeStepUp} title="Purger les données patients UAT/Demo" description="Confirmation finale : saisissez votre mot de passe pour exécuter la purge irréversible."/>
    </div>
  );
}
