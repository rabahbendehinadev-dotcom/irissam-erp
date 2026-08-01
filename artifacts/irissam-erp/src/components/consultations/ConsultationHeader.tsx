import { useState } from 'react';
import { ArrowLeft, Play, Pause, CheckCircle2, Printer, MoreVertical, Clock, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { PatientAvatar } from '@/components/shared/PatientAvatar';
import { ConsultationStatusBadge, ConsultationTypeBadge } from './ConsultationStatusBadge';
import type { Consultation, ConsultationStatus } from '@/types/consultation';

function SyncIndicator({ status }: { status: Consultation['syncStatus'] }) {
  const map = {
    synced:   { icon: Wifi,       cls: 'text-green-500',  label: 'Synchronisé' },
    pending:  { icon: RefreshCw,  cls: 'text-yellow-500 animate-spin', label: 'En cours…' },
    conflict: { icon: WifiOff,    cls: 'text-orange-500', label: 'Conflit' },
    error:    { icon: WifiOff,    cls: 'text-red-500',    label: 'Erreur sync' },
  };
  const cfg = map[status];
  const Icon = cfg.icon;
  return (
    <div className="flex items-center gap-1 text-xs text-gray-400" title={cfg.label}>
      <Icon size={12} className={cfg.cls} />
      <span className="hidden sm:inline">{cfg.label}</span>
    </div>
  );
}

function AutoSaveIndicator({ saving }: { saving: boolean }) {
  return (
    <div className={cn('flex items-center gap-1 text-xs transition-colors', saving ? 'text-blue-500' : 'text-gray-400')}>
      <div className={cn('w-1.5 h-1.5 rounded-full', saving ? 'bg-blue-500 animate-pulse' : 'bg-green-400')} />
      <span className="hidden sm:inline">{saving ? 'Sauvegarde…' : 'Sauvegardé'}</span>
    </div>
  );
}

function TimerDisplay({ startedAt }: { startedAt?: string }) {
  const elapsed = startedAt
    ? Math.round((Date.now() - new Date(startedAt).getTime()) / 60000)
    : null;
  if (elapsed === null) return null;
  return (
    <div className="flex items-center gap-1 text-xs text-gray-500">
      <Clock size={12} />
      <span>{elapsed < 60 ? `${elapsed} min` : `${Math.floor(elapsed / 60)}h${elapsed % 60 > 0 ? elapsed % 60 + 'min' : ''}`}</span>
    </div>
  );
}

interface Props {
  consultation: Consultation;
  saving?: boolean;
  onStatusChange: (status: ConsultationStatus) => void;
  onTerminer: () => void;
}

export function ConsultationHeader({ consultation: c, saving = false, onStatusChange, onTerminer }: Props) {
  const [, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const nameParts = c.patientName.split(' ');

  const canStart     = c.status === 'en_attente' || c.status === 'planifiee';
  const canSuspend   = c.status === 'en_cours';
  const canResume    = c.status === 'suspendue';
  const canTerminer  = c.status === 'en_cours' || c.status === 'suspendue';
  const isReadOnly   = c.status === 'terminee' || c.status === 'annulee' || c.status === 'patient_absent';

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-3">
        <button
          onClick={() => setLocation('/consultations')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors flex-shrink-0"
        >
          <ArrowLeft size={15} /> Consultations
        </button>
        <span className="text-gray-300">/</span>
        <span className="font-mono text-sm text-blue-700 font-semibold">{c.number}</span>

        <div className="flex items-center gap-2 ml-auto">
          <AutoSaveIndicator saving={saving} />
          <SyncIndicator status={c.syncStatus} />
          <TimerDisplay startedAt={c.startedAt} />

          {isReadOnly && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Lecture seule</span>
          )}

          {/* Action buttons */}
          {canStart && (
            <button onClick={() => onStatusChange('en_cours')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Play size={12} /> Commencer
            </button>
          )}
          {canSuspend && (
            <button onClick={() => onStatusChange('suspendue')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200">
              <Pause size={12} /> Suspendre
            </button>
          )}
          {canResume && (
            <button onClick={() => onStatusChange('en_cours')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">
              <Play size={12} /> Reprendre
            </button>
          )}
          {canTerminer && (
            <button onClick={onTerminer}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">
              <CheckCircle2 size={12} /> Terminer
            </button>
          )}

          <button onClick={() => window.print()}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500">
            <Printer size={14} />
          </button>

          <div className="relative">
            <button onClick={() => setMenuOpen(v => !v)} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500">
              <MoreVertical size={14} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-9 z-50 w-44 bg-white border border-gray-200 rounded-xl shadow-xl py-1">
                  {[
                    { label: 'Imprimer CR', action: () => window.print() },
                    { label: 'Voir le patient', action: () => setLocation(`/patients/${c.patientId}`) },
                    c.admissionId ? { label: 'Voir l\'admission', action: () => setLocation(`/admissions`) } : null,
                    { label: 'Annuler', action: () => onStatusChange('annulee'), danger: true },
                  ].filter(Boolean).map((item: any) => (
                    <button key={item.label} onClick={() => { setMenuOpen(false); item.action(); }}
                      className={cn('flex w-full px-4 py-2 text-sm text-left hover:bg-gray-50',
                        item.danger ? 'text-red-600' : 'text-gray-700')}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Patient info bar */}
      <div className="flex items-center gap-4 px-6 py-2.5 bg-gradient-to-r from-blue-50/60 to-indigo-50/40 border-t border-gray-100">
        <PatientAvatar firstName={nameParts[nameParts.length - 1] ?? ''} lastName={nameParts[0] ?? ''} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{c.patientName}</span>
            <span className="font-mono text-xs text-gray-400">{c.patientMpi}</span>
            <ConsultationTypeBadge type={c.type} />
            <ConsultationStatusBadge status={c.status} size="sm" />
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
            <span>{c.doctorName}</span>
            <span>·</span>
            <span>{c.specialty}</span>
            <span>·</span>
            <span>{c.serviceName}</span>
            {c.admissionId && (
              <>
                <span>·</span>
                <span className="text-orange-600">Lié à l'hospitalisation</span>
              </>
            )}
          </div>
        </div>
        <div className="text-right text-xs text-gray-500 flex-shrink-0">
          <p className="font-medium">{c.scheduledAt.substring(0, 10)}</p>
          <p>{c.scheduledAt.substring(11, 16)}</p>
        </div>
      </div>
    </div>
  );
}
