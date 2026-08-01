import { useEffect, useState } from 'react';
import { AlertTriangle, Ambulance, Siren } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EmergencyPatient, Ambulance as AmbulanceT } from '@/types/emergency';

interface Props {
  patients: EmergencyPatient[];
  ambulances: AmbulanceT[];
  isDark: boolean;
}

interface Alert {
  id: string;
  type: 'P1_WAITING' | 'P1_CRITICAL' | 'AMBULANCE_INBOUND';
  message: string;
  sub: string;
  priority: 1 | 2 | 3;
}

function buildAlerts(patients: EmergencyPatient[], ambulances: AmbulanceT[]): Alert[] {
  const alerts: Alert[] = [];

  patients
    .filter(p => p.priority === 'P1')
    .forEach(p => {
      const isWaiting = p.status === 'attente_triage' || p.status === 'attente_soins';
      alerts.push({
        id: `p1-${p.id}`,
        type: isWaiting ? 'P1_WAITING' : 'P1_CRITICAL',
        message: `P1 — ${p.lastName} ${p.firstName}, ${p.age} ans`,
        sub: isWaiting ? `⚠ EN ATTENTE de prise en charge · ${p.chiefComplaint}` : `En cours · ${p.chiefComplaint}`,
        priority: isWaiting ? 1 : 2,
      });
    });

  ambulances
    .filter(a => a.status === 'vers_hopital')
    .forEach(a => {
      alerts.push({
        id: `amb-${a.id}`,
        type: 'AMBULANCE_INBOUND',
        message: `${a.callSign} — Arrivée imminente`,
        sub: `ETA : ${a.etaMinutes ?? '?'} min · ${a.patientName ?? 'Patient inconnu'} · ${a.chiefComplaint ?? ''}`,
        priority: a.patientPriority === 'P1' ? 1 : 3,
      });
    });

  return alerts.sort((a, b) => a.priority - b.priority);
}

const ALERT_CLS = {
  P1_WAITING:       { bg: 'bg-red-600',    icon: AlertTriangle, pulse: true  },
  P1_CRITICAL:      { bg: 'bg-red-500',    icon: Siren,         pulse: true  },
  AMBULANCE_INBOUND:{ bg: 'bg-orange-500', icon: Ambulance,     pulse: false },
} as const;

export function EmergencyAlertStrip({ patients, ambulances, isDark }: Props) {
  const alerts = buildAlerts(patients, ambulances);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (alerts.length <= 1) return;
    const id = setInterval(() => setIdx(i => (i + 1) % alerts.length), 4000);
    return () => clearInterval(id);
  }, [alerts.length]);

  if (alerts.length === 0) {
    return (
      <div className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border',
        isDark
          ? 'bg-green-900/30 border-green-700 text-green-400'
          : 'bg-green-50 border-green-200 text-green-700',
      )}>
        <span className="w-2 h-2 rounded-full bg-green-500" />
        Aucune alerte critique active — service opérationnel
      </div>
    );
  }

  const alert = alerts[idx % alerts.length];
  const cfg   = ALERT_CLS[alert.type];
  const Icon  = cfg.icon;

  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-2.5 rounded-xl text-white overflow-hidden relative',
      cfg.bg,
    )}>
      {/* Animated background sweep */}
      <div className="absolute inset-0 opacity-10 animate-pulse"
        style={{ background: 'linear-gradient(90deg, transparent 0%, white 50%, transparent 100%)' }} />

      <div className="flex items-center gap-2 flex-shrink-0">
        {cfg.pulse && <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping absolute opacity-75" />}
        <Icon size={16} className="relative z-10 flex-shrink-0" />
        <span className="text-xs font-black uppercase tracking-widest relative z-10">
          ALERTE {alerts.filter(a => a.priority === 1).length > 0 ? '— CRITIQUE' : ''}
        </span>
      </div>

      <div className="flex-1 min-w-0 relative z-10">
        <span className="font-bold text-sm">{alert.message}</span>
        <span className="ml-2 text-white/80 text-xs">{alert.sub}</span>
      </div>

      {/* Alert dots */}
      {alerts.length > 1 && (
        <div className="flex gap-1 flex-shrink-0 relative z-10">
          {alerts.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={cn('w-1.5 h-1.5 rounded-full transition-all', i === idx % alerts.length ? 'bg-white' : 'bg-white/40')}
            />
          ))}
        </div>
      )}

      <span className="text-xs text-white/70 flex-shrink-0 font-mono relative z-10">
        {idx + 1}/{alerts.length}
      </span>
    </div>
  );
}
