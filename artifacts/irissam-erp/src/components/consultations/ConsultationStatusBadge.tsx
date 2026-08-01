import { Clock, Loader2, CheckCircle2, XCircle, PauseCircle, CalendarX, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConsultationStatus, ConsultationType, ConsultationOrigin } from '@/types/consultation';

// ─── Status Badge ─────────────────────────────────────────────────────────────

interface StatusConfig {
  icon: React.ElementType;
  bg: string;
  text: string;
  border: string;
  label: string;
  dot?: string; // pulsing dot colour
}

const STATUS_MAP: Record<ConsultationStatus, StatusConfig> = {
  planifiee:      { icon: CalendarX,    bg: 'bg-gray-100',   text: 'text-gray-700',   border: 'border-gray-200',  label: 'Planifiée' },
  en_attente:     { icon: Clock,        bg: 'bg-yellow-50',  text: 'text-yellow-700', border: 'border-yellow-200',label: 'En attente',  dot: 'bg-yellow-400' },
  en_cours:       { icon: Loader2,      bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-200',  label: 'En cours',    dot: 'bg-blue-500' },
  suspendue:      { icon: PauseCircle,  bg: 'bg-orange-50',  text: 'text-orange-700', border: 'border-orange-200',label: 'Suspendue' },
  terminee:       { icon: CheckCircle2, bg: 'bg-green-50',   text: 'text-green-700',  border: 'border-green-200', label: 'Terminée' },
  annulee:        { icon: XCircle,      bg: 'bg-red-50',     text: 'text-red-600',    border: 'border-red-200',   label: 'Annulée' },
  patient_absent: { icon: UserX,        bg: 'bg-gray-100',   text: 'text-gray-500',   border: 'border-gray-200',  label: 'Patient absent' },
};

interface StatusBadgeProps {
  status: ConsultationStatus;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

export function ConsultationStatusBadge({ status, showIcon = true, size = 'sm' }: StatusBadgeProps) {
  const cfg = STATUS_MAP[status];
  const Icon = cfg.icon;
  const spin = status === 'en_cours';
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border font-medium',
      cfg.bg, cfg.text, cfg.border,
      size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
    )}>
      {showIcon && cfg.dot ? (
        <span className="relative flex h-1.5 w-1.5">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${cfg.dot}`} />
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${cfg.dot}`} />
        </span>
      ) : showIcon ? (
        <Icon size={12} className={spin ? 'animate-spin' : ''} />
      ) : null}
      {cfg.label}
    </span>
  );
}

// ─── Type Badge ───────────────────────────────────────────────────────────────

const TYPE_MAP: Record<ConsultationType, { bg: string; text: string; label: string }> = {
  programmee:      { bg: 'bg-blue-50',   text: 'text-blue-700',   label: 'Programmée' },
  sans_rdv:        { bg: 'bg-gray-100',  text: 'text-gray-700',   label: 'Sans RDV' },
  controle:        { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Contrôle' },
  specialisee:     { bg: 'bg-indigo-50', text: 'text-indigo-700', label: 'Spécialisée' },
  ambulatoire:     { bg: 'bg-teal-50',   text: 'text-teal-700',   label: 'Ambulatoire' },
  teleconsultation:{ bg: 'bg-sky-50',    text: 'text-sky-700',    label: 'Téléconsultation' },
  urgences:        { bg: 'bg-red-50',    text: 'text-red-700',    label: 'Urgences' },
  hospitalisation: { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Hospitalisation' },
};

interface TypeBadgeProps { type: ConsultationType }
export function ConsultationTypeBadge({ type }: TypeBadgeProps) {
  const cfg = TYPE_MAP[type];
  return (
    <span className={cn('inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full', cfg.bg, cfg.text)}>
      {cfg.label}
    </span>
  );
}

// ─── Origin Badge ─────────────────────────────────────────────────────────────

const ORIGIN_MAP: Record<ConsultationOrigin, { label: string; cls: string }> = {
  rdv:      { label: 'Rendez-vous', cls: 'bg-green-50 text-green-700' },
  urgence:  { label: 'Urgence',     cls: 'bg-red-50 text-red-700' },
  admission:{ label: 'Admission',   cls: 'bg-orange-50 text-orange-700' },
  sans_rdv: { label: 'Sans RDV',    cls: 'bg-gray-100 text-gray-600' },
};

interface OriginBadgeProps { origin: ConsultationOrigin }
export function ConsultationOriginBadge({ origin }: OriginBadgeProps) {
  const cfg = ORIGIN_MAP[origin];
  return (
    <span className={cn('inline-flex items-center text-xs px-2 py-0.5 rounded-full', cfg.cls)}>
      {cfg.label}
    </span>
  );
}
