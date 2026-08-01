import { useState, useMemo } from 'react';
import { Bed, X, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n';
import { MOCK_BEDS, MOCK_ADM_BUILDINGS, MOCK_ADM_FLOORS, MOCK_ROOMS } from '@/mock';
import type { Bed as BedType } from '@/types/admission';

const STATUS_STYLE: Record<string, { card: string; label: string }> = {
  libre:       { card: 'border-green-300 bg-green-50 hover:border-green-500 hover:bg-green-100 cursor-pointer', label: 'text-green-700' },
  occupe:      { card: 'border-red-300 bg-red-50 opacity-80 cursor-not-allowed', label: 'text-red-700' },
  nettoyage:   { card: 'border-amber-300 bg-amber-50 opacity-80 cursor-not-allowed', label: 'text-amber-700' },
  maintenance: { card: 'border-gray-300 bg-gray-50 opacity-60 cursor-not-allowed', label: 'text-gray-500' },
};

interface Props {
  selectedBedId?: string;
  onSelect: (bed: BedType | null) => void;
}

export function BedSelector({ selectedBedId, onSelect }: Props) {
  const { t } = useLanguage();
  const [buildingId, setBuildingId] = useState('');
  const [floorId, setFloorId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [hoveredBed, setHoveredBed] = useState<string | null>(null);

  const floors = useMemo(
    () => MOCK_ADM_FLOORS.filter(f => f.buildingId === buildingId),
    [buildingId],
  );
  const rooms = useMemo(
    () => MOCK_ROOMS.filter(r => r.floorId === floorId),
    [floorId],
  );
  const beds = useMemo(
    () => MOCK_BEDS.filter(b => b.roomId === roomId),
    [roomId],
  );

  const selectedBed = selectedBedId ? MOCK_BEDS.find(b => b.id === selectedBedId) : null;

  const handleBuildingChange = (id: string) => { setBuildingId(id); setFloorId(''); setRoomId(''); onSelect(null); };
  const handleFloorChange    = (id: string) => { setFloorId(id);    setRoomId(''); onSelect(null); };
  const handleRoomChange     = (id: string) => { setRoomId(id);                   onSelect(null); };

  const selectCls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white';

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{t('adm.form.bed.hint')}</p>

      {/* Building / Floor / Room selects */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{t('adm.form.bed.building')}</label>
          <select value={buildingId} onChange={e => handleBuildingChange(e.target.value)} className={selectCls}>
            <option value="">— Choisir —</option>
            {MOCK_ADM_BUILDINGS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{t('adm.form.bed.floor')}</label>
          <select value={floorId} onChange={e => handleFloorChange(e.target.value)} disabled={!buildingId} className={selectCls}>
            <option value="">— Choisir —</option>
            {floors.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{t('adm.form.bed.room')}</label>
          <select value={roomId} onChange={e => handleRoomChange(e.target.value)} disabled={!floorId} className={selectCls}>
            <option value="">— Choisir —</option>
            {rooms.map(r => <option key={r.id} value={r.id}>{r.number}</option>)}
          </select>
        </div>
      </div>

      {/* Légende */}
      {roomId && (
        <div className="flex gap-4 text-xs">
          {(['libre', 'occupe', 'nettoyage', 'maintenance'] as const).map(s => (
            <span key={s} className="flex items-center gap-1">
              <span className={cn('w-3 h-3 rounded border', {
                'bg-green-100 border-green-400': s === 'libre',
                'bg-red-100 border-red-400': s === 'occupe',
                'bg-amber-100 border-amber-400': s === 'nettoyage',
                'bg-gray-100 border-gray-400': s === 'maintenance',
              })} />
              {t(`adm.bed.${s}` as any)}
            </span>
          ))}
        </div>
      )}

      {/* Grille des lits */}
      {roomId && (
        beds.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Aucun lit dans cette chambre.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {beds.map(bed => {
              const isSelected = bed.id === selectedBedId;
              const isDisabled = bed.status !== 'libre';
              const styles = STATUS_STYLE[bed.status];

              return (
                <div key={bed.id} className="relative">
                  <button
                    type="button"
                    disabled={isDisabled}
                    onClick={() => !isDisabled && onSelect(isSelected ? null : bed)}
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
                      {t(`adm.bed.${bed.status}` as any)}
                    </span>
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
        )
      )}

      {/* Selected bed summary */}
      {selectedBed && (
        <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center gap-2">
            <Bed size={16} className="text-blue-600" />
            <div>
              <p className="text-sm font-semibold text-blue-800">{t('adm.form.bed.selected')} : {selectedBed.number}</p>
              <p className="text-xs text-blue-600">{selectedBed.buildingName} · {selectedBed.floorLabel} · Ch. {selectedBed.roomNumber}</p>
            </div>
          </div>
          <button type="button" onClick={() => { onSelect(null); }} className="p-1 rounded-lg hover:bg-blue-100 text-blue-500">
            <X size={14} />
          </button>
        </div>
      )}

      {!roomId && !selectedBed && (
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <Info size={12} />
          {t('adm.form.bed.skip')}
        </p>
      )}
    </div>
  );
}
