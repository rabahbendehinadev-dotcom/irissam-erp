import { cn } from '@/lib/utils';
import type { EmergencyPriority } from '@/types/emergency';

export const PRIORITY_CFG = {
  P1: {
    label: 'P1', fullLabel: 'IMMÉDIAT',
    textColor: 'text-white',
    bg: 'bg-red-600',
    border: 'border-red-700',
    stripBg: 'bg-red-500',
    rowBg: 'bg-red-50 border-l-4 border-l-red-500',
    pillBg: 'bg-red-100 text-red-800 border-red-300',
    targetMin: 0,
    dot: 'bg-red-500 animate-pulse',
    glowCls: 'ring-1 ring-red-400',
  },
  P2: {
    label: 'P2', fullLabel: 'TRÈS URGENT',
    textColor: 'text-white',
    bg: 'bg-orange-500',
    border: 'border-orange-600',
    stripBg: 'bg-orange-400',
    rowBg: 'bg-orange-50 border-l-4 border-l-orange-400',
    pillBg: 'bg-orange-100 text-orange-800 border-orange-300',
    targetMin: 20,
    dot: 'bg-orange-400',
    glowCls: 'ring-1 ring-orange-300',
  },
  P3: {
    label: 'P3', fullLabel: 'URGENT',
    textColor: 'text-gray-900',
    bg: 'bg-yellow-400',
    border: 'border-yellow-500',
    stripBg: 'bg-yellow-400',
    rowBg: 'bg-yellow-50/60 border-l-4 border-l-yellow-400',
    pillBg: 'bg-yellow-100 text-yellow-900 border-yellow-300',
    targetMin: 60,
    dot: 'bg-yellow-400',
    glowCls: '',
  },
  P4: {
    label: 'P4', fullLabel: 'STANDARD',
    textColor: 'text-white',
    bg: 'bg-green-500',
    border: 'border-green-600',
    stripBg: 'bg-green-400',
    rowBg: 'bg-white border-l-4 border-l-green-400',
    pillBg: 'bg-green-100 text-green-800 border-green-300',
    targetMin: 120,
    dot: 'bg-green-400',
    glowCls: '',
  },
  P5: {
    label: 'P5', fullLabel: 'NON URGENT',
    textColor: 'text-white',
    bg: 'bg-blue-400',
    border: 'border-blue-500',
    stripBg: 'bg-blue-300',
    rowBg: 'bg-white border-l-4 border-l-blue-300',
    pillBg: 'bg-blue-100 text-blue-800 border-blue-300',
    targetMin: 240,
    dot: 'bg-blue-300',
    glowCls: '',
  },
} as const satisfies Record<EmergencyPriority, {
  label: string; fullLabel: string; textColor: string;
  bg: string; border: string; stripBg: string; rowBg: string;
  pillBg: string; targetMin: number; dot: string; glowCls: string;
}>;

interface Props {
  priority: EmergencyPriority;
  size?: 'xs' | 'sm' | 'md';
  showLabel?: 'short' | 'full' | 'both';
  className?: string;
}

export function EmergencyPriorityBadge({ priority, size = 'sm', showLabel = 'both', className }: Props) {
  const cfg = PRIORITY_CFG[priority];
  const sizeMap = {
    xs: 'text-xs px-1.5 py-0.5 gap-1',
    sm: 'text-xs px-2 py-1 gap-1.5',
    md: 'text-sm px-2.5 py-1 gap-2',
  };
  return (
    <span className={cn(
      'inline-flex items-center rounded-full font-bold border leading-none',
      sizeMap[size],
      cfg.bg,
      cfg.border,
      cfg.textColor,
      cfg.glowCls,
      className,
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', cfg.dot)} />
      {showLabel === 'short' && cfg.label}
      {showLabel === 'full'  && cfg.fullLabel}
      {showLabel === 'both'  && <span>{cfg.label} <span className="font-normal opacity-80">{cfg.fullLabel}</span></span>}
    </span>
  );
}
