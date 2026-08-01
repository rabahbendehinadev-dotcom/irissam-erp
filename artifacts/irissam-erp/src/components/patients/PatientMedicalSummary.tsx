import {
  Stethoscope, Bed, AlertCircle, FlaskConical, Scan, Pill,
  User, Heart, ShieldAlert, TrendingUp, ChevronRight, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Patient, PatientTimelineEvent, TimelineEventType } from '@/types';
import { formatDate } from '@/utils/format';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findLast(timeline: PatientTimelineEvent[], types: TimelineEventType[]) {
  return [...timeline]
    .filter(e => types.includes(e.type))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
}

type RiskLevel = { label: string; color: string; bg: string; dot: string };

function computeRisk(patient: Patient): RiskLevel {
  const allergies = patient.medical?.allergies ?? [];
  const chronic   = patient.medical?.chronicDiseases ?? [];
  const critical  = !!patient.medical?.criticalNotes;

  if (critical && allergies.length > 0)
    return { label: 'CRITIQUE', color: 'text-red-700', bg: 'bg-red-50', dot: 'bg-red-500 animate-pulse' };
  if (critical || (allergies.length > 0 && chronic.length >= 2))
    return { label: 'ÉLEVÉ',    color: 'text-orange-700', bg: 'bg-orange-50', dot: 'bg-orange-400' };
  if (allergies.length > 0 || chronic.length > 0)
    return { label: 'MODÉRÉ',   color: 'text-yellow-700', bg: 'bg-yellow-50', dot: 'bg-yellow-400' };
  return { label: 'FAIBLE',     color: 'text-green-700', bg: 'bg-green-50', dot: 'bg-green-400' };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TileConfig {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color: string;
  bg: string;
  tabKey?: string;
  urgent?: boolean;
}

// ─── Tile ─────────────────────────────────────────────────────────────────────

function SummaryTile({ tile, onTabChange }: { tile: TileConfig; onTabChange: (tab: string) => void }) {
  const Icon = tile.icon;
  const clickable = !!tile.tabKey;
  return (
    <button
      onClick={() => tile.tabKey && onTabChange(tile.tabKey)}
      disabled={!clickable}
      className={cn(
        'flex flex-col gap-1.5 px-4 py-3 text-left transition-colors group flex-shrink-0 w-44 border-r border-gray-100 last:border-r-0',
        clickable ? 'hover:bg-blue-50/40 cursor-pointer' : 'cursor-default',
        tile.urgent && 'bg-red-50/30',
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <div className={cn('w-6 h-6 rounded-md flex items-center justify-center', tile.bg)}>
          <Icon size={11} className={tile.color} />
        </div>
        {tile.urgent && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
        {clickable && !tile.urgent && (
          <ChevronRight size={11} className="text-gray-200 group-hover:text-blue-400 transition-colors" />
        )}
      </div>
      <div>
        <p className="text-xs text-gray-400 leading-tight">{tile.label}</p>
        <p className={cn(
          'text-xs font-bold mt-0.5 leading-tight',
          tile.urgent ? 'text-red-700' : 'text-gray-800',
        )}>
          {tile.value}
        </p>
        {tile.sub && (
          <p className="text-xs text-gray-400 mt-0.5 leading-tight truncate max-w-[130px]">{tile.sub}</p>
        )}
      </div>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  patient: Patient;
  timeline: PatientTimelineEvent[];
  onTabChange: (tab: string) => void;
}

export function PatientMedicalSummary({ patient, timeline, onTabChange }: Props) {
  const lastConsult  = findLast(timeline, ['consultation']);
  const lastHospit   = findLast(timeline, ['hospitalization']);
  const lastUrgence  = findLast(timeline, ['emergency']);
  const lastLab      = findLast(timeline, ['laboratory', 'result']);
  const lastImaging  = findLast(timeline, ['imaging']);
  const lastRx       = findLast(timeline, ['prescription']);
  const lastDoc      = findLast(timeline, ['consultation', 'emergency', 'hospitalization']);

  const critAllergy  = patient.medical?.allergies?.[0] ?? null;
  const risk         = computeRisk(patient);

  // Responsible doctor: most recent clinical event that has a doctor
  const lastClinical = [...timeline]
    .filter(e => ['consultation', 'hospitalization', 'emergency'].includes(e.type) && e.doctor)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  const tiles: TileConfig[] = [
    {
      icon: Stethoscope,
      label: 'Dernière consultation',
      value: lastConsult ? formatDate(lastConsult.createdAt) : '—',
      sub: lastConsult?.doctor,
      color: 'text-indigo-600', bg: 'bg-indigo-50',
      tabKey: 'consultations',
    },
    {
      icon: Bed,
      label: 'Dernière hospitalisation',
      value: lastHospit ? formatDate(lastHospit.createdAt) : '—',
      sub: lastHospit?.service,
      color: 'text-orange-600', bg: 'bg-orange-50',
      tabKey: 'hospitalizations',
    },
    {
      icon: AlertCircle,
      label: 'Dernière urgence',
      value: lastUrgence ? formatDate(lastUrgence.createdAt) : '—',
      sub: lastUrgence?.title,
      color: 'text-red-600', bg: 'bg-red-50',
      tabKey: 'emergencies',
    },
    {
      icon: FlaskConical,
      label: 'Dernier bilan',
      value: lastLab ? formatDate(lastLab.createdAt) : '—',
      sub: lastLab?.title,
      color: 'text-teal-600', bg: 'bg-teal-50',
      tabKey: 'laboratory',
    },
    {
      icon: Scan,
      label: 'Dernière imagerie',
      value: lastImaging ? formatDate(lastImaging.createdAt) : '—',
      sub: lastImaging?.title,
      color: 'text-cyan-600', bg: 'bg-cyan-50',
      tabKey: 'imaging',
    },
    {
      icon: Pill,
      label: 'Dernière ordonnance',
      value: lastRx ? formatDate(lastRx.createdAt) : '—',
      sub: lastRx?.description ?? lastRx?.title,
      color: 'text-violet-600', bg: 'bg-violet-50',
      tabKey: 'prescriptions',
    },
    {
      icon: User,
      label: 'Médecin référent',
      value: lastClinical?.doctor ?? 'Non assigné',
      sub: lastClinical ? formatDate(lastClinical.createdAt) : undefined,
      color: 'text-blue-600', bg: 'bg-blue-50',
      tabKey: 'consultations',
    },
    {
      icon: Heart,
      label: 'Traitement en cours',
      value: lastRx ? 'En cours' : 'Aucun',
      sub: lastRx?.description?.slice(0, 35) ?? (lastRx?.title),
      color: 'text-pink-600', bg: 'bg-pink-50',
      tabKey: 'prescriptions',
    },
    {
      icon: ShieldAlert,
      label: 'Allergie critique',
      value: critAllergy ?? 'Aucune',
      sub: critAllergy ? 'Vérifier avant prescription' : 'Aucune allergie documentée',
      color: critAllergy ? 'text-red-600' : 'text-gray-400',
      bg:    critAllergy ? 'bg-red-50'  : 'bg-gray-50',
      tabKey: 'allergies',
      urgent: !!critAllergy,
    },
    {
      icon: TrendingUp,
      label: 'Niveau de risque',
      value: risk.label,
      sub: `${patient.medical?.allergies?.length ?? 0} allergie(s) · ${patient.medical?.chronicDiseases?.length ?? 0} chronique(s)`,
      color: risk.color,
      bg: risk.bg,
      tabKey: 'history',
    },
  ];

  return (
    <div className="px-6 py-2">
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Strip header */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-gray-50/50">
          <Clock size={12} className="text-blue-600" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Résumé médical intelligent</span>
          <span className="text-xs text-gray-300 ml-auto hidden sm:block">Cliquer pour accéder aux détails</span>
        </div>

        {/* Scrollable tile row */}
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex min-w-max">
            {tiles.map(tile => (
              <SummaryTile key={tile.label} tile={tile} onTabChange={onTabChange} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
