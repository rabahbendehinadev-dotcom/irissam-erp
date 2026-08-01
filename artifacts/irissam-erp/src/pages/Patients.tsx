import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { UserPlus, Download, Upload, Users, UserCheck, AlertTriangle, Copy } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PatientFilters, type PatientFiltersState } from '@/components/patients/PatientFilters';
import { PatientTable } from '@/components/patients/PatientTable';
import { PatientForm } from '@/components/patients/PatientForm';
import { MOCK_PATIENTS } from '@/mock';
import type { Patient } from '@/types';
import { useLanguage } from '@/i18n';
import { usePermission } from '@/hooks/usePermission';
import { useAuditLog } from '@/hooks/useAuditLog';

const DEFAULT_FILTERS: PatientFiltersState = { search: '', status: 'all', gender: 'all', bloodType: 'all' };

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default function PatientsPage() {
  const { t } = useLanguage();
  const { can } = usePermission();
  const { log } = useAuditLog();
  const [, setLocation] = useLocation();

  const [filters, setFilters] = useState<PatientFiltersState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [perPage] = useState(15);
  const [sortField, setSortField] = useState('lastName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showForm, setShowForm] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [archivingPatient, setArchivingPatient] = useState<Patient | null>(null);

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    setPage(1);
  };

  const filtered = useMemo(() => {
    const q = filters.search.toLowerCase();
    return MOCK_PATIENTS
      .filter(p => {
        if (q) {
          const searchable = [p.firstName, p.lastName, p.mpiId, p.fileNumber, p.phone, p.internalNumber]
            .map(v => (v ?? '').toLowerCase());
          if (!searchable.some(s => s.includes(q))) return false;
        }
        if (filters.status !== 'all' && p.status !== filters.status) return false;
        if (filters.gender !== 'all' && p.gender !== filters.gender) return false;
        if (filters.bloodType !== 'all' && p.bloodType !== filters.bloodType) return false;
        return true;
      })
      .sort((a, b) => {
        const val = (x: Patient): string => {
          switch (sortField) {
            case 'lastName':   return x.lastName + x.firstName;
            case 'dateOfBirth':return x.dateOfBirth;
            case 'status':     return x.status;
            case 'createdAt':  return x.createdAt;
            default:           return x.lastName;
          }
        };
        const cmp = val(a).localeCompare(val(b), 'fr');
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [filters, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const stats = {
    total:       MOCK_PATIENTS.length,
    active:      MOCK_PATIENTS.filter(p => p.status === 'active').length,
    incomplete:  MOCK_PATIENTS.filter(p => p.isIncomplete).length,
    duplicates:  MOCK_PATIENTS.filter(p => p.potentialDuplicate).length,
  };

  const handleView = (patient: Patient) => {
    log('view', 'patient', patient.id);
    setLocation(`/patients/${patient.id}`);
  };

  const handleEdit = (patient: Patient) => {
    setEditingPatient(patient);
    setShowForm(true);
  };

  const handleArchiveConfirm = () => {
    if (!archivingPatient) return;
    log('archive', 'patient', archivingPatient.id, `Archive de ${archivingPatient.lastName} ${archivingPatient.firstName}`);
    setArchivingPatient(null);
  };

  const handleSave = (data: Partial<Patient>) => {
    // Mock save — in production this would call API
    setShowForm(false);
    setEditingPatient(null);
  };

  if (!can('patients.view')) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center text-gray-400 space-y-2">
            <Users size={48} className="mx-auto opacity-30" />
            <p className="text-lg font-semibold">{t('pat.page.no_permission')}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5">
        {/* Page header */}
        <PageHeader
          title={t('pat.page.title')}
          subtitle={t('pat.page.subtitle')}
          actions={
            <div className="flex items-center gap-2">
              {/* Demo badge */}
              <span className="flex items-center gap-1 text-xs px-2.5 py-1 bg-amber-100 text-amber-700 border border-amber-200 rounded-full font-medium">
                <AlertTriangle size={11} />
                {t('pat.page.demo')}
              </span>

              {/* Export */}
              {can('patients.export') && (
                <button
                  onClick={() => log('export', 'patients')}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Download size={14} />
                  {t('pat.export')}
                </button>
              )}

              {/* Import (disabled) */}
              <button
                disabled
                title={t('pat.import.soon')}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-400 cursor-not-allowed"
              >
                <Upload size={14} />
                {t('pat.import')}
              </button>

              {/* Add patient */}
              {can('patients.create') && (
                <button
                  onClick={() => { setEditingPatient(null); setShowForm(true); }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <UserPlus size={14} />
                  {t('pat.add')}
                </button>
              )}
            </div>
          }
        />

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={<Users size={20} className="text-blue-600" />}       label={t('pat.stats.total')}      value={stats.total}      color="bg-blue-50" />
          <StatCard icon={<UserCheck size={20} className="text-green-600" />}  label={t('pat.stats.active')}     value={stats.active}     color="bg-green-50" />
          <StatCard icon={<AlertTriangle size={20} className="text-amber-600" />} label={t('pat.stats.incomplete')} value={stats.incomplete}  color="bg-amber-50" />
          <StatCard icon={<Copy size={20} className="text-red-600" />}         label={t('pat.stats.duplicates')} value={stats.duplicates} color="bg-red-50" />
        </div>

        {/* Filters */}
        <PatientFilters
          filters={filters}
          onChange={f => { setFilters(f); setPage(1); }}
          resultCount={filtered.length}
          total={MOCK_PATIENTS.length}
        />

        {/* Table */}
        <PatientTable
          patients={filtered}
          page={page}
          perPage={perPage}
          onView={handleView}
          onEdit={handleEdit}
          onArchive={p => setArchivingPatient(p)}
          canEdit={can('patients.edit')}
          canArchive={can('patients.archive')}
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
        />

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              {Math.min((page - 1) * perPage + 1, filtered.length)}–{Math.min(page * perPage, filtered.length)} {t('pat.pagination.of')} {filtered.length} {t('pat.filter.results')}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {t('pat.pagination.prev')}
              </button>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 text-xs rounded-lg transition-colors ${p === page ? 'bg-blue-600 text-white' : 'border border-gray-200 hover:bg-gray-50'}`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {t('pat.pagination.next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Patient form modal */}
      {showForm && (
        <PatientForm
          patient={editingPatient ?? undefined}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingPatient(null); }}
        />
      )}

      {/* Archive confirmation */}
      {archivingPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setArchivingPatient(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <h3 className="font-bold text-gray-900">{t('pat.confirm.archive.title')}</h3>
            </div>
            <p className="text-sm text-gray-600 mb-5">{t('pat.confirm.archive.desc')}</p>
            <div className="flex gap-3">
              <button onClick={() => setArchivingPatient(null)} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                {t('pat.confirm.archive.no')}
              </button>
              <button onClick={handleArchiveConfirm} className="flex-1 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">
                {t('pat.confirm.archive.yes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
