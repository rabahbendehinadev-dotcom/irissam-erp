import { Search, X } from 'lucide-react';
import { useLanguage } from '@/i18n';
import { MOCK_SERVICES } from '@/mock';
import type { AdmissionType, AdmissionStatus, AdmissionPriority } from '@/types/admission';

export interface AdmissionFiltersState {
  search: string;
  type: AdmissionType | 'all';
  status: AdmissionStatus | 'all';
  priority: AdmissionPriority | 'all';
  serviceId: string | 'all';
  dateFrom: string;
  dateTo: string;
}

export const DEFAULT_ADM_FILTERS: AdmissionFiltersState = {
  search: '', type: 'all', status: 'all', priority: 'all', serviceId: 'all', dateFrom: '', dateTo: '',
};

interface Props {
  filters: AdmissionFiltersState;
  onChange: (f: AdmissionFiltersState) => void;
  resultCount: number;
  total: number;
}

export function AdmissionFilters({ filters, onChange, resultCount, total }: Props) {
  const { t } = useLanguage();
  const set = (key: keyof AdmissionFiltersState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...filters, [key]: e.target.value });
  const isDefault = JSON.stringify(filters) === JSON.stringify(DEFAULT_ADM_FILTERS);
  const selectCls = 'text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white text-gray-700';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      {/* Row 1: search + selects */}
      <div className="flex flex-wrap gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={filters.search}
            onChange={set('search')}
            placeholder={t('adm.filter.search')}
            className="w-full text-sm border border-gray-200 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
        </div>

        {/* Type */}
        <select value={filters.type} onChange={set('type')} className={selectCls}>
          <option value="all">{t('adm.filter.type')}</option>
          {(['hospitalisation','ambulatoire','preadmission','urgence','maternite','chirurgie'] as const).map(v =>
            <option key={v} value={v}>{t(`adm.type.${v}` as any)}</option>
          )}
        </select>

        {/* Status */}
        <select value={filters.status} onChange={set('status')} className={selectCls}>
          <option value="all">{t('adm.filter.status')}</option>
          {(['active','preadmission','ambulatoire','transferred','discharged','cancelled'] as const).map(v =>
            <option key={v} value={v}>{t(`adm.status.${v}` as any)}</option>
          )}
        </select>

        {/* Priority */}
        <select value={filters.priority} onChange={set('priority')} className={selectCls}>
          <option value="all">{t('adm.filter.priority')}</option>
          {(['normal','urgent','tres_urgent','vital'] as const).map(v =>
            <option key={v} value={v}>{t(`adm.priority.${v}` as any)}</option>
          )}
        </select>

        {/* Service */}
        <select value={filters.serviceId} onChange={set('serviceId')} className={selectCls}>
          <option value="all">{t('adm.filter.service')}</option>
          {MOCK_SERVICES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Row 2: dates + reset + count */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">{t('adm.filter.date_from')}</label>
          <input type="date" value={filters.dateFrom} onChange={set('dateFrom')} className={`${selectCls} w-36`} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">{t('adm.filter.date_to')}</label>
          <input type="date" value={filters.dateTo} onChange={set('dateTo')} className={`${selectCls} w-36`} />
        </div>
        {!isDefault && (
          <button
            onClick={() => onChange(DEFAULT_ADM_FILTERS)}
            className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 rounded-lg px-2.5 py-2 hover:bg-gray-50 transition-colors"
          >
            <X size={12} /> {t('adm.filter.reset')}
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">
          {resultCount} {t('adm.filter.results')} {resultCount !== total && `/ ${total}`}
        </span>
      </div>
    </div>
  );
}
