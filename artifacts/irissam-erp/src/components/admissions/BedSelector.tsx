import { useState, useMemo, useEffect } from 'react';
import { Bed, X, Info, RefreshCw, AlertCircle, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n';
import { useOccupancyBedsApi } from '@/hooks/useOccupancyBedsApi';
import { apiClient } from '@/services/api/client';
import type { OccupancyBed } from '@/types/repository';

const STATUS_STYLE: Record<string, { card: string; label: string }> = {
  disponible:   { card: 'border-green-300 bg-green-50 hover:border-green-500 hover:bg-green-100 cursor-pointer',    label: 'text-green-700' },
  occupe:       { card: 'border-red-300 bg-red-50 opacity-80 cursor-not-allowed',                                    label: 'text-red-700' },
  reserve:      { card: 'border-purple-300 bg-purple-50 opacity-80 cursor-not-allowed',                              label: 'text-purple-700' },
  nettoyage:    { card: 'border-amber-300 bg-amber-50 opacity-80 cursor-not-allowed',                                label: 'text-amber-700' },
  maintenance:  { card: 'border-gray-300 bg-gray-50 opacity-60 cursor-not-allowed',                                  label: 'text-gray-500' },
  hors_service: { card: 'border-gray-300 bg-gray-100 opacity-50 cursor-not-allowed',                                 label: 'text-gray-400' },
};

const STATUS_LABELS: Record<string, string> = {
  disponible:   'Disponible',
  occupe:       'Occupé',
  reserve:      'Réservé',
  nettoyage:    'Nettoyage',
  maintenance:  'Maintenance',
  hors_service: 'Hors service',
};

const TYPE_LABELS: Record<string, string> = {
  standard:       'Standard',
  soins_intensifs: 'Soins intensifs',
  isolement:      'Isolement',
  maternite:      'Maternité',
  pediatrie:      'Pédiatrie',
};

interface Props {
  selectedBedId?: string;
  onSelect: (bed: OccupancyBed | null) => void;
}

export function BedSelector({ selectedBedId, onSelect }: Props) {
  const { t } = useLanguage();
  const [refreshKey, setRefreshKey] = useState(0);
  const { beds, loading, error, refresh } = useOccupancyBedsApi({ refreshKey });

  const [search, setSearch]   = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [hoveredBed, setHoveredBed] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  // Derive unique bed types from data
  const bedTypes = useMemo(
    () => [...new Set(beds.map(b => b.type).filter(Boolean))].sort(),
    [beds],
  );

  // Filtered + sorted beds
  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    return beds
      .filter(b => {
        if (q && !`${b.number} ${b.roomNumber} ${b.buildingName} ${b.floorLabel}`.toLowerCase().includes(q)) return false;
        if (typeFilter && b.type !== typeFilter) return false;
        return true;
      })
      .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  }, [beds, search, typeFilter]);

  const selectedBed = selectedBedId ? beds.find(b => b.id === selectedBedId) ?? null : null;

  // Pre-selection availability check: re-verify when component mounts if a bed is pre-selected
  useEffect(() => {
    if (!selectedBedId) return;
    setConflict(null);
  }, [selectedBedId]);

  /** Verify bed is still disponible before confirming selection */
  async function handleSelect(bed: OccupancyBed) {
    if (bed.status !== 'disponible') return;
    setConflict(null);
    try {
      const fresh = await apiClient.get<any>(`/occupancy-beds/${bed.id}`);
      if (fresh.status !== 'disponible') {
        setConflict(`Le lit ${bed.number} n'est plus disponible (${STATUS_LABELS[fresh.status] ?? fresh.status}). La liste a été mise à jour.`);
        refresh();
        onSelect(null);
        return;
      }
    } catch {
      // If the verify call fails, allow selection optimistically
    }
    onSelect(bed.id === selectedBedId ? null : bed);
  }

  const selectCls = 'text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white';

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <AlertCircle size={32} className="text-red-400" />
        <p className="text-sm text-red-600">{error}</p>
        <button onClick={refresh} className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
          <RefreshCw size={12} /> Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{t('adm.form.bed.hint')}</p>

      {/* Filters row */}
      <div className="flex gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Lit, chambre, bâtiment…"
            className={`${selectCls} pl-8 w-full`}
          />
        </div>
        {/* Type filter */}
        {bedTypes.length > 1 && (
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className={selectCls}>
            <option value="">— Tous types —</option>
            {bedTypes.map(tp => (
              <option key={tp} value={tp}>{TYPE_LABELS[tp] ?? tp}</option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => { refresh(); setRefreshKey(k => k + 1); }}
          className="flex items-center gap-1.5 text-xs px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500"
          title="Actualiser"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {/* Conflict warning */}
      {conflict && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          {conflict}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {(['disponible', 'occupe', 'nettoyage', 'maintenance'] as const).map(s => (
          <span key={s} className="flex items-center gap-1">
            <span className={cn('w-3 h-3 rounded border', {
              'bg-green-100 border-green-400':  s === 'disponible',
              'bg-red-100 border-red-400':      s === 'occupe',
              'bg-amber-100 border-amber-400':  s === 'nettoyage',
              'bg-gray-100 border-gray-400':    s === 'maintenance',
            })} />
            {STATUS_LABELS[s]}
          </span>
        ))}
      </div>

      {/* Bed grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
          <Bed size={24} />
          <p className="text-sm">
            {beds.length === 0 ? 'Aucun lit en base de données.' : 'Aucun lit ne correspond aux filtres.'}
          </p>
          {beds.length > 0 && search && (
            <button onClick={() => setSearch('')} className="text-xs underline text-blue-500">
              Effacer la recherche
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {displayed.map(bed => {
            const isSelected = bed.id === selectedBedId;
            const isDisabled = bed.status !== 'disponible';
            const styles     = STATUS_STYLE[bed.status] ?? STATUS_STYLE['hors_service'];

            return (
              <div key={bed.id} className="relative">
                <button
                  type="button"
                  disabled={isDisabled}
                  onClick={() => !isDisabled && handleSelect(bed)}
                  onMouseEnter={() => setHoveredBed(bed.id)}
                  onMouseLeave={() => setHoveredBed(null)}
                  className={cn(
                    'w-full border-2 rounded-xl p-3 text-left transition-all',
                    isSelected
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/30'
                      : styles.card,
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Bed size={14} className={styles.label} />
                    <span className="text-sm font-bold text-gray-800">{bed.number}</span>
                  </div>
                  <span className={`text-xs font-medium ${styles.label}`}>
                    {STATUS_LABELS[bed.status] ?? bed.status}
                  </span>
                  {bed.roomNumber && (
                    <p className="text-xs text-gray-400 mt-0.5">{bed.roomNumber}</p>
                  )}
                  {bed.status === 'occupe' && bed.patientName && (
                    <p className="text-xs text-red-600 mt-0.5 truncate">{bed.patientName}</p>
                  )}
                </button>

                {/* Tooltip */}
                {hoveredBed === bed.id && bed.status === 'occupe' && bed.patientName && (
                  <div className="absolute bottom-full left-0 mb-1 z-10 bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                    <span className="font-semibold">{t('adm.bed.occupied_by')} :</span> {bed.patientName}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Selected bed summary */}
      {selectedBed && (
        <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center gap-2">
            <Bed size={16} className="text-blue-600" />
            <div>
              <p className="text-sm font-semibold text-blue-800">
                {t('adm.form.bed.selected')} : {selectedBed.number}
              </p>
              <p className="text-xs text-blue-600">
                {[selectedBed.buildingName, selectedBed.floorLabel, selectedBed.roomNumber && `Ch. ${selectedBed.roomNumber}`]
                  .filter(Boolean).join(' · ') || selectedBed.roomNumber}
              </p>
            </div>
          </div>
          <button type="button" onClick={() => onSelect(null)} className="p-1 rounded-lg hover:bg-blue-100 text-blue-500">
            <X size={14} />
          </button>
        </div>
      )}

      {!selectedBed && (
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <Info size={12} />
          {t('adm.form.bed.skip')}
        </p>
      )}
    </div>
  );
}
