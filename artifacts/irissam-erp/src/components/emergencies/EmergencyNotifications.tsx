import { useEffect, useRef, useState, useCallback } from 'react';
import { AlertTriangle, Ambulance, X, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EmergencyPatient, Ambulance as AmbulanceT } from '@/types/emergency';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotifKind = 'P1_ARRIVED' | 'AMBULANCE_ARRIVING' | 'CRITICAL_WAIT';

export interface EmNotification {
  id: string;
  kind: NotifKind;
  title: string;
  body: string;
  at: Date;
  autoDismissMs: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const KIND_CFG: Record<NotifKind, {
  icon: React.ElementType;
  bg: string; border: string; title: string; icon_bg: string;
}> = {
  P1_ARRIVED: {
    icon: AlertTriangle,
    bg: 'bg-red-600', border: 'border-red-700',
    title: 'text-white', icon_bg: 'bg-red-800/50',
  },
  AMBULANCE_ARRIVING: {
    icon: Ambulance,
    bg: 'bg-orange-500', border: 'border-orange-600',
    title: 'text-white', icon_bg: 'bg-orange-700/50',
  },
  CRITICAL_WAIT: {
    icon: AlertTriangle,
    bg: 'bg-yellow-500', border: 'border-yellow-600',
    title: 'text-white', icon_bg: 'bg-yellow-700/50',
  },
};

// ─── Toast ────────────────────────────────────────────────────────────────────

function NotifToast({ notif, onDismiss }: { notif: EmNotification; onDismiss: (id: string) => void }) {
  const cfg = KIND_CFG[notif.kind];
  const Icon = cfg.icon;
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const step = 100 / (notif.autoDismissMs / 100);
    const id = setInterval(() => setProgress(p => Math.max(0, p - step)), 100);
    const dismiss = setTimeout(() => onDismiss(notif.id), notif.autoDismissMs);
    return () => { clearInterval(id); clearTimeout(dismiss); };
  }, [notif.id, notif.autoDismissMs, onDismiss]);

  return (
    <div className={cn(
      'flex gap-3 rounded-xl border shadow-2xl p-3 w-80 overflow-hidden relative',
      cfg.bg, cfg.border,
    )}>
      {/* Progress bar */}
      <div
        className="absolute bottom-0 left-0 h-0.5 bg-white/30 transition-all duration-100"
        style={{ width: `${progress}%` }}
      />

      {/* Icon */}
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', cfg.icon_bg)}>
        <Icon size={15} className="text-white" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-bold', cfg.title)}>{notif.title}</p>
        <p className="text-xs text-white/80 mt-0.5">{notif.body}</p>
        <p className="text-xs text-white/50 mt-0.5 font-mono">
          {notif.at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
      </div>

      {/* Dismiss */}
      <button
        onClick={() => onDismiss(notif.id)}
        className="w-5 h-5 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center flex-shrink-0 transition-colors"
      >
        <X size={11} className="text-white" />
      </button>
    </div>
  );
}

// ─── Engine + renderer ────────────────────────────────────────────────────────

interface Props {
  patients: EmergencyPatient[];
  ambulances: AmbulanceT[];
}

export function EmergencyNotifications({ patients, ambulances }: Props) {
  const [notifs,  setNotifs]  = useState<EmNotification[]>([]);
  const [muted,   setMuted]   = useState(false);
  const [visible, setVisible] = useState(true);
  const shownRef = useRef(new Set<string>());

  const push = useCallback((n: Omit<EmNotification, 'id' | 'at'>) => {
    const id = `${n.kind}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setNotifs(prev => [{ ...n, id, at: new Date() }, ...prev].slice(0, 5));
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifs(prev => prev.filter(n => n.id !== id));
  }, []);

  // On mount: fire notifications for current critical state
  useEffect(() => {
    if (muted) return;

    patients
      .filter(p => p.priority === 'P1' && (p.status === 'attente_triage' || p.status === 'en_triage'))
      .forEach(p => {
        const key = `p1-wait-${p.id}`;
        if (shownRef.current.has(key)) return;
        shownRef.current.add(key);
        push({
          kind: 'P1_ARRIVED',
          title: `⚠ P1 — ${p.lastName} ${p.firstName}`,
          body: `${p.chiefComplaint}${p.byAmbulance ? ' — Arrivée SMUR' : ''}`,
          autoDismissMs: 10_000,
        });
      });

    ambulances
      .filter(a => a.status === 'vers_hopital' && (a.etaMinutes ?? 99) <= 10)
      .forEach(a => {
        const key = `amb-${a.id}-arriving`;
        if (shownRef.current.has(key)) return;
        shownRef.current.add(key);
        push({
          kind: 'AMBULANCE_ARRIVING',
          title: `🚑 ${a.callSign} — Arrivée dans ${a.etaMinutes ?? '?'} min`,
          body: `${a.patientName ?? 'Patient'} · ${a.chiefComplaint ?? ''}`,
          autoDismissMs: 12_000,
        });
      });

    patients
      .filter(p => {
        const waitMin = (Date.now() - new Date(p.arrivalTime).getTime()) / 60000;
        return p.status === 'attente_soins' && (p.priority === 'P1' || p.priority === 'P2') && waitMin > 20;
      })
      .slice(0, 2)
      .forEach(p => {
        const waitMin = Math.round((Date.now() - new Date(p.arrivalTime).getTime()) / 60000);
        const key = `wait-${p.id}-${Math.floor(waitMin / 10)}`;
        if (shownRef.current.has(key)) return;
        shownRef.current.add(key);
        push({
          kind: 'CRITICAL_WAIT',
          title: `⏱ ${p.priority} en attente — ${waitMin} min`,
          body: `${p.lastName} ${p.firstName} · ${p.chiefComplaint}`,
          autoDismissMs: 8_000,
        });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return (
    <button
      onClick={() => setVisible(true)}
      className="fixed top-20 right-4 z-50 w-9 h-9 bg-red-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-red-700 transition-colors"
      title="Afficher les notifications"
    >
      <Bell size={15} />
    </button>
  );

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {/* Controls */}
      <div className="flex justify-end gap-1.5 pointer-events-auto">
        <button
          onClick={() => setMuted(m => !m)}
          className={cn(
            'text-xs px-2 py-1 rounded-lg border shadow-sm transition-colors',
            muted
              ? 'bg-gray-100 border-gray-200 text-gray-500'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50',
          )}
          title={muted ? 'Réactiver les notifications' : 'Silencieux'}
        >
          {muted ? '🔕 Silencieux' : '🔔 Notifs ON'}
        </button>
        <button
          onClick={() => setVisible(false)}
          className="text-xs px-2 py-1 rounded-lg border bg-white border-gray-200 text-gray-500 hover:bg-gray-50 shadow-sm"
          title="Masquer le panneau"
        >
          <X size={11} />
        </button>
      </div>

      {/* Toasts */}
      <div className="flex flex-col gap-2 pointer-events-auto">
        {notifs.map(n => <NotifToast key={n.id} notif={n} onDismiss={dismiss} />)}
      </div>
    </div>
  );
}
