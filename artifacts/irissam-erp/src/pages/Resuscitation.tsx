/**
 * Resuscitation (ICU) — live ICU bed board
 * All data from MockRepository (Phase 6b). No local mock.
 */
import { useState } from 'react';
import { Activity, CheckCircle, AlertTriangle, Clock, BedDouble } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useMockRepository } from '@/store/MockRepository';
import { useAuth } from '@/store/AuthContext';
import type { AuditCtx } from '@/types/repository';

const STATUS_COLOR: Record<string, string> = {
  disponible: 'border-green-300 bg-green-50 text-green-700',
  occupe:     'border-red-300 bg-red-50 text-red-700',
  reserve:    'border-purple-300 bg-purple-50 text-purple-700',
  hors_service: 'border-gray-200 bg-gray-50 text-gray-400 opacity-60',
};

const PRIORITY_COLOR: Record<string, string> = {
  P1: 'bg-red-100 text-red-700',
  P2: 'bg-orange-100 text-orange-700',
  P3: 'bg-yellow-100 text-yellow-700',
};

export default function Resuscitation() {
  const { icuBeds, getICUStats, freeICUBed } = useMockRepository();
  const { user } = useAuth();
  const ctx: AuditCtx = { userId: user?.id ?? 'sys', userName: user ? `${user.firstName} ${user.lastName}` : 'Système', userRole: user?.role ?? 'admin' };

  const [filter, setFilter] = useState<'all' | 'disponible' | 'occupe'>('all');
  const stats = getICUStats();

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
            </div>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: stats.total,      color: 'text-gray-700',   bg: 'bg-gray-50',    icon: BedDouble },
            { label: 'Disponibles', value: stats.disponible, color: 'text-green-700', bg: 'bg-green-50', icon: CheckCircle },
            { label: 'Occupés',    value: stats.occupe,     color: 'text-red-700',   bg: 'bg-red-50',   icon: Activity },
            { label: 'Réservés',   value: stats.reserve,    color: 'text-purple-700',bg: 'bg-purple-50',icon: Clock },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border border-gray-100 rounded-xl p-4 flex items-center gap-3`}>
              <s.icon size={20} className={s.color} />
              <div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-2">
          {(['all', 'disponible', 'occupe'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${filter === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {f === 'all' ? 'Tous' : f === 'disponible' ? 'Disponibles' : 'Occupés'}
            </button>
          ))}
        </div>

        {/* Units */}
        {Object.entries(byUnit).map(([unit, unitBeds]) => (
          <div key={unit} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-800">{unit}</h2>
              <span className="text-xs text-gray-500">
                {unitBeds.filter(b => b.status === 'disponible').length} / {unitBeds.length} disponibles
              </span>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {unitBeds.map(bed => (
                <div key={bed.id} className={`border-2 rounded-xl p-3 ${STATUS_COLOR[bed.status] ?? ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Activity size={14} />
                      <span className="text-sm font-bold">{bed.number}</span>
                    </div>
                    {bed.priority && (
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${PRIORITY_COLOR[bed.priority] ?? ''}`}>
                        {bed.priority}
                      </span>
                    )}
                  </div>
                  {bed.patientName && <p className="text-xs font-medium truncate">{bed.patientName}</p>}
                  <p className="text-xs mt-1">{bed.status === 'disponible' ? 'Disponible' : bed.status === 'occupe' ? 'Occupé' : bed.status === 'reserve' ? 'Réservé' : 'Hors service'}</p>
                  {bed.status === 'occupe' && (
                    <button onClick={() => freeICUBed(bed.id, ctx)}
                      className="mt-2 w-full text-xs bg-green-600 text-white rounded-lg py-1 hover:bg-green-700 transition-colors">
                      Libérer
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
