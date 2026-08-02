import { useEffect, useState } from 'react';
import { MapPin, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Ambulance } from '@/types/emergency';

// Hardcoded relative positions for each callSign [x%, y%]
const AMB_POSITIONS: Record<string, { x: number; y: number }> = {
  'AMB-001': { x: 72, y: 22 },   // NE — en route vers hôpital
  'AMB-002': { x: 24, y: 72 },   // SW — sur place
  'AMB-003': { x: 32, y: 18 },   // N  — disponible
  'AMB-004': { x: 68, y: 78 },   // SE — disponible
  'AMB-005': { x: 52, y: 58 },   // Near hospital — maintenance
};

const STATUS_DOT: Record<Ambulance['status'], { fill: string; stroke: string; pulse: boolean; label: string }> = {
  disponible:        { fill: '#22c55e', stroke: '#16a34a', pulse: false, label: 'Disponible' },
  en_route:          { fill: '#ef4444', stroke: '#dc2626', pulse: true,  label: 'En route' },
  vers_hopital:      { fill: '#ef4444', stroke: '#dc2626', pulse: true,  label: 'En route →' },
  vers_patient:      { fill: '#f59e0b', stroke: '#d97706', pulse: true,  label: '← Vers patient' },
  sur_place:         { fill: '#f97316', stroke: '#ea580c', pulse: false, label: 'Sur place' },
  transport_patient: { fill: '#f97316', stroke: '#ea580c', pulse: true,  label: 'Transport' },
  maintenance:       { fill: '#6b7280', stroke: '#4b5563', pulse: false, label: 'Maintenance' },
  hors_service:      { fill: '#9ca3af', stroke: '#6b7280', pulse: false, label: 'Hors service' },
};

// ETA countdown hook — decrements displayed ETA once per minute
function useEtaCountdown(initialEta: number | undefined): number | undefined {
  const [eta, setEta] = useState(initialEta);
  useEffect(() => {
    if (!initialEta) return;
    setEta(initialEta);
    const id = setInterval(() => setEta(t => (t && t > 1 ? t - 1 : 1)), 60_000);
    return () => clearInterval(id);
  }, [initialEta]);
  return eta;
}

function AmbCard({ amb, isDark }: { amb: Ambulance; isDark: boolean }) {
  const cfg = STATUS_DOT[amb.status];
  const eta = useEtaCountdown(amb.etaMinutes);

  return (
    <div className={cn(
      'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors',
      isDark
        ? 'bg-gray-700 border-gray-600'
        : 'bg-white border-gray-200',
      amb.status === 'vers_hopital' ? (isDark ? 'border-red-700 bg-red-900/30' : 'border-red-200 bg-red-50') : '',
    )}>
      {/* Status dot */}
      <span
        className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', cfg.pulse ? 'animate-pulse' : '')}
        style={{ backgroundColor: cfg.fill }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <span className={cn('font-mono font-bold', isDark ? 'text-gray-100' : 'text-gray-800')}>
            {amb.callSign}
          </span>
          <span className={cn('text-xs font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
            {cfg.label}
          </span>
        </div>
        {amb.patientName && (
          <p className={cn('truncate', isDark ? 'text-gray-300' : 'text-gray-600')}>{amb.patientName}</p>
        )}
        {amb.location && (
          <p className={cn('flex items-center gap-0.5 truncate', isDark ? 'text-gray-500' : 'text-gray-400')}>
            <MapPin size={9} />{amb.location}
          </p>
        )}
      </div>
      {eta !== undefined && (
        <div className={cn(
          'flex-shrink-0 font-mono font-black text-sm',
          isDark ? 'text-red-400' : 'text-red-600',
          'animate-pulse',
        )}>
          {eta}′
        </div>
      )}
    </div>
  );
}

interface Props {
  ambulances: Ambulance[];
  isDark: boolean;
}

export function EmergencyAmbulanceMap({ ambulances, isDark }: Props) {
  const active = ambulances.filter(a => a.status !== 'maintenance');
  const H = { x: 50, y: 50 }; // Hospital at ~center

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center justify-between gap-3 px-4 py-3 border-b',
        isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-100',
      )}>
        <div className="flex items-center gap-2">
          <Wifi size={14} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
          <h3 className={cn('font-semibold text-sm', isDark ? 'text-gray-200' : 'text-gray-800')}>
            Carte de localisation — Ambulances
          </h3>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {(['disponible', 'vers_hopital', 'sur_place'] as const).map(s => (
            <span key={s} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_DOT[s].fill }} />
              <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                {STATUS_DOT[s].label}: {ambulances.filter(a => a.status === s).length}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
        {/* SVG Map — 2/3 width */}
        <div className={cn(
          'lg:col-span-2 relative overflow-hidden',
          isDark ? 'bg-gray-900' : 'bg-slate-50',
        )} style={{ minHeight: 280 }}>
          <svg
            viewBox="0 0 500 280"
            className="w-full h-full"
            style={{ minHeight: 280 }}
          >
            {/* Grid lines (city streets) */}
            {[0,1,2,3,4].map(i => (
              <g key={i} opacity="0.15">
                <line x1={i * 125} y1={0} x2={i * 125} y2={280}
                  stroke={isDark ? '#60a5fa' : '#94a3b8'} strokeWidth="0.5" />
                <line x1={0} y1={i * 70} x2={500} y2={i * 70}
                  stroke={isDark ? '#60a5fa' : '#94a3b8'} strokeWidth="0.5" />
              </g>
            ))}

            {/* Roads to hospital */}
            {active.map(amb => {
              const pos = AMB_POSITIONS[amb.callSign];
              if (!pos) return null;
              const x2 = H.x * 5; const y2 = H.y * 2.8;
              const x1 = pos.x * 5; const y1 = pos.y * 2.8;
              const isMoving = amb.status === 'vers_hopital' || amb.status === 'vers_patient';
              return (
                <line key={`road-${amb.id}`}
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={isMoving ? (isDark ? '#ef4444' : '#ef4444') : (isDark ? '#374151' : '#e2e8f0')}
                  strokeWidth={isMoving ? 2 : 1}
                  strokeDasharray={isMoving ? '8 4' : '4 4'}
                  opacity={isMoving ? 0.7 : 0.3}
                />
              );
            })}

            {/* Distance rings around hospital */}
            {[30, 60, 95].map((r, i) => (
              <circle key={r}
                cx={H.x * 5} cy={H.y * 2.8}
                r={r}
                fill="none"
                stroke={isDark ? '#374151' : '#e2e8f0'}
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity={0.5 - i * 0.1}
              />
            ))}

            {/* Hospital icon */}
            <g transform={`translate(${H.x * 5 - 16}, ${H.y * 2.8 - 16})`}>
              <rect width="32" height="32" rx="6"
                fill={isDark ? '#1e3a5f' : '#dbeafe'}
                stroke={isDark ? '#3b82f6' : '#3b82f6'}
                strokeWidth="1.5" />
              {/* + cross */}
              <rect x="13" y="7" width="6" height="18" rx="1" fill={isDark ? '#60a5fa' : '#2563eb'} />
              <rect x="7" y="13" width="18" height="6" rx="1" fill={isDark ? '#60a5fa' : '#2563eb'} />
            </g>
            <text x={H.x * 5} y={H.y * 2.8 + 28}
              textAnchor="middle" fontSize="9" fontWeight="700"
              fill={isDark ? '#93c5fd' : '#1d4ed8'}>
              IRISSAM
            </text>

            {/* Ambulance dots */}
            {ambulances.map(amb => {
              const pos = AMB_POSITIONS[amb.callSign];
              if (!pos) return null;
              const cfg = STATUS_DOT[amb.status];
              const cx = pos.x * 5;
              const cy = pos.y * 2.8;

              return (
                <g key={amb.id}>
                  {/* Pulse ring for moving ambulances */}
                  {cfg.pulse && (
                    <circle cx={cx} cy={cy} r={12} fill={cfg.fill} opacity="0.25">
                      <animate attributeName="r" values="8;18;8" dur="1.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.4;0;0.4" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                  )}
                  {/* Ambulance dot */}
                  <circle cx={cx} cy={cy} r={7}
                    fill={cfg.fill} stroke={cfg.stroke} strokeWidth="1.5" />
                  {/* Call sign */}
                  <text x={cx} y={cy - 11}
                    textAnchor="middle" fontSize="7.5" fontWeight="700"
                    fill={isDark ? '#e5e7eb' : '#1f2937'}>
                    {amb.callSign}
                  </text>
                  {/* ETA badge */}
                  {amb.etaMinutes !== undefined && (
                    <g>
                      <rect x={cx + 8} y={cy - 8} width={20} height={12} rx="3"
                        fill={isDark ? '#dc2626' : '#fee2e2'}
                        stroke={isDark ? '#ef4444' : '#fca5a5'}
                        strokeWidth="0.8" />
                      <text x={cx + 18} y={cy + 0}
                        textAnchor="middle" fontSize="7" fontWeight="900"
                        fill={isDark ? '#fca5a5' : '#dc2626'}>
                        {amb.etaMinutes}′
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Scale hint */}
          <div className={cn(
            'absolute bottom-2 right-3 text-xs opacity-50',
            isDark ? 'text-gray-400' : 'text-gray-400',
          )}>
            Carte schématique · Zone Alger Centre
          </div>
        </div>

        {/* Card list — 1/3 width */}
        <div className={cn(
          'flex flex-col gap-2 p-3 border-l overflow-y-auto',
          isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-100 bg-gray-50',
        )} style={{ maxHeight: 280 }}>
          <p className={cn('text-xs font-semibold uppercase tracking-wide mb-1', isDark ? 'text-gray-400' : 'text-gray-400')}>
            État de flotte
          </p>
          {ambulances.map(amb => (
            <AmbCard key={amb.id} amb={amb} isDark={isDark} />
          ))}
        </div>
      </div>
    </div>
  );
}
