/**
 * Hospitalization — live ward bed board
 * All data from MockRepository (Phase 6b). No local mock.
 */
import { useState, useMemo } from 'react';
import { BedDouble, CheckCircle, Clock, Wrench, AlertTriangle, RefreshCw } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useMockRepository } from '@/store/MockRepository';
import { useAuth } from '@/store/AuthContext';
import type { OccupancyBed } from '@/types/repository';
import type { AuditCtx } from '@/types/repository';

type StatusFilter = 'all' | 'disponible' | 'occupe' | 'nettoyage' | 'maintenance';

const STATUS_COLOR: Record<string, string> = {
  disponible:   'bg-green-100 text-green-700 border-green-200',
  occupe:       'bg-red-100 text-red-700 border-red-200',
  reserve:      'bg-purple-100 text-purple-700 border-purple-200',
  nettoyage:    'bg-amber-100 text-amber-700 border-amber-200',
  maintenance:  'bg-gray-100 text-gray-600 border-gray-200',
  hors_service: 'bg-gray-100 text-gray-400 border-gray-200',
};
const STATUS_LABEL: Record<string, string> = {
  disponible:   'Disponible',
  occupe:       'Occupé',
  reserve:      'Réservé',
  nettoyage:    'Nettoyage',
  maintenance:  'Maintenance',
  hors_service: 'Hors service',
};

function BedCard({ bed, onClean, onComplete, ctx }: { bed: OccupancyBed; onClean: (id: string) => void; onComplete: (id: string) => void; ctx: AuditCtx }) {
  return (
    <div className={`border rounded-xl p-3 text-left transition-all ${STATUS_COLOR[bed.status] ?? ''}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <BedDouble size={14} />
          <span className="text-sm font-bold">{bed.number}</span>
        </div>
        <span className="text-xs font-medium capitalize">{STATUS_LABEL[bed.status] ?? bed.status}</span>
      </div>
      {bed.status === 'occupe' && bed.patientName && (
        <p className="text-xs mt-1 truncate font-medium">{bed.patientName}</p>
      )}
      {bed.status === 'nettoyage' && (
        <button
          onClick={() => onComplete(bed.id)}
          className="mt-2 w-full text-xs bg-green-600 text-white rounded-lg py-1 hover:bg-green-700 transition-colors"
        >
          ✓ Nettoyage terminé
        </button>
      )}
      {bed.status === 'occupe' && (
        <button
          onClick={() => onClean(bed.id)}
          className="mt-2 w-full text-xs bg-amber-500 text-white rounded-lg py-1 hover:bg-amber-600 transition-colors"
        >
          Démarrer nettoyage
        </button>
      )}
    </div>
  );
}

export default function Hospitalization() {
  const { beds, getBedStats, startBedCleaning, completeBedCleaning } = useMockRepository();
  const { user } = useAuth();

  const ctx: AuditCtx = { userId: user?.id ?? 'sys', userName: user ? `${user.firstName} ${user.lastName}` : 'Système', userRole: user?.role ?? 'admin' };

  const [buildingFilter, setBuildingFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

  const buildings = useMemo(() => {
    const seen = new Set<string>();
    return beds.reduce<{ id: string; name: string }[]>((acc, b) => {
      if (!seen.has(b.buildingId)) { seen.add(b.buildingId); acc.push({ id: b.buildingId, name: b.buildingName }); }
      return acc;
    }, []);
  }, [beds]);

  const filtered = useMemo(() => {
    return beds.filter(b => {
      if (buildingFilter !== 'all' && b.buildingId !== buildingFilter) return false;
      if (statusFilter  !== 'all' && b.status !== statusFilter) return false;
      if (search && !b.number.toLowerCase().includes(search.toLowerCase()) &&
          !(b.patientName ?? '').toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [beds, buildingFilter, statusFilter, search]);

  // Group by building → floor → room
  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, Record<string, Record<string, OccupancyBed[]>>>>(
      (acc, bed) => {
        if (!acc[bed.buildingName]) acc[bed.buildingName] = {};
        if (!acc[bed.buildingName][bed.floorLabel]) acc[bed.buildingName][bed.floorLabel] = {};
        if (!acc[bed.buildingName][bed.floorLabel][bed.roomNumber]) acc[bed.buildingName][bed.floorLabel][bed.roomNumber] = [];
        acc[bed.buildingName][bed.floorLabel][bed.roomNumber].push(bed);
        return acc;
      }, {},
    );
  }, [filtered]);

  const stats = getBedStats(buildingFilter !== 'all' ? { buildingId: buildingFilter } : undefined);

  const statCards = [
    { label: 'Total', value: stats.total,      icon: BedDouble,    color: 'text-gray-600',   bg: 'bg-gray-50'   },
    { label: 'Disponibles', value: stats.disponible, icon: CheckCircle, color: 'text-green-600',  bg: 'bg-green-50'  },
    { label: 'Occupés',     value: stats.occupe,     icon: BedDouble,   color: 'text-red-600',    bg: 'bg-red-50'    },
    { label: 'Nettoyage',   value: stats.nettoyage,  icon: RefreshCw,   color: 'text-amber-600',  bg: 'bg-amber-50'  },
    { label: 'Maintenance', value: stats.maintenance, icon: Wrench,     color: 'text-gray-500',   bg: 'bg-gray-50'   },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5">
        <PageHeader
          title="Hospitalisation"
          subtitle="État des lits par bâtiment, étage et chambre"
          actions={
            <span className="text-sm font-semibold px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Occupation : {stats.occupancyRate}%
            </span>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {statCards.map(s => (
            <div key={s.label} className={`${s.bg} border border-gray-100 rounded-xl p-4 flex items-center gap-3`}>
              <s.icon size={20} className={s.color} />
              <div>
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select value={buildingFilter} onChange={e => setBuildingFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="all">Tous les bâtiments</option>
            {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="all">Tous les statuts</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Lit ou patient…"
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>

        {/* Bed hierarchy */}
        {Object.entries(grouped).map(([building, floors]) => (
          <div key={building} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">{building}</h2>
            </div>
            <div className="p-4 space-y-5">
              {Object.entries(floors).map(([floor, rooms]) => (
                <div key={floor}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{floor}</p>
                  <div className="space-y-4">
                    {Object.entries(rooms).map(([room, roomBeds]) => (
                      <div key={room}>
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          Chambre {room}
                          <span className="ml-2 text-xs text-gray-400">
                            ({roomBeds.filter(b => b.status === 'disponible').length} libre{roomBeds.filter(b => b.status === 'disponible').length !== 1 ? 's' : ''} / {roomBeds.length})
                          </span>
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {roomBeds.map(bed => (
                            <BedCard
                              key={bed.id}
                              bed={bed}
                              onClean={id => startBedCleaning(id, ctx)}
                              onComplete={id => completeBedCleaning(id, ctx)}
                              ctx={ctx}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <BedDouble size={40} className="mx-auto mb-3 opacity-30" />
            <p>Aucun lit ne correspond aux filtres.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
