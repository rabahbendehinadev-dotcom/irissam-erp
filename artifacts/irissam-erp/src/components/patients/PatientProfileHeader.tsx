import { Pencil, Printer, Archive, Droplets, Phone, MapPin, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n';
import type { Patient } from '@/types';
import { PatientAvatar } from '@/components/shared/PatientAvatar';
import { PatientStatusBadge } from './PatientStatusBadge';
import { SyncStatusBadge } from './SyncStatusBadge';
import { calculateAge } from '@/utils/format';

const TABS = [
  { key: 'overview',         labelKey: 'pat.tab.overview' },
  { key: 'identity',         labelKey: 'pat.tab.identity' },
  { key: 'contacts',         labelKey: 'pat.tab.contacts' },
  { key: 'insurance',        labelKey: 'pat.tab.insurance' },
  { key: 'documents',        labelKey: 'pat.tab.documents' },
  { key: 'history',          labelKey: 'pat.tab.history' },
  { key: 'allergies',        labelKey: 'pat.tab.allergies' },
  { key: 'appointments',     labelKey: 'pat.tab.appointments',     soon: true },
  { key: 'admissions',       labelKey: 'pat.tab.admissions',       soon: true },
  { key: 'consultations',    labelKey: 'pat.tab.consultations',    soon: true },
  { key: 'emergencies',      labelKey: 'pat.tab.emergencies',      soon: true },
  { key: 'hospitalizations', labelKey: 'pat.tab.hospitalizations', soon: true },
  { key: 'laboratory',       labelKey: 'pat.tab.laboratory',       soon: true },
  { key: 'imaging',          labelKey: 'pat.tab.imaging',          soon: true },
  { key: 'prescriptions',    labelKey: 'pat.tab.prescriptions',    soon: true },
  { key: 'invoices',         labelKey: 'pat.tab.invoices',         soon: true },
  { key: 'timeline',         labelKey: 'pat.tab.timeline' },
  { key: 'audit',            labelKey: 'pat.tab.audit' },
] as const;

interface Props {
  patient: Patient;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onEdit: () => void;
  onArchive: () => void;
  canEdit: boolean;
  canArchive: boolean;
}

export function PatientProfileHeader({ patient, activeTab, onTabChange, onEdit, onArchive, canEdit, canArchive }: Props) {
  const { t } = useLanguage();
  const fullName = `${patient.lastName} ${patient.firstName}`;
  const age = calculateAge(patient.dateOfBirth);

  return (
    <div className="bg-white border-b border-gray-200">
      {/* Critical notes banner */}
      {patient.medical?.criticalNotes && (
        <div className="flex items-center gap-2 px-6 py-2.5 bg-red-50 border-b border-red-200">
          <AlertTriangle size={15} className="text-red-600 flex-shrink-0" />
          <p className="text-sm font-medium text-red-700">{patient.medical.criticalNotes}</p>
        </div>
      )}

      {/* Incomplete banner */}
      {patient.isIncomplete && (
        <div className="flex items-center gap-2 px-6 py-2.5 bg-amber-50 border-b border-amber-200">
          <AlertTriangle size={15} className="text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700">{t('pat.overview.incomplete_banner')}</p>
        </div>
      )}

      {/* Main header */}
      <div className="px-6 pt-5 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Avatar */}
          <PatientAvatar name={fullName} size="xl" />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-gray-900">{fullName}</h1>
              <PatientStatusBadge status={patient.status} />
              <SyncStatusBadge status={patient.syncStatus} />
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-gray-600 mb-3">
              <span className="flex items-center gap-1 font-mono text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                {t('pat.profile.mpi')} {patient.mpiId}
              </span>
              <span className="flex items-center gap-1 font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                {t('pat.profile.file')} {patient.fileNumber}
              </span>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500">
              <span>{patient.gender === 'M' ? t('pat.gender.m') : t('pat.gender.f')} · {age} {t('pat.age.years')}</span>
              {patient.bloodType && (
                <span className="flex items-center gap-1 text-red-600 font-semibold">
                  <Droplets size={13} /> {patient.bloodType}{patient.rhesus}
                </span>
              )}
              {patient.phone && (
                <span className="flex items-center gap-1">
                  <Phone size={13} /> {patient.phone}
                </span>
              )}
              {patient.wilaya && (
                <span className="flex items-center gap-1">
                  <MapPin size={13} /> {patient.wilaya}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {canEdit && (
              <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <Pencil size={14} /> {t('pat.profile.edit')}
              </button>
            )}
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <Printer size={14} /> {t('pat.profile.print')}
            </button>
            {canArchive && patient.status !== 'archived' && (
              <button onClick={onArchive} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                <Archive size={14} /> {t('pat.profile.archive')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-0 px-6 min-w-max">
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={cn(
                  'px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors relative',
                  isActive
                    ? 'border-blue-600 text-blue-700 font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                  'soon' in tab && tab.soon ? 'opacity-60' : ''
                )}
              >
                {t(tab.labelKey as any)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
