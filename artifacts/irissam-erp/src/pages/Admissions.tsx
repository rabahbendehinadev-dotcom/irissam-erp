import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { ScrollableTabBar } from '@/components/ui/ScrollableTabBar';
import { PlusCircle, Download, AlertTriangle, Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  AdmissionMiniDashboard, AdmissionFilters, AdmissionTable,
  AdmissionForm, AdmissionTimeline,
  DEFAULT_ADM_FILTERS, type AdmissionFiltersState,
} from '@/components/admissions';
import { AdmissionStatusBadge } from '@/components/admissions/AdmissionStatusBadge';
import { AdmissionTypeBadge } from '@/components/admissions/AdmissionTypeBadge';
import { PriorityBadge } from '@/components/admissions/PriorityBadge';
import { TransferBedModal } from '@/components/admissions/TransferBedModal';
import {
  MOCK_ADMISSION_TIMELINES,
} from '@/mock';
import type { Admission } from '@/types/admission';
import { useLanguage } from '@/i18n';
import { usePermission } from '@/hooks/usePermission';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useAdmissionsApi } from '@/hooks/useAdmissionsApi';
import { useAuth } from '@/store/AuthContext';
import { formatDate } from '@/utils/format';
import { PatientAvatar } from '@/components/shared/PatientAvatar';
import { PatientDrawer } from '@/components/shared/PatientDrawer';

// ─── Discharge modal ─────────────────────────────────────────────────────────

function DischargeModal({ admission, onConfirm, onCancel }: {
  admission: Admission;
  onConfirm: (type: string, date: string, time: string, notes: string) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const today = new Date().toISOString().slice(0, 10);
  const now   = new Date().toTimeString().slice(0, 5);
  const [type, setType] = useState('domicile');
  const [date, setDate] = useState(today);
  const [time, setTime] = useState(now);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy]   = useState(false);
  const cls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400';

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onConfirm(type, date, time, notes);
    } catch (e: any) {
      setError(e?.data?.error ?? e?.message ?? 'Échec de la sortie');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-6 max-h-[95dvh] overflow-y-auto">
        <h3 className="font-bold text-gray-900 text-lg mb-1">{t('adm.discharge.title')}</h3>
        <p className="text-xs text-gray-500 mb-4">
          {admission.patientName} · Lit {admission.bedNumber || '—'} · {admission.serviceName}
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('adm.discharge.type')}</label>
            <select value={type} onChange={e => setType(e.target.value)} className={cls}>
              {['domicile','transfert_interne','transfert_externe','deces','fugue','contre_avis'].map(v =>
                <option key={v} value={v}>{t(`adm.discharge.type.${v}` as any)}</option>
              )}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('adm.discharge.date')}</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={cls}
                min={admission.admissionDate || undefined} max={today} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('adm.discharge.time')}</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className={cls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('adm.discharge.notes')}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className={`${cls} resize-none`} />
          </div>
          {admission.bedNumber && (
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-2.5">
              Le lit {admission.bedNumber} passera en <span className="font-medium">nettoyage</span>, puis redeviendra
              disponible une fois le nettoyage terminé (Hospitalisation).
            </p>
          )}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg p-3 text-xs text-red-700">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel} disabled={busy}
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">
            {t('adm.form.cancel')}
          </button>
          <button onClick={submit} disabled={busy}
            className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-40 flex items-center justify-center gap-1.5">
            {busy && <Loader2 size={13} className="animate-spin" />}
            {t('adm.discharge.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── Detail panel (slide-in) ─────────────────────────────────────────────────

function AdmissionDetailPanel({ admission, onClose }: { admission: Admission; onClose: () => void }) {
  const { t } = useLanguage();
  const timeline = MOCK_ADMISSION_TIMELINES[admission.id] ?? [];
  const [tab, setTab] = useState<'overview' | 'timeline'>('overview');

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-xl bg-white h-full flex flex-col shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-start gap-3 z-10">
          <PatientAvatar name={admission.patientName} size="md" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900">{admission.patientName}</p>
            <p className="text-xs font-mono text-gray-400">{admission.admissionNumber} · {admission.patientMpiId}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <AdmissionStatusBadge status={admission.status} />
              <AdmissionTypeBadge type={admission.type} />
              <PriorityBadge priority={admission.priority} />
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 flex-shrink-0">✕</button>
        </div>

        {/* Tabs — scrollable */}
        <div className="border-b border-gray-200">
          <ScrollableTabBar
            tabs={[
              { id: 'overview',  label: 'Vue générale' },
              { id: 'timeline',  label: t('adm.timeline.title') },
            ]}
            activeTab={tab}
            onTabChange={id => setTab(id as 'overview' | 'timeline')}
            className="px-3"
          />
        </div>

        {/* Content */}
        <div className="flex-1 p-5">
          {tab === 'overview' && (
            <div className="space-y-4 text-sm">
              {[
                { l: 'Service', v: admission.serviceName },
                { l: 'Médecin', v: admission.doctorName },
                { l: 'Motif', v: admission.motif },
                { l: 'Date admission', v: `${formatDate(admission.admissionDate)} à ${admission.admissionTime}` },
                admission.bedNumber ? { l: 'Lit', v: `${admission.bedNumber} — ${admission.buildingName} · ${admission.floorLabel}` } : null,
                admission.expectedDischargeDate ? { l: 'Sortie prévisionnelle', v: formatDate(admission.expectedDischargeDate) } : null,
                admission.actualDischargeDate ? { l: 'Date de sortie', v: formatDate(admission.actualDischargeDate) } : null,
                admission.transferTo ? { l: 'Transféré vers', v: admission.transferTo } : null,
                admission.notes ? { l: 'Notes', v: admission.notes } : null,
              ].filter(Boolean).map((row, i) => (
                <div key={i} className="flex flex-col gap-0.5">
                  <span className="text-xs text-gray-400 uppercase tracking-wide">{(row as any).l}</span>
                  <span className="text-gray-800 font-medium">{(row as any).v}</span>
                </div>
              ))}
            </div>
          )}
          {tab === 'timeline' && <AdmissionTimeline events={timeline} />}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdmissionsPage() {
  const { t } = useLanguage();
  const { can } = usePermission();
  const { log } = useAuditLog();
  const [, navigate] = useLocation();
  const { admissions, discharge, transfer, cancel, addAdmission, updateAdmission, refresh, loading: admLoading } = useAdmissionsApi();
  const { user } = useAuth();
  const [bedRefreshKey, setBedRefreshKey] = useState(0);

  const [filters, setFilters] = useState<AdmissionFiltersState>(DEFAULT_ADM_FILTERS);
  const [page, setPage]       = useState(1);
  const perPage               = 15;
  const [sortField, setSortField] = useState('admissionDate');
  const [sortDir, setSortDir]     = useState<'asc' | 'desc'>('desc');

  const [showForm,        setShowForm]        = useState(false);
  const [editing,         setEditing]         = useState<Admission | null>(null);
  const [detailing,       setDetailing]       = useState<Admission | null>(null);
  const [discharging,     setDischarging]     = useState<Admission | null>(null);
  const [transferring,    setTransferring]    = useState<Admission | null>(null);
  const [cancelling,      setCancelling]      = useState<Admission | null>(null);
  const [cancelError,      setCancelError]      = useState('');
  const [drawerPatientId, setDrawerPatientId] = useState<string | null>(null);
  const [prefillPatientId, setPrefillPatientId] = useState<string | null>(null);

  // Ouverture directe depuis « Actions rapides » du dossier patient (?new=1&patientId=…)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') !== '1') return;
    window.history.replaceState({}, '', window.location.pathname);
    if (!can('admissions.create')) return;
    const pid = params.get('patientId');
    if (pid) setPrefillPatientId(pid);
    setEditing(null);
    setShowForm(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
    setPage(1);
  };

  const filtered = useMemo(() => {
    const q = filters.search.toLowerCase();
    return admissions
      .filter(a => {
        if (q && ![ a.admissionNumber, a.patientMpiId, a.patientName, a.serviceName ].some(v => v.toLowerCase().includes(q))) return false;
        if (filters.type     !== 'all' && a.type     !== filters.type)     return false;
        if (filters.status   !== 'all' && a.status   !== filters.status)   return false;
        if (filters.priority !== 'all' && a.priority !== filters.priority) return false;
        if (filters.serviceId !== 'all' && a.serviceId !== filters.serviceId) return false;
        if (filters.dateFrom && a.admissionDate < filters.dateFrom) return false;
        if (filters.dateTo   && a.admissionDate > filters.dateTo)   return false;
        return true;
      })
      .sort((a, b) => {
        const val = (x: Admission) => {
          switch (sortField) {
            case 'admissionNumber': return x.admissionNumber;
            case 'patientName':    return x.patientName;
            case 'admissionDate':  return x.admissionDate + x.admissionTime;
            case 'priority':       return ['vital','tres_urgent','urgent','normal'].indexOf(x.priority).toString();
            case 'status':         return x.status;
            default: return x.admissionDate;
          }
        };
        const cmp = val(a).localeCompare(val(b));
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [admissions, filters, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));

  if (!can('admissions.view')) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-400 text-lg">{t('adm.page.no_permission')}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5">
        {/* Header */}
        <PageHeader
          title={t('adm.page.title')}
          subtitle={t('adm.page.subtitle')}
          actions={
            <div className="flex items-center gap-2">
              {admLoading ? (
                <span className="flex items-center gap-1 text-xs px-2.5 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded-full font-medium animate-pulse">
                  Chargement…
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full font-medium">
                  ● Live
                </span>
              )}
              {can('admissions.export') && (
                <button onClick={() => log('export', 'admissions')} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <Download size={14} /> {t('adm.export')}
                </button>
              )}
              {can('admissions.create') && (
                <button onClick={() => { setEditing(null); setShowForm(true); }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                  <PlusCircle size={14} /> {t('adm.add')}
                </button>
              )}
            </div>
          }
        />

        {/* Mini-dashboard — refreshKey increments after any bed-lifecycle operation */}
        <AdmissionMiniDashboard refreshKey={bedRefreshKey} />

        {/* Filters */}
        <AdmissionFilters
          filters={filters}
          onChange={f => { setFilters(f); setPage(1); }}
          resultCount={filtered.length}
          total={admissions.length}
        />

        {/* Table */}
        <AdmissionTable
          admissions={filtered}
          page={page}
          perPage={perPage}
          onView={a => { log('view', 'admission', a.id); navigate(`/admissions/${a.id}`); }}
          onEdit={a => { setEditing(a); setShowForm(true); }}
          onDischarge={a => setDischarging(a)}
          onTransfer={a => setTransferring(a)}
          onCancel={a => setCancelling(a)}
          onPatientClick={patientId => setDrawerPatientId(patientId)}
          onViewPatient={patientId => navigate(`/patients/${patientId}`)}
          canEdit={can('admissions.edit')}
          canDischarge={can('admissions.discharge')}
          canTransfer={can('admissions.transfer')}
          canCancel={can('admissions.cancel')}
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
        />

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              {Math.min((page - 1) * perPage + 1, filtered.length)}–{Math.min(page * perPage, filtered.length)} {t('adm.pagination.of')} {filtered.length} {t('adm.filter.results')}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {t('adm.pagination.prev')}
              </button>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-8 h-8 text-xs rounded-lg transition-colors ${p === page ? 'bg-blue-600 text-white' : 'border border-gray-200 hover:bg-gray-50'}`}>
                      {p}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {t('adm.pagination.next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}

      {showForm && (
        <AdmissionForm
          admission={editing ?? undefined}
          initialPatientId={prefillPatientId ?? undefined}
          onSave={(data) => {
            // Le formulaire a déjà enregistré via l'API (POST/PATCH /admissions).
            // Le lit est occupé côté serveur dans la même transaction (admit()) —
            // plus d'assignation séparée ici (évitait un double-assign).
            if (editing) {
              updateAdmission(data);
            } else {
              addAdmission(data);
            }
            refresh();
            setBedRefreshKey(k => k + 1);
            setShowForm(false);
            setEditing(null);
          }}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {detailing && (
        <AdmissionDetailPanel admission={detailing} onClose={() => setDetailing(null)} />
      )}

      <PatientDrawer patientId={drawerPatientId} onClose={() => setDrawerPatientId(null)} />

      {discharging && (
        <DischargeModal
          admission={discharging}
          onConfirm={async (type, date, time, notes) => {
            // Sortie ADT atomique côté serveur : admission clôturée + lit →
            // nettoyage + encounter fermé + mouvement journalisé — une seule
            // transaction. Plus d'appel start-cleaning séparé ni d'erreur avalée.
            await discharge(discharging.id, type, date, time, notes); // jette en cas d'échec — le modal affiche l'erreur
            log('archive', 'admission', discharging.id, `Sortie ${type}`);
            setBedRefreshKey(k => k + 1);
            setDischarging(null);
          }}
          onCancel={() => setDischarging(null)}
        />
      )}

      {transferring && (
        <TransferBedModal
          admission={transferring}
          onConfirm={async ({ newBedId, motif }) => {
            // Mouvement ADT atomique côté serveur : libération de l'ancien lit
            // (→ nettoyage) + occupation du nouveau + réalignement de l'admission
            // + journalisation dans l'historique patient — une seule transaction.
            await transfer(transferring.id, { newBedId, motif }); // jette en cas d'échec — le modal affiche l'erreur
            log('update', 'admission', transferring.id, `Transfert de lit — ${motif}`);
            setBedRefreshKey(k => k + 1);
            setTransferring(null);
          }}
          onCancel={() => setTransferring(null)}
        />
      )}

      {cancelling && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setCancelling(null); setCancelError(''); }} />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 w-full sm:max-w-sm max-h-[95dvh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <h3 className="font-bold text-gray-900">{t('adm.confirm.cancel.title')}</h3>
            </div>
            <p className="text-sm text-gray-600 mb-5">{t('adm.confirm.cancel.desc')}</p>
            {cancelError && <p className="text-xs text-red-600 mb-3">{cancelError}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setCancelling(null); setCancelError(''); }} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                {t('adm.confirm.cancel.no')}
              </button>
              <button onClick={async () => {
                try {
                  // Le backend annule, libère le lit et clôt l'encounter en une transaction
                  await cancel(cancelling.id);
                  log('archive', 'admission', cancelling.id);
                  setBedRefreshKey(k => k + 1);
                  setCancelling(null);
                  setCancelError('');
                } catch (e: any) {
                  setCancelError(e?.message ?? "Échec de l'annulation");
                }
              }}
                className="flex-1 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">
                {t('adm.confirm.cancel.yes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
