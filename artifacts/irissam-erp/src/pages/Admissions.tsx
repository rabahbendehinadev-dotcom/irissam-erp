import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { PlusCircle, Download, AlertTriangle } from 'lucide-react';
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
import {
  MOCK_ADMISSION_TIMELINES,
} from '@/mock';
import type { Admission } from '@/types/admission';
import { useLanguage } from '@/i18n';
import { usePermission } from '@/hooks/usePermission';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useAdmissionsApi } from '@/hooks/useAdmissionsApi';
import { apiClient } from '@/services/api/client';
import { useAuth } from '@/store/AuthContext';
import { formatDate } from '@/utils/format';
import { PatientAvatar } from '@/components/shared/PatientAvatar';
import { PatientDrawer } from '@/components/shared/PatientDrawer';

// ─── Discharge modal ─────────────────────────────────────────────────────────

function DischargeModal({ admission, onConfirm, onCancel }: {
  admission: Admission;
  onConfirm: (type: string, date: string, time: string, notes: string) => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const today = new Date().toISOString().slice(0, 10);
  const now   = new Date().toTimeString().slice(0, 5);
  const [type, setType] = useState('domicile');
  const [date, setDate] = useState(today);
  const [time, setTime] = useState(now);
  const [notes, setNotes] = useState('');
  const cls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="font-bold text-gray-900 text-lg mb-4">{t('adm.discharge.title')}</h3>
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
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={cls} />
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
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">{t('adm.form.cancel')}</button>
          <button onClick={() => onConfirm(type, date, time, notes)}
            className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
            {t('adm.discharge.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Transfer modal ──────────────────────────────────────────────────────────

function TransferModal({ admission, onConfirm, onCancel }: {
  admission: Admission;
  onConfirm: (to: string, date: string, notes: string) => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const today = new Date().toISOString().slice(0, 10);
  const [to, setTo] = useState('');
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');
  const cls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="font-bold text-gray-900 text-lg mb-4">{t('adm.transfer.title')}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('adm.transfer.to')} *</label>
            <input value={to} onChange={e => setTo(e.target.value)} className={cls}
              placeholder="Ex: CHU Mustapha — Cardiologie" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('adm.transfer.date')}</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={cls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('adm.transfer.notes')}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={`${cls} resize-none`} />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">{t('adm.form.cancel')}</button>
          <button onClick={() => onConfirm(to, date, notes)} disabled={!to.trim()}
            className="flex-1 px-3 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium disabled:opacity-40">
            {t('adm.transfer.confirm')}
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

        {/* Tabs */}
        <div className="flex gap-0 px-5 border-b border-gray-200">
          {(['overview', 'timeline'] as const).map(t2 => (
            <button key={t2} onClick={() => setTab(t2)}
              className={`px-4 py-2.5 text-sm border-b-2 transition-colors ${tab === t2 ? 'border-blue-600 text-blue-700 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t2 === 'overview' ? 'Vue générale' : t('adm.timeline.title')}
            </button>
          ))}
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
  const { admissions, discharge, transfer, cancel, loading: admLoading } = useAdmissionsApi();
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
  const [drawerPatientId, setDrawerPatientId] = useState<string | null>(null);

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
  }, [filters, sortField, sortDir]);

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
          onSave={() => { setShowForm(false); setEditing(null); }}
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
            await discharge(discharging.id, type, date, time, notes).catch(() => {});
            log('archive', 'admission', discharging.id, `Sortie ${type}`);
            if (discharging.bedId) {
              apiClient.post(`/occupancy-beds/${discharging.bedId}/start-cleaning`, {}).catch(() => {});
            }
            setBedRefreshKey(k => k + 1);
            setDischarging(null);
          }}
          onCancel={() => setDischarging(null)}
        />
      )}

      {transferring && (
        <TransferModal
          admission={transferring}
          onConfirm={async (to, date, notes) => {
            await transfer(transferring.id, to, date, notes).catch(() => {});
            log('update', 'admission', transferring.id, `Transfert → ${to}`);
            if (transferring.bedId) {
              apiClient.post(`/occupancy-beds/${transferring.bedId}/start-cleaning`, {}).catch(() => {});
            }
            setBedRefreshKey(k => k + 1);
            setTransferring(null);
          }}
          onCancel={() => setTransferring(null)}
        />
      )}

      {cancelling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCancelling(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <h3 className="font-bold text-gray-900">{t('adm.confirm.cancel.title')}</h3>
            </div>
            <p className="text-sm text-gray-600 mb-5">{t('adm.confirm.cancel.desc')}</p>
            <div className="flex gap-3">
              <button onClick={() => setCancelling(null)} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                {t('adm.confirm.cancel.no')}
              </button>
              <button onClick={async () => {
                await cancel(cancelling.id).catch(() => {});
                log('archive', 'admission', cancelling.id);
                if (cancelling.bedId) {
                  apiClient.post(`/occupancy-beds/${cancelling.bedId}/release`, {}).catch(() => {});
                }
                setBedRefreshKey(k => k + 1);
                setCancelling(null);
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
