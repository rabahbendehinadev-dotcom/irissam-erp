import { useLanguage } from '@/i18n';
import type { AdmissionStatus } from '@/types/admission';

const CONFIG: Record<AdmissionStatus, { dot: string; badge: string }> = {
  active:       { dot: 'bg-green-500 animate-pulse', badge: 'bg-green-100 text-green-800 border-green-200' },
  preadmission: { dot: 'bg-blue-500',                badge: 'bg-blue-100 text-blue-800 border-blue-200' },
  ambulatoire:  { dot: 'bg-purple-500',              badge: 'bg-purple-100 text-purple-800 border-purple-200' },
  transferred:  { dot: 'bg-amber-500',               badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  discharged:   { dot: 'bg-gray-400',                badge: 'bg-gray-100 text-gray-600 border-gray-200' },
  cancelled:    { dot: 'bg-red-400',                 badge: 'bg-red-50 text-red-600 border-red-200' },
};

interface Props { status: AdmissionStatus }

export function AdmissionStatusBadge({ status }: Props) {
  const { t } = useLanguage();
  const cfg = CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {t(`adm.status.${status}` as any)}
    </span>
  );
}
