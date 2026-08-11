import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Eye, Pencil, History, Printer, Archive, Trash2 } from 'lucide-react';
import { useLanguage } from '@/i18n';
import type { Patient } from '@/types';

interface Props {
  patient: Patient;
  onView: () => void;
  onEdit: () => void;
  onArchive: () => void;
  canEdit: boolean;
  canArchive: boolean;
  /** Suppression définitive — visible uniquement pour le Super Administrateur */
  onDeletePermanent?: () => void;
  canDeletePermanent?: boolean;
}

export function PatientQuickActions({
  patient, onView, onEdit, onArchive, canEdit, canArchive,
  onDeletePermanent, canDeletePermanent,
}: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const item = (icon: React.ReactNode, label: string, onClick: () => void, danger = false) => (
    <button
      key={label}
      onClick={() => { onClick(); setOpen(false); }}
      className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors ${danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700'}`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
        title="Actions"
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1 overflow-hidden">
          {item(<Eye size={14} />, t('pat.action.view'), onView)}
          {canEdit && item(<Pencil size={14} />, t('pat.action.edit'), onEdit)}
          {item(<History size={14} />, t('pat.action.history'), onView)}
          {item(<Printer size={14} />, t('pat.action.print'), () => window.print())}
          {canArchive && patient.status !== 'archived' && (
            <div className="border-t border-gray-100 mt-1 pt-1">
              {item(<Archive size={14} />, t('pat.action.archive'), onArchive, true)}
            </div>
          )}
          {canDeletePermanent && onDeletePermanent && (
            <div className="border-t border-gray-100 mt-1 pt-1">
              {item(<Trash2 size={14} />, t('pat.action.delete_permanent'), onDeletePermanent, true)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
