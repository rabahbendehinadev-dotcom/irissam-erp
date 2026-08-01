import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Eye, Pencil, LogOut, ArrowRight, Ban, Printer } from 'lucide-react';
import { useLanguage } from '@/i18n';
import type { Admission } from '@/types/admission';

interface Props {
  admission: Admission;
  onView: () => void;
  onEdit: () => void;
  onDischarge: () => void;
  onTransfer: () => void;
  onCancel: () => void;
  onPrint: () => void;
  canEdit: boolean;
  canDischarge: boolean;
  canTransfer: boolean;
  canCancel: boolean;
}

export function AdmissionQuickActions({
  admission, onView, onEdit, onDischarge, onTransfer, onCancel, onPrint,
  canEdit, canDischarge, canTransfer, canCancel,
}: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const canActOnActive   = ['active', 'ambulatoire'].includes(admission.status);
  const canActOnPending  = ['active', 'preadmission', 'ambulatoire'].includes(admission.status);

  const item = (icon: React.ReactNode, label: string, fn: () => void, danger = false) => (
    <button
      onClick={() => { fn(); setOpen(false); }}
      className={`flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg transition-colors ${
        danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      <span className="flex-shrink-0">{icon}</span>
      {label}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 w-44 min-w-max">
          {item(<Eye size={14} />,         t('adm.action.view'),      onView)}
          {canEdit && item(<Pencil size={14} />, t('adm.action.edit'), onEdit)}
          {canDischarge && canActOnActive && item(<LogOut size={14} />, t('adm.action.discharge'), onDischarge)}
          {canTransfer  && canActOnActive && item(<ArrowRight size={14} />, t('adm.action.transfer'), onTransfer)}
          {item(<Printer size={14} />,    t('adm.action.print'),     onPrint)}
          {canCancel && canActOnPending && (
            <>
              <div className="my-1 border-t border-gray-100" />
              {item(<Ban size={14} />, t('adm.action.cancel'), onCancel, true)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
