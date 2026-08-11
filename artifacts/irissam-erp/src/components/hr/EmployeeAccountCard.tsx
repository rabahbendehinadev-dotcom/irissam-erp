/**
 * EmployeeAccountCard — carte « Compte ERP » de la fiche employé.
 *
 * Sans compte : bouton « Créer un compte ERP » (permission admin.users)
 * → email + rôle + mot de passe provisoire (changement forcé au 1er login).
 * Avec compte : email / rôle / statut / dernier login + actions
 * Suspendre / Réactiver / Réinitialiser le mot de passe.
 */
import { useState } from "react";
import { useQuery } from "@/hooks/useQuery";
import { apiClient } from "@/lib/api-client";
import { usePermission } from "@/hooks/usePermission";
import { KeyRound, ShieldCheck, ShieldOff, RotateCcw, X, Copy, Check } from "lucide-react";

interface AccountInfo {
  id: string;
  email: string;
  account_status: string;
  last_login_at: string | null;
  force_password_change: boolean;
  role_name: string | null;
  role_display: string | null;
}

interface Props {
  employeeId: string;
  employeeStatus: string;
  account: AccountInfo | null;
  defaultEmail?: string;
  onChanged: () => void;
}

function genPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes).map(b => chars[b % chars.length]).join("");
}

export function EmployeeAccountCard({ employeeId, employeeStatus, account, defaultEmail, onChanged }: Props) {
  const { can } = usePermission();
  const canAdmin = can("admin.users");
  const [showCreate, setShowCreate] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const toggleAccountStatus = async () => {
    if (!account) return;
    const suspend = account.account_status === "active";
    const q = suspend
      ? "Suspendre ce compte ERP ? L'utilisateur ne pourra plus se connecter."
      : "Réactiver ce compte ERP ? L'utilisateur pourra de nouveau se connecter.";
    if (!window.confirm(q)) return;
    setBusy(true); setMsg(null);
    try {
      await apiClient.post(`/system/users/${account.id}/status`, {
        action: suspend ? "suspend" : "activate",
        reason: "Via fiche employé",
      });
      onChanged();
    } catch (e: any) {
      setMsg(e?.data?.error ?? e?.message ?? "Erreur");
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-1.5">
          <KeyRound className="w-4 h-4 text-indigo-500"/> Compte ERP
        </h3>
        {account && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            account.account_status === "active" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
            {account.account_status === "active" ? "Actif" : "Suspendu"}
          </span>
        )}
      </div>

      {!account && (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">Aucun compte utilisateur lié à cette fiche.</p>
          {canAdmin && employeeStatus !== "archive" && (
            <button onClick={() => setShowCreate(true)}
              className="w-full px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              Créer un compte ERP
            </button>
          )}
          {!canAdmin && (
            <p className="text-xs text-gray-400">La création de comptes est réservée à l'administration (admin.users).</p>
          )}
        </div>
      )}

      {account && (
        <div className="space-y-2 text-sm">
          <Row label="Email" value={account.email}/>
          <Row label="Rôle" value={account.role_display ?? account.role_name ?? "—"}/>
          <Row label="Dernier login" value={account.last_login_at ? new Date(account.last_login_at).toLocaleString("fr-FR") : "Jamais connecté"}/>
          {account.force_password_change && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
              Changement de mot de passe requis au prochain login.
            </p>
          )}
          {msg && <p className="text-xs text-red-600">{msg}</p>}
          {canAdmin && (
            <div className="flex gap-2 pt-1">
              <button onClick={toggleAccountStatus} disabled={busy}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-lg border disabled:opacity-50 ${
                  account.account_status === "active"
                    ? "border-orange-200 text-orange-700 hover:bg-orange-50"
                    : "border-green-200 text-green-700 hover:bg-green-50"}`}>
                {account.account_status === "active"
                  ? <><ShieldOff className="w-3.5 h-3.5"/> Suspendre</>
                  : <><ShieldCheck className="w-3.5 h-3.5"/> Réactiver</>}
              </button>
              <button onClick={() => setShowReset(true)} disabled={busy}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                <RotateCcw className="w-3.5 h-3.5"/> Réinit. mot de passe
              </button>
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <CreateAccountModal
          employeeId={employeeId}
          defaultEmail={defaultEmail}
          onClose={() => setShowCreate(false)}
          onDone={() => { setShowCreate(false); onChanged(); }}
        />
      )}
      {showReset && account && (
        <ResetPasswordModal
          userId={account.id}
          email={account.email}
          onClose={() => setShowReset(false)}
          onDone={() => { setShowReset(false); onChanged(); }}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-400 shrink-0 w-28">{label}</span>
      <span className="text-gray-800 font-medium break-all">{value}</span>
    </div>
  );
}

function PasswordField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <label className="text-xs font-medium text-gray-700">Mot de passe provisoire * (min. 8 caractères)</label>
      <div className="flex gap-2 mt-1">
        <input value={value} onChange={e => onChange(e.target.value)}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"/>
        <button type="button" onClick={() => onChange(genPassword())}
          className="px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">Générer</button>
        <button type="button" disabled={!value}
          onClick={() => { navigator.clipboard?.writeText(value).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">
          {copied ? <Check className="w-3.5 h-3.5 text-green-600"/> : <Copy className="w-3.5 h-3.5"/>}
        </button>
      </div>
      <p className="text-[11px] text-gray-400 mt-1">L'utilisateur devra le changer à sa première connexion.</p>
    </div>
  );
}

function CreateAccountModal({ employeeId, defaultEmail, onClose, onDone }: {
  employeeId: string; defaultEmail?: string; onClose: () => void; onDone: () => void;
}) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [roleId, setRoleId] = useState("");
  const [password, setPassword] = useState(genPassword());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { data: roles } = useQuery<any[]>("/system/users/roles");

  const valid = email.trim().length > 3 && email.includes("@") && roleId && password.length >= 8;

  async function submit() {
    setSaving(true); setErr(null);
    try {
      await apiClient.post(`/hr/employees/${employeeId}/account`, {
        email: email.trim(), roleId, tempPassword: password,
      });
      onDone();
    } catch (e: any) {
      setErr(e?.data?.error ?? e?.message ?? "Erreur lors de la création du compte");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Créer un compte ERP</h2>
          <button onClick={onClose}><X className="w-5 h-5"/></button>
        </div>
        {err && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{err}</div>}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-700">Email de connexion *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"/>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700">Rôle (permissions) *</label>
            <select value={roleId} onChange={e => setRoleId(e.target.value)}
              className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none">
              <option value="">— Sélectionner un rôle —</option>
              {Array.isArray(roles) && roles.map((r: any) => (
                <option key={r.id} value={r.id}>{r.display_name}</option>
              ))}
            </select>
          </div>
          <PasswordField value={password} onChange={setPassword}/>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
          <button onClick={submit} disabled={saving || !valid}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? "Création…" : "Créer le compte"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordModal({ userId, email, onClose, onDone }: {
  userId: string; email: string; onClose: () => void; onDone: () => void;
}) {
  const [password, setPassword] = useState(genPassword());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setSaving(true); setErr(null);
    try {
      await apiClient.post(`/system/users/${userId}/reset-password`, { tempPassword: password });
      onDone();
    } catch (e: any) {
      setErr(e?.data?.error ?? e?.message ?? "Erreur lors de la réinitialisation");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Réinitialiser le mot de passe</h2>
          <button onClick={onClose}><X className="w-5 h-5"/></button>
        </div>
        <p className="text-sm text-gray-500">Compte : <span className="font-medium text-gray-800">{email}</span></p>
        {err && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{err}</div>}
        <PasswordField value={password} onChange={setPassword}/>
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
          Toutes les sessions ouvertes de ce compte seront déconnectées.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
          <button onClick={submit} disabled={saving || password.length < 8}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? "…" : "Réinitialiser"}
          </button>
        </div>
      </div>
    </div>
  );
}
