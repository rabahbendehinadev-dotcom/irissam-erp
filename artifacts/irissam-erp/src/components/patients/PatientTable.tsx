import { ArrowUpDown, ArrowUp, ArrowDown, Droplets } from 'lucide-react';
import { useLanguage } from '@/i18n';
import type { Patient } from '@/types';
import { PatientAvatar } from '@/components/shared/PatientAvatar';
import { PatientStatusBadge } from './PatientStatusBadge';
import { SyncStatusBadge } from './SyncStatusBadge';
import { PatientQuickActions } from './PatientQuickActions';
import { formatDate, calculateAge } from '@/utils/format';
import { EmptyState } from '@/components/shared/EmptyState';
import { Users } from 'lucide-react';

function displayAge(dob: string) {
  if (!dob) return '—';
  const birth = new Date(dob);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - birth.getTime()) / 86400000);
  if (diffDays < 1) return 'Nouveau-né';
  if (diffDays < 30) return `${diffDays} j`;
  const months = Math.floor(diffDays / 30.44);
  if (months < 24) return `${months} mois`;
  return `${calculateAge(dob)} ans`;
}

interface SortHeaderProps {
  label: string;
  field: string;
  current: string;
  dir: 'asc' | 'desc';
  onSort: (f: string) => void;
}
function SortHeader({ label, field, current, dir, onSort }: SortHeaderProps) {
  const active = current === field;
  return (
    <button onClick={() => onSort(field)} className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700 uppercase tracking-wide whitespace-nowrap">
      {label}
      {active ? (dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-30" />}
    </button>
  );
}

interface Props {
  patients: Patient[];
  page: number;
  perPage: number;
  onView: (p: Patient) => void;
  onEdit: (p: Patient) => void;
  onArchive: (p: Patient) => void;
  canEdit: boolean;
  canArchive: boolean;
  sortField: string;
  sortDir: 'asc' | 'desc';
  onSort: (field: string) => void;
}

export function PatientTable({
  patients, page, perPage, onView, onEdit, onArchive,
  canEdit, canArchive, sortField, sortDir, onSort,
}: Props) {
  const { t } = useLanguage();

  if (!Array.isArray(patients) || patients.length === 0) {
    return (
      <EmptyState
        icon={<Users size={40} />}
        title={t('pat.empty.title')}
        description={t('pat.empty.desc')}
      />
    );
  }

  const start = (page - 1) * perPage;
  const pagePatients = patients.slice(start, start + perPage);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left">
                <SortHeader label={t('pat.col.patient')} field="lastName" current={sortField} dir={sortDir} onSort={onSort} />
              </th>
              <th className="px-3 py-3 text-left hidden md:table-cell">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('pat.col.file')}</span>
              </th>
              <th className="px-3 py-3 text-left">
                <SortHeader label={t('pat.col.age')} field="dateOfBirth" current={sortField} dir={sortDir} onSort={onSort} />
              </th>
              <th className="px-3 py-3 text-left hidden lg:table-cell">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('pat.col.phone')}</span>
              </th>
              <th className="px-3 py-3 text-center hidden xl:table-cell">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('pat.col.blood')}</span>
              </th>
              <th className="px-3 py-3 text-left">
                <SortHeader label={t('pat.col.status')} field="status" current={sortField} dir={sortDir} onSort={onSort} />
              </th>
              <th className="px-3 py-3 text-center hidden lg:table-cell">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('pat.col.sync')}</span>
              </th>
              <th className="px-3 py-3 text-left hidden xl:table-cell">
                <SortHeader label={t('pat.col.created')} field="createdAt" current={sortField} dir={sortDir} onSort={onSort} />
              </th>
              <th className="px-4 py-3 text-right">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('pat.col.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pagePatients.map((patient) => {
              const fullName = `${patient.lastName} ${patient.firstName}`;
              return (
                <tr
                  key={patient.id}
                  className="hover:bg-gray-50/60 transition-colors group"
                >
                  {/* Patient avatar + name */}
                  <td className="px-4 py-3">
                    <button onClick={() => onView(patient)} className="flex items-center gap-3 text-left">
                      <PatientAvatar name={fullName} size="sm" />
                      <div>
                        <p className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors text-sm leading-tight">
                          {patient.lastName} <span className="font-normal">{patient.firstName}</span>
                        </p>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{patient.mpiId}</p>
                      </div>
                    </button>
                  </td>

                  {/* File number */}
                  <td className="px-3 py-3 hidden md:table-cell">
                    <span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                      {patient.fileNumber}
                    </span>
                  </td>

                  {/* Age / Gender / DOB */}
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-gray-800">
                        {patient.gender === 'M' ? t('pat.gender.short.m') : t('pat.gender.short.f')} — {displayAge(patient.dateOfBirth)}
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(patient.dateOfBirth)}</span>
                    </div>
                  </td>

                  {/* Phone */}
                  <td className="px-3 py-3 hidden lg:table-cell">
                    <span className="text-sm text-gray-600 font-mono">{patient.phone || '—'}</span>
                  </td>

                  {/* Blood type */}
                  <td className="px-3 py-3 text-center hidden xl:table-cell">
                    {patient.bloodType ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                        <Droplets size={10} /> {patient.bloodType}
                      </span>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>

                  {/* Status */}
                  <td className="px-3 py-3">
                    <PatientStatusBadge status={patient.status} />
                  </td>

                  {/* Sync */}
                  <td className="px-3 py-3 text-center hidden lg:table-cell">
                    <SyncStatusBadge status={patient.syncStatus} />
                  </td>

                  {/* Created */}
                  <td className="px-3 py-3 hidden xl:table-cell">
                    <span className="text-xs text-gray-400">{formatDate(patient.createdAt)}</span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <PatientQuickActions
                      patient={patient}
                      onView={() => onView(patient)}
                      onEdit={() => onEdit(patient)}
                      onArchive={() => onArchive(patient)}
                      canEdit={canEdit}
                      canArchive={canArchive}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
