/**
 * Pharmacie — Module Dispensation
 *
 * Onglet Prescriptions : lit directement depuis MockRepository (réactif, sans refresh).
 *   - Prescriptions depuis Urgences et Consultations
 *   - Flux : Prescrite → Préparée → Délivrée
 *   - Enregistrement du pharmacien + horodatage
 *   - Notification au médecin + audit à chaque transition
 *   - Alertes mock allergie / stock insuffisant
 *
 * Onglet Stock : gestion du stock médicamenteux (données locales mock).
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
  Pill, Search, ChevronRight, X, Package,
  AlertTriangle, CheckCircle2, Clock, Truck,
} from 'lucide-react';
import type { RepoPrescription, AuditCtx } from '@/types/repository';

// ─── Prescription status config ───────────────────────────────────────────────

const RX_STATUS: Record<RepoPrescription['status'], {
  label: string; badge: string; row?: string;
  next?: RepoPrescription['status']; nextLabel?: string; nextColor?: string;
  icon?: React.ReactNode;
}> = {
  prescrit: { label: 'Prescrite',  badge: 'bg-blue-100 text-blue-700 border-blue-200',   icon: <Clock className="w-3 h-3" />,          next: 'prepare',  nextLabel: 'Préparer',  nextColor: 'bg-blue-50 text-blue-700 hover:bg-blue-100'   },
  prepare:  { label: 'Préparée',   badge: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <Package className="w-3 h-3" />,       next: 'delivre',  nextLabel: 'Délivrer',  nextColor: 'bg-green-50 text-green-700 hover:bg-green-100'  },
  delivre:  { label: 'Délivrée',   badge: 'bg-green-100 text-green-700 border-green-200',  icon: <CheckCircle2 className="w-3 h-3" /> },
  annule:   { label: 'Annulée',    badge: 'bg-gray-100 text-gray-500 border-gray-200',    row: 'opacity-60' },
};

// ─── Mock stock & allergy alerts ──────────────────────────────────────────────

// Simulate known allergies and low-stock drugs (mock — would come from patient record / stock DB)
const MOCK_ALLERGIES: Record<string, string[]> = {
  'ep-01': ['Aspirine', 'HBPM'],
  'ep-02': ['Morphine'],
};

const LOW_STOCK_DRUGS = ['Adrénaline', 'Kétamine', 'Rocuronium'];

function getAlerts(rx: RepoPrescription): string[] {
  const alerts: string[] = [];
  const allergies = MOCK_ALLERGIES[rx.patientId] ?? [];
  if (allergies.some(a => rx.drug.toLowerCase().includes(a.toLowerCase()))) {
    alerts.push(`⚠ Allergie connue : ${rx.drug}`);
  }
  if (LOW_STOCK_DRUGS.some(d => rx.drug.includes(d))) {
    alerts.push(`📦 Stock faible : ${rx.drug}`);
  }
  return alerts;
}

// ─── Dispense modal ───────────────────────────────────────────────────────────

function DispenseModal({
  rx,
  onConfirm,
  onClose,
  pharmacistName,
}: {
  rx: RepoPrescription;
  onConfirm: (comment?: string) => void;
  onClose: () => void;
  pharmacistName: string;
}) {
  const [comment, setComment] = useState('');
  const alerts = getAlerts(rx);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-green-600" />
            Confirmer la délivrance
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {alerts.length > 0 && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 space-y-1">
            {alerts.map(a => (
              <p key={a} className="text-sm text-red-700 font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {a}
              </p>
            ))}
          </div>
        )}

        <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1">
          <p className="font-semibold text-gray-900">{rx.drug} — {rx.dosage}</p>
          <p className="text-sm text-gray-500">{rx.patientName}</p>
          <div className="flex gap-3 text-xs text-gray-400 mt-1">
            <span>{rx.route}</span>
            {rx.frequency && <span>{rx.frequency}</span>}
            {rx.duration && <span>× {rx.duration}</span>}
          </div>
          <p className="text-xs text-gray-400">Prescrit par {rx.prescribedBy}</p>
        </div>

        <label className="block text-sm font-medium text-gray-700 mb-1">Commentaire (optionnel)</label>
        <textarea
          rows={2}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500 mb-3"
          placeholder="Substitution générique, lot, remarque…"
          value={comment}
          onChange={e => setComment(e.target.value)}
        />

        <p className="text-xs text-gray-400 mb-4">
          Délivré par : <span className="font-medium text-gray-600">{pharmacistName}</span>
        </p>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
            Annuler
          </button>
          <button
            onClick={() => onConfirm(comment.trim() || undefined)}
            className={cn(
              'flex-1 px-4 py-2 text-sm font-semibold rounded-xl text-white transition-colors',
              alerts.length > 0 ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700',
            )}
          >
            {alerts.length > 0 ? 'Délivrer malgré alerte' : 'Confirmer la délivrance'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Mock stock tab ───────────────────────────────────────────────────────────

type StockItem = { drug: string; quantity: number; unit: string; status: 'ok' | 'low' | 'critical' };

const MOCK_STOCK: StockItem[] = [
  { drug: 'Adrénaline 1mg/mL',    quantity: 4,   unit: 'amp',  status: 'critical' },
  { drug: 'Morphine 10mg',        quantity: 12,  unit: 'amp',  status: 'low' },
  { drug: 'Kétamine 500mg',       quantity: 3,   unit: 'fl',   status: 'critical' },
  { drug: 'Paracétamol 1g',       quantity: 480, unit: 'cp',   status: 'ok' },
  { drug: 'Amoxicilline 1g',      quantity: 150, unit: 'fl',   status: 'ok' },
  { drug: 'Rocuronium 50mg',      quantity: 6,   unit: 'amp',  status: 'low' },
  { drug: 'Héparine 5000 UI',     quantity: 80,  unit: 'ser',  status: 'ok' },
  { drug: 'Sérum physiologique',  quantity: 200, unit: 'fl',   status: 'ok' },
];

const STOCK_STATUS_BADGE: Record<StockItem['status'], string> = {
  ok:       'bg-green-100 text-green-700',
  low:      'bg-yellow-100 text-yellow-700',
  critical: 'bg-red-100 text-red-700',
};

function StockTab() {
  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-red-50 text-red-700 rounded-xl p-3 flex items-center gap-3 shadow-sm">
          <p className="text-2xl font-bold">{MOCK_STOCK.filter(s => s.status === 'critical').length}</p>
          <p className="text-xs opacity-80">Critiques</p>
        </div>
        <div className="bg-yellow-50 text-yellow-700 rounded-xl p-3 flex items-center gap-3 shadow-sm">
          <p className="text-2xl font-bold">{MOCK_STOCK.filter(s => s.status === 'low').length}</p>
          <p className="text-xs opacity-80">Faibles</p>
        </div>
        <div className="bg-green-50 text-green-700 rounded-xl p-3 flex items-center gap-3 shadow-sm">
          <p className="text-2xl font-bold">{MOCK_STOCK.filter(s => s.status === 'ok').length}</p>
          <p className="text-xs opacity-80">OK</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Médicament', 'Quantité', 'Unité', 'État'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {MOCK_STOCK.sort((a, b) => {
              const ord: Record<string, number> = { critical: 0, low: 1, ok: 2 };
              return ord[a.status] - ord[b.status];
            }).map(item => (
              <tr key={item.drug} className={cn('hover:bg-gray-50/50', item.status !== 'ok' && 'bg-red-50/20')}>
                <td className="px-4 py-3 font-medium text-gray-800">{item.drug}</td>
                <td className="px-4 py-3 font-mono font-bold text-gray-900">{item.quantity}</td>
                <td className="px-4 py-3 text-gray-500">{item.unit}</td>
                <td className="px-4 py-3">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STOCK_STATUS_BADGE[item.status])}>
                    {item.status === 'ok' ? 'OK' : item.status === 'low' ? 'Faible' : 'Critique'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Prescriptions tab ────────────────────────────────────────────────────────

function PrescriptionsTab() {
  const { user } = useAuth();
  const { can } = usePermission();
  const { toast } = useToast();
  const repo = useMockRepository();

  const [statusFilter, setStatusFilter] = useState<RepoPrescription['status'] | 'all'>('all');
  const [search, setSearch] = useState('');
  const [delivering, setDelivering] = useState<RepoPrescription | null>(null);

  const pharmacistName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Pharmacien';

  const ctx: AuditCtx = {
    userId:   user?.id ?? 'unknown',
    userName: pharmacistName,
    userRole: user?.role ?? 'unknown',
  };

  const prescriptions = useMemo(() => {
    let list = repo.prescriptions;
    if (statusFilter !== 'all') list = list.filter(p => p.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.patientName.toLowerCase().includes(q) ||
        p.drug.toLowerCase().includes(q) ||
        p.prescribedBy.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      const order: Record<string, number> = { prescrit: 0, prepare: 1, delivre: 2, annule: 3 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return new Date(b.prescribedAt).getTime() - new Date(a.prescribedAt).getTime();
    });
  }, [repo.prescriptions, statusFilter, search]);

  const counts = useMemo(() => {
    const base = { all: repo.prescriptions.length, prescrit: 0, prepare: 0, delivre: 0, annule: 0 };
    repo.prescriptions.forEach(p => { if (p.status in base) (base as Record<string, number>)[p.status]++; });
    return base;
  }, [repo.prescriptions]);

  const handleAdvance = (rx: RepoPrescription) => {
    const cfg = RX_STATUS[rx.status];
    if (!cfg.next) return;
    if (cfg.next === 'delivre') {
      setDelivering(rx);
      return;
    }
    repo.updatePrescriptionStatus(rx.id, cfg.next, ctx);
    toast({ title: 'Statut mis à jour', description: `${rx.drug} → ${RX_STATUS[cfg.next].label}` });
  };

  const handleDeliver = (comment?: string) => {
    if (!delivering) return;
    const alerts = getAlerts(delivering);
    repo.updatePrescriptionStatus(delivering.id, 'delivre', ctx, {
      dispensedBy: pharmacistName,
      comment,
    });
    if (alerts.length > 0) {
      toast({ title: 'Délivré avec alerte', description: alerts.join(' · '), variant: 'destructive' });
    } else {
      toast({ title: 'Médicament délivré', description: `${delivering.drug} — ${delivering.patientName}` });
    }
    setDelivering(null);
  };

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {([
          { key: 'prescrit', label: 'Prescrites', color: 'bg-blue-50   text-blue-700'  },
          { key: 'prepare',  label: 'Préparées',  color: 'bg-yellow-50 text-yellow-700'},
          { key: 'delivre',  label: 'Délivrées',  color: 'bg-green-50  text-green-700' },
          { key: 'annule',   label: 'Annulées',   color: 'bg-gray-50   text-gray-500'  },
        ] as const).map(s => (
          <div key={s.key} className={cn('rounded-xl p-3 flex items-center gap-3 shadow-sm border border-white/60', s.color)}>
            <p className="text-2xl font-bold tabular-nums">{counts[s.key]}</p>
            <p className="text-xs opacity-80">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="Patient, médicament, médecin…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {(['all', 'prescrit', 'prepare', 'delivre'] as const).map(s => (
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
              {s === 'all' ? 'Toutes' : RX_STATUS[s].label}
              {' '}
              <span className="opacity-70">({counts[s === 'all' ? 'all' : s]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {prescriptions.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Pill className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Aucune prescription trouvée</p>
            <p className="text-sm mt-1 opacity-70">Les prescriptions depuis Urgences et Consultations apparaissent ici.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Patient / Encounter', 'Médicament', 'Posologie', 'Médecin / Source', 'Statut', 'Heure', 'Action'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {prescriptions.map(rx => {
                  const st     = RX_STATUS[rx.status];
                  const alerts = rx.status !== 'delivre' && rx.status !== 'annule' ? getAlerts(rx) : [];
                  const canAct  = can('pharmacy.dispense') && rx.status !== 'delivre' && rx.status !== 'annule';

                  return (
                    <tr
                      key={rx.id}
                      className={cn(
                        'hover:bg-gray-50/50 transition-colors',
                        st.row,
                        alerts.length > 0 && 'bg-red-50/20',
                      )}
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{rx.patientName}</p>
                        {rx.encounterId && <p className="text-[11px] font-mono text-gray-400 mt-0.5">{rx.encounterId}</p>}
                        {alerts.map(a => (
                          <p key={a} className="text-[10px] text-red-600 font-medium flex items-center gap-0.5 mt-0.5">
                            <AlertTriangle className="w-3 h-3 shrink-0" />{a}
                          </p>
                        ))}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{rx.drug}</p>
                        <p className="text-xs text-gray-400">{rx.dosage}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        <p>{rx.route}</p>
                        {rx.frequency && <p>{rx.frequency}</p>}
                        {rx.duration && <p>{rx.duration}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-700 text-sm">{rx.prescribedBy}</p>
                        <p className="text-xs text-gray-400 capitalize">{rx.sourceModule}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs border flex items-center gap-1 w-fit', st.badge)}>
                          {st.icon}{st.label}
                        </span>
                        {rx.dispensedBy && (
                          <p className="text-[10px] text-green-600 mt-0.5">par {rx.dispensedBy}</p>
                        )}
                        {rx.preparedBy && rx.status === 'prepare' && (
                          <p className="text-[10px] text-yellow-600 mt-0.5">préparé par {rx.preparedBy}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {new Date(rx.prescribedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canAct && st.next && (
                          <button
                            onClick={() => handleAdvance(rx)}
                            className={cn(
                              'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors',
                              st.nextColor,
                            )}
                          >
                            {st.nextLabel}
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                        {rx.status === 'delivre' && <CheckCircle2 className="w-4 h-4 text-green-500 inline" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dispense confirmation modal */}
      {delivering && (
        <DispenseModal
          rx={delivering}
          pharmacistName={pharmacistName}
          onConfirm={handleDeliver}
          onClose={() => setDelivering(null)}
        />
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = 'prescriptions' | 'stock';

export default function PharmacyPage() {
  const { can } = usePermission();
  const [tab, setTab] = useState<Tab>('prescriptions');

  if (!can('pharmacy.view')) {
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
          title="Pharmacie"
          subtitle="Dispensation des médicaments et gestion du stock"
        />

        {/* Tab nav */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 w-fit">
          {([
            { key: 'prescriptions', label: 'Prescriptions', icon: <Pill className="w-4 h-4" /> },
            { key: 'stock',         label: 'Stock',         icon: <Package className="w-4 h-4" /> },
          ] as { key: Tab; label: string; icon: React.ReactNode }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                tab === t.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {tab === 'prescriptions' ? <PrescriptionsTab /> : <StockTab />}
      </PageWrapper>
    </DashboardLayout>
  );
}
