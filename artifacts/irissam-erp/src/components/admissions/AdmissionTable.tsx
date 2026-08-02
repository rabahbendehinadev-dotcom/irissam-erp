import { ArrowUpDown, ArrowUp, ArrowDown, BedDouble } from 'lucide-react';
import { useLanguage } from '@/i18n';
import type { Admission } from '@/types/admission';
import { PatientAvatar } from '@/components/shared/PatientAvatar';
import { AdmissionStatusBadge } from './AdmissionStatusBadge';
import { AdmissionTypeBadge } from './AdmissionTypeBadge';
import { PriorityBadge } from './PriorityBadge';
import { AdmissionQuickActions } from './AdmissionQuickActions';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatDate } from '@/utils/format';
import { Users } from 'lucide-react';

function SortHeader({ label, field, current, dir, onSort }: {
  label: string; field: string; current: string; dir: 'asc' | 'desc'; onSort: (f: string) => void;
}) {
  const active = current === field;
  return (
    <button onClick={() => onSort(field)} className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700 uppercase tracking-wide whitespace-nowrap">
      {label}
      {active ? (dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-30" />}
    </button>
  );
}

interface Props {
  admissions: Admission[];
  page: number;
  perPage: number;
  onView: (a: Admission) => void;
  onEdit: (a: Admission) => void;
  onDischarge: (a: Admission) => void;
  onTransfer: (a: Admission) => void;
  onCancel: (a: Admission) => void;
  onPatientClick?: (patientId: string) => void;
  canEdit: boolean;
  canDischarge: boolean;
  canTransfer: boolean;
  canCancel: boolean;
  sortField: string;
  sortDir: 'asc' | 'desc';
  onSort: (field: string) => void;
}

export function AdmissionTable({
  admissions, page, perPage,
  onView, onEdit, onDischarge, onTransfer, onCancel,
  onPatientClick,
  canEdit, canDischarge, canTransfer, canCancel,
  sortField, sortDir, onSort,
}: Props) {
  const { t } = useLanguage();

  if (!admissions.length) {
    return <EmptyState icon={<Users size={40} />} title={t('adm.empty.title')} description={t('adm.empty.desc')} />;
  }

  const start = (page - 1) * perPage;
  const pageItems = admissions.slice(start, start + perPage);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left">
                <SortHeader label={t('adm.col.number')} field="admissionNumber" current={sortField} dir={sortDir} onSort={onSort} />
              </th>
              <th className="px-3 py-3 text-left">
                <SortHeader label={t('adm.col.patient')} field="patientName" current={sortField} dir={sortDir} onSort={onSort} />
              </th>
              <th className="px-3 py-3 text-left hidden md:table-cell">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('adm.col.service')}</span>
              </th>
              <th className="px-3 py-3 text-left hidden lg:table-cell">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('adm.col.doctor')}</span>
              </th>
              <th className="px-3 py-3 text-left hidden xl:table-cell">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('adm.col.bed')}</span>
              </th>
              <th className="px-3 py-3 text-left">
                <SortHeader label={t('adm.col.date')} field="admissionDate" current={sortField} dir={sortDir} onSort={onSort} />
              </th>
              <th className="px-3 py-3 text-left hidden md:table-cell">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('adm.col.type')}</span>
              </th>
              <th className="px-3 py-3 text-left">
                <SortHeader label={t('adm.col.priority')} field="priority" current={sortField} dir={sortDir} onSort={onSort} />
              </th>
              <th className="px-3 py-3 text-left">
                <SortHeader label={t('adm.col.status')} field="status" current={sortField} dir={sortDir} onSort={onSort} />
              </th>
              <th className="px-4 py-3 text-right">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('adm.col.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageItems.map(admission => (
              <tr key={admission.id} className="hover:bg-gray-50/60 transition-colors group">
                {/* Admission number */}
                <td className="px-4 py-3">
                  <button onClick={() => onView(admission)} className="text-left">
                    <p className="text-xs font-mono font-semibold text-blue-700 group-hover:underline">{admission.admissionNumber}</p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{admission.patientMpiId}</p>
                  </button>
                </td>

                {/* Patient */}
                <td className="px-3 py-3">
                  <button
                    onClick={() => onPatientClick ? onPatientClick(admission.patientId) : onView(admission)}
                    className="flex items-center gap-2.5"
                  >
                    <PatientAvatar name={admission.patientName} size="sm" />
                    <span className="text-sm font-medium text-gray-900 group-hover:text-blue-700 transition-colors">
                      {admission.patientName}
                    </span>
                  </button>
                </td>

                {/* Service */}
                <td className="px-3 py-3 hidden md:table-cell">
                  <span className="text-sm text-gray-700">{admission.serviceName}</span>
                </td>

                {/* Doctor */}
                <td className="px-3 py-3 hidden lg:table-cell">
                  <span className="text-xs text-gray-500">{admission.doctorName}</span>
                </td>

                {/* Bed */}
                <td className="px-3 py-3 hidden xl:table-cell">
                  {admission.bedNumber ? (
                    <span className="flex items-center gap-1 text-xs font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                      <BedDouble size={10} />
                      {admission.bedNumber}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>

                {/* Date */}
                <td className="px-3 py-3">
                  <div>
                    <p className="text-sm text-gray-800">{formatDate(admission.admissionDate)}</p>
                    <p className="text-xs text-gray-400">{admission.admissionTime}</p>
                  </div>
                </td>

                {/* Type */}
                <td className="px-3 py-3 hidden md:table-cell">
                  <AdmissionTypeBadge type={admission.type} />
                </td>

                {/* Priority */}
                <td className="px-3 py-3">
                  <PriorityBadge priority={admission.priority} compact />
                </td>

                {/* Status */}
                <td className="px-3 py-3">
                  <AdmissionStatusBadge status={admission.status} />
                </td>

                {/* Actions */}
                <td className="px-4 py-3 text-right">
                  <AdmissionQuickActions
                    admission={admission}
                    onView={() => onView(admission)}
                    onEdit={() => onEdit(admission)}
                    onDischarge={() => onDischarge(admission)}
                    onTransfer={() => onTransfer(admission)}
                    onCancel={() => onCancel(admission)}
                    onPrint={() => window.print()}
                    canEdit={canEdit}
                    canDischarge={canDischarge}
                    canTransfer={canTransfer}
                    canCancel={canCancel}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
