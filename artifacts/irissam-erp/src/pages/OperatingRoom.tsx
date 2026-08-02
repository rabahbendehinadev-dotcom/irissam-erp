/**
 * OperatingRoom — Bloc opératoire live board
 * All data from MockRepository (Phase 6b). No local mock.
 */
import { useState, useMemo } from 'react';
import { Scissors, Clock, CheckCircle, AlertTriangle, Calendar } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useMockRepository } from '@/store/MockRepository';
import { useAuth } from '@/store/AuthContext';
import type { OperatingRoom as ORType, OperatingRoomStatus, AuditCtx } from '@/types/repository';

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

function ORCard({ or: room, onStatusChange, ctx }: { or: ORType; onStatusChange: (id: string, s: OperatingRoomStatus) => void; ctx: AuditCtx }) {
  const Icon = STATUS_ICON[room.status];
  const nextSlots = room.slots
    .filter(s => new Date(s.endAt) > new Date())
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const currentSlot = nextSlots.find(s => new Date(s.startAt) <= new Date() && new Date(s.endAt) > new Date());
  const upcoming    = nextSlots.filter(s => new Date(s.startAt) > new Date()).slice(0, 2);

  return (
    <div className={`border-2 rounded-2xl overflow-hidden shadow-sm ${STATUS_COLOR[room.status]}`}>
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-gray-600" />
          <div>
            <p className="font-bold text-gray-800">{room.name}</p>
            <p className="text-xs text-gray-500">{room.specialty}</p>
          </div>
        </div>
        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white/70 border border-white">
          {STATUS_LABEL[room.status]}
        </span>
      </div>

      <div className="px-4 pb-4 space-y-2">
        {currentSlot && (
          <div className="bg-white/80 rounded-xl p-2.5">
            <p className="text-xs font-semibold text-red-700 mb-0.5">🔴 En cours</p>
            <p className="text-sm font-medium text-gray-800">{currentSlot.intervention}</p>
            <p className="text-xs text-gray-500">{currentSlot.patientName} · {currentSlot.surgeon}</p>
            <p className="text-xs text-gray-400 mt-0.5">{formatTime(currentSlot.startAt)} → {formatTime(currentSlot.endAt)}</p>
          </div>
        )}

        {upcoming.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-500">Prochains créneaux</p>
            {upcoming.map(s => (
              <div key={s.id} className="bg-white/60 rounded-lg p-2">
                <p className="text-xs font-medium text-gray-700">{s.intervention}</p>
                <p className="text-xs text-gray-500">{s.patientName} · {formatDate(s.startAt)} {formatTime(s.startAt)}</p>
              </div>
            ))}
          </div>
        )}

        {/* Status transitions */}
        <div className="flex gap-1.5 flex-wrap pt-1">
          {room.status === 'en_intervention' && (
            <button onClick={() => onStatusChange(room.id, 'nettoyage')}
              className="text-xs bg-amber-500 text-white rounded-lg px-2.5 py-1 hover:bg-amber-600 transition-colors">
              Fin d'intervention
            </button>
          )}
          {room.status === 'nettoyage' && (
            <button onClick={() => onStatusChange(room.id, 'libre')}
              className="text-xs bg-green-600 text-white rounded-lg px-2.5 py-1 hover:bg-green-700 transition-colors">
              Nettoyage terminé
            </button>
          )}
          {room.status === 'libre' && (
            <button onClick={() => onStatusChange(room.id, 'en_preparation')}
              className="text-xs bg-blue-600 text-white rounded-lg px-2.5 py-1 hover:bg-blue-700 transition-colors">
              Préparer
            </button>
          )}
          {room.status === 'en_preparation' && (
            <button onClick={() => onStatusChange(room.id, 'en_intervention')}
              className="text-xs bg-red-600 text-white rounded-lg px-2.5 py-1 hover:bg-red-700 transition-colors">
              Démarrer intervention
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OperatingRoom() {
  const { operatingRooms, updateOperatingRoomStatus } = useMockRepository();
  const { user } = useAuth();
  const ctx: AuditCtx = { userId: user?.id ?? 'sys', userName: user ? `${user.firstName} ${user.lastName}` : 'Système', userRole: user?.role ?? 'admin' };

  const libre         = operatingRooms.filter(r => r.status === 'libre').length;
  const enCours       = operatingRooms.filter(r => r.status === 'en_intervention').length;
  const enPrep        = operatingRooms.filter(r => r.status === 'en_preparation').length;
  const nettoyage     = operatingRooms.filter(r => r.status === 'nettoyage').length;

  const totalSlots = useMemo(() => {
    const today = new Date().toDateString();
    return operatingRooms.reduce((sum, r) =>
      sum + r.slots.filter(s => new Date(s.startAt).toDateString() === today).length, 0);
  }, [operatingRooms]);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5">
        <PageHeader
          title="Bloc opératoire"
          subtitle="Planification et suivi en temps réel des salles"
        />

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Libres',          value: libre,      color: 'text-green-700', bg: 'bg-green-50',  icon: CheckCircle },
            { label: 'En intervention', value: enCours,    color: 'text-red-700',   bg: 'bg-red-50',    icon: Scissors },
            { label: 'En préparation',  value: enPrep,     color: 'text-blue-700',  bg: 'bg-blue-50',   icon: Clock },
            { label: 'Interventions J', value: totalSlots, color: 'text-gray-700',  bg: 'bg-gray-50',   icon: Calendar },
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

        {/* OR cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {operatingRooms.map(or => (
            <ORCard key={or.id} or={or} onStatusChange={(id, s) => updateOperatingRoomStatus(id, s, ctx)} ctx={ctx} />
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
