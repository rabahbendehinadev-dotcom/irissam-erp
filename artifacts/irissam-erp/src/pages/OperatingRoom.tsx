/**
 * OperatingRoom — Bloc opératoire live board
 * Data from real PostgreSQL API via useOperatingRoomApi.
 */
import { useState, useMemo } from 'react';
import { Scissors, Clock, CheckCircle, AlertTriangle, Calendar, RefreshCw } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useOperatingRoomApi } from '@/hooks/useOperatingRoomApi';
import type { OperatingRoomStatus } from '@/types/repository';
import type { ORRoomApi } from '@/hooks/useOperatingRoomApi';

const STATUS_COLOR: Record<OperatingRoomStatus, string> = {
  libre:            'border-green-300 bg-green-50',
  reserve:          'border-purple-300 bg-purple-50',
  en_preparation:   'border-blue-300 bg-blue-50',
  en_intervention:  'border-red-300 bg-red-50',
  nettoyage:        'border-amber-300 bg-amber-50',
  hors_service:     'border-gray-200 bg-gray-50 opacity-60',
  maintenance:      'border-gray-200 bg-gray-50 opacity-60',
};

const STATUS_LABEL: Record<OperatingRoomStatus, string> = {
  libre:            'Libre',
  reserve:          'Réservé',
  en_preparation:   'En préparation',
  en_intervention:  'En intervention',
  nettoyage:        'Nettoyage',
  hors_service:     'Hors service',
  maintenance:      'Maintenance',
};

const STATUS_ICON: Record<OperatingRoomStatus, React.ElementType> = {
  libre:            CheckCircle,
  reserve:          Clock,
  en_preparation:   Clock,
  en_intervention:  Scissors,
  nettoyage:        AlertTriangle,
  hors_service:     AlertTriangle,
  maintenance:      AlertTriangle,
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit' });
}

function ORCard({ or: room, currentRequest }: { or: ORRoomApi; currentRequest?: any }) {
  const Icon = STATUS_ICON[room.status] ?? CheckCircle;

  return (
    <div className={`border-2 rounded-2xl overflow-hidden shadow-sm ${STATUS_COLOR[room.status] ?? 'border-gray-200 bg-gray-50'}`}>
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-gray-600" />
          <span className="font-bold text-sm text-gray-900">{room.name}</span>
          {room.specialty && (
            <span className="text-xs text-gray-400">({room.specialty})</span>
          )}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          room.status === 'libre'           ? 'bg-green-100 text-green-700' :
          room.status === 'reserve'         ? 'bg-purple-100 text-purple-700' :
          room.status === 'en_preparation'  ? 'bg-blue-100 text-blue-700' :
          room.status === 'en_intervention' ? 'bg-red-100 text-red-700' :
          room.status === 'nettoyage'       ? 'bg-amber-100 text-amber-700' :
          'bg-gray-100 text-gray-400'
        }`}>
          {STATUS_LABEL[room.status]}
        </span>
      </div>

      {currentRequest && (
        <div className="px-4 pb-3 space-y-1">
          <div className="text-sm font-medium text-gray-800 truncate">
            {currentRequest.patientName}
          </div>
          <div className="text-xs text-gray-500 truncate">{currentRequest.intervention}</div>
          {currentRequest.surgeonName && (
            <div className="text-xs text-gray-400">Dr. {currentRequest.surgeonName}</div>
          )}
          {currentRequest.scheduledAt && (
            <div className="text-xs text-gray-400 flex items-center gap-1">
              <Calendar size={10} />
              {formatDate(currentRequest.scheduledAt)} à {formatTime(currentRequest.scheduledAt)}
            </div>
          )}
        </div>
      )}

      {!currentRequest && room.status === 'libre' && (
        <div className="px-4 pb-3 text-xs text-green-600 flex items-center gap-1">
          <CheckCircle size={11} /> Disponible pour intervention
        </div>
      )}
    </div>
  );
}

export default function OperatingRoom() {
  const { operatingRooms: rawORooms, surgicalRequests: rawSurgReqs, loading, error, refresh } = useOperatingRoomApi();
  const [filter, setFilter] = useState<OperatingRoomStatus | 'all'>('all');

  const operatingRooms  = Array.isArray(rawORooms)   ? rawORooms   : [];
  const surgicalRequests = Array.isArray(rawSurgReqs) ? rawSurgReqs : [];

  // Map current surgical requests to rooms
  const requestByOrRoomId = useMemo(() => {
    const map: Record<string, any> = {};
    for (const r of surgicalRequests) {
      if (r.orRoomId && r.status !== 'annule' && r.status !== 'termine') {
        map[r.orRoomId] = r;
      }
    }
    return map;
  }, [surgicalRequests]);

  const displayed = operatingRooms.filter(r => filter === 'all' || r.status === filter);

  const stats = useMemo(() => ({
    total:          operatingRooms.length,
    libre:          operatingRooms.filter(r => r.status === 'libre').length,
    enIntervention: operatingRooms.filter(r => r.status === 'en_intervention').length,
    reserve:        operatingRooms.filter(r => r.status === 'reserve').length,
    nettoyage:      operatingRooms.filter(r => r.status === 'nettoyage').length,
  }), [operatingRooms]);

  // Pending surgical requests (not yet assigned to a room)
  const pending = surgicalRequests.filter(r => r.status === 'demande');

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5">
        <PageHeader
          title="Bloc opératoire"
          subtitle="Statut des salles d'opération en temps réel"
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={refresh}
                disabled={loading}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                title="Actualiser"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin text-blue-500' : 'text-gray-500'} />
              </button>
              <span className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-full font-medium">
                ● Live
              </span>
            </div>
          }
        />

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error} — <button onClick={refresh} className="underline font-medium">Réessayer</button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Total',       value: stats.total,          color: 'text-gray-600', bg: 'bg-gray-50' },
            { label: 'Libres',      value: stats.libre,          color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'En cours',    value: stats.enIntervention, color: 'text-red-600',   bg: 'bg-red-50' },
            { label: 'Réservés',    value: stats.reserve,        color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Nettoyage',   value: stats.nettoyage,      color: 'text-amber-600',  bg: 'bg-amber-50' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`${bg} rounded-xl border border-gray-100 p-3 text-center shadow-sm`}>
              <div className={`text-xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'libre', 'reserve', 'en_preparation', 'en_intervention', 'nettoyage'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f === 'all' ? 'Toutes' : STATUS_LABEL[f as OperatingRoomStatus]}
            </button>
          ))}
        </div>

        {/* Loading skeleton */}
        {loading && operatingRooms.length === 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        )}

        {/* OR cards */}
        {displayed.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayed.map(room => (
              <ORCard
                key={room.id}
                or={room}
                currentRequest={requestByOrRoomId[room.id]}
              />
            ))}
          </div>
        )}

        {/* Pending surgical requests */}
        {pending.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Clock size={14} className="text-orange-500" />
              Demandes en attente de planification
              <span className="ml-1 bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-medium">
                {pending.length}
              </span>
            </h3>
            <div className="space-y-2">
              {pending.map(r => (
                <div key={r.id} className="flex items-center gap-4 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                  <Scissors size={14} className="text-orange-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{r.patientName}</div>
                    <div className="text-xs text-gray-500 truncate">{r.intervention}</div>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                    r.urgencyDegree === 'urgent'   ? 'bg-red-100 text-red-700' :
                    r.urgencyDegree === 'elective' ? 'bg-gray-100 text-gray-600' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {r.urgencyDegree}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && displayed.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Scissors size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucune salle trouvée</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
