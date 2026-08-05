import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'wouter';
import {
  AlertTriangle, Activity, Ambulance as AmbulanceIcon, Bed, Users,
  Clock, Search, ChevronRight, Radio, Stethoscope, FlaskConical,
  Scan, FileText, History, LogOut, UserCheck, RefreshCw,
  MapPin, Moon, Sun, Play, X, Droplets, Thermometer, Wind,
  Heart, Brain, Zap,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { cn } from '@/lib/utils';
import { useMockRepository } from '@/store/MockRepository';
import { useAuth } from '@/store/AuthContext';
import { EmergencyPriorityBadge, PRIORITY_CFG } from '@/components/emergencies/EmergencyPriorityBadge';
import { EmergencyAlertStrip } from '@/components/emergencies/EmergencyAlertStrip';
import { EmergencyKPIs } from '@/components/emergencies/EmergencyKPIs';
import { EmergencyAmbulanceMap } from '@/components/emergencies/EmergencyAmbulanceMap';
import { EmergencyNotifications } from '@/components/emergencies/EmergencyNotifications';
import { useEmergencyData } from '@/hooks/useEmergencyData';
import type {
  EmergencyPatient, EmergencyPatientStatus,
  EmergencyRoom, Ambulance, EmergencyDoctor, EmergencyNurse,
  EmergencyPriority,
} from '@/types/emergency';

// ─── Dark mode helper ─────────────────────────────────────────────────────────

/** dk(isDark, darkClasses, lightClasses?) — apply different classes in dark/light mode */
const dk = (dark: boolean, d: string, l = '') => dark ? d : l;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function elapsedMs(iso: string): number {
  return Date.now() - new Date(iso).getTime();
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function timerCls(ms: number, targetMin: number): string {
  if (targetMin === 0) return 'text-red-500 font-black animate-pulse tabular-nums';
  const ratio = (ms / 60000) / targetMin;
  if (ratio >= 1)    return 'text-red-500 font-black tabular-nums';
  if (ratio >= 0.75) return 'text-amber-500 font-bold tabular-nums';
  return 'text-gray-400 tabular-nums';
}

function useTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return tick;
}

function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem('em_dark') === 'true'; } catch { return false; }
  });
  const toggle = useCallback(() => {
    setIsDark(d => {
      const next = !d;
      try { localStorage.setItem('em_dark', String(next)); } catch {}
      return next;
    });
  }, []);
  return { isDark, toggle };
}

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

function LiveClock({ isDark }: { isDark: boolean }) {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className={cn('font-mono text-sm tabular-nums', dk(isDark, 'text-gray-300', 'text-gray-400'))}>
      {time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, color, pulse, isDark }: {
  icon: React.ElementType; label: string; value: number | string;
  sub?: string; color: string; pulse?: boolean; isDark: boolean;
}) {
  return (
    <div className={cn(
      'border rounded-xl p-4 flex items-start gap-3',
      dk(isDark, 'bg-gray-800 border-gray-700', 'bg-white border-gray-200'),
    )}>
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', color)}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className={cn('text-xs font-medium', dk(isDark, 'text-gray-400', 'text-gray-500'))}>{label}</p>
        <div className="flex items-center gap-1.5">
          <p className={cn('text-2xl font-bold', dk(isDark, 'text-gray-100', 'text-gray-900'))}>{value}</p>
          {pulse && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
        </div>
        {sub && <p className={cn('text-xs mt-0.5', dk(isDark, 'text-gray-500', 'text-gray-400'))}>{sub}</p>}
      </div>
    </div>
  );
}

function QuickNavTile({ icon: Icon, label, count, countColor, onClick, isDark }: {
  icon: React.ElementType; label: string; count?: number; countColor?: string; onClick: () => void; isDark: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center gap-1.5 p-3 border rounded-xl transition-colors group',
        dk(isDark,
          'bg-gray-800 border-gray-700 hover:border-blue-500 hover:bg-gray-700',
          'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50/30',
        ),
      )}
    >
      <Icon size={20} className={cn(
        'transition-colors',
        dk(isDark, 'text-gray-400 group-hover:text-blue-400', 'text-gray-500 group-hover:text-blue-600'),
      )} />
      <span className={cn('text-xs font-medium text-center leading-tight',
        dk(isDark, 'text-gray-300', 'text-gray-700'))}>{label}</span>
      {count !== undefined && (
        <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded-full', countColor ?? 'bg-gray-100 text-gray-700')}>
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Glasgow + Pain visuals ───────────────────────────────────────────────────

function GlasgowBar({ score, isDark }: { score: number; isDark: boolean }) {
  const pct = Math.round(((score - 3) / 12) * 100);
  const color = score <= 8 ? 'bg-red-500' : score <= 12 ? 'bg-amber-500' : 'bg-green-500';
  return (
    <div className="flex items-center gap-2">
      <div className={cn('flex-1 rounded-full h-1.5 overflow-hidden', dk(isDark, 'bg-gray-700', 'bg-gray-100'))}>
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('text-xs font-bold w-6 text-right',
        score <= 8 ? 'text-red-500' : score <= 12 ? 'text-amber-500' : 'text-green-500')}>
        {score}
      </span>
    </div>
  );
}

function PainScale({ level, isDark }: { level: number; isDark: boolean }) {
  return (
    <div className="flex gap-0.5 items-center">
      {Array.from({ length: 10 }).map((_, i) => {
        const active = i < level;
        const color = i < 3 ? 'bg-green-400' : i < 6 ? 'bg-amber-400' : i < 8 ? 'bg-orange-500' : 'bg-red-600';
        return (
          <div
            key={i}
            className={cn('w-3 h-3 rounded-sm transition-colors', active ? color : dk(isDark, 'bg-gray-700', 'bg-gray-200'))}
          />
        );
      })}
      <span className={cn('ml-1 text-xs font-bold',
        level >= 8 ? 'text-red-500' : level >= 5 ? 'text-amber-500' : 'text-green-500')}>
        {level}/10
      </span>
    </div>
  );
}

// ─── Expanded Patient Card ────────────────────────────────────────────────────

function PatientExpandedCard({ patient, isDark, onClose }: {
  patient: EmergencyPatient; isDark: boolean; onClose: () => void;
}) {
  const [, setLocation] = useLocation();
  const bloodType = patient.bloodType ?? '?';
  const allergies = patient.allergies ?? [];
  const v = patient.vitals;
  const { startCare: repoStartCare } = useMockRepository();
  const { user } = useAuth();

  return (
    <div className={cn(
      'border rounded-xl p-4 mx-4 mb-2 space-y-4 animate-in slide-in-from-top-2',
      dk(isDark, 'bg-gray-700 border-gray-600', 'bg-blue-50/40 border-blue-200'),
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <EmergencyPriorityBadge priority={patient.priority} size="sm" showLabel="both" />
          <span className={cn('text-sm font-bold', dk(isDark, 'text-gray-100', 'text-gray-900'))}>
            {patient.lastName} {patient.firstName}
          </span>
          <span className={cn('text-xs', dk(isDark, 'text-gray-400', 'text-gray-500'))}>
            {patient.age} ans · {patient.gender === 'M' ? '♂ Masculin' : '♀ Féminin'}
          </span>
        </div>
        <button onClick={onClose} className={cn('p-1 rounded-lg', dk(isDark, 'hover:bg-gray-600', 'hover:bg-gray-100'))}>
          <X size={13} className={dk(isDark, 'text-gray-400', 'text-gray-500')} />
        </button>
      </div>

      {/* Identity row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Blood type */}
        <div className={cn('rounded-lg p-2.5 flex items-center gap-2', dk(isDark, 'bg-gray-600', 'bg-red-50 border border-red-100'))}>
          <Droplets size={14} className="text-red-500 flex-shrink-0" />
          <div>
            <p className={cn('text-xs', dk(isDark, 'text-gray-400', 'text-gray-500'))}>Groupe sanguin</p>
            <p className="text-sm font-black text-red-600">{bloodType}</p>
          </div>
        </div>

        {/* Chief complaint */}
        <div className={cn('rounded-lg p-2.5 sm:col-span-2', dk(isDark, 'bg-gray-600', 'bg-orange-50 border border-orange-100'))}>
          <p className={cn('text-xs mb-0.5', dk(isDark, 'text-gray-400', 'text-gray-500'))}>Motif principal</p>
          <p className={cn('text-xs font-semibold', dk(isDark, 'text-gray-100', 'text-orange-800'))}>{patient.chiefComplaint}</p>
          {patient.mechanism && (
            <p className={cn('text-xs mt-0.5', dk(isDark, 'text-gray-400', 'text-gray-500'))}>{patient.mechanism}</p>
          )}
        </div>

        {/* MPI */}
        <div className={cn('rounded-lg p-2.5', dk(isDark, 'bg-gray-600', 'bg-gray-50 border border-gray-200'))}>
          <p className={cn('text-xs', dk(isDark, 'text-gray-400', 'text-gray-500'))}>MPI</p>
          <p className={cn('text-xs font-mono font-bold', dk(isDark, 'text-gray-200', 'text-gray-700'))}>{patient.mpiId}</p>
        </div>
      </div>

      {/* Vitals grid */}
      {v && (
        <div>
          <p className={cn('text-xs font-semibold uppercase tracking-wide mb-2',
            dk(isDark, 'text-gray-400', 'text-gray-500'))}>Constantes vitales</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {v.hr !== undefined && (
              <div className={cn('rounded-lg p-2.5', dk(isDark, 'bg-gray-600', 'bg-white border border-gray-200'))}>
                <div className="flex items-center gap-1 mb-1">
                  <Heart size={11} className={v.hr > 100 || v.hr < 60 ? 'text-red-500' : 'text-pink-500'} />
                  <span className={cn('text-xs', dk(isDark, 'text-gray-400', 'text-gray-400'))}>FC</span>
                </div>
                <p className={cn('text-base font-black font-mono',
                  v.hr > 100 || v.hr < 60 ? 'text-red-500' : dk(isDark, 'text-gray-100', 'text-gray-800'))}>
                  {v.hr} <span className="text-xs font-normal">bpm</span>
                </p>
              </div>
            )}
            {v.bp && (
              <div className={cn('rounded-lg p-2.5', dk(isDark, 'bg-gray-600', 'bg-white border border-gray-200'))}>
                <div className="flex items-center gap-1 mb-1">
                  <Zap size={11} className="text-red-500" />
                  <span className={cn('text-xs', dk(isDark, 'text-gray-400', 'text-gray-400'))}>TA</span>
                </div>
                <p className={cn('text-base font-black font-mono', dk(isDark, 'text-gray-100', 'text-gray-800'))}>
                  {v.bp} <span className="text-xs font-normal">mmHg</span>
                </p>
              </div>
            )}
            {v.spo2 !== undefined && (
              <div className={cn('rounded-lg p-2.5', dk(isDark, 'bg-gray-600', 'bg-white border border-gray-200'))}>
                <div className="flex items-center gap-1 mb-1">
                  <Wind size={11} className={v.spo2 < 94 ? 'text-red-500' : 'text-blue-500'} />
                  <span className={cn('text-xs', dk(isDark, 'text-gray-400', 'text-gray-400'))}>SpO₂</span>
                </div>
                <p className={cn('text-base font-black font-mono',
                  v.spo2 < 94 ? 'text-red-500' : dk(isDark, 'text-gray-100', 'text-gray-800'))}>
                  {v.spo2}<span className="text-xs font-normal">%</span>
                </p>
              </div>
            )}
            {v.temp !== undefined && (
              <div className={cn('rounded-lg p-2.5', dk(isDark, 'bg-gray-600', 'bg-white border border-gray-200'))}>
                <div className="flex items-center gap-1 mb-1">
                  <Thermometer size={11} className={v.temp > 38.5 ? 'text-orange-500' : 'text-gray-400'} />
                  <span className={cn('text-xs', dk(isDark, 'text-gray-400', 'text-gray-400'))}>Temp</span>
                </div>
                <p className={cn('text-base font-black font-mono',
                  v.temp > 38.5 ? 'text-orange-500' : dk(isDark, 'text-gray-100', 'text-gray-800'))}>
                  {v.temp}<span className="text-xs font-normal">°C</span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Glasgow + Pain */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {v?.gcs !== undefined && (
          <div className={cn('rounded-lg p-2.5', dk(isDark, 'bg-gray-600', 'bg-white border border-gray-200'))}>
            <div className="flex items-center gap-1 mb-2">
              <Brain size={11} className="text-indigo-500" />
              <span className={cn('text-xs font-semibold', dk(isDark, 'text-gray-300', 'text-gray-600'))}>
                Score de Glasgow
              </span>
              <span className={cn('ml-auto text-xs',
                dk(isDark, 'text-gray-400', 'text-gray-400'))}>
                {v.gcs <= 8 ? '⚠ Critique' : v.gcs <= 12 ? '⚠ Modéré' : 'Normal'}
              </span>
            </div>
            <GlasgowBar score={v.gcs} isDark={isDark} />
          </div>
        )}
        {v?.painLevel !== undefined && (
          <div className={cn('rounded-lg p-2.5', dk(isDark, 'bg-gray-600', 'bg-white border border-gray-200'))}>
            <div className="flex items-center gap-1 mb-2">
              <AlertTriangle size={11} className="text-red-400" />
              <span className={cn('text-xs font-semibold', dk(isDark, 'text-gray-300', 'text-gray-600'))}>
                Niveau de douleur
              </span>
            </div>
            <PainScale level={v.painLevel} isDark={isDark} />
          </div>
        )}
      </div>

      {/* Allergies */}
      {allergies.length > 0 && (
        <div className={cn('rounded-lg p-2.5 border', dk(isDark, 'bg-red-900/30 border-red-800', 'bg-red-50 border-red-200'))}>
          <p className={cn('text-xs font-semibold mb-1.5', dk(isDark, 'text-red-400', 'text-red-700'))}>
            ⚠ Allergies connues
          </p>
          <div className="flex gap-1 flex-wrap">
            {allergies.map(a => (
              <span key={a} className={cn('text-xs px-2 py-0.5 rounded-full font-semibold',
                dk(isDark, 'bg-red-800 text-red-200', 'bg-red-100 text-red-700 border border-red-200'))}>
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Triage notes */}
      {patient.triageNotes && (
        <div className={cn('rounded-lg p-2.5', dk(isDark, 'bg-gray-600', 'bg-yellow-50 border border-yellow-200'))}>
          <p className={cn('text-xs font-semibold mb-1', dk(isDark, 'text-yellow-400', 'text-yellow-700'))}>
            📋 Notes de triage
          </p>
          <p className={cn('text-xs', dk(isDark, 'text-gray-300', 'text-gray-700'))}>{patient.triageNotes}</p>
        </div>
      )}

      {/* Start care button */}
      <button
        onClick={() => {
          // Only call mock startCare for mock-backed patients (no real patientId)
          if (!patient.patientId) {
            repoStartCare(patient.id, {
              userId: user?.id ?? '',
              userName: user ? `${user.firstName} ${user.lastName}` : 'Personnel',
              userRole: user?.role ?? 'medecin',
            });
          }
          // Navigate using the real patient UUID for DB patients, or visit id for mock
          setLocation(`/emergencies/${patient.patientId ?? patient.id}`);
        }}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors text-sm shadow-sm"
      >
        <Play size={15} fill="white" /> Démarrer la prise en charge
      </button>
    </div>
  );
}

// ─── Patient Queue ────────────────────────────────────────────────────────────

type PriorityFilter = 'all' | 'P1' | 'P2' | 'P3' | 'P4P5';

function PatientRow({ patient, tick, isDark }: { patient: EmergencyPatient; tick: number; isDark: boolean }) {
  const [, setLocation] = useLocation();
  const [expanded, setExpanded] = useState(false);
  const cfg = PRIORITY_CFG[patient.priority];
  const statusCfg = STATUS_CFG[patient.status];
  const elapsed = elapsedMs(patient.arrivalTime);
  const target = cfg.targetMin;
  const { startCare: repoStartCare } = useMockRepository();
  const { user } = useAuth();

  // Timer size: big for P1 (immédiat), normal for others
  const isP1 = patient.priority === 'P1';
  const timerSize = isP1 ? 'text-2xl' : 'text-sm';

  return (
    <>
      <div
        className={cn(
          'flex items-start gap-3 px-4 py-3 border-b last:border-0 transition-all cursor-pointer select-none',
          dk(isDark, 'border-gray-700 hover:bg-gray-700/50', `${cfg.rowBg} hover:brightness-95`),
          expanded && dk(isDark, 'bg-gray-700/70', 'bg-blue-50/40'),
        )}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Priority badge */}
        <div className="flex-shrink-0 pt-0.5">
          <EmergencyPriorityBadge priority={patient.priority} size="sm" showLabel="short" />
        </div>

        {/* Identity */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn('font-semibold text-sm', dk(isDark, 'text-gray-100', 'text-gray-900'))}>
              {patient.lastName} {patient.firstName}
            </span>
            <span className={cn('text-xs', dk(isDark, 'text-gray-400', 'text-gray-500'))}>
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
            {(patient.allergies ?? []).length > 0 && (
              <span className="text-xs bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-full">⚠ Allergie</span>
            )}
            {patient.tags?.map(tag => (
              <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full capitalize">{tag}</span>
            ))}
          </div>
          <p className={cn('text-xs mt-0.5 line-clamp-1', dk(isDark, 'text-gray-300', 'text-gray-700'))}>
            {patient.chiefComplaint}
          </p>
          {patient.assignedRoom && (
            <p className={cn('text-xs mt-0.5 flex items-center gap-1', dk(isDark, 'text-gray-500', 'text-gray-400'))}>
              <Bed size={10} /> {patient.assignedRoom}
            </p>
          )}
        </div>

        {/* Vitals snapshot */}
        {patient.vitals && (
          <div className={cn('hidden lg:flex flex-col gap-0.5 text-xs flex-shrink-0 w-28', dk(isDark, 'text-gray-400', 'text-gray-500'))}>
            {patient.vitals.hr && (
              <span className={cn('font-mono', patient.vitals.hr > 100 || patient.vitals.hr < 60 ? 'text-red-500 font-semibold' : '')}>
                ❤ {patient.vitals.hr} bpm
              </span>
            )}
            {patient.vitals.bp && <span className="font-mono">{patient.vitals.bp} mmHg</span>}
            {patient.vitals.spo2 && (
              <span className={cn('font-mono', patient.vitals.spo2 < 94 ? 'text-red-500 font-semibold' : '')}>
                O₂ {patient.vitals.spo2}%
              </span>
            )}
          </div>
        )}

        {/* Timer — big for P1 */}
        <div className="flex-shrink-0 text-right">
          <p className={cn(timerSize, 'font-mono', timerCls(elapsed, target))}>
            {isP1 && <span className="text-red-500 mr-0.5">⏱</span>}
            {!isP1 && '⏱ '}
            {formatElapsed(elapsed)}
          </p>
          <p className={cn('text-xs', dk(isDark, 'text-gray-500', 'text-gray-400'))}>
            Cible: {target === 0 ? 'Immédiat' : `${target} min`}
          </p>
        </div>

        {/* Doctor */}
        <div className={cn('hidden xl:flex flex-col gap-0.5 text-xs flex-shrink-0 w-36', dk(isDark, 'text-gray-400', ''))}>
          {patient.assignedDoctor ? (
            <span className={cn('flex items-center gap-1 font-medium', dk(isDark, 'text-blue-400', 'text-blue-700'))}>
              <Stethoscope size={9} /> {patient.assignedDoctor.replace('Dr. ', '')}
            </span>
          ) : (
            <span className={cn('italic', dk(isDark, 'text-gray-600', 'text-gray-300'))}>Non assigné</span>
          )}
          {patient.assignedNurse && (
            <span className={cn('flex items-center gap-1', dk(isDark, 'text-gray-500', 'text-gray-500'))}>
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

        {/* Start care + expand */}
        <div className="flex-shrink-0 flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => {
              const canStartCareLocally = patient.status === 'attente_soins' || patient.status === 'attente_triage';
              // Only call mock startCare for mock-backed patients (no real patientId)
              if (canStartCareLocally && !patient.patientId) {
                repoStartCare(patient.id, {
                  userId: user?.id ?? '',
                  userName: user ? `${user.firstName} ${user.lastName}` : 'Personnel',
                  userRole: user?.role ?? 'medecin',
                });
              }
              // Navigate using the real patient UUID for DB patients, or visit id for mock
              setLocation(`/emergencies/${patient.patientId ?? patient.id}`);
            }}
            className={cn(
              'flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap',
              patient.status === 'attente_soins' || patient.status === 'attente_triage'
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : dk(isDark,
                    'bg-gray-600 hover:bg-gray-500 text-gray-300',
                    'bg-gray-100 hover:bg-gray-200 text-gray-600'),
            )}
          >
            <Play size={10} fill="currentColor" />
            {patient.status === 'attente_soins' || patient.status === 'attente_triage' ? 'Prendre en charge' : 'Ouvrir'}
          </button>
          <button
            onClick={() => setExpanded(e => !e)}
            className={cn(
              'flex-shrink-0 p-1.5 rounded-lg border transition-colors',
              dk(isDark,
                'border-gray-600 hover:border-blue-500 hover:bg-gray-600 text-gray-400 hover:text-blue-400',
                'border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-400 hover:text-blue-600'),
            )}
          >
            <ChevronRight size={14} className={cn('transition-transform', expanded ? 'rotate-90' : '')} />
          </button>
        </div>
      </div>

      {/* Expanded card */}
      {expanded && <PatientExpandedCard patient={patient} isDark={isDark} onClose={() => setExpanded(false)} />}
    </>
  );
}

function PatientQueueSection({ patients, tick, isDark }: { patients: EmergencyPatient[]; tick: number; isDark: boolean }) {
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
    const matchPriority = filter === 'all' ? true
      : filter === 'P4P5' ? (p.priority === 'P4' || p.priority === 'P5')
      : p.priority === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || [p.lastName, p.firstName, p.chiefComplaint, p.mpiId].some(f => f?.toLowerCase().includes(q));
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
    { key: 'all',  label: `Tous (${counts.all})`,          cls: dk(isDark, 'text-gray-300 border-gray-500', 'text-gray-700 border-gray-300') },
    { key: 'P1',   label: `P1 Immédiat (${counts.P1})`,   cls: 'text-red-700 border-red-300 bg-red-50' },
    { key: 'P2',   label: `P2 Très urgent (${counts.P2})`,cls: 'text-orange-700 border-orange-300 bg-orange-50' },
    { key: 'P3',   label: `P3 Urgent (${counts.P3})`,     cls: 'text-yellow-700 border-yellow-300 bg-yellow-50' },
    { key: 'P4P5', label: `P4/P5 (${counts.P4P5})`,       cls: 'text-green-700 border-green-300 bg-green-50' },
  ];

  return (
    <div className={cn(
      'border rounded-xl overflow-hidden flex flex-col h-full',
      dk(isDark, 'bg-gray-800 border-gray-700', 'bg-white border-gray-200'),
    )}>
      <div className={cn('px-4 py-3 border-b', dk(isDark, 'bg-gray-900 border-gray-700', 'bg-gray-50 border-gray-100'))}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Users size={15} className={dk(isDark, 'text-blue-400', 'text-blue-600')} />
            <h3 className={cn('font-semibold text-sm', dk(isDark, 'text-gray-200', 'text-gray-800'))}>
              File d'attente des patients
            </h3>
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className={cn('absolute left-2.5 top-1/2 -translate-y-1/2', dk(isDark, 'text-gray-500', 'text-gray-400'))} />
            <input
              type="text"
              placeholder="Rechercher patient, motif…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={cn(
                'w-full pl-8 pr-3 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20',
                dk(isDark, 'bg-gray-700 border-gray-600 text-gray-200 placeholder:text-gray-500', 'border-gray-200'),
              )}
            />
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                'px-2.5 py-1 text-xs rounded-lg border transition-colors font-medium',
                filter === tab.key ? `${tab.cls} opacity-100` : dk(isDark,
                  'border-gray-600 text-gray-400 hover:border-gray-500 bg-gray-700',
                  'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'),
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className={cn(
        'hidden lg:grid grid-cols-[auto_1fr_100px_130px_100px_80px_auto] gap-2 px-4 py-2 border-b text-xs font-semibold uppercase tracking-wide',
        dk(isDark, 'bg-gray-900/50 border-gray-700 text-gray-500', 'bg-gray-50/50 border-gray-100 text-gray-400'),
      )}>
        <span>Priorité</span><span>Patient / Motif</span><span>Constantes</span>
        <span className="text-right">Attente</span><span>Médecin</span>
        <span>Statut</span><span />
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className={cn('flex flex-col items-center justify-center py-12', dk(isDark, 'text-gray-600', 'text-gray-400'))}>
            <Users size={36} className="opacity-20 mb-2" /><p className="text-sm">Aucun patient pour ce filtre</p>
          </div>
        ) : (
          filtered.map(p => <PatientRow key={p.id} patient={p} tick={tick} isDark={isDark} />)
        )}
      </div>

      <div className={cn('px-4 py-2 border-t flex items-center justify-between',
        dk(isDark, 'bg-gray-900 border-gray-700', 'bg-gray-50 border-gray-100'))}>
        <p className={cn('text-xs', dk(isDark, 'text-gray-500', 'text-gray-400'))}>
          {filtered.length} patient{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}
        </p>
        <p className={cn('text-xs', dk(isDark, 'text-gray-600', 'text-gray-400'))}>⏱ Cliquer sur une ligne pour détails</p>
      </div>
    </div>
  );
}

// ─── Rooms Board ──────────────────────────────────────────────────────────────

/** Simulated avg stay in minutes per room type */
const AVG_STAY_MIN: Record<string, number> = {
  reanimation: 480, triage: 35, soins: 95, observation: 240, attente: 28,
};

function RoomsBoard({ rooms, isDark }: { rooms: EmergencyRoom[]; isDark: boolean }) {
  const ROOM_TYPE_ORDER: Record<string, number> = {
    reanimation: 0, triage: 1, soins: 2, observation: 3, attente: 4,
  };

  const sorted = [...rooms].sort((a, b) =>
    (ROOM_TYPE_ORDER[a.type] ?? 9) - (ROOM_TYPE_ORDER[b.type] ?? 9)
  );

  // Overall occupancy
  const totalCap = rooms.reduce((s, r) => s + r.capacity, 0);
  const totalOcc = rooms.reduce((s, r) => s + r.occupied, 0);
  const globalPct = Math.round((totalOcc / totalCap) * 100);

  function roomStatusCls(room: EmergencyRoom) {
    const ratio = room.capacity > 0 ? room.occupied / room.capacity : 0;
    if (room.type === 'reanimation' && room.occupied > 0) return 'bg-red-100 border-red-300 text-red-800';
    if (ratio >= 1)    return 'bg-red-50 border-red-200 text-red-700';
    if (ratio >= 0.75) return 'bg-amber-50 border-amber-200 text-amber-700';
    if (ratio > 0)     return 'bg-blue-50 border-blue-200 text-blue-700';
    return 'bg-green-50 border-green-200 text-green-700';
  }

  return (
    <div className={cn('border rounded-xl overflow-hidden', dk(isDark, 'bg-gray-800 border-gray-700', 'bg-white border-gray-200'))}>
      <div className={cn('flex items-center justify-between gap-2 px-4 py-3 border-b',
        dk(isDark, 'bg-gray-900 border-gray-700', 'bg-gray-50 border-gray-100'))}>
        <div className="flex items-center gap-2">
          <Bed size={14} className={dk(isDark, 'text-blue-400', 'text-blue-600')} />
          <h3 className={cn('font-semibold text-sm', dk(isDark, 'text-gray-200', 'text-gray-800'))}>État des salles</h3>
        </div>
        {/* Global fill rate */}
        <div className="flex items-center gap-2">
          <div className={cn('w-24 rounded-full h-2 overflow-hidden', dk(isDark, 'bg-gray-700', 'bg-gray-200'))}>
            <div
              className={cn('h-full rounded-full', globalPct >= 90 ? 'bg-red-500' : globalPct >= 70 ? 'bg-amber-500' : 'bg-green-500')}
              style={{ width: `${globalPct}%` }}
            />
          </div>
          <span className={cn('text-xs font-bold tabular-nums', dk(isDark, 'text-gray-300', 'text-gray-700'))}>
            {globalPct}%
          </span>
        </div>
      </div>

      <div className="p-3 grid grid-cols-2 gap-2">
        {sorted.map(room => {
          const ratio = room.capacity > 0 ? room.occupied / room.capacity : 0;
          const pct = Math.round(ratio * 100);
          const avgMin = AVG_STAY_MIN[room.type] ?? 60;
          const freeCount = room.capacity - room.occupied;

          return (
            <div key={room.id}
              className={cn('rounded-lg border p-2.5 flex flex-col gap-1.5',
                dk(isDark, 'bg-gray-700 border-gray-600', roomStatusCls(room)))}>
              <div className="flex items-center justify-between">
                <span className={cn('text-xs font-bold', dk(isDark, 'text-gray-200', ''))}>
                  {room.shortName}
                </span>
                <span className={cn('text-xs font-semibold tabular-nums', dk(isDark, 'text-gray-300', ''))}>
                  {room.occupied}/{room.capacity}
                </span>
              </div>
              {/* Occupancy bar */}
              <div className={cn('w-full rounded-full h-1.5 overflow-hidden', dk(isDark, 'bg-gray-600', 'bg-white/60'))}>
                <div
                  className={cn('h-full rounded-full transition-all', ratio >= 1 ? 'bg-red-500' : ratio >= 0.75 ? 'bg-amber-500' : 'bg-blue-500')}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className={cn('text-xs leading-none', dk(isDark, 'text-gray-400', 'opacity-80'))}>
                  {freeCount === 0 ? '🔴 COMPLET' : `${freeCount} libre${freeCount > 1 ? 's' : ''}`}
                </span>
                <span className={cn('text-xs font-mono', dk(isDark, 'text-gray-500', 'opacity-60'))}>
                  ~{avgMin >= 60 ? `${Math.round(avgMin / 60)}h` : `${avgMin}′`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Staff Board ──────────────────────────────────────────────────────────────

function StaffBoard({ doctors, nurses, isDark }: { doctors: EmergencyDoctor[]; nurses: EmergencyNurse[]; isDark: boolean }) {
  const ROLE_LABEL = { chef_service: 'Chef de service', senior: 'Senior', resident: 'Résident' };
  const STATUS_CLS = {
    actif:               dk(isDark, 'bg-green-900/50 text-green-400', 'bg-green-100 text-green-700'),
    pause:               dk(isDark, 'bg-gray-700 text-gray-400',       'bg-gray-100 text-gray-500'),
    intervention_urgente:dk(isDark, 'bg-red-900/50 text-red-400 animate-pulse', 'bg-red-100 text-red-700 animate-pulse'),
  };

  function LoadBar({ current, max }: { current: number; max: number }) {
    const pct = Math.min(Math.round((current / max) * 100), 100);
    const color = pct >= 90 ? 'bg-red-500' : pct >= 66 ? 'bg-amber-500' : 'bg-green-500';
    return (
      <div className="flex items-center gap-1.5 mt-0.5">
        <div className={cn('flex-1 rounded-full h-1.5 overflow-hidden', dk(isDark, 'bg-gray-700', 'bg-gray-100'))}>
          <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
        </div>
        <span className={cn('text-xs font-bold w-8 text-right tabular-nums',
          dk(isDark, 'text-gray-300', 'text-gray-700'))}>{current}/{max}</span>
      </div>
    );
  }

  const sorted = [...doctors].sort((a, b) => {
    const order = { chef_service: 0, senior: 1, resident: 2 };
    return order[a.role] - order[b.role];
  });

  return (
    <div className={cn('border rounded-xl overflow-hidden', dk(isDark, 'bg-gray-800 border-gray-700', 'bg-white border-gray-200'))}>
      <div className={cn('flex items-center gap-2 px-4 py-3 border-b',
        dk(isDark, 'bg-gray-900 border-gray-700', 'bg-gray-50 border-gray-100'))}>
        <Stethoscope size={14} className={dk(isDark, 'text-blue-400', 'text-blue-600')} />
        <h3 className={cn('font-semibold text-sm', dk(isDark, 'text-gray-200', 'text-gray-800'))}>
          Personnel de garde — charge de travail
        </h3>
        <span className={cn('text-xs ml-auto', dk(isDark, 'text-gray-500', 'text-gray-400'))}>
          {doctors.length + nurses.length} agents
        </span>
      </div>
      <div className="divide-y" style={{ ['--tw-divide-color' as string]: isDark ? '#374151' : '#f9fafb' }}>
        {sorted.map(doc => (
          <div key={doc.id}
            className={cn('px-4 py-2.5 hover:transition-colors',
              dk(isDark, 'hover:bg-gray-700', 'hover:bg-gray-50'))}>
            <div className="flex items-center gap-2.5">
              <div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
                dk(isDark, 'bg-blue-900/50', 'bg-blue-100'))}>
                <Stethoscope size={12} className={dk(isDark, 'text-blue-400', 'text-blue-600')} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-xs font-semibold truncate', dk(isDark, 'text-gray-200', 'text-gray-800'))}>{doc.name}</p>
                <p className={cn('text-xs', dk(isDark, 'text-gray-500', 'text-gray-400'))}>
                  {ROLE_LABEL[doc.role]} · {doc.specialty}
                </p>
                <LoadBar current={doc.patientCount} max={doc.maxPatients} />
              </div>
              <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0', STATUS_CLS[doc.status])}>
                {doc.status === 'actif' ? '● Actif' : doc.status === 'intervention_urgente' ? '⚡ Urgence' : '⏸ Pause'}
              </span>
            </div>
          </div>
        ))}

        <div className={cn('px-4 pt-2 pb-1', dk(isDark, 'border-t border-gray-700', ''))}>
          <p className={cn('text-xs font-semibold uppercase tracking-wide mb-1.5',
            dk(isDark, 'text-gray-500', 'text-gray-400'))}>Infirmiers</p>
        </div>
        {nurses.map(nurse => (
          <div key={nurse.id}
            className={cn('px-4 py-2.5 hover:transition-colors',
              dk(isDark, 'hover:bg-gray-700', 'hover:bg-gray-50'))}>
            <div className="flex items-center gap-2.5">
              <div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
                dk(isDark, 'bg-teal-900/50', 'bg-teal-100'))}>
                <UserCheck size={12} className={dk(isDark, 'text-teal-400', 'text-teal-600')} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-xs font-semibold truncate', dk(isDark, 'text-gray-200', 'text-gray-800'))}>{nurse.name}</p>
                <p className={cn('text-xs capitalize', dk(isDark, 'text-gray-500', 'text-gray-400'))}>
                  {nurse.role.replace('_', ' ')}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className={cn('flex-1 rounded-full h-1.5 overflow-hidden', dk(isDark, 'bg-gray-700', 'bg-gray-100'))}>
                    <div className={cn('h-full rounded-full transition-all',
                      (nurse.patientCount / nurse.maxPatients) >= 0.9 ? 'bg-red-500' :
                      (nurse.patientCount / nurse.maxPatients) >= 0.66 ? 'bg-amber-500' : 'bg-teal-500')}
                      style={{ width: `${Math.min(Math.round((nurse.patientCount / nurse.maxPatients) * 100), 100)}%` }} />
                  </div>
                  <span className={cn('text-xs font-bold w-8 text-right tabular-nums',
                    dk(isDark, 'text-gray-300', 'text-gray-700'))}>{nurse.patientCount}/{nurse.maxPatients}</span>
                </div>
              </div>
              <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0', STATUS_CLS[nurse.status])}>
                {nurse.status === 'actif' ? '● Actif' : '⏸ Pause'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EmergenciesPage() {
  const tick = useTick();
  const [, setLocation] = useLocation();
  const { isDark, toggle: toggleDark } = useDarkMode();

  // Live emergency data from API
  const {
    patients: rawPatients, rooms: rawRooms, ambulances: rawAmbulances,
    todayStats, loading: emLoading, error: emError, refresh: emRefresh,
  } = useEmergencyData();

  // Staff data still served from in-memory store pending a staff API
  const { erDoctors: doctors, erNurses: nurses } = useMockRepository();

  const patients   = Array.isArray(rawPatients)   ? rawPatients   : [];
  const rooms      = Array.isArray(rawRooms)      ? rawRooms      : [];
  const ambulances = Array.isArray(rawAmbulances) ? rawAmbulances : [];

  const active = patients.filter(p => !['sorti', 'transfere', 'decede'].includes(p.status));

  const stats = {
    totalPresent:      active.length,
    waitingTriage:     active.filter(p => p.status === 'attente_triage' || p.status === 'en_triage').length,
    inCare:            active.filter(p => p.status === 'en_soins' || p.status === 'observation').length,
    critical:          active.filter(p => p.priority === 'P1' || p.priority === 'P2').length,
    ambulancesEnRoute: ambulances.filter(a => a.status === 'vers_hopital' || a.status === 'vers_patient').length,
  };

  const deptStatus = stats.critical >= 5 ? 'CRITIQUE' : stats.totalPresent >= 14 ? 'SATURÉ' : 'OPÉRATIONNEL';
  const deptStatusCls = deptStatus === 'CRITIQUE'
    ? 'bg-red-600 text-white animate-pulse'
    : deptStatus === 'SATURÉ' ? 'bg-orange-500 text-white' : 'bg-green-500 text-white';

  return (
    <DashboardLayout>
      {/* Fixed notifications overlay */}
      <EmergencyNotifications patients={active} ambulances={ambulances} />

      {/* Main container — dark mode applies here */}
      <div className={cn(
        'space-y-4 p-6 min-h-full transition-colors duration-300',
        dk(isDark, 'bg-gray-950'),
      )}>

        {/* ── Page header ───────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center shadow-sm">
              <AlertTriangle size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={cn('text-xl font-bold', dk(isDark, 'text-gray-100', 'text-gray-900'))}>
                  Module Urgences
                </h1>
                <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', deptStatusCls)}>
                  ● {deptStatus}
                </span>
              </div>
              <div className={cn('flex items-center gap-3 text-xs mt-0.5', dk(isDark, 'text-gray-400', 'text-gray-500'))}>
                <span>Service des Urgences — IRISSAM Hospital</span>
                <span>·</span>
                <LiveClock isDark={isDark} />
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Radio size={10} className="text-green-500" />
                  <span className="text-green-500 font-medium">Temps réel actif</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setLocation('/emergencies')}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              <AlertTriangle size={14} /> Nouveau passage
            </button>
            <button
              onClick={() => setLocation('/ambulances')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              <AmbulanceIcon size={14} /> Appeler ambulance
            </button>
            <button
              onClick={() => setLocation('/admissions')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors',
                dk(isDark, 'border-gray-600 text-gray-300 hover:bg-gray-700', 'border-gray-200 text-gray-600 hover:bg-gray-50'),
              )}
            >
              <Bed size={14} /> Admission
            </button>
            <button
              onClick={emRefresh}
              className={cn(
                'p-2 border rounded-lg transition-colors',
                dk(isDark, 'border-gray-600 text-gray-400 hover:bg-gray-700', 'border-gray-200 text-gray-500 hover:bg-gray-50'),
              )}
              title="Actualiser"
            >
              <RefreshCw size={14} className={emLoading ? 'animate-spin' : ''} />
            </button>
            {/* Dark mode toggle */}
            <button
              onClick={toggleDark}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors font-medium',
                isDark
                  ? 'border-yellow-500/50 text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-50',
              )}
              title={isDark ? 'Passer en mode jour' : 'Passer en mode nuit'}
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
              {isDark ? 'Mode jour' : 'Mode nuit'}
            </button>
          </div>
        </div>

        {/* ── Alert strip ────────────────────────────────────────────────────── */}
        <EmergencyAlertStrip patients={active} ambulances={ambulances} isDark={isDark} />

        {/* ── Stats strip ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard icon={Users}        label="Patients présents"  value={stats.totalPresent}      sub={`${active.filter(p => p.status === 'attente_soins').length} en attente de salle`}                              color="bg-blue-600"   isDark={isDark} />
          <StatCard icon={Activity}     label="En triage / attente" value={stats.waitingTriage}     sub="Salle de tri + accueil"                                                                                         color="bg-amber-500"  isDark={isDark} />
          <StatCard icon={Bed}          label="En soins actifs"    value={stats.inCare}             sub={`${rooms.filter(r => r.type === 'soins').reduce((s, r) => s + r.occupied, 0)} lits soins occupés`}              color="bg-indigo-600" isDark={isDark} />
          <StatCard icon={AlertTriangle} label="Critiques P1 / P2" value={stats.critical}           sub={`P1: ${active.filter(p => p.priority === 'P1').length} · P2: ${active.filter(p => p.priority === 'P2').length}`} color="bg-red-600" pulse={stats.critical > 0} isDark={isDark} />
          <StatCard icon={AmbulanceIcon} label="Ambulances en route" value={stats.ambulancesEnRoute} sub={`${ambulances.filter(a => a.status === 'disponible').length} disponibles · ${ambulances.filter(a => a.status === 'maintenance').length} maintenance`} color="bg-orange-500" isDark={isDark} />
        </div>

        {/* ── API error banner ───────────────────────────────────────────────── */}
        {emError && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
            <AlertTriangle size={13} className="flex-shrink-0" />
            <span>Impossible de charger les données en direct : {emError}</span>
            <button onClick={emRefresh} className="ml-auto font-semibold underline">Réessayer</button>
          </div>
        )}

        {/* ── KPI panel ──────────────────────────────────────────────────────── */}
        <EmergencyKPIs patients={patients} tick={tick} isDark={isDark} todayStats={todayStats} />

        {/* ── Quick navigation modules ────────────────────────────────────────── */}
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {[
            { icon: Activity,      label: 'Salle de tri',    count: active.filter(p => p.status === 'en_triage' || p.status === 'attente_triage').length,   countColor: 'bg-amber-100 text-amber-800' },
            { icon: Clock,         label: 'Salle d\'attente', count: active.filter(p => p.status === 'attente_soins').length,                                countColor: 'bg-gray-100 text-gray-700' },
            { icon: Stethoscope,   label: 'Soins actifs',    count: active.filter(p => p.status === 'en_soins').length,                                      countColor: 'bg-blue-100 text-blue-800' },
            { icon: AlertTriangle, label: 'Critiques',       count: stats.critical,                                                                          countColor: stats.critical > 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700' },
            { icon: Bed,           label: 'Observation',     count: active.filter(p => p.status === 'observation').length,                                   countColor: 'bg-violet-100 text-violet-800' },
            { icon: AmbulanceIcon, label: 'Ambulances',      count: ambulances.filter(a => a.status !== 'maintenance').length,                               countColor: 'bg-orange-100 text-orange-800' },
            { icon: FlaskConical,  label: 'Analyses',        count: undefined },
            { icon: History,       label: 'Historique',      count: undefined },
          ].map(tile => (
            <QuickNavTile
              key={tile.label}
              icon={tile.icon}
              label={tile.label}
              count={tile.count}
              countColor={tile.countColor}
              onClick={() => {
                if (tile.label === 'Ambulances') setLocation('/ambulances');
                else if (tile.label === 'Analyses') setLocation('/laboratory');
              }}
              isDark={isDark}
            />
          ))}
        </div>

        {/* ── Priority legend ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className={cn('text-xs font-medium', dk(isDark, 'text-gray-500', 'text-gray-400'))}>Code couleur :</span>
          {(['P1', 'P2', 'P3', 'P4', 'P5'] as EmergencyPriority[]).map(p => (
            <EmergencyPriorityBadge key={p} priority={p} size="sm" showLabel="both" />
          ))}
        </div>

        {/* ── Main 2-column: Queue + Operational ──────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-7">
            <PatientQueueSection patients={active} tick={tick} isDark={isDark} />
          </div>
          <div className="xl:col-span-5 flex flex-col gap-4">
            <RoomsBoard rooms={rooms} isDark={isDark} />
            <StaffBoard doctors={doctors} nurses={nurses} isDark={isDark} />
          </div>
        </div>

        {/* ── Ambulance map (replaces plain cards) ──────────────────────────── */}
        <EmergencyAmbulanceMap ambulances={ambulances} isDark={isDark} />

      </div>
    </DashboardLayout>
  );
}
