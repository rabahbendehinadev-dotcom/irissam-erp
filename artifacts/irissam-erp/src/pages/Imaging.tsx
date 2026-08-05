/**
 * Imagerie — Module Radiologie
 *
 * Connecté au backend réel via GET /imaging-orders.
 * Mutations : PATCH /imaging-orders/:id/status · POST /imaging-orders/:id/report
 */
import { useState, useMemo, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageWrapper } from '@/components/shared/PageWrapper';
import { useQuery } from '@/hooks/useQuery';
import { apiClient } from '@/services/api/client';
import { useAuth } from '@/store/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  ScanLine, Search, ChevronRight, X, FileText, Eye, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { PublishToPortalButton } from '@/components/portal/PublishToPortalButton';

// ─── API type ─────────────────────────────────────────────────────────────────

type ApiImagingOrder = {
  id: string;
  encounterId: string | null;
  patientId: string;
  patientName: string;
  visitId: string | null;
  exam: string;
  region: string;
  side: string | null;
  urgency: 'STAT' | 'urgent' | 'routine';
  withContrast: boolean;
  requestedByName: string;
  requestedAt: string | null;
  status: 'demandee' | 'planifiee' | 'realisee' | 'interpretee' | 'annulee';
  result: string | null;
  resultAt: string | null;
  report: string | null;
  reportedByName: string | null;
  interpretedByName: string | null;
  interpretedAt: string | null;
  sourceModule: string;
};

// ─── Config ───────────────────────────────────────────────────────────────────

const IMG_STATUS: Record<ApiImagingOrder['status'], {
  label: string; badge: string;
  next?: ApiImagingOrder['status']; nextLabel?: string; nextColor?: string;
}> = {
  demandee:    { label: 'Demandée',    badge: 'bg-blue-100 text-blue-700 border-blue-200',     next: 'planifiee',   nextLabel: 'Planifier',    nextColor: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
  planifiee:   { label: 'Planifiée',   badge: 'bg-purple-100 text-purple-700 border-purple-200', next: 'realisee',   nextLabel: 'Réalisé',      nextColor: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
  realisee:    { label: 'Réalisée',    badge: 'bg-orange-100 text-orange-700 border-orange-200', next: 'interpretee', nextLabel: 'Interpréter →', nextColor: 'bg-green-50 text-green-700 hover:bg-green-100' },
  interpretee: { label: 'Interprétée', badge: 'bg-green-100 text-green-700 border-green-200' },
  annulee:     { label: 'Annulée',     badge: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const URGENCY: Record<ApiImagingOrder['urgency'], { label: string; badge: string }> = {
  STAT:    { label: 'STAT',    badge: 'bg-red-100 text-red-700 font-bold border border-red-200' },
  urgent:  { label: 'Urgent',  badge: 'bg-orange-100 text-orange-700 border border-orange-200' },
  routine: { label: 'Routine', badge: 'bg-gray-100 text-gray-600 border border-gray-200' },
};

// ─── Report modal ─────────────────────────────────────────────────────────────

function ReportModal({
  order,
  onConfirm,
  onClose,
  radiologistName,
}: {
  order: ApiImagingOrder;
  onConfirm: (result: string, report: string) => void;
  onClose: () => void;
  radiologistName: string;
}) {
  const [result, setResult] = useState('');
  const [report, setReport] = useState('');
  const { toast } = useToast();

  const MOCK_REPORT_TEMPLATES: Record<string, string> = {
    'Radiographie': `Technique : Radiographie standard face/profil.\n\nRésultats :\n- Champs pulmonaires libres, pas d'opacité suspecte.\n- Silhouette cardiaque de taille normale (ICT < 0.5).\n- Trame vasculaire normale.\n\nConclusion : Pas d'anomalie radiologique évidente.`,
    'Scanner': `Technique : TDM sans injection de produit de contraste.\n\nRésultats :\n- Pas de lésion parenchymateuse.\n- Structures médianes en place.\n- Espaces sous-arachnoïdiens normaux.\n\nConclusion : Examen dans les limites de la normale.`,
    'Échographie': `Technique : Échographie abdominale avec sonde convexe 3.5 MHz.\n\nRésultats :\n- Foie de taille normale, échogénicité homogène.\n- Voies biliaires non dilatées.\n- Vésicule biliaire sans lithiase visible.\n- Reins de taille et d'échogénicité normales.\n\nConclusion : Pas d'anomalie échographique.`,
  };

  const autoFill = () => {
    const key = Object.keys(MOCK_REPORT_TEMPLATES).find(k => order.exam.includes(k)) ?? 'Échographie';
    setReport(MOCK_REPORT_TEMPLATES[key]);
    setResult(`${order.exam} réalisé — aucune anomalie majeure`);
  };

  const handleSubmit = () => {
    if (!result.trim() || !report.trim()) {
      toast({ title: 'Champs requis', description: 'Le résultat et le compte rendu sont obligatoires.', variant: 'destructive' });
      return;
    }
    onConfirm(result.trim(), report.trim());
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6 my-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-green-600" />
            Compte rendu d'imagerie
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1">
          <p className="font-semibold text-gray-900">{order.exam} — {order.region}{order.side ? ` (${order.side})` : ''}</p>
          <p className="text-sm text-gray-500">{order.patientName}</p>
          <div className="flex gap-3 text-xs text-gray-400 mt-1">
            <span>Demandé par {order.requestedByName}</span>
            <span className="capitalize">{order.sourceModule}</span>
            {order.withContrast && <span className="text-purple-600 font-medium">Avec contraste</span>}
          </div>
        </div>

        <div className="flex justify-end mb-2">
          <button
            onClick={autoFill}
            className="text-xs text-blue-600 hover:text-blue-800 underline transition-colors"
          >
            Remplir avec compte rendu type
          </button>
        </div>

        <label className="block text-sm font-medium text-gray-700 mb-1">Résultat court *</label>
        <input
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
          placeholder="Ex: Pas d'anomalie osseuse — fracture L2 non déplacée"
          value={result}
          onChange={e => setResult(e.target.value)}
          autoFocus
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">Compte rendu complet *</label>
        <textarea
          rows={7}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
          placeholder="Technique, résultats détaillés, conclusion…"
          value={report}
          onChange={e => setReport(e.target.value)}
        />

        <p className="text-xs text-gray-400 mb-4">
          Radiologue : <span className="font-medium text-gray-600">{radiologistName}</span>
        </p>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 text-sm font-semibold rounded-xl text-white bg-green-600 hover:bg-green-700 transition-colors"
          >
            Valider le rapport
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Row detail expand ────────────────────────────────────────────────────────

function ReportPanel({ order }: { order: ApiImagingOrder }) {
  return (
    <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-sm">
      <p className="font-medium text-gray-700 mb-1">Compte rendu :</p>
      <pre className="whitespace-pre-wrap text-gray-600 text-xs font-mono leading-relaxed bg-white border border-gray-100 rounded-lg p-3">
        {order.report}
      </pre>
      {order.interpretedByName && (
        <p className="text-xs text-gray-400 mt-2">
          Interprété par {order.interpretedByName} · {order.interpretedAt ? new Date(order.interpretedAt).toLocaleString('fr-FR') : ''}
        </p>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ImagingPage() {
  const { user } = useAuth();
  const { can } = usePermission();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState<ApiImagingOrder['status'] | 'all'>('all');
  const [search, setSearch] = useState('');
  const [interpreting, setInterpreting] = useState<ApiImagingOrder | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const radiologistName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Dr. Radiologue';

  const { data: rawOrders, loading, error, refetch } = useQuery<ApiImagingOrder[]>('/imaging-orders');
  const allOrders = rawOrders ?? [];

  // ── Filtered list ─────────────────────────────────────────────────────────
  const orders = useMemo(() => {
    let list = allOrders;
    if (statusFilter !== 'all') list = list.filter(o => o.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        o.patientName.toLowerCase().includes(q) ||
        o.exam.toLowerCase().includes(q) ||
        o.region.toLowerCase().includes(q) ||
        o.requestedByName.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      const aScore = a.urgency === 'STAT' ? 3 : a.urgency === 'urgent' ? 1 : 0;
      const bScore = b.urgency === 'STAT' ? 3 : b.urgency === 'urgent' ? 1 : 0;
      if (aScore !== bScore) return bScore - aScore;
      return new Date(b.requestedAt ?? 0).getTime() - new Date(a.requestedAt ?? 0).getTime();
    });
  }, [allOrders, statusFilter, search]);

  const counts = useMemo(() => {
    const base = { all: allOrders.length, demandee: 0, planifiee: 0, realisee: 0, interpretee: 0, annulee: 0 };
    allOrders.forEach(o => { if (o.status in base) (base as Record<string, number>)[o.status]++; });
    return base;
  }, [allOrders]);

  const handleAdvance = useCallback(async (order: ApiImagingOrder) => {
    const cfg = IMG_STATUS[order.status];
    if (!cfg.next) return;
    if (cfg.next === 'interpretee') {
      setInterpreting(order);
      return;
    }
    try {
      await apiClient.request(`/imaging-orders/${order.id}/status`, { method: 'PATCH', body: { status: cfg.next } });
      toast({ title: 'Statut mis à jour', description: `${order.exam} → ${IMG_STATUS[cfg.next].label}` });
      refetch();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: e?.message ?? 'Mise à jour impossible' });
    }
  }, [toast, refetch]);

  const handleInterpret = useCallback(async (result: string, report: string) => {
    if (!interpreting) return;
    try {
      await apiClient.request(`/imaging-orders/${interpreting.id}/report`, { method: 'POST', body: { result, report } });
      toast({ title: 'Rapport validé', description: `${interpreting.exam} — ${interpreting.patientName}` });
      setInterpreting(null);
      refetch();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: e?.message ?? 'Validation impossible' });
    }
  }, [interpreting, toast, refetch]);

  // ── Loading / error states ─────────────────────────────────────────────────
  if (loading) {
    return (
      <DashboardLayout>
        <PageWrapper>
          <PageHeader title="Imagerie médicale" subtitle="Gestion des examens radiologiques" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        </PageWrapper>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <PageWrapper>
          <PageHeader title="Imagerie médicale" subtitle="Gestion des examens radiologiques" />
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>Impossible de charger les examens : {error}</span>
            <button onClick={refetch} className="ml-auto flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-800 border border-red-300 rounded-lg px-2.5 py-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Réessayer
            </button>
          </div>
        </PageWrapper>
      </DashboardLayout>
    );
  }

  if (!can('imaging.view')) {
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
          title="Imagerie médicale"
          subtitle="Gestion des examens radiologiques"
        />

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {([
            { key: 'demandee',  label: 'En attente',    color: 'bg-blue-50   text-blue-700'   },
            { key: 'planifiee', label: 'Planifiées',    color: 'bg-purple-50 text-purple-700' },
            { key: 'realisee',  label: 'Réalisées',     color: 'bg-orange-50 text-orange-700' },
            { key: 'interpretee',label: 'Interprétées', color: 'bg-green-50  text-green-700'  },
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
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              placeholder="Patient, examen, région, médecin…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {(['all', 'demandee', 'planifiee', 'realisee', 'interpretee'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap',
                  statusFilter === s
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
                )}
              >
                {s === 'all' ? 'Toutes' : IMG_STATUS[s].label}
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
              <ScanLine className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Aucun examen trouvé</p>
              <p className="text-sm mt-1 opacity-70">Les demandes d'imagerie apparaissent ici en temps réel.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Patient / Encounter', 'Examen', 'Priorité', 'Médecin / Source', 'Statut', 'Heure', 'Portail', 'Action'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orders.map(order => {
                    const st  = IMG_STATUS[order.status];
                    const urg = URGENCY[order.urgency];
                    const canAdvance = order.status !== 'interpretee' && order.status !== 'annulee' && can('imaging.request');
                    const isExpanded = expanded === order.id;

                    return [
                      <tr
                        key={order.id}
                        className={cn(
                          'hover:bg-gray-50/50 transition-colors',
                          order.urgency === 'STAT' && 'bg-red-50/30',
                        )}
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900">{order.patientName}</p>
                          {order.encounterId && (
                            <p className="text-[11px] font-mono text-gray-400 mt-0.5">{order.encounterId}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{order.exam}</p>
                          <p className="text-xs text-gray-400">
                            {order.region}{order.side ? ` · ${order.side}` : ''}{order.withContrast ? ' · avec contraste' : ''}
                          </p>
                          {order.result && (
                            <p className="text-xs text-green-700 mt-0.5 font-medium">{order.result}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('px-2 py-0.5 rounded-full text-xs', urg.badge)}>{urg.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-700 text-sm">{order.requestedByName}</p>
                          <p className="text-xs text-gray-400 capitalize">{order.sourceModule}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('px-2 py-0.5 rounded-full text-xs border', st.badge)}>{st.label}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                          {order.requestedAt ? new Date(order.requestedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <PublishToPortalButton
                            entityType="imaging"
                            entityId={order.id}
                            isPublished={false}
                            status={order.status}
                          />
                        </td>
                        <td className="px-4 py-3 text-right flex items-center justify-end gap-1">
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
                          {order.report && (
                            <button
                              onClick={() => setExpanded(isExpanded ? null : order.id)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                              title="Voir le compte rendu"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>,
                      isExpanded && order.report && (
                        <tr key={`${order.id}-report`}>
                          <td colSpan={7} className="p-0">
                            <ReportPanel order={order} />
                          </td>
                        </tr>
                      ),
                    ];
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Report modal */}
        {interpreting && (
          <ReportModal
            order={interpreting}
            radiologistName={radiologistName}
            onConfirm={handleInterpret}
            onClose={() => setInterpreting(null)}
          />
        )}
      </PageWrapper>
    </DashboardLayout>
  );
}
