import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, Eye, Pencil, LogOut, ArrowRight, Ban, Printer, FolderOpen } from 'lucide-react';
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
  onViewPatient?: () => void;
  canEdit: boolean;
  canDischarge: boolean;
  canTransfer: boolean;
  canCancel: boolean;
}

export function AdmissionQuickActions({
  admission, onView, onEdit, onDischarge, onTransfer, onCancel, onPrint, onViewPatient,
  canEdit, canDischarge, canTransfer, canCancel,
}: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Menu rendu dans un portal en position fixe : il échappe à l'overflow du
  // conteneur du tableau. S'il n'y a pas assez d'espace sous le bouton, il
  // s'ouvre automatiquement vers le haut.
  const updatePosition = useCallback(() => {
    const btn = btnRef.current;
    const menu = menuRef.current;
    if (!btn || !menu) return;
    const rect = btn.getBoundingClientRect();
    const menuH = menu.offsetHeight;
    const menuW = menu.offsetWidth;
    const margin = 4;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const openUp = spaceBelow < menuH && spaceAbove > spaceBelow;
    const top = openUp
      ? Math.max(margin, rect.top - margin - menuH)
      : rect.bottom + margin;
    const left = Math.max(margin, Math.min(rect.right - menuW, window.innerWidth - menuW - margin));
    setPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (open) updatePosition();
    else setPos(null);
  }, [open, updatePosition]);

  // Suit le bouton pendant un scroll (y compris celui du conteneur) ou un resize.
  useEffect(() => {
    if (!open) return;
    const reposition = () => updatePosition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
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
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <MoreVertical size={16} />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}
          className="z-50 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 w-44 min-w-max"
        >
          {item(<Eye size={14} />,         t('adm.action.view'),      onView)}
          {onViewPatient && item(<FolderOpen size={14} />, t('adm.action.viewPatient'), onViewPatient)}
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
        </div>,
        document.body
      )}
    </>
  );
}
