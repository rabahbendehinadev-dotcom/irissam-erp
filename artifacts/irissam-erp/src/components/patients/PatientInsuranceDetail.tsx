import { useState } from 'react';
import {
  Shield, CheckCircle, XCircle, AlertTriangle, Clock,
  FileText, Plus, RefreshCw, TrendingUp, Loader2, History,
} from 'lucide-react';
import type { Patient } from '@/types';
import { formatDate } from '@/utils/format';
import {
  useInsurancePolicies, useInsuranceClaims,
  useCreatePolicy, useValidatePolicy, useRenewPolicy,
} from '@/hooks/useInsuranceApi';
import type { InsurancePolicy, CreatePolicyInput, PolicyStatus } from '@/types/insurance';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysUntil(s?: string | null): number | null {
  if (!s) return null;
  return Math.ceil((new Date(s).getTime() - Date.now()) / 86_400_000);
}

function fmt(n: number | string | undefined | null) {
  if (n == null) return '—';
  return Number(n).toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_CONFIG: Record<PolicyStatus, { icon: React.ElementType; cls: string; label: string }> = {
  active:                   { icon: CheckCircle,  cls: 'bg-green-100 text-green-700',  label: 'Active' },
  expiree:                  { icon: XCircle,      cls: 'bg-red-100 text-red-700',      label: 'Expirée' },
  suspendue:                { icon: Clock,        cls: 'bg-orange-100 text-orange-700',label: 'Suspendue' },
  en_attente_validation:    { icon: Clock,        cls: 'bg-yellow-100 text-yellow-700',label: 'En attente' },
  refusee:                  { icon: XCircle,      cls: 'bg-red-100 text-red-700',      label: 'Refusée' },
  archivee:                 { icon: History,      cls: 'bg-gray-100 text-gray-500',    label: 'Archivée' },
};

function PolicyStatusBadge({ statut }: { statut: PolicyStatus }) {
  const s = STATUS_CONFIG[statut] ?? { icon: Shield, cls: 'bg-gray-100 text-gray-500', label: statut };
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      <Icon size={10}/>{s.label}
    </span>
  );
}

const CLAIM_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600', submitted: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700', partially_approved: 'bg-orange-100 text-orange-700',
  rejected: 'bg-red-100 text-red-700', paid: 'bg-purple-100 text-purple-700',
};

// ─── Add Policy Mini-Form ─────────────────────────────────────────────────────
function AddPolicyForm({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const createPolicy = useCreatePolicy();
  const [form, setForm] = useState<Partial<CreatePolicyInput>>({ patientId });
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await createPolicy.mutateAsync({ ...form, patientId } as CreatePolicyInput);
      onClose();
    } catch (err: unknown) { setError((err as Error).message ?? 'Erreur'); }
  }

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-blue-800">Nouvelle police d&apos;assurance</p>
      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 block mb-1">N° police *</label>
            <input required value={form.policyNumber ?? ''}
              onChange={e => setForm(f => ({ ...f, policyNumber: e.target.value }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Taux couverture (%)</label>
            <input type="number" min={0} max={100} value={form.coveragePercent ?? ''}
              onChange={e => setForm(f => ({ ...f, coveragePercent: e.target.value ? Number(e.target.value) : undefined }))}
              placeholder="80"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Valide du</label>
            <input type="date" value={form.validFrom ?? ''}
              onChange={e => setForm(f => ({ ...f, validFrom: e.target.value || undefined }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Valide au</label>
            <input type="date" value={form.validUntil ?? ''}
              onChange={e => setForm(f => ({ ...f, validUntil: e.target.value || undefined }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={createPolicy.isPending}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
            {createPolicy.isPending && <Loader2 size={12} className="animate-spin"/>} Créer
          </button>
          <button type="button" onClick={onClose}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">Annuler</button>
        </div>
      </form>
    </div>
  );
}

// ─── Renew Policy Form ────────────────────────────────────────────────────────
function RenewForm({ policy, onClose }: { policy: InsurancePolicy; onClose: () => void }) {
  const renew = useRenewPolicy();
  const [validUntil, setValidUntil] = useState('');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await renew.mutateAsync({ id: policy.id, data: { validUntil } });
      onClose();
    } catch (err: unknown) { setError((err as Error).message ?? 'Erreur'); }
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex-1">
        <label className="text-xs text-gray-500 block mb-1">Nouvelle date d&apos;expiration</label>
        <input required type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500/20"/>
      </div>
      <button type="submit" disabled={renew.isPending || !validUntil}
        className="flex items-center gap-1.5 px-3 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-60 whitespace-nowrap">
        {renew.isPending && <Loader2 size={12} className="animate-spin"/>}
        <RefreshCw size={12}/> Renouveler
      </button>
      <button type="button" onClick={onClose} className="px-2 py-2 text-gray-400 hover:text-gray-600">✕</button>
    </form>
  );
}

// ─── Policy Card ──────────────────────────────────────────────────────────────
function PolicyCard({ policy }: { policy: InsurancePolicy }) {
  const validatePolicy = useValidatePolicy();
  const [showRenew, setShowRenew] = useState(false);

  const days = daysUntil(policy.valid_until);
  const expiringWarn = days !== null && days >= 0 && days <= 30;
  const expired      = days !== null && days < 0;

  const ceilingPct = policy.ceiling_amount
    ? Math.min(100, Math.round((Number(policy.plafond_consomme) / Number(policy.ceiling_amount)) * 100))
    : null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 text-sm">{policy.organization_name ?? policy.insurer_name ?? '—'}</p>
            <PolicyStatusBadge statut={policy.statut}/>
          </div>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{policy.policy_number}</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Shield size={18} className="text-blue-600"/>
        </div>
      </div>

      {/* Coverage + dates */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-50 rounded-lg py-2">
          <p className="text-xs text-gray-400">Couverture</p>
          <p className="text-sm font-bold text-blue-600">{policy.coverage_percent}%</p>
        </div>
        <div className="bg-gray-50 rounded-lg py-2">
          <p className="text-xs text-gray-400">Valide du</p>
          <p className="text-xs font-medium text-gray-700">{policy.valid_from ? formatDate(policy.valid_from) : '—'}</p>
        </div>
        <div className="bg-gray-50 rounded-lg py-2">
          <p className="text-xs text-gray-400">Valide au</p>
          <p className={`text-xs font-medium ${expired ? 'text-red-600' : expiringWarn ? 'text-amber-600' : 'text-gray-700'}`}>
            {policy.valid_until ? formatDate(policy.valid_until) : '—'}
          </p>
        </div>
      </div>

      {/* Ceiling progress */}
      {ceilingPct !== null && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500">Plafond consommé</p>
            <p className="text-xs font-medium text-gray-700">
              {fmt(policy.plafond_consomme)} / {fmt(policy.ceiling_amount)} DZD ({ceilingPct}%)
            </p>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${ceilingPct >= 90 ? 'bg-red-500' : ceilingPct >= 70 ? 'bg-amber-500' : 'bg-blue-500'}`}
              style={{ width: `${ceilingPct}%` }}/>
          </div>
        </div>
      )}

      {/* Alerts */}
      {expiringWarn && !expired && (
        <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-lg">
          <AlertTriangle size={13} className="text-amber-500 flex-shrink-0"/>
          <p className="text-xs text-amber-700">Police expire dans <strong>{days}</strong> jour(s)</p>
          <button onClick={() => setShowRenew(v => !v)}
            className="ml-auto flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium whitespace-nowrap">
            <RefreshCw size={11}/> Renouveler
          </button>
        </div>
      )}
      {expired && (
        <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-100 rounded-lg">
          <XCircle size={13} className="text-red-500 flex-shrink-0"/>
          <p className="text-xs text-red-700">Police expirée</p>
          <button onClick={() => setShowRenew(v => !v)}
            className="ml-auto flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium whitespace-nowrap">
            <RefreshCw size={11}/> Renouveler
          </button>
        </div>
      )}
      {ceilingPct !== null && ceilingPct >= 90 && (
        <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-100 rounded-lg">
          <AlertTriangle size={13} className="text-red-500 flex-shrink-0"/>
          <p className="text-xs text-red-700">Plafond presque atteint ({ceilingPct}%)</p>
        </div>
      )}

      {/* Renew form */}
      {showRenew && <RenewForm policy={policy} onClose={() => setShowRenew(false)}/>}

      {/* Validate button */}
      {policy.statut === 'en_attente_validation' && (
        <button onClick={() => validatePolicy.mutate(policy.id)} disabled={validatePolicy.isPending}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-60">
          {validatePolicy.isPending && <Loader2 size={13} className="animate-spin"/>}
          <CheckCircle size={13}/> Valider la police
        </button>
      )}
    </div>
  );
}

// ─── Main exported component ──────────────────────────────────────────────────
interface Props { patient: Patient }

export function PatientInsuranceDetail({ patient }: Props) {
  const [showAddPolicy, setShowAddPolicy] = useState(false);

  const { data: policies = [], isLoading: policiesLoading } = useInsurancePolicies({ patientId: patient.id });
  const { data: claims   = [], isLoading: claimsLoading   } = useInsuranceClaims({ patientId: patient.id, limit: 5 });

  const activePolicies = policies.filter(p => p.statut === 'active' || p.statut === 'en_attente_validation');
  const recentClaims   = claims.slice(0, 5);

  if (policiesLoading || claimsLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {Array.from({length:3}).map((_,i) => <div key={i} className="h-28 bg-gray-100 rounded-xl"/>)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Section A: Polices actives ─────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield size={15} className="text-blue-600"/>
            <h3 className="text-sm font-semibold text-gray-800">Polices d&apos;assurance</h3>
            <span className="text-xs text-gray-400">({policies.length})</span>
          </div>
          <button onClick={() => setShowAddPolicy(v => !v)}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium">
            <Plus size={13}/> Ajouter
          </button>
        </div>

        {showAddPolicy && (
          <div className="mb-3">
            <AddPolicyForm patientId={patient.id} onClose={() => setShowAddPolicy(false)}/>
          </div>
        )}

        {policies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-300 border border-dashed border-gray-200 rounded-xl">
            <Shield size={28} className="mb-2"/>
            <p className="text-sm text-gray-400">Aucune police enregistrée</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Active / pending first */}
            {activePolicies.map(p => <PolicyCard key={p.id} policy={p}/>)}
            {/* Archived / expired collapsed */}
            {policies.filter(p => !activePolicies.includes(p)).length > 0 && (
              <details className="group">
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 list-none flex items-center gap-1 py-1">
                  <History size={12}/>
                  {policies.filter(p => !activePolicies.includes(p)).length} police(s) archivée(s) / expirée(s)
                </summary>
                <div className="space-y-2 mt-2">
                  {policies.filter(p => !activePolicies.includes(p)).map(p => (
                    <PolicyCard key={p.id} policy={p}/>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </section>

      {/* ── Section B: Sinistres récents ───────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-gray-600"/>
            <h3 className="text-sm font-semibold text-gray-800">Sinistres récents</h3>
            {claims.length > 5 && <span className="text-xs text-gray-400">(5 sur {claims.length})</span>}
          </div>
        </div>

        {recentClaims.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Aucun sinistre enregistré</p>
        ) : (
          <div className="space-y-2">
            {recentClaims.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="min-w-0">
                  <p className="text-xs font-mono text-blue-600">{c.claim_number}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(c.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Demandé</p>
                    <p className="text-sm font-medium text-gray-800">{fmt(c.amount_requested)} DZD</p>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CLAIM_STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {c.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Section C: Couverture globale ─────────────────────────────────── */}
      {activePolicies.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={15} className="text-gray-600"/>
            <h3 className="text-sm font-semibold text-gray-800">Couverture globale</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {activePolicies.slice(0,2).map(p => (
              <div key={p.id} className="bg-gradient-to-br from-blue-50 to-white rounded-xl border border-blue-100 p-4 text-center">
                <p className="text-xs text-gray-400 truncate mb-1">{p.organization_name ?? p.insurer_name}</p>
                <p className="text-2xl font-bold text-blue-600">{p.coverage_percent}%</p>
                <p className="text-xs text-gray-400">couverture</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// Keep backward compat default export
export default PatientInsuranceDetail;
