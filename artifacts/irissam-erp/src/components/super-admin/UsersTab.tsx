/**
 * UsersTab — « Comptes ERP » : console d'administration des comptes utilisateurs.
 *
 * Liste des comptes avec employé RH lié, rôle, statut et dernier login.
 * Actions (admin.users) : changer le rôle, lier / détacher une fiche employé,
 * suspendre / réactiver, réinitialiser le mot de passe (provisoire, changement
 * forcé au premier login), consulter le journal d'activité du compte.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@/hooks/useQuery";
import {
  getErpRoles, getLinkCandidates, updateErpUser, setErpUserStatus,
  resetErpUserPassword, getErpUserActivity,
} from "@/services/api/system";
import {
  Users, ShieldCheck, ShieldOff, RotateCcw, History, UserCog, Link2,
  Search, X, Copy, Check, AlertTriangle,
} from "lucide-react";

/* ── helpers ─────────────────────────────────────────────────────────────── */

function genPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes).map(b => chars[b % chars.length]).join("");
}
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString("fr-FR") : "—");
const errMsg = (e: any, fallback: string) => e?.data?.error ?? e?.message ?? fallback;

interface ErpUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  legacy_role: string;
  account_status: string;
  last_login_at: string | null;
  force_password_change: boolean;
  locked_until: string | null;
  employee_number: string | null;
  role_name: string | null;
  role_display: string | null;
  employee_id: string | null;
  employee_matricule: string | null;
  employee_first_name: string | null;
  employee_last_name: string | null;
  employee_status: string | null;
}

/* ── composant principal ─────────────────────────────────────────────────── */

export default function UsersTab() {
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [modal, setModal] = useState<
    | { kind: "role"; user: ErpUser }
    | { kind: "link"; user: ErpUser }
    | { kind: "reset"; user: ErpUser }
    | { kind: "activity"; user: ErpUser }
    | null
  >(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    p.set("limit", "100");
    return `/system/users?${p}`;
  }, [q, status]);

  const { data, loading, error, refetch } = useQuery<any>(url);
  const rows: ErpUser[] = Array.isArray(data?.data) ? data.data : [];
  const stats = data?.stats ?? {};

  function notify(kind: "ok" | "err", text: string) {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 4000);
  }

  async function toggleStatus(u: ErpUser) {
    const suspend = u.account_status === "active";
    const question = suspend
      ? `Suspendre le compte ${u.email} ? L'utilisateur ne pourra plus se connecter et ses sessions seront fermées.`
      : `Réactiver le compte ${u.email} ?`;
    if (!window.confirm(question)) return;
    setBusyId(u.id);
    try {
      await setErpUserStatus(u.id, suspend ? "suspend" : "activate", "Console Comptes ERP");
      notify("ok", suspend ? "Compte suspendu." : "Compte réactivé.");
      refetch();
    } catch (e: any) {
      notify("err", errMsg(e, "Erreur lors du changement de statut"));
    } finally { setBusyId(null); }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="Comptes" value={stats.total ?? "—"} icon={<Users className="w-4 h-4 text-indigo-500"/>}/>
        <Kpi label="Actifs" value={stats.active ?? "—"} icon={<ShieldCheck className="w-4 h-4 text-green-500"/>}/>
        <Kpi label="Suspendus" value={stats.suspended ?? "—"} icon={<ShieldOff className="w-4 h-4 text-orange-500"/>}/>
        <Kpi label="Jamais connectés" value={stats.never_logged ?? "—"} icon={<History className="w-4 h-4 text-gray-400"/>}/>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"/>
          <input value={qInput} onChange={e => setQInput(e.target.value)}
            placeholder="Rechercher (nom, email, matricule)…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"/>
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none">
          <option value="">Tous les statuts</option>
          <option value="active">Actifs</option>
          <option value="suspended">Suspendus</option>
        </select>
      </div>

      {toast && (
        <div className={`px-3 py-2 rounded-lg text-sm border ${
          toast.kind === "ok" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
          {toast.text}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        {loading && <div className="p-8 text-center text-sm text-gray-400">Chargement…</div>}
        {error && !loading && (
          <div className="p-6 text-center text-sm text-red-600 flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4"/> {error}
          </div>
        )}
        {!loading && !error && rows.length === 0 && (
          <div className="p-8 text-center text-sm text-gray-400">Aucun compte trouvé.</div>
        )}
        {!loading && !error && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th className="px-4 py-2.5 font-medium">Utilisateur</th>
                  <th className="px-4 py-2.5 font-medium">Rôle</th>
                  <th className="px-4 py-2.5 font-medium">Employé lié</th>
                  <th className="px-4 py-2.5 font-medium">Statut</th>
                  <th className="px-4 py-2.5 font-medium">Dernier login</th>
                  <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(u => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-gray-900">{u.first_name} {u.last_name}</div>
                      <div className="text-xs text-gray-400 break-all">{u.email}</div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {u.role_display ?? <span className="text-gray-400 italic">{u.legacy_role} (hérité)</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {u.employee_id ? (
                        <div>
                          <div className="text-gray-800">{u.employee_first_name} {u.employee_last_name}</div>
                          <div className="text-xs text-gray-400">{u.employee_matricule}</div>
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.account_status === "active" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                          {u.account_status === "active" ? "Actif" : "Suspendu"}
                        </span>
                        {u.locked_until && new Date(u.locked_until) > new Date() && (
                          <span className="text-[10px] text-red-500">Verrouillé (échecs login)</span>
                        )}
                        {u.force_password_change && (
                          <span className="text-[10px] text-amber-600">MDP à changer</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(u.last_login_at)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <IconBtn title="Changer le rôle" onClick={() => setModal({ kind: "role", user: u })}>
                          <UserCog className="w-4 h-4"/>
                        </IconBtn>
                        <IconBtn title="Lier / détacher un employé" onClick={() => setModal({ kind: "link", user: u })}>
                          <Link2 className="w-4 h-4"/>
                        </IconBtn>
                        <IconBtn title="Réinitialiser le mot de passe" onClick={() => setModal({ kind: "reset", user: u })}>
                          <RotateCcw className="w-4 h-4"/>
                        </IconBtn>
                        <IconBtn title="Journal d'activité" onClick={() => setModal({ kind: "activity", user: u })}>
                          <History className="w-4 h-4"/>
                        </IconBtn>
                        <IconBtn
                          title={u.account_status === "active" ? "Suspendre" : "Réactiver"}
                          disabled={busyId === u.id}
                          onClick={() => toggleStatus(u)}
                          className={u.account_status === "active" ? "text-orange-500 hover:bg-orange-50" : "text-green-600 hover:bg-green-50"}>
                          {u.account_status === "active" ? <ShieldOff className="w-4 h-4"/> : <ShieldCheck className="w-4 h-4"/>}
                        </IconBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400">
        Les comptes se créent depuis Personnel &amp; RH (assistant « Nouvel employé » ou fiche employé) :
        la fiche RH reste la source maîtresse. Un changement de rôle prend effet au prochain
        rafraîchissement de session (≤ 15 min) ou à la prochaine connexion.
      </p>

      {modal?.kind === "role" && <RoleModal user={modal.user} onClose={() => setModal(null)} onDone={() => { setModal(null); refetch(); notify("ok", "Rôle mis à jour."); }}/>}
      {modal?.kind === "link" && <LinkModal user={modal.user} onClose={() => setModal(null)} onDone={(m) => { setModal(null); refetch(); notify("ok", m); }}/>}
      {modal?.kind === "reset" && <ResetModal user={modal.user} onClose={() => setModal(null)} onDone={() => { setModal(null); refetch(); notify("ok", "Mot de passe provisoire enregistré — sessions déconnectées."); }}/>}
      {modal?.kind === "activity" && <ActivityModal user={modal.user} onClose={() => setModal(null)}/>}
    </div>
  );
}

/* ── petits composants ───────────────────────────────────────────────────── */

function Kpi({ label, value, icon }: { label: string; value: any; icon: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-gray-400">{icon}{label}</div>
      <div className="text-xl font-bold text-gray-900 mt-1">{value}</div>
    </div>
  );
}

function IconBtn({ title, onClick, children, disabled, className }: {
  title: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; className?: string;
}) {
  return (
    <button title={title} onClick={onClick} disabled={disabled}
      className={`p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 ${className ?? ""}`}>
      {children}
    </button>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900">{title}</h2>
          <button onClick={onClose}><X className="w-5 h-5"/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Modal : rôle ────────────────────────────────────────────────────────── */

function RoleModal({ user, onClose, onDone }: { user: ErpUser; onClose: () => void; onDone: () => void }) {
  const [roles, setRoles] = useState<any[]>([]);
  const [roleId, setRoleId] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getErpRoles().then((r: any) => {
      const list = Array.isArray(r) ? r : [];
      setRoles(list);
      const current = list.find((x: any) => x.name === user.role_name);
      if (current) setRoleId(current.id);
    }).catch((e: any) => setErr(errMsg(e, "Impossible de charger les rôles")));
  }, [user.role_name]);

  async function submit() {
    setSaving(true); setErr(null);
    try {
      await updateErpUser(user.id, { roleId });
      onDone();
    } catch (e: any) { setErr(errMsg(e, "Erreur")); setSaving(false); }
  }

  return (
    <ModalShell title="Changer le rôle" onClose={onClose}>
      <p className="text-sm text-gray-500">Compte : <span className="font-medium text-gray-800">{user.email}</span></p>
      {err && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{err}</div>}
      <select value={roleId} onChange={e => setRoleId(e.target.value)}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none">
        <option value="">— Sélectionner un rôle —</option>
        {roles.map(r => (
          <option key={r.id} value={r.id}>{r.display_name} ({r.permission_count} permissions)</option>
        ))}
      </select>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
        <button onClick={submit} disabled={saving || !roleId}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {saving ? "…" : "Enregistrer"}
        </button>
      </div>
    </ModalShell>
  );
}

/* ── Modal : liaison employé ─────────────────────────────────────────────── */

function LinkModal({ user, onClose, onDone }: { user: ErpUser; onClose: () => void; onDone: (msg: string) => void }) {
  const [q, setQ] = useState("");
  const [candidates, setCandidates] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      getLinkCandidates(q || undefined)
        .then((r: any) => setCandidates(Array.isArray(r) ? r : []))
        .catch((e: any) => setErr(errMsg(e, "Erreur de recherche")));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function link(employeeId: string) {
    setBusy(true); setErr(null);
    try {
      await updateErpUser(user.id, { linkedEmployeeId: employeeId });
      onDone("Employé lié au compte.");
    } catch (e: any) { setErr(errMsg(e, "Erreur de liaison")); setBusy(false); }
  }
  async function unlink() {
    if (!window.confirm("Détacher la fiche employé de ce compte ?")) return;
    setBusy(true); setErr(null);
    try {
      await updateErpUser(user.id, { linkedEmployeeId: null });
      onDone("Fiche employé détachée.");
    } catch (e: any) { setErr(errMsg(e, "Erreur")); setBusy(false); }
  }

  return (
    <ModalShell title="Lier une fiche employé" onClose={onClose}>
      <p className="text-sm text-gray-500">Compte : <span className="font-medium text-gray-800">{user.email}</span></p>
      {user.employee_id && (
        <div className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm">
          <span>Lié à <span className="font-medium">{user.employee_first_name} {user.employee_last_name}</span> ({user.employee_matricule})</span>
          <button onClick={unlink} disabled={busy} className="text-xs text-red-600 hover:underline disabled:opacity-50">Détacher</button>
        </div>
      )}
      {err && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{err}</div>}
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un employé sans compte…"
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"/>
      <div className="max-h-56 overflow-y-auto divide-y divide-gray-50 border border-gray-100 rounded-lg">
        {candidates.length === 0 && <div className="p-4 text-center text-xs text-gray-400">Aucun employé sans compte trouvé.</div>}
        {candidates.map(c => (
          <button key={c.id} onClick={() => link(c.id)} disabled={busy}
            className="w-full text-left px-3 py-2 hover:bg-indigo-50/60 disabled:opacity-50">
            <div className="text-sm text-gray-800">{c.first_name} {c.last_name}</div>
            <div className="text-xs text-gray-400">{c.matricule}{c.position_name ? ` · ${c.position_name}` : ""}</div>
          </button>
        ))}
      </div>
    </ModalShell>
  );
}

/* ── Modal : reset mot de passe ──────────────────────────────────────────── */

function ResetModal({ user, onClose, onDone }: { user: ErpUser; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState(genPassword());
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setSaving(true); setErr(null);
    try {
      await resetErpUserPassword(user.id, password);
      onDone();
    } catch (e: any) { setErr(errMsg(e, "Erreur")); setSaving(false); }
  }

  return (
    <ModalShell title="Réinitialiser le mot de passe" onClose={onClose}>
      <p className="text-sm text-gray-500">Compte : <span className="font-medium text-gray-800">{user.email}</span></p>
      {err && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{err}</div>}
      <div>
        <label className="text-xs font-medium text-gray-700">Mot de passe provisoire * (min. 8 caractères)</label>
        <div className="flex gap-2 mt-1">
          <input value={password} onChange={e => setPassword(e.target.value)}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"/>
          <button type="button" onClick={() => setPassword(genPassword())}
            className="px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">Générer</button>
          <button type="button" disabled={!password}
            onClick={() => { navigator.clipboard?.writeText(password).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">
            {copied ? <Check className="w-3.5 h-3.5 text-green-600"/> : <Copy className="w-3.5 h-3.5"/>}
          </button>
        </div>
      </div>
      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
        Changement obligatoire au premier login. Toutes les sessions ouvertes seront déconnectées.
      </p>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
        <button onClick={submit} disabled={saving || password.length < 8}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {saving ? "…" : "Réinitialiser"}
        </button>
      </div>
    </ModalShell>
  );
}

/* ── Modal : journal d'activité ──────────────────────────────────────────── */

function ActivityModal({ user, onClose }: { user: ErpUser; onClose: () => void }) {
  const [logs, setLogs] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getErpUserActivity(user.id, 50)
      .then((r: any) => setLogs(Array.isArray(r) ? r : []))
      .catch((e: any) => setErr(errMsg(e, "Erreur de chargement")));
  }, [user.id]);

  return (
    <ModalShell title="Journal d'activité" onClose={onClose}>
      <p className="text-sm text-gray-500">Compte : <span className="font-medium text-gray-800">{user.email}</span></p>
      {err && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{err}</div>}
      {!logs && !err && <div className="p-4 text-center text-xs text-gray-400">Chargement…</div>}
      {logs && logs.length === 0 && <div className="p-4 text-center text-xs text-gray-400">Aucune activité enregistrée.</div>}
      {logs && logs.length > 0 && (
        <div className="max-h-72 overflow-y-auto divide-y divide-gray-50 border border-gray-100 rounded-lg">
          {logs.map((l: any) => (
            <div key={l.id} className="px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-gray-700">{l.action}{l.module ? ` · ${l.module}` : ""}</span>
                <span className="text-[10px] text-gray-400 whitespace-nowrap">{fmtDate(l.timestamp)}</span>
              </div>
              {(l.description || l.resource_label) && (
                <div className="text-xs text-gray-500 mt-0.5">{l.description ?? l.resource_label}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  );
}
