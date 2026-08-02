/**
 * Resuscitation (ICU) — live ICU bed board
 * Data from real PostgreSQL API via useICUApi hook.
 */
import { useState } from 'react';
import { Activity, CheckCircle, AlertTriangle, Clock, BedDouble, RefreshCw } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useICUApi } from '@/hooks/useICUApi';

const STATUS_COLOR: Record<string, string> = {
  disponible:   'border-green-300 bg-green-50 text-green-700',
  occupe:       'border-red-300 bg-red-50 text-red-700',
  reserve:      'border-purple-300 bg-purple-50 text-purple-700',
  nettoyage:    'border-amber-300 bg-amber-50 text-amber-700',
  hors_service: 'border-gray-200 bg-gray-50 text-gray-400 opacity-60',
};

const STATUS_LABEL: Record<string, string> = {
  disponible:   'Disponible',
  occupe:       'Occupé',
  reserve:      'Réservé',
  nettoyage:    'Nettoyage',
  hors_service: 'Hors service',
};

const PRIORITY_COLOR: Record<string, string> = {
  P1: 'bg-red-100 text-red-700',
  P2: 'bg-orange-100 text-orange-700',
  P3: 'bg-yellow-100 text-yellow-700',
  P4: 'bg-gray-100 text-gray-500',
};

export default function Resuscitation() {
  const { icuBeds, loading, error, getICUStats, freeICUBed, refresh } = useICUApi();
  const [filter, setFilter] = useState<'all' | 'disponible' | 'occupe'>('all');

  const stats    = getICUStats();
  const displayed = icuBeds.filter(b => filter === 'all' || b.status === filter);

  // Group by unit
  const byUnit = displayed.reduce<Record<string, typeof icuBeds>>((acc, b) => {
    (acc[b.unitName] = acc[b.unitName] ?? []).push(b);
    return acc;
  }, {});

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5">
        <PageHeader
          title="Réanimation"
          subtitle="Disponibilité des lits de réanimation en temps réel"
          actions={
            <div className="flex items-center gap-2">
              {stats.disponible === 0 && (
                <span className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-red-50 border border-red-200 text-red-700 rounded-full font-medium">
                  <AlertTriangle size={12} /> Aucun lit disponible
                </span>
              )}
              <span className="text-sm font-semibold px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Occupation : {stats.occupancyRate}%
              </span>
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

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total',       value: stats.total,      icon: BedDouble, color: 'text-gray-600' },
            { label: 'Disponibles', value: stats.disponible, icon: CheckCircle, color: 'text-green-600' },
            { label: 'Occupés',     value: stats.occupe,     icon: Activity,   color: 'text-red-600'  },
            { label: 'Occupation',  value: `${stats.occupancyRate}%`, icon: Clock, color: 'text-blue-600' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm">
              <Icon size={20} className={color} />
              <div>
                <div className="text-xl font-bold text-gray-900">{value}</div>
                <div className="text-xs text-gray-500">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(['all', 'disponible', 'occupe'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f === 'all' ? 'Tous' : f === 'disponible' ? 'Disponibles' : 'Occupés'}
            </button>
          ))}
        </div>

        {/* Loading skeleton */}
        {loading && icuBeds.length === 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-40 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        )}

        {/* Bed groups by unit */}
        {Object.entries(byUnit).map(([unitName, beds]) => (
          <div key={unitName} className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <BedDouble size={15} className="text-blue-500" /> {unitName}
              <span className="ml-1 text-xs font-normal text-gray-400">
                ({beds.filter(b => b.status === 'disponible').length} libre{beds.filter(b => b.status === 'disponible').length !== 1 ? 's' : ''} / {beds.length})
              </span>
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {beds.map(bed => (
                <div
                  key={bed.id}
                  className={`border-2 rounded-2xl p-4 transition-shadow shadow-sm hover:shadow-md ${STATUS_COLOR[bed.status] ?? 'border-gray-200 bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm">Lit {bed.number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      bed.status === 'disponible' ? 'bg-green-100 text-green-700' :
                      bed.status === 'occupe'     ? 'bg-red-100 text-red-700'    :
                      bed.status === 'reserve'    ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {STATUS_LABEL[bed.status] ?? bed.status}
                    </span>
                  </div>

                  {bed.patientName && (
                    <div className="mt-2 space-y-1">
                      <div className="text-sm font-medium text-gray-800 truncate">{bed.patientName}</div>
                      {bed.priority && (
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLOR[bed.priority] ?? 'bg-gray-100 text-gray-500'}`}>
                          {bed.priority}
                        </span>
                      )}
                      {bed.occupiedAt && (
                        <div className="text-xs text-gray-400 mt-1">
                          Depuis {new Date(bed.occupiedAt).toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  )}

                  {bed.status === 'occupe' && bed.icuAdmissionId && (
                    <button
                      onClick={() => freeICUBed(bed.id)}
                      className="mt-3 w-full text-xs py-1.5 rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 transition-colors font-medium"
                    >
                      Libérer
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {!loading && displayed.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <BedDouble size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucun lit trouvé</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
