import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n';

interface Props {
  value: string;
  canView: boolean;
  className?: string;
}

export function SensitiveField({ value, canView, className }: Props) {
  const { t } = useLanguage();
  const [revealed, setRevealed] = useState(false);

  if (!canView) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-gray-400 text-xs', className)}>
        <Lock size={11} />
        {t('pat.sensitive.no_permission')}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5 font-mono text-sm', className)}>
      <span>{revealed ? value : t('pat.sensitive.hidden')}</span>
      <button
        type="button"
        onClick={() => setRevealed(v => !v)}
        className="text-blue-500 hover:text-blue-700 transition-colors"
        title={revealed ? t('pat.sensitive.hide') : t('pat.sensitive.show')}
      >
        {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </span>
  );
}
