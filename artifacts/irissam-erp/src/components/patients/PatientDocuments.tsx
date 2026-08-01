import { FileText, Upload, Lock } from 'lucide-react';
import { useLanguage } from '@/i18n';

const DOC_CATEGORIES = [
  { key: 'cni',           icon: '🪪', labelKey: 'pat.form.docs.cni' as const },
  { key: 'ss',            icon: '🏥', labelKey: 'pat.form.docs.ss' as const },
  { key: 'insurance',     icon: '📋', labelKey: 'pat.form.docs.insurance' as const },
  { key: 'prescriptions', icon: '💊', labelKey: 'pat.form.docs.prescriptions' as const },
  { key: 'admin',         icon: '📁', labelKey: 'pat.form.docs.admin' as const },
  { key: 'other',         icon: '📎', labelKey: 'pat.form.docs.other' as const },
];

interface Props {
  patientId: string;
}

export function PatientDocuments({ patientId: _ }: Props) {
  const { t } = useLanguage();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">{t('pat.docs.title')}</h3>
        <button disabled className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed" title={t('pat.docs.soon')}>
          <Upload size={14} />
          {t('pat.docs.add')}
        </button>
      </div>

      {/* Placeholder categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {DOC_CATEGORIES.map(cat => (
          <div key={cat.key} className="border border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center gap-2 bg-gray-50/50 min-h-[100px]">
            <span className="text-2xl">{cat.icon}</span>
            <p className="text-xs font-medium text-gray-600 text-center">{t(cat.labelKey)}</p>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Lock size={10} />
              {t('pat.docs.soon')}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <FileText size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-700">{t('pat.form.docs.hint')}</p>
      </div>
    </div>
  );
}
