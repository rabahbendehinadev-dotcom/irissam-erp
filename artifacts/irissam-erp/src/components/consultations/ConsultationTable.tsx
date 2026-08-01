import { useState } from 'react';
import { useLocation } from 'wouter';
import { ChevronUp, ChevronDown, MoreVertical, Eye, Play, Pencil, CheckSquare, Printer, History, XCircle, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PatientAvatar } from '@/components/shared/PatientAvatar';
import { ConsultationStatusBadge, ConsultationTypeBadge, ConsultationOriginBadge } from './ConsultationStatusBadge';
import { SyncStatusBadge } from '@/components/patients/SyncStatusBadge';
import { formatDate, formatTime } from '@/utils/format';
import type { Consultation, ConsultationStatus } from '@/types/consultation';

type SortKey = 'number' | 'date' | 'patientName' | 'doctorName' | 'status' | 'duration';

function SortIcon({ col, active, dir }: { col: SortKey; active: SortKey; dir: 'asc' | 'desc' }) {
  if (col !== active) return <ChevronsUpDown size={12} className="text-gray-300" />;
  return dir === 'asc' ? <ChevronUp size={12} className="text-blue-600" /> : <ChevronDown size={12} className="text-blue-600" />;
}

interface ActionsMenuProps {
  consultation: Consultation;
  onAction: (action: string, c: Consultation) => void;
}

function ActionsMenu({ consultation: c, onAction }: ActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const can = {
    start:    c.status === 'en_attente' || c.status === 'planifiee',
    edit:     c.status !== 'terminee' && c.status !== 'annulee',
    complete: c.status === 'en_cours' || c.status === 'suspendue',
    cancel:   c.status !== 'terminee' && c.status !== 'annulee',
  };

  return (
    <div className="relative">
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 w-48 bg-white border border-gray-200 rounded-xl shadow-xl py-1 overflow-hidden">
            {[
              { key: 'open',     icon: Eye,        label: 'Ouvrir',          show: true,         danger: false },
              { key: 'start',    icon: Play,        label: 'Commencer',       show: can.start,    danger: false },
              { key: 'edit',     icon: Pencil,      label: 'Modifier',        show: can.edit,     danger: false },
              { key: 'complete', icon: CheckSquare, label: 'Terminer',        show: can.complete, danger: false },
              { key: 'print',    icon: Printer,     label: 'Imprimer',        show: true,         danger: false },
              { key: 'history',  icon: History,     label: 'Voir historique', show: true,         danger: false },
              { key: 'cancel',   icon: XCircle,     label: 'Annuler',         show: can.cancel,   danger: true  },
            ].filter(a => a.show).map(a => {
              const Icon = a.icon;
              return (
                <button
                  key={a.key}
                  onClick={e => { e.stopPropagation(); setOpen(false); onAction(a.key, c); }}
                  className={cn(
                    'flex items-center gap-2.5 w-full px-4 py-2 text-sm transition-colors',
                    a.danger
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <Icon size={14} className="text-gray-400" />
                  {a.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

interface Props {
  consultations: Consultation[];
  onStatusChange?: (id: string, status: ConsultationStatus) => void;
  onPatientClick?: (patientId: string) => void;
}

const PAGE_SIZE = 10;

export function ConsultationTable({ consultations, onStatusChange, onPatientClick }: Props) {
  const [, setLocation] = useLocation();
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  const sorted = [...consultations].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'number')      cmp = a.number.localeCompare(b.number);
    else if (sortKey === 'date')   cmp = a.scheduledAt.localeCompare(b.scheduledAt);
    else if (sortKey === 'patientName') cmp = a.patientName.localeCompare(b.patientName);
    else if (sortKey === 'doctorName')  cmp = a.doctorName.localeCompare(b.doctorName);
    else if (sortKey === 'status') cmp = a.status.localeCompare(b.status);
    else if (sortKey === 'duration') cmp = (a.duration ?? 0) - (b.duration ?? 0);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleAction = (action: string, c: Consultation) => {
    if (action === 'open')     setLocation(`/consultations/${c.id}`);
    else if (action === 'start')    onStatusChange?.(c.id, 'en_cours');
    else if (action === 'complete') setLocation(`/consultations/${c.id}`);
    else if (action === 'cancel')   onStatusChange?.(c.id, 'annulee');
    else if (action === 'edit')     setLocation(`/consultations/${c.id}`);
    else if (action === 'history')  setLocation(`/consultations/${c.id}`);
    else if (action === 'print')    window.print();
  };

  const Th = ({ col, label, className }: { col?: SortKey; label: string; className?: string }) => (
    <th
      className={cn('text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap', className, col ? 'cursor-pointer hover:text-gray-700 select-none' : '')}
      onClick={col ? () => handleSort(col) : undefined}
    >
      <div className="flex items-center gap-1">
        {label}
        {col && <SortIcon col={col} active={sortKey} dir={sortDir} />}
      </div>
    </th>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <Th col="number"      label="N° Consultation" />
              <Th col="date"        label="Date / Heure" />
              <Th col="patientName" label="Patient" />
              <Th label="MPI" />
              <Th col="doctorName"  label="Médecin" />
              <Th label="Spécialité" />
              <Th label="Service" />
              <Th label="Type" />
              <Th label="Motif" />
              <Th col="status"      label="Statut" />
              <Th col="duration"    label="Durée" />
              <Th label="Origine" />
              <Th label="Sync" />
              <Th label="" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {paged.map(c => {
              const nameParts = c.patientName.split(' ');
              return (
                <tr
                  key={c.id}
                  onClick={() => setLocation(`/consultations/${c.id}`)}
                  className={cn(
                    'cursor-pointer transition-colors hover:bg-blue-50/30',
                    c.status === 'en_cours' ? 'bg-blue-50/20' : '',
                    (c.status === 'annulee' || c.status === 'patient_absent') ? 'opacity-60' : '',
                  )}
                >
                  <td className="px-4 py-3 font-mono text-xs text-blue-700 font-semibold whitespace-nowrap">{c.number}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="text-xs font-medium text-gray-800">{formatDate(c.scheduledAt)}</p>
                    <p className="text-xs text-gray-400">{formatTime(c.scheduledAt)}</p>
                  </td>
                  <td className="px-4 py-3" onClick={e => { if (onPatientClick && c.patientId) { e.stopPropagation(); onPatientClick(c.patientId); } }}>
                    <div className={cn("flex items-center gap-2", onPatientClick && c.patientId ? "cursor-pointer group" : "")}>
                      <PatientAvatar
                        firstName={nameParts[nameParts.length - 1] ?? ''}
                        lastName={nameParts[0] ?? ''}
                        size="xs"
                      />
                      <span className={cn("font-medium whitespace-nowrap", onPatientClick && c.patientId ? "text-blue-700 group-hover:underline" : "text-gray-900")}>{c.patientName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{c.patientMpi}</td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap text-xs">{c.doctorName}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full whitespace-nowrap">{c.specialty}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap">{c.serviceName}</span>
                  </td>
                  <td className="px-4 py-3"><ConsultationTypeBadge type={c.type} /></td>
                  <td className="px-4 py-3 max-w-[160px]">
                    <p className="text-xs text-gray-600 truncate" title={c.reason}>{c.reason}</p>
                  </td>
                  <td className="px-4 py-3"><ConsultationStatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {c.duration ? `${c.duration} min` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3"><ConsultationOriginBadge origin={c.origin} /></td>
                  <td className="px-4 py-3"><SyncStatusBadge status={c.syncStatus} /></td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <ActionsMenu consultation={c} onAction={handleAction} />
                  </td>
                </tr>
              );
            })}
            {paged.length === 0 && (
              <tr>
                <td colSpan={14} className="px-4 py-16 text-center text-gray-400 text-sm">
                  Aucune consultation trouvée pour ces filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-500">
            Page {page} sur {totalPages} · {consultations.length} résultats
          </p>
          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  'w-7 h-7 text-xs rounded-lg transition-colors',
                  p === page ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                )}
              >{p}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
