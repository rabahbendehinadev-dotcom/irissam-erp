import { Phone, MapPin, Droplets } from 'lucide-react';
import { useLanguage } from '@/i18n';
import type { Patient } from '@/types';
import { PatientAvatar } from '@/components/shared/PatientAvatar';
import { PatientStatusBadge } from './PatientStatusBadge';
import { calculateAge } from '@/utils/format';

interface Props {
  patient: Patient;
  onClick?: () => void;
}

export function PatientSummaryCard({ patient, onClick }: Props) {
  const { t } = useLanguage();
  const age = calculateAge(patient.dateOfBirth);
  const fullName = `${patient.lastName} ${patient.firstName}`;

  return (
    <div
      onClick={onClick}
      className={`bg-white border border-gray-200 rounded-xl p-4 flex gap-3 ${onClick ? 'cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all' : ''}`}
    >
      <PatientAvatar name={fullName} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div>
            <p className="font-semibold text-gray-900 text-sm truncate">{fullName}</p>
            <p className="text-xs text-gray-400">{patient.mpiId}</p>
          </div>
          <PatientStatusBadge status={patient.status} />
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          <span className="text-xs text-gray-500">
            {patient.gender === 'M' ? t('pat.gender.short.m') : t('pat.gender.short.f')} · {age} {t('pat.age.years')}
          </span>
          {patient.bloodType && (
            <span className="text-xs flex items-center gap-0.5 text-red-600">
              <Droplets size={10} /> {patient.bloodType}
            </span>
          )}
          {patient.phone && (
            <span className="text-xs flex items-center gap-0.5 text-gray-500">
              <Phone size={10} /> {patient.phone}
            </span>
          )}
          {patient.wilaya && (
            <span className="text-xs flex items-center gap-0.5 text-gray-400">
              <MapPin size={10} /> {patient.wilaya}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
