import { useInsuranceDashboard } from '@/hooks/useInsuranceApi';
import { useLanguage } from '@/i18n';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  Shield, FileText, CheckCircle, XCircle, Clock,
  Banknote, Building2, AlertTriangle, TrendingUp, Package, RefreshCw
} from 'lucide-react';

// ─── Safe numeric helpers ─────────────────────────────────────────────────────

/** Coerce any value to a safe, finite number. null/undefined/NaN/Infinity → 0 */
export function safeNumber(v: unknown): number {
  if (v == null) return 0;
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

/** Safe currency string: always finite, never "NaN DZD" */
export function safeCurrency(v: unknown): string {
  return safeNumber(v).toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Safe integer count string */
export function safeCount(v: unknown): string {
  return safeNumber(v).toLocaleString('fr-DZ', { maximumFractionDigits: 0 });
}

/** Safe percentage: safeDivision(numerator, denominator) * 100, clamped 0–100 */
export function safePercentage(numerator: unknown, denominator: unknown): number {
  const den = safeNumber(denominator);
  if (den === 0) return 0;
  const pct = (safeNumber(numerator) / den) * 100;
  return Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0;
}

/** Safe division: returns 0 when denominator is zero or result is not finite */
export function safeDivision(numerator: unknown, denominator: unknown): number {
  const den = safeNumber(denominator);
  if (den === 0) return 0;
  const result = safeNumber(numerator) / den;
  return Number.isFinite(result) ? result : 0;
}

// ─── Internal formatting (uses safe helpers) ──────────────────────────────────

function fmt(v: unknown) { return safeCurrency(v); }

// ─── KPI card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: unknown;
  icon: React.ElementType;
  color: string;
  iconBg: string;
  isDzd?: boolean;
}

function KpiCard({ label, value, icon: Icon, color, iconBg, isDzd }: KpiCardProps) {
  const display = isDzd
    ? `${safeCurrency(value)} DZD`
    : safeCount(value);
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon size={22} className={color} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium truncate">{label}</p>
        <p className="text-xl font-bold text-gray-900 truncate">{display}</p>
      </div>
    </div>
  );
}

// ─── Empty state for charts ────────────────────────────────────────────────────

function ChartEmptyState() {
  return (
    <div className="h-48 flex flex-col items-center justify-center gap-2 text-gray-300">
      <Package size={32} className="text-gray-200" />
      <p className="text-xs">Aucune donnée disponible</p>
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PIE_COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];

// ─── Main dashboard component ────────────────────────────────────────────────

export default function InsuranceDashboard() {
  const { t } = useLanguage();
  const { data, isLoading, isError, refetch } = useInsuranceDashboard();

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 bg-white rounded-xl border border-gray-100" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-72 bg-white rounded-xl border border-gray-100" />
          <div className="h-72 bg-white rounded-xl border border-gray-100" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <AlertTriangle size={40} className="mb-3 text-red-400" />
        <p className="text-sm font-medium text-red-600">Erreur de chargement du tableau de bord</p>
        <button onClick={() => refetch()}
          className="mt-4 flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <RefreshCw size={14} /> Réessayer
        </button>
      </div>
    );
  }

  const kpis = data.kpis;

  const kpiCards: KpiCardProps[] = [
    { label: t('insurance.kpi.active_policies'),   value: kpis.active_policies,      icon: Shield,      color: 'text-green-600',  iconBg: 'bg-green-50' },
    { label: t('insurance.kpi.pending_claims'),    value: kpis.pending_claims,        icon: Clock,       color: 'text-amber-600',  iconBg: 'bg-amber-50' },
    { label: t('insurance.kpi.approved_claims'),   value: kpis.total_approved,        icon: CheckCircle, color: 'text-green-600',  iconBg: 'bg-green-50',  isDzd: true },
    { label: t('insurance.kpi.rejected_claims'),   value: kpis.total_rejected,        icon: XCircle,     color: 'text-red-600',    iconBg: 'bg-red-50',    isDzd: true },
    { label: t('insurance.kpi.bordereaux'),         value: kpis.bordereau_count,       icon: Package,     color: 'text-blue-600',   iconBg: 'bg-blue-50' },
    { label: t('insurance.kpi.payments_received'),  value: kpis.total_paid,            icon: Banknote,    color: 'text-purple-600', iconBg: 'bg-purple-50', isDzd: true },
    { label: t('insurance.kpi.remaining'),          value: kpis.remaining_to_collect,  icon: TrendingUp,  color: 'text-orange-600', iconBg: 'bg-orange-50', isDzd: true },
    { label: t('insurance.kpi.orgs'),               value: kpis.overdue_claims,        icon: Building2,   color: 'text-red-600',    iconBg: 'bg-red-50' },
  ];

  // Safe chart data (filter out rows with no meaningful data)
  const claimsByStatus = (data.charts?.claims_by_status ?? []).filter(r => safeNumber(r.count) > 0);
  const reqVsApproved  = (data.charts?.requested_vs_approved ?? []).filter(r =>
    safeNumber(r.requested) > 0 || safeNumber(r.approved) > 0,
  );

  return (
    <div className="space-y-6">
      {/* ── KPI grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, i) => <KpiCard key={i} {...card} />)}
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Bar chart: requested vs approved by month */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Montants demandés vs approuvés</h3>
          {reqVsApproved.length === 0 ? <ChartEmptyState /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={reqVsApproved} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={v => safeCount(v)} />
                <Tooltip formatter={(v: unknown) => `${fmt(v)} DZD`} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="requested" name="Demandé"  fill="#3b82f6" radius={[3,3,0,0]} />
                <Bar dataKey="approved"  name="Approuvé" fill="#22c55e" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie chart: by status */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Répartition par statut</h3>
          {claimsByStatus.length === 0 ? <ChartEmptyState /> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={claimsByStatus}
                  dataKey="count"
                  nameKey="status"
                  cx="50%" cy="50%" outerRadius={90}
                  label={({ status, percent }) =>
                    `${status ?? ''} ${(safeNumber(percent) * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {claimsByStatus.map((_entry, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: unknown) => safeCount(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Alert widgets ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Expiring policies */}
        <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} className="text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-800">{t('insurance.alert.expiring_soon')}</h3>
          </div>
          {(data.alerts?.expiring_policies ?? []).length === 0 ? (
            <p className="text-xs text-gray-400">Aucune police expirant bientôt</p>
          ) : (
            <ul className="space-y-2">
              {(data.alerts?.expiring_policies ?? []).slice(0, 5).map((p, i) => (
                <li key={i} className="text-xs">
                  <p className="font-medium text-gray-700">{p.patient_name ?? '—'}</p>
                  <p className="text-gray-400">
                    {p.policy_number ?? '—'} — {safeNumber(p.days_left)}j restants
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Overdue claims */}
        <div className="bg-white rounded-xl border border-red-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={15} className="text-red-500" />
            <h3 className="text-sm font-semibold text-gray-800">{t('insurance.alert.claim_overdue')}</h3>
          </div>
          {(data.alerts?.overdue_claims ?? []).length === 0 ? (
            <p className="text-xs text-gray-400">Aucun sinistre en retard</p>
          ) : (
            <ul className="space-y-2">
              {(data.alerts?.overdue_claims ?? []).slice(0, 5).map((c, i) => (
                <li key={i} className="text-xs">
                  <p className="font-medium text-gray-700">{c.claim_number ?? '—'}</p>
                  <p className="text-gray-400">
                    {safeNumber(c.days_overdue)}j — {fmt(c.amount)} DZD
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Unsent bordereaux */}
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={15} className="text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-800">{t('insurance.alert.bordereau_unsent')}</h3>
          </div>
          {(data.alerts?.pending_bordereaux ?? []).length === 0 ? (
            <p className="text-xs text-gray-400">Aucun bordereau en attente</p>
          ) : (
            <ul className="space-y-2">
              {(data.alerts?.pending_bordereaux ?? []).slice(0, 5).map((b, i) => (
                <li key={i} className="text-xs">
                  <p className="font-medium text-gray-700">{b.bordereau_number ?? '—'}</p>
                  <p className="text-gray-400">
                    {safeNumber(b.claim_count)} sinistres — {fmt(b.total)} DZD
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
