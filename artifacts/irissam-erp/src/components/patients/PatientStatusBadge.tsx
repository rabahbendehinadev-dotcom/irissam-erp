import { cn } from '@/lib/utils';
import type { PatientStatus } from '@/types';
import { useLanguage } from '@/i18n';

const CLASSES: Record<PatientStatus, string> = {
  active:   'bg-green-100 text-green-700 border-green-200',
  inactive: 'bg-gray-100 text-gray-500 border-gray-200',
  archived: 'bg-amber-100 text-amber-700 border-amber-200',
  deceased: 'bg-slate-200 text-slate-600 border-slate-300',
};

const DOTS: Record<PatientStatus, string> = {
  active:   'bg-green-500',
  inactive: 'bg-gray-400',
  archived: 'bg-amber-500',
  deceased: 'bg-slate-500',
};

interface Props {
  status: PatientStatus;
  className?: string;
}

export function PatientStatusBadge({ status, className }: Props) {
  const { t } = useLanguage();
  const key = `pat.status.${status}` as const;
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border',
      CLASSES[status],
      className
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', DOTS[status])} />
      {t(key)}
    </span>
  );
}
