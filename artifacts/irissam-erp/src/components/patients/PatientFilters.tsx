import { Search, X } from 'lucide-react';
import { useLanguage } from '@/i18n';
import type { BloodType } from '@/types';

export interface PatientFiltersState {
  search: string;
  status: string;
  gender: string;
  bloodType: string;
}

interface Props {
  filters: PatientFiltersState;
  onChange: (f: PatientFiltersState) => void;
  resultCount: number;
  total: number;
}

const BLOOD_TYPES: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const selectCls = 'text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400';

export function PatientFilters({ filters, onChange, resultCount, total }: Props) {
  const { t } = useLanguage();

  const set = (key: keyof PatientFiltersState, value: string) =>
    onChange({ ...filters, [key]: value });

  const hasActiveFilters = filters.search || filters.status !== 'all' || filters.gender !== 'all' || filters.bloodType !== 'all';

  const reset = () => onChange({ search: '', status: 'all', gender: 'all', bloodType: 'all' });

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
      {/* Search row */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={filters.search}
            onChange={e => set('search', e.target.value)}
            placeholder={t('pat.filter.search')}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
          {filters.search && (
            <button onClick={() => set('search', '')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status */}
        <select value={filters.status} onChange={e => set('status', e.target.value)} className={selectCls}>
          <option value="all">{t('pat.filter.status')} — {t('pat.filter.all')}</option>
          <option value="active">{t('pat.status.active')}</option>
          <option value="inactive">{t('pat.status.inactive')}</option>
          <option value="archived">{t('pat.status.archived')}</option>
          <option value="deceased">{t('pat.status.deceased')}</option>
        </select>

        {/* Gender */}
        <select value={filters.gender} onChange={e => set('gender', e.target.value)} className={selectCls}>
          <option value="all">{t('pat.filter.gender')} — {t('pat.filter.all')}</option>
          <option value="M">{t('pat.gender.m')}</option>
          <option value="F">{t('pat.gender.f')}</option>
        </select>

        {/* Blood type */}
        <select value={filters.bloodType} onChange={e => set('bloodType', e.target.value)} className={selectCls}>
          <option value="all">{t('pat.filter.blood')} — {t('pat.filter.all')}</option>
          {BLOOD_TYPES.map(bt => <option key={bt} value={bt}>{bt}</option>)}
        </select>

        {hasActiveFilters && (
          <button onClick={reset} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 px-2 py-2 rounded-lg hover:bg-red-50 transition-colors">
            <X size={14} />
            {t('pat.filter.reset')}
          </button>
        )}
      </div>

      {/* Result count */}
      <div className="text-xs text-gray-500">
        {resultCount} {t('pat.filter.results')}
        {resultCount !== total && <span className="ml-1 text-gray-400">/ {total} total</span>}
      </div>
    </div>
  );
}
