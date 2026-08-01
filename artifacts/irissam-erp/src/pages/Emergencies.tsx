import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import {
  AlertTriangle, Activity, Ambulance as AmbulanceIcon, Bed, Users,
  Clock, Search, ChevronRight, Radio, Stethoscope, FlaskConical,
  Scan, FileText, History, LogOut, UserCheck, RefreshCw,
  Wifi, MapPin, Phone,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { cn } from '@/lib/utils';
import { EmergencyPriorityBadge, PRIORITY_CFG } from '@/components/emergencies/EmergencyPriorityBadge';
import {
  MOCK_EMERGENCY_PATIENTS,
  MOCK_EMERGENCY_ROOMS,
  MOCK_EMERGENCY_AMBULANCES,
  MOCK_EMERGENCY_DOCTORS,
  MOCK_EMERGENCY_NURSES,
} from '@/mock';
import type {
  EmergencyPatient, EmergencyPatientStatus,
  EmergencyRoom, Ambulance, EmergencyDoctor, EmergencyNurse,
  EmergencyPriority,
} from '@/types/emergency';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns elapsed time in ms from an ISO string */
function elapsedMs(iso: string): number {
  return Date.now() - new Date(iso).getTime();
}

/** Format milliseconds → HH:MM:SS or MM:SS */
function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Timer color based on elapsed vs priority target */
function timerCls(elapsedMs: number, targetMin: number): string {
  if (targetMin === 0) return 'text-red-600 font-bold animate-pulse tabular-nums';
  const ratio = (elapsedMs / 60000) / targetMin;
  if (ratio >= 1)    return 'text-red-600 font-bold tabular-nums';
  if (ratio >= 0.75) return 'text-amber-600 font-semibold tabular-nums';
  return 'text-gray-500 tabular-nums';
}

/** Hook that ticks every second to trigger re-renders for live timers */
function useTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return tick;
}

/** Patient status display config */
const STATUS_CFG: Record<EmergencyPatientStatus, { label: string; color: string; bg: string; pulse?: boolean }> = {
  attente_triage:   { label: 'Attente triage',  color: 'text-gray-700',   bg: 'bg-gray-100' },
  en_triage:        { label: 'En triage',        color: 'text-orange-700', bg: 'bg-orange-100', pulse: true },
  attente_soins:    { label: 'Attente soins',    color: 'text-amber-700',  bg: 'bg-amber-100' },
  en_soins:         { label: 'En soins',         color: 'text-blue-700',   bg: 'bg-blue-100',   pulse: true },
  observation:      { label: 'Observation',      color: 'text-violet-700', bg: 'bg-violet-100' },
  hospitalise:      { label: 'Hospitalisé',      color: 'text-indigo-700', bg: 'bg-indigo-100' },
  sorti:            { label: 'Sorti',            color: 'text-green-700',  bg: 'bg-green-100' },
  transfere:        { label: 'Transféré',        color: 'text-gray-600',   bg: 'bg-gray-100' },
  decede:           { label: 'Décédé',           color: 'text-gray-500',   bg: 'bg-gray-100' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-sm text-gray-300 tabular-nums">
      {time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, color, pulse }: {
  icon: React.ElementType; label: string; value: number | string;
  sub?: string; color: string; pulse?: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', color)}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <div className="flex items-center gap-1.5">
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {pulse && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
        </div>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function QuickNavTile({ icon: Icon, label, count, countColor, onClick }: {
  icon: React.ElementType; label: string; count?: number; countColor?: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/30 transition-colors group"
    >
      <Icon size={20} className="text-gray-500 group-hover:text-blue-600 transition-colors" />
      <span className="text-xs font-medium text-gray-700 text-center leading-tight">{label}</span>
      {count !== undefined && (
        <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded-full', countColor ?? 'bg-gray-100 text-gray-700')}>
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Patient Queue ────────────────────────────────────────────────────────────

type PriorityFilter = 'all' | 'P1' | 'P2' | 'P3' | 'P4P5';

function PatientRow({ patient, tick }: { patient: EmergencyPatient; tick: number }) {
  const cfg = PRIORITY_CFG[patient.priority];
  const statusCfg = STATUS_CFG[patient.status];
  const elapsed = elapsedMs(patient.arrivalTime);
  const [, setLocation] = useLocation();

  return (
    <div className={cn(
      'flex items-start gap-3 px-4 py-3 border-b border-gray-100 last:border-0 hover:brightness-95 transition-all',
      cfg.rowBg,
    )}>
      {/* Priority badge */}
      <div className="flex-shrink-0 pt-0.5">
        <EmergencyPriorityBadge priority={patient.priority} size="sm" showLabel="short" />
      </div>

      {/* Identity */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-gray-900 text-sm">
            {patient.lastName} {patient.firstName}
          </span>
          <span className="text-xs text-gray-500">
            {patient.age} ans · {patient.gender === 'M' ? '♂' : '♀'}
          </span>
          {patient.isMinor && (
            <span className="text-xs bg-pink-100 text-pink-700 border border-pink-200 px-1.5 py-0.5 rounded-full">Mineur</span>
          )}
          {patient.byAmbulance && (
            <span className="text-xs bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <AmbulanceIcon size={9} /> SMUR
            </span>
          )}
          {patient.tags?.map(tag => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full capitalize">{tag}</span>
          ))}
        </div>
        <p className="text-xs text-gray-700 mt-0.5 line-clamp-1">{patient.chiefComplaint}</p>
        {patient.assignedRoom && (
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
            <Bed size={10} /> {patient.assignedRoom}
          </p>
        )}
      </div>

      {/* Vitals snapshot */}
      {patient.vitals && (
        <div className="hidden lg:flex flex-col gap-0.5 text-xs text-gray-500 flex-shrink-0 w-28">
          {patient.vitals.hr && (
            <span className={cn('font-mono', patient.vitals.hr > 100 || patient.vitals.hr < 60 ? 'text-red-600 font-semibold' : '')}>
              ❤ {patient.vitals.hr} bpm
            </span>
          )}
          {patient.vitals.bp && (
            <span className="font-mono">{patient.vitals.bp} mmHg</span>
          )}
          {patient.vitals.spo2 && (
            <span className={cn('font-mono', patient.vitals.spo2 < 94 ? 'text-red-600 font-semibold' : '')}>
              O₂ {patient.vitals.spo2}%
            </span>
          )}
        </div>
      )}

      {/* Timer */}
      <div className="flex-shrink-0 text-right">
        <p className={cn('text-sm font-mono', timerCls(elapsed, cfg.targetMin))}>
          ⏱ {formatElapsed(elapsed)}
        </p>
        <p className="text-xs text-gray-400">
          Cible : {cfg.targetMin === 0 ? 'Immédiat' : `${cfg.targetMin} min`}
        </p>
      </div>

      {/* Doctor / Nurse */}
      <div className="hidden xl:flex flex-col gap-0.5 text-xs flex-shrink-0 w-36">
        {patient.assignedDoctor ? (
          <span className="flex items-center gap-1 text-blue-700 font-medium">
            <Stethoscope size={9} /> {patient.assignedDoctor.replace('Dr. ', '')}
          </span>
        ) : (
          <span className="text-gray-300 italic">Non assigné</span>
        )}
        {patient.assignedNurse && (
          <span className="flex items-center gap-1 text-gray-500">
            <UserCheck size={9} /> {patient.assignedNurse.replace('Inf. ', '')}
          </span>
        )}
      </div>

      {/* Status */}
      <div className="flex-shrink-0">
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap flex items-center gap-1', statusCfg.color, statusCfg.bg)}>
          {statusCfg.pulse && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
          {statusCfg.label}
        </span>
      </div>

      {/* Action */}
      <button
        onClick={() => alert(`Dossier urgence ${patient.id} — sous-page disponible prochainement`)}
        className="flex-shrink-0 p-1.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

function PatientQueueSection({ patients, tick }: { patients: EmergencyPatient[]; tick: number }) {
  const [filter, setFilter]   = useState<PriorityFilter>('all');
  const [search, setSearch]   = useState('');

  const PRIORITY_ORDER: EmergencyPriority[] = ['P1', 'P2', 'P3', 'P4', 'P5'];

  const sorted = useMemo(() => [...patients].sort((a, b) => {
    const pa = PRIORITY_ORDER.indexOf(a.priority);
    const pb = PRIORITY_ORDER.indexOf(b.priority);
    if (pa !== pb) return pa - pb;
    return new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime();
  }), [patients]);

  const filtered = useMemo(() => sorted.filter(p => {
    const matchPriority = filter === 'all'
      ? true
      : filter === 'P4P5'
        ? (p.priority === 'P4' || p.priority === 'P5')
        : p.priority === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || [p.lastName, p.firstName, p.chiefComplaint, p.mpiId]
      .some(f => f?.toLowerCase().includes(q));
    return matchPriority && matchSearch;
  }), [sorted, filter, search]);

  const counts = {
    all:  patients.length,
    P1:   patients.filter(p => p.priority === 'P1').length,
    P2:   patients.filter(p => p.priority === 'P2').length,
    P3:   patients.filter(p => p.priority === 'P3').length,
    P4P5: patients.filter(p => p.priority === 'P4' || p.priority === 'P5').length,
  };

  const filterTabs: { key: PriorityFilter; label: string; cls: string }[] = [
    { key: 'all',  label: `Tous (${counts.all})`,         cls: 'text-gray-700 border-gray-300' },
    { key: 'P1',   label: `P1 Immédiat (${counts.P1})`,   cls: 'text-red-700 border-red-300 bg-red-50' },
    { key: 'P2',   label: `P2 Très urgent (${counts.P2})`,cls: 'text-orange-700 border-orange-300 bg-orange-50' },
    { key: 'P3',   label: `P3 Urgent (${counts.P3})`,     cls: 'text-yellow-700 border-yellow-300 bg-yellow-50' },
    { key: 'P4P5', label: `P4/P5 (${counts.P4P5})`,       cls: 'text-green-700 border-green-300 bg-green-50' },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-blue-600" />
            <h3 className="font-semibold text-gray-800 text-sm">File d'attente des patients</h3>
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher patient, motif…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
        {/* Priority filter tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                'px-2.5 py-1 text-xs rounded-lg border transition-colors font-medium',
                filter === tab.key
                  ? `${tab.cls} opacity-100`
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table header */}
      <div className="hidden lg:grid grid-cols-[auto_1fr_100px_130px_100px_80px_auto] gap-2 px-4 py-2 bg-gray-50/50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
        <span>Priorité</span>
        <span>Patient / Motif</span>
        <span>Constantes</span>
        <span className="text-right">Attente</span>
        <span>Médecin</span>
        <span>Statut</span>
        <span />
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Users size={36} className="opacity-20 mb-2" />
            <p className="text-sm">Aucun patient pour ce filtre</p>
          </div>
        ) : (
          filtered.map(p => <PatientRow key={p.id} patient={p} tick={tick} />)
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
        <p className="text-xs text-gray-400">{filtered.length} patient{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}</p>
        <p className="text-xs text-gray-400">⏱ Mise à jour en temps réel</p>
      </div>
    </div>
  );
}

// ─── Rooms Board ──────────────────────────────────────────────────────────────

function RoomsBoard({ rooms }: { rooms: EmergencyRoom[] }) {
  const ROOM_TYPE_ORDER: Record<string, number> = {
    reanimation: 0, triage: 1, soins: 2, observation: 3, attente: 4,
  };

  const sorted = [...rooms].sort((a, b) =>
    (ROOM_TYPE_ORDER[a.type] ?? 9) - (ROOM_TYPE_ORDER[b.type] ?? 9)
  );

  function roomStatusCls(room: EmergencyRoom) {
    const ratio = room.capacity > 0 ? room.occupied / room.capacity : 0;
    if (room.type === 'reanimation' && room.occupied > 0) return 'bg-red-100 border-red-300 text-red-800';
    if (ratio >= 1)    return 'bg-red-50 border-red-200 text-red-700';
    if (ratio >= 0.75) return 'bg-amber-50 border-amber-200 text-amber-700';
    if (ratio > 0)     return 'bg-blue-50 border-blue-200 text-blue-700';
    return 'bg-green-50 border-green-200 text-green-700';
  }

  function roomFreeLabel(room: EmergencyRoom) {
    const free = room.capacity - room.occupied;
    if (free === 0) return 'COMPLET';
    return `${free} libre${free > 1 ? 's' : ''}`;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
        <Bed size={14} className="text-blue-600" />
        <h3 className="font-semibold text-gray-800 text-sm">État des salles</h3>
      </div>
      <div className="p-3 grid grid-cols-2 gap-2">
        {sorted.map(room => {
          const ratio = room.capacity > 0 ? room.occupied / room.capacity : 0;
          const cls = roomStatusCls(room);
          const pct = Math.round(ratio * 100);
          return (
            <div key={room.id} className={cn('rounded-lg border p-2.5 flex flex-col gap-1', cls)}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">{room.shortName}</span>
                <span className="text-xs font-semibold">{room.occupied}/{room.capacity}</span>
              </div>
              {/* Occupancy bar */}
              <div className="w-full bg-white/60 rounded-full h-1.5 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', ratio >= 1 ? 'bg-red-500' : ratio >= 0.75 ? 'bg-amber-500' : 'bg-blue-500')}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <span className="text-xs opacity-80 leading-none">{roomFreeLabel(room)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Staff Board ──────────────────────────────────────────────────────────────

function StaffBoard({ doctors, nurses }: { doctors: EmergencyDoctor[]; nurses: EmergencyNurse[] }) {
  const ROLE_LABEL = { chef_service: 'Chef de service', senior: 'Senior', resident: 'Résident' };
  const STATUS_CLS = {
    actif: 'bg-green-100 text-green-700',
    pause: 'bg-gray-100 text-gray-500',
    intervention_urgente: 'bg-red-100 text-red-700 animate-pulse',
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
        <Stethoscope size={14} className="text-blue-600" />
        <h3 className="font-semibold text-gray-800 text-sm">Personnel de garde</h3>
        <span className="text-xs text-gray-400 ml-auto">{doctors.length + nurses.length} agents</span>
      </div>
      <div className="divide-y divide-gray-50">
        {[...doctors].sort((a, b) => {
          const order = { chef_service: 0, senior: 1, resident: 2 };
          return order[a.role] - order[b.role];
        }).map(doc => (
          <div key={doc.id} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50 transition-colors">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Stethoscope size={12} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{doc.name}</p>
              <p className="text-xs text-gray-400">{ROLE_LABEL[doc.role]} · {doc.specialty}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-xs font-bold text-gray-700">{doc.patientCount}/{doc.maxPatients}</span>
              <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', STATUS_CLS[doc.status])}>
                {doc.status === 'actif' ? '●' : doc.status === 'intervention_urgente' ? '⚡' : '⏸'}
              </span>
            </div>
          </div>
        ))}

        <div className="px-4 pt-2 pb-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Infirmiers</p>
        </div>
        {nurses.map(nurse => (
          <div key={nurse.id} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50 transition-colors">
            <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
              <UserCheck size={12} className="text-teal-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{nurse.name}</p>
              <p className="text-xs text-gray-400 capitalize">{nurse.role.replace('_', ' ')}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-xs font-bold text-gray-700">{nurse.patientCount}/{nurse.maxPatients}</span>
              <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', STATUS_CLS[nurse.status])}>
                {nurse.status === 'actif' ? '●' : '⏸'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Ambulances ───────────────────────────────────────────────────────────────

const AMB_STATUS_CFG = {
  disponible:      { label: 'Disponible',   bg: 'bg-green-50',  border: 'border-green-200', icon: 'bg-green-500', text: 'text-green-700' },
  vers_hopital:    { label: 'En route →',   bg: 'bg-red-50',    border: 'border-red-200',   icon: 'bg-red-500 animate-pulse', text: 'text-red-700' },
  vers_patient:    { label: '← Vers patient',bg: 'bg-amber-50', border: 'border-amber-200', icon: 'bg-amber-500 animate-pulse', text: 'text-amber-700' },
  sur_place:       { label: 'Sur place',    bg: 'bg-orange-50', border: 'border-orange-200',icon: 'bg-orange-400', text: 'text-orange-700' },
  maintenance:     { label: 'Maintenance',  bg: 'bg-gray-50',   border: 'border-gray-200',  icon: 'bg-gray-300',  text: 'text-gray-500' },
} as const;

function AmbulancesSection({ ambulances }: { ambulances: Ambulance[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <AmbulanceIcon size={15} className="text-blue-600" />
          <h3 className="font-semibold text-gray-800 text-sm">Parc ambulances</h3>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400" />Disponibles : {ambulances.filter(a => a.status === 'disponible').length}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />En route : {ambulances.filter(a => a.status === 'vers_hopital' || a.status === 'vers_patient').length}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" />Sur place : {ambulances.filter(a => a.status === 'sur_place').length}</span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 p-4">
        {ambulances.map(amb => {
          const cfg = AMB_STATUS_CFG[amb.status];
          return (
            <div key={amb.id} className={cn('rounded-xl border p-3.5 flex flex-col gap-2', cfg.bg, cfg.border)}>
              {/* Call sign + status */}
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-sm text-gray-800">{amb.callSign}</span>
                <div className="flex items-center gap-1.5">
                  <span className={cn('w-2 h-2 rounded-full', cfg.icon)} />
                  <span className={cn('text-xs font-semibold', cfg.text)}>{cfg.label}</span>
                </div>
              </div>

              {/* Mission info */}
              {(amb.patientName || amb.chiefComplaint) && (
                <div className="bg-white/70 rounded-lg p-2">
                  {amb.patientName && (
                    <p className="text-xs font-semibold text-gray-800">{amb.patientName}</p>
                  )}
                  {amb.patientPriority && (
                    <div className="mt-0.5">
                      <EmergencyPriorityBadge priority={amb.patientPriority} size="xs" showLabel="short" />
                    </div>
                  )}
                  {amb.chiefComplaint && (
                    <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">{amb.chiefComplaint}</p>
                  )}
                </div>
              )}

              {/* ETA */}
              {amb.etaMinutes !== undefined && (
                <div className="flex items-center gap-1 text-xs font-bold text-red-700">
                  <Clock size={11} />
                  ETA : {amb.etaMinutes} min
                </div>
              )}

              {/* Location */}
              {amb.location && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <MapPin size={10} />
                  <span className="truncate">{amb.location}</span>
                </div>
              )}

              {/* Crew */}
              <div className="flex items-center gap-1 text-xs text-gray-500 border-t border-gray-200/60 pt-1.5 mt-auto">
                <Users size={10} />
                <span className="truncate">{amb.crew === '—' ? 'Hors service' : amb.crew}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EmergenciesPage() {
  const tick = useTick();
  const [, setLocation] = useLocation();

  const patients   = MOCK_EMERGENCY_PATIENTS;
  const rooms      = MOCK_EMERGENCY_ROOMS;
  const ambulances = MOCK_EMERGENCY_AMBULANCES;
  const doctors    = MOCK_EMERGENCY_DOCTORS;
  const nurses     = MOCK_EMERGENCY_NURSES;

  // Active patients only (exclude sorti/transfere/decede from stats)
  const active = patients.filter(p => !['sorti', 'transfere', 'decede'].includes(p.status));

  const stats = {
    totalPresent:       active.length,
    waitingTriage:      active.filter(p => p.status === 'attente_triage' || p.status === 'en_triage').length,
    inCare:             active.filter(p => p.status === 'en_soins' || p.status === 'observation').length,
    critical:           active.filter(p => p.priority === 'P1' || p.priority === 'P2').length,
    ambulancesEnRoute:  ambulances.filter(a => a.status === 'vers_hopital' || a.status === 'vers_patient').length,
  };

  // Dept status derived from data
  const deptStatus = stats.critical >= 5 ? 'CRITIQUE' : stats.totalPresent >= 14 ? 'SATURÉ' : 'OPÉRATIONNEL';
  const deptStatusCls = deptStatus === 'CRITIQUE'
    ? 'bg-red-600 text-white animate-pulse'
    : deptStatus === 'SATURÉ'
      ? 'bg-orange-500 text-white'
      : 'bg-green-500 text-white';

  return (
    <DashboardLayout>
      <div className="space-y-4 p-6">

        {/* ── Page header ───────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center shadow-sm">
              <AlertTriangle size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">Module Urgences</h1>
                <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', deptStatusCls)}>
                  ● {deptStatus}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                <span>Service des Urgences — IRISSAM Hospital</span>
                <span>·</span>
                <LiveClock />
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Radio size={10} className="text-green-500" />
                  <span className="text-green-600 font-medium">Temps réel actif</span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => alert('Formulaire d\'accueil patient — disponible dans la prochaine sous-page')}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              <AlertTriangle size={14} /> Nouveau passage
            </button>
            <button
              onClick={() => alert('Dispatch ambulance — disponible dans la sous-page Ambulances')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              <AmbulanceIcon size={14} /> Appeler ambulance
            </button>
            <button
              onClick={() => setLocation('/admissions')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Bed size={14} /> Admission
            </button>
            <button
              onClick={() => {}}
              className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 transition-colors"
              title="Actualiser"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* ── Stats strip ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard
            icon={Users}
            label="Patients présents"
            value={stats.totalPresent}
            sub={`${active.filter(p => p.status === 'attente_soins').length} en attente de salle`}
            color="bg-blue-600"
          />
          <StatCard
            icon={Activity}
            label="En triage / attente"
            value={stats.waitingTriage}
            sub="Salle de tri + accueil"
            color="bg-amber-500"
          />
          <StatCard
            icon={Bed}
            label="En soins actifs"
            value={stats.inCare}
            sub={`${rooms.filter(r => r.type === 'soins').reduce((s, r) => s + r.occupied, 0)} lits soins occupés`}
            color="bg-indigo-600"
          />
          <StatCard
            icon={AlertTriangle}
            label="Critiques P1 / P2"
            value={stats.critical}
            sub={`P1: ${active.filter(p => p.priority === 'P1').length} · P2: ${active.filter(p => p.priority === 'P2').length}`}
            color="bg-red-600"
            pulse={stats.critical > 0}
          />
          <StatCard
            icon={AmbulanceIcon}
            label="Ambulances en route"
            value={stats.ambulancesEnRoute}
            sub={`${ambulances.filter(a => a.status === 'disponible').length} disponibles · ${ambulances.filter(a => a.status === 'maintenance').length} maintenance`}
            color="bg-orange-500"
          />
        </div>

        {/* ── Quick navigation modules ───────────────────────────────────────── */}
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {[
            { icon: Activity,      label: 'Salle de tri',   count: active.filter(p => p.status === 'en_triage' || p.status === 'attente_triage').length, countColor: 'bg-amber-100 text-amber-800' },
            { icon: Clock,         label: 'Salle d\'attente',count: active.filter(p => p.status === 'attente_soins').length, countColor: 'bg-gray-100 text-gray-700' },
            { icon: Stethoscope,   label: 'Soins actifs',   count: active.filter(p => p.status === 'en_soins').length, countColor: 'bg-blue-100 text-blue-800' },
            { icon: AlertTriangle, label: 'Critiques',      count: stats.critical, countColor: stats.critical > 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700' },
            { icon: Bed,           label: 'Observation',    count: active.filter(p => p.status === 'observation').length, countColor: 'bg-violet-100 text-violet-800' },
            { icon: AmbulanceIcon, label: 'Ambulances',     count: ambulances.filter(a => a.status !== 'maintenance').length, countColor: 'bg-orange-100 text-orange-800' },
            { icon: FlaskConical,  label: 'Analyses',       count: undefined },
            { icon: History,       label: 'Historique',     count: undefined },
          ].map((tile) => (
            <QuickNavTile
              key={tile.label}
              icon={tile.icon}
              label={tile.label}
              count={tile.count}
              countColor={tile.countColor}
              onClick={() => alert(`Sous-page "${tile.label}" — disponible prochainement`)}
            />
          ))}
        </div>

        {/* ── Priority legend ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-gray-400 font-medium">Code couleur :</span>
          {(['P1', 'P2', 'P3', 'P4', 'P5'] as EmergencyPriority[]).map(p => (
            <EmergencyPriorityBadge key={p} priority={p} size="sm" showLabel="both" />
          ))}
        </div>

        {/* ── Main 2-column: Queue + Operational ─────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          {/* Patient queue — 7/12 */}
          <div className="xl:col-span-7">
            <PatientQueueSection patients={active} tick={tick} />
          </div>

          {/* Operational board — 5/12 */}
          <div className="xl:col-span-5 flex flex-col gap-4">
            <RoomsBoard rooms={rooms} />
            <StaffBoard doctors={doctors} nurses={nurses} />
          </div>
        </div>

        {/* ── Ambulances ─────────────────────────────────────────────────────── */}
        <AmbulancesSection ambulances={ambulances} />

      </div>
    </DashboardLayout>
  );
}
