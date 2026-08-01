import { CheckCircle, Clock, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SyncStatus } from '@/types';
import { useLanguage } from '@/i18n';

const CONFIG: Record<SyncStatus, { icon: React.ElementType; cls: string; labelKey: string }> = {
  synced:  { icon: CheckCircle,   cls: 'text-green-600',  labelKey: 'pat.sync.badge.synced' },
  pending: { icon: Clock,         cls: 'text-amber-500',  labelKey: 'pat.sync.badge.pending' },
  conflict:{ icon: AlertTriangle, cls: 'text-orange-500', labelKey: 'pat.sync.badge.conflict' },
  error:   { icon: XCircle,       cls: 'text-red-500',    labelKey: 'pat.sync.badge.error' },
};

interface Props {
  status: SyncStatus;
  showLabel?: boolean;
  className?: string;
}

export function SyncStatusBadge({ status, showLabel = false, className }: Props) {
  const { t } = useLanguage();
  const { icon: Icon, cls, labelKey } = CONFIG[status];
  return (
    <span className={cn('inline-flex items-center gap-1', cls, className)} title={t(labelKey as any)}>
      <Icon size={14} />
      {showLabel && <span className="text-xs">{t(labelKey as any)}</span>}
    </span>
  );
}
