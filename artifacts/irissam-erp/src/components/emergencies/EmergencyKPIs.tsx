import { TrendingUp, Clock, LogOut, BedDouble, ArrowRightLeft, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EmergencyPatient } from '@/types/emergency';
import type { EmergencyTodayStats } from '@/hooks/useEmergencyData';

interface Props {
  patients: EmergencyPatient[];
  tick: number;
  isDark: boolean;
  todayStats?: EmergencyTodayStats;
}

interface KPI {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  color: string;
  bg: string;
  trend?: 'up' | 'down' | 'neutral';
}

function computeKPIs(patients: EmergencyPatient[], todayStats?: EmergencyTodayStats): KPI[] {
  const active = patients.filter(p => !['sorti', 'transfere', 'decede'].includes(p.status));
  const waiting = active.filter(p => p.status === 'attente_soins');
  const inCare  = active.filter(p => p.status === 'en_soins' || p.status === 'observation');

  const avgWaitMs = waiting.length > 0
    ? waiting.reduce((s, p) => s + (Date.now() - new Date(p.arrivalTime).getTime()), 0) / waiting.length
    : 0;
  const avgWaitMin = Math.round(avgWaitMs / 60000);

  const avgCareMs = inCare.length > 0
    ? inCare.reduce((s, p) => s + (Date.now() - new Date(p.arrivalTime).getTime()), 0) / inCare.length
    : 0;
  const avgCareMin = Math.round(avgCareMs / 60000);

  // Today's totals: from live API when available, otherwise 0
  const sortiesToday   = todayStats?.sorties          ?? 0;
  const hospitToday    = todayStats?.hospitalisations  ?? 0;
  const transfertToday = todayStats?.transferts        ?? 0;

  return [
    {
      icon: Clock,
      label: 'Moy. attente',
      value: avgWaitMin > 0 ? `${avgWaitMin} min` : '—',
      sub: `${waiting.length} patient${waiting.length !== 1 ? 's' : ''} en attente`,
      color: avgWaitMin > 30 ? 'text-red-600' : avgWaitMin > 15 ? 'text-amber-600' : 'text-green-600',
      bg:    avgWaitMin > 30 ? 'bg-red-100'   : avgWaitMin > 15 ? 'bg-amber-100'   : 'bg-green-100',
      trend: avgWaitMin > 30 ? 'up' : 'neutral',
    },
    {
      icon: Timer,
      label: 'Moy. prise en charge',
      value: avgCareMin > 0 ? `${avgCareMin} min` : '—',
      sub: `${inCare.length} patient${inCare.length !== 1 ? 's' : ''} en soins`,
      color: 'text-blue-600',
      bg:    'bg-blue-100',
      trend: 'neutral',
    },
    {
      icon: LogOut,
      label: 'Sorties auj.',
      value: String(sortiesToday),
      sub: 'Retours à domicile',
      color: 'text-green-600',
      bg:    'bg-green-100',
      trend: 'neutral',
    },
    {
      icon: BedDouble,
      label: 'Hospitalisations auj.',
      value: String(hospitToday),
      sub: 'Admissions en service',
      color: 'text-indigo-600',
      bg:    'bg-indigo-100',
      trend: 'neutral',
    },
    {
      icon: ArrowRightLeft,
      label: 'Transferts auj.',
      value: String(transfertToday),
      sub: 'Vers autres établissements',
      color: 'text-orange-600',
      bg:    'bg-orange-100',
      trend: 'neutral',
    },
  ];
}

export function EmergencyKPIs({ patients, tick: _, isDark, todayStats }: Props) {
  const kpis = computeKPIs(patients, todayStats);

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center gap-2 px-4 py-2.5 border-b',
        isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-100',
      )}>
        <TrendingUp size={13} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
        <span className={cn('text-xs font-semibold uppercase tracking-wide', isDark ? 'text-gray-300' : 'text-gray-500')}>
          Indicateurs de performance — temps réel
        </span>
        <span className={cn('ml-auto text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>⏱ mise à jour toutes les secondes</span>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y sm:divide-y-0">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className={cn(
              'flex items-center gap-3 px-4 py-3',
              isDark ? 'divide-gray-700' : '',
            )}>
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', kpi.bg,
                isDark ? 'opacity-70' : '')}>
                <Icon size={14} className={kpi.color} />
              </div>
              <div>
                <p className={cn('text-xs font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>{kpi.label}</p>
                <p className={cn('text-xl font-black tabular-nums leading-tight', kpi.color)}>{kpi.value}</p>
                <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>{kpi.sub}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
