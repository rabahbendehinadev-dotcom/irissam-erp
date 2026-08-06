/**
 * Hospitalization — live ward bed board from PostgreSQL /occupancy-beds API.
 * Replaces MockRepository with real data.
 */
import { useState, useMemo, useCallback } from 'react';
import { BedDouble, CheckCircle, Clock, Wrench, AlertTriangle, RefreshCw } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { apiClient } from '@/lib/api-client';
import { useQuery } from '@/hooks/useQuery';

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

// ─── BedCard ──────────────────────────────────────────────────────────────────

function BedCard({
  bed,
  onStartCleaning,
  onCompleteCleaning,
  actionInProgress,
}: {
  bed: any;
  onStartCleaning: (id: string) => void;
  onCompleteCleaning: (id: string) => void;
  actionInProgress: string | null;
}) {
  const busy = actionInProgress === bed.id;
  return (
    <div className={`border rounded-xl p-3 text-left transition-all ${STATUS_COLOR[bed.status] ?? ''}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <BedDouble size={14} />
          <span className="text-sm font-bold">{bed.number}</span>
        </div>
        <span className="text-xs font-medium capitalize">
          {STATUS_LABEL[bed.status] ?? bed.status}
        </span>
      </div>
      {bed.status === 'occupe' && bed.patientName && (
        <p className="text-xs mt-1 truncate font-medium">{bed.patientName}</p>
      )}
      {bed.status === 'nettoyage' && (
        <button
          disabled={busy}
          onClick={() => onCompleteCleaning(bed.id)}
          className="mt-2 w-full text-xs bg-green-600 text-white rounded-lg py-1 hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {busy ? '…' : '✓ Nettoyage terminé'}
        </button>
      )}
      {bed.status === 'occupe' && (
        <button
          disabled={busy}
          onClick={() => onStartCleaning(bed.id)}
          className="mt-2 w-full text-xs bg-amber-500 text-white rounded-lg py-1 hover:bg-amber-600 disabled:opacity-50 transition-colors"
        >
          {busy ? '…' : 'Démarrer nettoyage'}
        </button>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Hospitalization() {
  const { data: rawBeds, loading, error, refetch } = useQuery<any[]>('/occupancy-beds');
  const beds = Array.isArray(rawBeds) ? rawBeds : [];

  const [buildingFilter, setBuildingFilter] = useState('all');
  const [statusFilter, setStatusFilter]     = useState<StatusFilter>('all');
  const [search, setSearch]                 = useState('');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Unique buildings for filter dropdown
  const buildings = useMemo(() => {
    const seen = new Set<string>();
    return beds.reduce<{ name: string }[]>((acc, b) => {
      const name = b.buildingName ?? 'Sans bâtiment';
      if (!seen.has(name)) { seen.add(name); acc.push({ name }); }
      return acc;
    }, []);
  }, [beds]);

  const filtered = useMemo(() => beds.filter(b => {
    if (buildingFilter !== 'all' && (b.buildingName ?? 'Sans bâtiment') !== buildingFilter) return false;
    if (statusFilter  !== 'all' && b.status !== statusFilter) return false;
    const q = search.toLowerCase();
    if (q && !b.number.toLowerCase().includes(q) &&
        !(b.patientName ?? '').toLowerCase().includes(q)) return false;
    return true;
  }), [beds, buildingFilter, statusFilter, search]);

  // Group by building → floor → room
  const grouped = useMemo(() => filtered.reduce<Record<string, Record<string, Record<string, any[]>>>>(
    (acc, bed) => {
      const bldg  = bed.buildingName ?? 'Sans bâtiment';
      const floor = bed.floorLabel   ?? 'Sans étage';
      const room  = bed.roomNumber   ?? 'Sans chambre';
      if (!acc[bldg])           acc[bldg] = {};
      if (!acc[bldg][floor])    acc[bldg][floor] = {};
      if (!acc[bldg][floor][room]) acc[bldg][floor][room] = [];
      acc[bldg][floor][room].push(bed);
      return acc;
    }, {},
  ), [filtered]);

  // Stats computed from current filter context
  const statsSet = buildingFilter !== 'all'
    ? beds.filter(b => (b.buildingName ?? 'Sans bâtiment') === buildingFilter)
    : beds;
  const stats = {
    total:       statsSet.length,
    disponible:  statsSet.filter(b => b.status === 'disponible').length,
    occupe:      statsSet.filter(b => b.status === 'occupe').length,
    nettoyage:   statsSet.filter(b => b.status === 'nettoyage').length,
    maintenance: statsSet.filter(b => b.status === 'maintenance' || b.status === 'hors_service').length,
    occupancyRate: statsSet.length > 0
      ? Math.round((statsSet.filter(b => b.status === 'occupe').length / statsSet.length) * 100)
      : 0,
  };

  // Actions
  const doAction = useCallback(async (id: string, endpoint: string) => {
    setActionInProgress(id);
    setActionError(null);
    try {
      await apiClient.post(`/occupancy-beds/${id}/${endpoint}`, {});
      refetch();
    } catch (e: unknown) {
      const body = e as { data?: { error?: string }; message?: string };
      setActionError(body?.data?.error ?? body?.message ?? 'Erreur');
    } finally {
      setActionInProgress(null);
    }
  }, [refetch]);

  const handleStartCleaning    = useCallback((id: string) => doAction(id, 'start-cleaning'),    [doAction]);
  const handleCompleteCleaning = useCallback((id: string) => doAction(id, 'complete-cleaning'), [doAction]);

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <DashboardLayout>
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-8 bg-white/10 rounded-lg w-1/3"/>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 bg-white/10 rounded-xl"/>)}
        </div>
        <div className="h-64 bg-white/10 rounded-xl"/>
      </div>
    </DashboardLayout>
  );

  // ─── Error ──────────────────────────────────────────────────────────────────
  if (error) return (
    <DashboardLayout>
      <div className="p-6 max-w-md mx-auto text-center mt-20">
        <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-red-400"/>
        <p className="text-white font-semibold mb-1">Impossible de charger les lits</p>
        <p className="text-white/50 text-sm mb-4">{error}</p>
        <button onClick={refetch}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 text-sm">
          <RefreshCw className="w-4 h-4"/> Réessayer
        </button>
      </div>
    </DashboardLayout>
  );

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="p-6 space-y-5">
        <PageHeader
          title="Hospitalisation"
          subtitle="État des lits par bâtiment, étage et chambre"
          actions={
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Occupation : {stats.occupancyRate}%
              </span>
              <button onClick={() => refetch()}
                className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors">
                <RefreshCw size={16}/>
              </button>
            </div>
          }
        />

        {/* Action error toast */}
        {actionError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-300 text-sm flex items-center gap-2">
            <AlertTriangle size={16}/>
            {actionError}
            <button onClick={() => setActionError(null)} className="ml-auto text-red-400 hover:text-red-200">✕</button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total',        value: stats.total,       icon: BedDouble,   color: 'text-gray-600',   bg: 'bg-gray-50' },
            { label: 'Disponibles',  value: stats.disponible,  icon: CheckCircle, color: 'text-green-600',  bg: 'bg-green-50' },
            { label: 'Occupés',      value: stats.occupe,      icon: BedDouble,   color: 'text-red-600',    bg: 'bg-red-50' },
            { label: 'Nettoyage',    value: stats.nettoyage,   icon: Clock,       color: 'text-amber-600',  bg: 'bg-amber-50' },
            { label: 'Maintenance',  value: stats.maintenance, icon: Wrench,      color: 'text-gray-500',   bg: 'bg-gray-50' },
          ].map(s => (
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
            {buildings.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="all">Tous les statuts</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Lit ou patient…"
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
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
                            ({roomBeds.filter(b => b.status === 'disponible').length} libre
                            {roomBeds.filter(b => b.status === 'disponible').length !== 1 ? 's' : ''} / {roomBeds.length})
                          </span>
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {roomBeds.map(bed => (
                            <BedCard
                              key={bed.id}
                              bed={bed}
                              onStartCleaning={handleStartCleaning}
                              onCompleteCleaning={handleCompleteCleaning}
                              actionInProgress={actionInProgress}
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

        {/* Empty state */}
        {filtered.length === 0 && beds.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <BedDouble size={40} className="mx-auto mb-3 opacity-30"/>
            <p className="font-medium">Aucun lit enregistré</p>
            <p className="text-sm mt-1">Configurez les lits depuis le tableau de bord système.</p>
          </div>
        )}
        {filtered.length === 0 && beds.length > 0 && (
          <div className="text-center py-16 text-gray-400">
            <BedDouble size={40} className="mx-auto mb-3 opacity-30"/>
            <p>Aucun lit ne correspond aux filtres.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
