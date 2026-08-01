import { Hospital, Stethoscope, Clock, AlertTriangle, Baby, Scissors } from 'lucide-react';
import { useLanguage } from '@/i18n';
import type { AdmissionType } from '@/types/admission';

const CONFIG: Record<AdmissionType, { icon: React.ReactNode; className: string }> = {
  hospitalisation: { icon: <Hospital size={11} />,      className: 'bg-blue-100 text-blue-700 border-blue-200' },
  ambulatoire:     { icon: <Stethoscope size={11} />,   className: 'bg-purple-100 text-purple-700 border-purple-200' },
  preadmission:    { icon: <Clock size={11} />,          className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  urgence:         { icon: <AlertTriangle size={11} />, className: 'bg-red-100 text-red-700 border-red-200' },
  maternite:       { icon: <Baby size={11} />,           className: 'bg-pink-100 text-pink-700 border-pink-200' },
  chirurgie:       { icon: <Scissors size={11} />,       className: 'bg-orange-100 text-orange-700 border-orange-200' },
};

interface Props { type: AdmissionType }

export function AdmissionTypeBadge({ type }: Props) {
  const { t } = useLanguage();
  const cfg = CONFIG[type];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border ${cfg.className}`}>
      {cfg.icon}
      {t(`adm.type.${type}` as any)}
    </span>
  );
}
