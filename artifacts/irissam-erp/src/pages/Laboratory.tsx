/**
 * Laboratory — Module Laboratoire
 *
 * Lit directement depuis MockRepository (réactif, sans refresh).
 * Phase 2 : source unique de vérité partagée avec Urgences et Consultations.
 * Phase 5 : notifications au médecin lors de la validation.
 * Phase 7 : audit complet de chaque transition.
 */
import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageWrapper } from '@/components/shared/PageWrapper';
import { useMockRepository } from '@/store/MockRepository';
import { useAuth } from '@/store/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  FlaskConical, Search, AlertTriangle, Microscope,
  ChevronRight, X, CheckCircle2, Clock,
} from 'lucide-react';
import type { RepoLabOrder } from '@/types/repository';
import type { AuditCtx } from '@/types/repository';

// ─── Status / urgency config ──────────────────────────────────────────────────

const LAB_STATUS: Record<RepoLabOrder['status'], {
  label: string; badge: string; row: string;
  next?: RepoLabOrder['status']; nextLabel?: string; nextColor?: string;
}> = {
  demandee:  { label: 'Demandée',  badge: 'bg-blue-100 text-blue-700 border-blue-200',   row: '',              next: 'prelevee', nextLabel: 'Prélever',  nextColor: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
  prelevee:  { label: 'Prélevée',  badge: 'bg-yellow-100 text-yellow-700 border-yellow-200', row: '',           next: 'en_cours', nextLabel: 'Analyser',  nextColor: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100' },
  en_cours:  { label: 'En cours',  badge: 'bg-orange-100 text-orange-700 border-orange-200', row: '',          next: 'validee',  nextLabel: 'Valider →', nextColor: 'bg-green-50 text-green-700 hover:bg-green-100' },
  validee:   { label: 'Validée',   badge: 'bg-green-100 text-green-700 border-green-200',  row: '' },
  annulee:   { label: 'Annulée',   badge: 'bg-gray-100 text-gray-500 border-gray-200',    row: 'opacity-60' },
};

const URGENCY: Record<RepoLabOrder['urgency'], { label: string; badge: string }> = {
  STAT:    { label: 'STAT',    badge: 'bg-red-100 text-red-700 font-bold border border-red-200' },
  urgent:  { label: 'Urgent',  badge: 'bg-orange-100 text-orange-700 border border-orange-200' },
  routine: { label: 'Routine', badge: 'bg-gray-100 text-gray-600 border border-gray-200' },
};

const STATUS_FILTERS = ['all', 'demandee', 'prelevee', 'en_cours', 'validee'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

// ─── Validation modal ─────────────────────────────────────────────────────────

function ValidationModal({
  order,
  onConfirm,
  onClose,
}: {
  order: RepoLabOrder;
  onConfirm: (result: string, isCritical: boolean) => void;
  onClose: () => void;
}) {
  const [result, setResult]       = useState('');
  const [isCritical, setIsCritical] = useState(false);
  const { toast } = useToast();

  const handleSubmit = () => {
    if (!result.trim()) {
      toast({ title: 'Résultat requis', description: 'Saisissez le résultat avant de valider.', variant: 'destructive' });
      return;
    }
    onConfirm(result.trim(), isCritical);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-6 max-h-[95dvh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Valider l'analyse
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1">
          <p className="font-semibold text-gray-900">{order.test}</p>
          <p className="text-sm text-gray-500">{order.patientName}</p>
          <p className="text-xs text-gray-400">
            Demandé par {order.requestedBy} · {order.sourceModule}
            {order.encounterId && <span className="font-mono ml-2 text-gray-400">{order.encounterId}</span>}
          </p>
        </div>

        <label className="block text-sm font-medium text-gray-700 mb-1">Résultat *</label>
        <textarea
          rows={4}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
          placeholder="Ex: Hémoglobine 8.2 g/dL, Leucocytes 12 000/mm³…"
          value={result}
          onChange={e => setResult(e.target.value)}
          autoFocus
        />

        <label className="flex items-center gap-2 cursor-pointer mb-4">
          <input
            type="checkbox"
            checked={isCritical}
            onChange={e => setIsCritical(e.target.checked)}
            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
          />
          <span className="text-sm text-red-600 font-medium flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Résultat critique — alerter immédiatement
          </span>
        </label>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            className={cn(
              'flex-1 px-4 py-2 text-sm font-semibold rounded-xl text-white transition-colors',
              isCritical ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700',
            )}
          >
            {isCritical ? 'Valider (Critique ⚠)' : 'Valider le résultat'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LaboratoryPage() {
  const { user } = useAuth();
  const { can } = usePermission();
  const { toast } = useToast();
  const repo = useMockRepository();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [validating, setValidating] = useState<RepoLabOrder | null>(null);

  const ctx: AuditCtx = {
    userId:   user?.id ?? 'unknown',
    userName: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Inconnu',
    userRole: user?.role ?? 'unknown',
  };

  // ── Filtered + sorted list (reactive — no local copy) ──────────────────────
  const orders = useMemo(() => {
    let list = repo.labOrders;
    if (statusFilter !== 'all') list = list.filter(o => o.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        o.patientName.toLowerCase().includes(q) ||
        o.test.toLowerCase().includes(q) ||
        o.requestedBy.toLowerCase().includes(q) ||
        (o.encounterId ?? '').toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      // STAT + critiques en premier
      const aScore = (a.urgency === 'STAT' ? 4 : a.urgency === 'urgent' ? 2 : 0) + (a.isCritical ? 1 : 0);
      const bScore = (b.urgency === 'STAT' ? 4 : b.urgency === 'urgent' ? 2 : 0) + (b.isCritical ? 1 : 0);
      if (aScore !== bScore) return bScore - aScore;
      return new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime();
    });
  }, [repo.labOrders, statusFilter, search]);

  // ── Counts ─────────────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const base = { all: repo.labOrders.length, demandee: 0, prelevee: 0, en_cours: 0, validee: 0, annulee: 0 };
    repo.labOrders.forEach(o => { if (o.status in base) (base as Record<string, number>)[o.status]++; });
    return base;
  }, [repo.labOrders]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleAdvance = (order: RepoLabOrder) => {
    const cfg = LAB_STATUS[order.status];
    if (!cfg.next) return;
    if (cfg.next === 'validee') {
      setValidating(order);
      return;
    }
    repo.updateLabOrderStatus(order.id, cfg.next, undefined, undefined, ctx);
    toast({ title: `Statut mis à jour`, description: `${order.test} → ${LAB_STATUS[cfg.next].label}` });
  };

  const handleValidate = (result: string, isCritical: boolean) => {
    if (!validating) return;
    repo.updateLabOrderStatus(validating.id, 'validee', result, isCritical, ctx);
    toast({
      title: isCritical ? '⚠ Résultat critique envoyé' : 'Résultat validé',
      description: `${validating.test} — ${validating.patientName}`,
      variant: isCritical ? 'destructive' : 'default',
    });
    setValidating(null);
  };

  // ── Permission gate ────────────────────────────────────────────────────────
  if (!can('laboratory.view')) {
    return (
      <DashboardLayout>
        <PageWrapper>
          <div className="flex items-center justify-center h-64 text-gray-400">Accès non autorisé</div>
        </PageWrapper>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageWrapper>
        <PageHeader
          title="Laboratoire"
          subtitle="Gestion des analyses biologiques"
        />

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {([
            { key: 'demandee', label: 'En attente',    color: 'bg-blue-50   text-blue-700'  },
            { key: 'prelevee', label: 'Prélevées',     color: 'bg-yellow-50 text-yellow-700'},
            { key: 'en_cours', label: 'En cours',      color: 'bg-orange-50 text-orange-700'},
            { key: 'validee',  label: 'Validées auj.', color: 'bg-green-50  text-green-700' },
          ] as const).map(s => (
            <div key={s.key} className={cn('rounded-xl p-4 flex items-center gap-3 shadow-sm border border-white/60', s.color)}>
              <p className="text-3xl font-bold tabular-nums">{counts[s.key]}</p>
              <p className="text-xs opacity-80 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              placeholder="Patient, analyse, médecin…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {STATUS_FILTERS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap',
                  statusFilter === s
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
                )}
              >
                {s === 'all' ? 'Toutes' : LAB_STATUS[s].label}
                {' '}
                <span className="opacity-70">({counts[s === 'all' ? 'all' : s]})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {orders.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <Microscope className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Aucune analyse trouvée</p>
              <p className="text-sm mt-1 opacity-70">Les demandes depuis Urgences et Consultations apparaissent ici en temps réel.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Patient / Encounter', 'Analyse', 'Priorité', 'Médecin / Source', 'Statut', 'Heure', 'Action'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orders.map(order => {
                    const st  = LAB_STATUS[order.status];
                    const urg = URGENCY[order.urgency];
                    const canAdvance = order.status !== 'validee' && order.status !== 'annulee' &&
                      (can('laboratory.validate') || (can('laboratory.create') && order.status !== 'en_cours'));

                    return (
                      <tr
                        key={order.id}
                        className={cn(
                          'hover:bg-gray-50/50 transition-colors',
                          st.row,
                          order.urgency === 'STAT' && 'bg-red-50/30',
                          order.isCritical && order.status === 'validee' && 'bg-red-50/50',
                        )}
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900">{order.patientName}</p>
                          {order.encounterId && (
                            <p className="text-[11px] font-mono text-gray-400 mt-0.5">{order.encounterId}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{order.test}</p>
                          <p className="text-xs text-gray-400">{order.category}</p>
                          {order.result && (
                            <p className={cn('text-xs mt-1 font-medium', order.isCritical ? 'text-red-600' : 'text-green-600')}>
                              {order.isCritical && <AlertTriangle className="w-3 h-3 inline mr-0.5" />}
                              {order.result}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('px-2 py-0.5 rounded-full text-xs', urg.badge)}>{urg.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-700 text-sm">{order.requestedBy}</p>
                          <p className="text-xs text-gray-400 capitalize">{order.sourceModule}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('px-2 py-0.5 rounded-full text-xs border', st.badge)}>{st.label}</span>
                          {order.isCritical && order.status === 'validee' && (
                            <span className="ml-1 text-[10px] text-red-600 font-bold">CRITIQUE</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                          {new Date(order.requestedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          {order.validatedBy && (
                            <p className="text-[10px] text-green-600 mt-0.5">par {order.validatedBy}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canAdvance && st.next && (
                            <button
                              onClick={() => handleAdvance(order)}
                              className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors',
                                st.nextColor,
                              )}
                            >
                              {st.nextLabel}
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                          {order.status === 'validee' && <CheckCircle2 className="w-4 h-4 text-green-500 inline" />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Validation modal */}
        {validating && (
          <ValidationModal
            order={validating}
            onConfirm={handleValidate}
            onClose={() => setValidating(null)}
          />
        )}
      </PageWrapper>
    </DashboardLayout>
  );
}
