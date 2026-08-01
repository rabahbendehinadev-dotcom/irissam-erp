import { useLanguage } from '@/i18n';
import type { AdmissionPriority } from '@/types/admission';

const CONFIG: Record<AdmissionPriority, { className: string; dot: string }> = {
  normal:      { className: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' },
  urgent:      { className: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  tres_urgent: { className: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
  vital:       { className: 'bg-red-900 text-red-100 border-red-800', dot: 'bg-red-400 animate-ping' },
};

interface Props { priority: AdmissionPriority; compact?: boolean }

export function PriorityBadge({ priority, compact = false }: Props) {
  const { t } = useLanguage();
  const cfg = CONFIG[priority];
  if (priority === 'normal' && compact) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded border ${cfg.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {compact ? priority.replace('_', ' ').toUpperCase() : t(`adm.priority.${priority}` as any)}
    </span>
  );
}
