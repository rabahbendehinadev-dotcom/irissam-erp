import { ExecFilters, Period } from '@/services/api/executive-dashboard';
import { useLanguage } from '@/i18n';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'day',     label: 'Aujourd\'hui' },
  { value: 'week',    label: 'Semaine' },
  { value: 'month',   label: 'Mois' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year',    label: 'Année' },
];

interface Props {
  filters: ExecFilters;
  onChange: (f: ExecFilters) => void;
}

export default function ExecFiltersBar({ filters, onChange }: Props) {
  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2 flex flex-wrap items-center gap-3">
      {/* Period selector */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 font-medium mr-1">Période:</span>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {PERIODS.map(p => (
            <button key={p.value}
              onClick={() => onChange({ ...filters, period: p.value })}
              className={`px-3 py-1 text-xs font-medium transition-colors
                ${filters.period === p.value
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date range */}
      <div className="flex items-center gap-2">
        <input type="date" value={filters.from ?? ''}
          onChange={e => onChange({ ...filters, from: e.target.value || undefined })}
          className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400" />
        <span className="text-xs text-gray-400">→</span>
        <input type="date" value={filters.to ?? ''}
          onChange={e => onChange({ ...filters, to: e.target.value || undefined })}
          className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400" />
      </div>
    </div>
  );
}
