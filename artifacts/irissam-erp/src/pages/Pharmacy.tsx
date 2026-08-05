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
 * Onglet Stock : gestion du stock médicamenteux via l'API (CRUD complet).
 */
import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ScrollableTabBar } from '@/components/ui/ScrollableTabBar';
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
  Plus, Pencil, Trash2, Loader2, ChevronLeft, ChevronRight as ChevronRightIcon,
  Download,
} from 'lucide-react';
import type { RepoPrescription, AuditCtx } from '@/types/repository';
import { PublishToPortalButton } from '@/components/portal/PublishToPortalButton';
import {
  useGetMedications,
  useCreateMedication,
  useUpdateMedication,
  useDeleteMedication,
  getMedications,
  getGetMedicationsQueryKey,
  type MedicationItem,
  type CreateMedicationBody,
  type UpdateMedicationBody,
} from '@workspace/api-client-react';

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

// ─── Stock & prescription alerts ─────────────────────────────────────────────

// Drugs that commonly show low-stock situations; will be replaced by
// a real stock-level API call when the inventory bridge is wired.
const LOW_STOCK_DRUGS = ['Adrénaline', 'Kétamine', 'Rocuronium'];

function getAlerts(rx: RepoPrescription): string[] {
  const alerts: string[] = [];
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
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-6 max-h-[95dvh] overflow-y-auto">
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

// ─── Medication form modal (create / edit) ────────────────────────────────────

type MedFormValues = {
  name: string;
  unit: string;
  quantity: string;
  lowStockThreshold: string;
  expiryDate: string;
};

function MedicationFormModal({
  initial,
  onClose,
  onSave,
  isSaving,
}: {
  initial?: MedicationItem;
  onClose: () => void;
  onSave: (values: MedFormValues) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<MedFormValues>({
    name: initial?.name ?? '',
    unit: initial?.unit ?? 'unités',
    quantity: initial?.quantity?.toString() ?? '0',
    lowStockThreshold: initial?.lowStockThreshold?.toString() ?? '10',
    expiryDate: initial?.expiryDate ?? '',
  });

  const isEdit = !!initial;

  function set(field: keyof MedFormValues, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg p-6 max-h-[95dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Pill className="w-5 h-5 text-blue-600" />
            {isEdit ? 'Modifier le médicament' : 'Nouveau médicament'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="text"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex : Paracétamol 1g"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </div>

          {/* Unit + Quantity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unité</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="cp, amp, fl…"
                value={form.unit}
                onChange={e => set('unit', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantité</label>
              <input
                type="number"
                min={0}
                step={1}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.quantity}
                onChange={e => set('quantity', e.target.value)}
              />
            </div>
          </div>

          {/* Threshold + Expiry */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seuil d'alerte</label>
              <input
                type="number"
                min={0}
                step={1}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.lowStockThreshold}
                onChange={e => set('lowStockThreshold', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date d'expiration</label>
              <input
                type="date"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.expiryDate}
                onChange={e => set('expiryDate', e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving || !form.name.trim()}
              className="flex-1 px-4 py-2 text-sm font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete confirmation dialog ───────────────────────────────────────────────

function DeleteConfirmModal({
  medication,
  onConfirm,
  onClose,
  isDeleting,
}: {
  medication: MedicationItem;
  onConfirm: () => void;
  onClose: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm p-6 max-h-[95dvh] overflow-y-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Supprimer ce médicament ?</h3>
            <p className="text-sm text-gray-500 mt-0.5">{medication.name}</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          Cette action est irréversible. Le médicament sera retiré de l'inventaire.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 text-sm font-semibold rounded-xl text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stock status helpers ─────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  ok:       { label: 'OK',       cls: 'bg-green-100 text-green-700' },
  low:      { label: 'Faible',   cls: 'bg-yellow-100 text-yellow-700' },
  critical: { label: 'Critique', cls: 'bg-red-100 text-red-700' },
  expired:  { label: 'Expiré',   cls: 'bg-gray-100 text-gray-500' },
};

const STATUS_FILTER_OPTIONS = [
  { value: 'all',      label: 'Tous' },
  { value: 'critical', label: 'Critiques' },
  { value: 'low',      label: 'Faibles' },
  { value: 'expired',  label: 'Expirés' },
  { value: 'ok',       label: 'OK' },
] as const;

// ─── Real stock tab ───────────────────────────────────────────────────────────

function StockTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const [formTarget, setFormTarget] = useState<MedicationItem | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MedicationItem | null>(null);

  const { data, isLoading, isError } = useGetMedications(
    { status: statusFilter as 'all' | 'ok' | 'low' | 'critical' | 'expired', search: search || undefined, page, pageSize: PAGE_SIZE },
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: [getGetMedicationsQueryKey()[0]] });

  const createMut = useCreateMedication({
    mutation: {
      onSuccess: () => {
        toast({ title: 'Médicament créé' });
        setFormTarget(null);
        invalidate();
      },
      onError: () => toast({ title: 'Erreur lors de la création', variant: 'destructive' }),
    },
  });

  const updateMut = useUpdateMedication({
    mutation: {
      onSuccess: () => {
        toast({ title: 'Médicament mis à jour' });
        setFormTarget(null);
        invalidate();
      },
      onError: () => toast({ title: 'Erreur lors de la mise à jour', variant: 'destructive' }),
    },
  });

  const deleteMut = useDeleteMedication({
    mutation: {
      onSuccess: () => {
        toast({ title: 'Médicament supprimé' });
        setDeleteTarget(null);
        invalidate();
      },
      onError: () => toast({ title: 'Erreur lors de la suppression', variant: 'destructive' }),
    },
  });

  function handleSave(values: MedFormValues) {
    const qty = parseInt(values.quantity, 10);
    const threshold = parseInt(values.lowStockThreshold, 10);

    if (formTarget === 'new') {
      const body: CreateMedicationBody = {
        name: values.name.trim(),
        unit: values.unit || undefined,
        quantity: isNaN(qty) ? 0 : qty,
        lowStockThreshold: isNaN(threshold) ? 10 : threshold,
        expiryDate: values.expiryDate || null,
      };
      createMut.mutate({ data: body });
    } else if (formTarget) {
      const body: UpdateMedicationBody = {
        name: values.name.trim(),
        unit: values.unit || undefined,
        quantity: isNaN(qty) ? 0 : qty,
        lowStockThreshold: isNaN(threshold) ? 10 : threshold,
        expiryDate: values.expiryDate || null,
      };
      updateMut.mutate({ id: formTarget.id, data: body });
    }
  }

  const medications = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Summary counts (from current page — for full counts we'd need separate requests;
  // use the visible page data for the status bar)
  const criticalCount = medications.filter(m => m.status === 'critical').length;
  const lowCount      = medications.filter(m => m.status === 'low').length;
  const okCount       = medications.filter(m => m.status === 'ok').length;

  const isMutating = createMut.isPending || updateMut.isPending;

  const [isExporting, setIsExporting] = useState(false);

  async function handleExportCSV() {
    setIsExporting(true);
    try {
      const result = await getMedications({
        status: statusFilter as 'all' | 'ok' | 'low' | 'critical' | 'expired',
        search: search || undefined,
        page: 1,
        pageSize: 10000,
      });
      const rows = result.data ?? [];

      const STATUS_LABELS: Record<string, string> = {
        ok: 'OK', low: 'Faible', critical: 'Critique', expired: 'Expiré',
      };

      const header = ['Médicament', 'Quantité', 'Unité', 'Seuil d\'alerte', 'Date d\'expiration', 'État'];
      const csvLines = [
        header.join(';'),
        ...rows.map(m => [
          `"${m.name.replace(/"/g, '""')}"`,
          m.quantity,
          `"${(m.unit ?? '').replace(/"/g, '""')}"`,
          m.lowStockThreshold,
          m.expiryDate ? new Date(m.expiryDate).toLocaleDateString('fr-FR') : '',
          STATUS_LABELS[m.status] ?? m.status,
        ].join(';')),
      ];

      const csv = '\uFEFF' + csvLines.join('\r\n'); // BOM for Excel UTF-8
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filterLabel = statusFilter !== 'all' ? `_${statusFilter}` : '';
      link.href = url;
      link.download = `stock_pharmacie${filterLabel}_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent — toast not critical for export
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div>
      {/* Action bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="Rechercher un médicament…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        {/* Status filter */}
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setStatusFilter(opt.value); setPage(1); }}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap',
                statusFilter === opt.value
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Export CSV + New medication buttons */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportCSV}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Exporter CSV
          </button>
          <button
            onClick={() => setFormTarget('new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nouveau médicament
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-red-50 text-red-700 rounded-xl p-3 flex items-center gap-3 shadow-sm">
          <p className="text-2xl font-bold tabular-nums">{criticalCount}</p>
          <p className="text-xs opacity-80">Critiques</p>
        </div>
        <div className="bg-yellow-50 text-yellow-700 rounded-xl p-3 flex items-center gap-3 shadow-sm">
          <p className="text-2xl font-bold tabular-nums">{lowCount}</p>
          <p className="text-xs opacity-80">Faibles</p>
        </div>
        <div className="bg-green-50 text-green-700 rounded-xl p-3 flex items-center gap-3 shadow-sm">
          <p className="text-2xl font-bold tabular-nums">{okCount}</p>
          <p className="text-xs opacity-80">OK</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span className="text-sm">Chargement…</span>
          </div>
        ) : isError ? (
          <div className="text-center py-20 text-red-500">
            <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">Erreur lors du chargement du stock</p>
          </div>
        ) : medications.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Aucun médicament trouvé</p>
            <p className="text-sm mt-1 opacity-70">
              {search || statusFilter !== 'all'
                ? 'Essayez de modifier vos filtres.'
                : 'Cliquez sur « Nouveau médicament » pour commencer.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Médicament', 'Quantité', 'Unité', 'Seuil', 'Expiration', 'État', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {medications.map(med => {
                  const badge = STATUS_BADGE[med.status] ?? STATUS_BADGE.ok;
                  return (
                    <tr
                      key={med.id}
                      className={cn(
                        'hover:bg-gray-50/50 transition-colors',
                        med.status === 'critical' && 'bg-red-50/30',
                        med.status === 'expired'  && 'bg-gray-50/50 opacity-70',
                      )}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{med.name}</p>
                        {med.expiringSoon && (
                          <p className="text-[10px] text-orange-600 font-medium flex items-center gap-0.5 mt-0.5">
                            <AlertTriangle className="w-3 h-3 shrink-0" />Expire bientôt
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-gray-900">{med.quantity}</td>
                      <td className="px-4 py-3 text-gray-500">{med.unit}</td>
                      <td className="px-4 py-3 text-gray-500 tabular-nums">{med.lowStockThreshold}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {med.expiryDate
                          ? new Date(med.expiryDate).toLocaleDateString('fr-FR')
                          : <span className="text-gray-300">—</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', badge.cls)}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setFormTarget(med)}
                            title="Modifier"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(med)}
                            title="Supprimer"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>{total} médicament{total > 1 ? 's' : ''}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-medium text-gray-700">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      {formTarget !== null && (
        <MedicationFormModal
          initial={formTarget === 'new' ? undefined : formTarget}
          onClose={() => setFormTarget(null)}
          onSave={handleSave}
          isSaving={isMutating}
        />
      )}

      {/* Delete confirm modal */}
      {deleteTarget !== null && (
        <DeleteConfirmModal
          medication={deleteTarget}
          onConfirm={() => deleteMut.mutate({ id: deleteTarget.id })}
          onClose={() => setDeleteTarget(null)}
          isDeleting={deleteMut.isPending}
        />
      )}
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
                  {['Patient / Encounter', 'Médicament', 'Posologie', 'Médecin / Source', 'Statut', 'Heure', 'Portail', 'Action'].map(h => (
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
                      <td className="px-4 py-3">
                        <PublishToPortalButton
                          entityType="prescriptions"
                          entityId={rx.id}
                          isPublished={false}
                          status={rx.status}
                        />
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

        {/* Tab nav — pill variant */}
        <div className="mb-5">
          <ScrollableTabBar
            variant="pill"
            tabs={[
              { id: 'prescriptions', label: 'Prescriptions', icon: <Pill className="w-4 h-4" /> },
              { id: 'stock',         label: 'Stock',         icon: <Package className="w-4 h-4" /> },
            ]}
            activeTab={tab}
            onTabChange={id => setTab(id as Tab)}
            className="w-fit"
          />
        </div>

        {tab === 'prescriptions' ? <PrescriptionsTab /> : <StockTab />}
      </PageWrapper>
    </DashboardLayout>
  );
}
