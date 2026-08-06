import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Play, Pause, CheckCircle2, Printer,
  MoreVertical, Clock, Wifi, WifiOff, RefreshCw, ShieldAlert,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { PatientAvatar } from '@/components/shared/PatientAvatar';
import { ConsultationStatusBadge, ConsultationTypeBadge } from './ConsultationStatusBadge';
import { apiClient } from '@/services/api/client';
import type { Consultation, ConsultationStatus, ConsultationPriority } from '@/types/consultation';

// ─── Priority config ──────────────────────────────────────────────────────────

const PRIORITY_CFG: Record<ConsultationPriority, { label: string; color: string; bg: string; dot: string }> = {
  normale:      { label: 'Normale',      color: 'text-gray-600',  bg: 'bg-gray-100',  dot: 'bg-gray-400' },
  urgente:      { label: 'Urgente',      color: 'text-amber-700', bg: 'bg-amber-100', dot: 'bg-amber-500' },
  tres_urgente: { label: 'Très urgente', color: 'text-red-700',   bg: 'bg-red-100',   dot: 'bg-red-600 animate-pulse' },
};

// ─── Sub-indicators ───────────────────────────────────────────────────────────

function SyncIndicator({ status }: { status: Consultation['syncStatus'] }) {
  const cfg = {
    synced:   { Icon: Wifi,      cls: 'text-green-500',                 label: 'Synchronisé' },
    pending:  { Icon: RefreshCw, cls: 'text-amber-500 animate-spin',    label: 'En cours…' },
    conflict: { Icon: WifiOff,   cls: 'text-orange-500',                label: 'Conflit' },
    error:    { Icon: WifiOff,   cls: 'text-red-500',                   label: 'Erreur sync' },
  }[status];
  return (
    <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0" title={cfg.label}>
      <cfg.Icon size={12} className={cfg.cls} />
      <span className="hidden lg:inline">{cfg.label}</span>
    </div>
  );
}

function AutoSaveIndicator({ saving }: { saving: boolean }) {
  return (
    <div className={cn('flex items-center gap-1.5 text-xs transition-colors shrink-0',
      saving ? 'text-blue-600' : 'text-gray-400')}>
      <div className={cn('w-1.5 h-1.5 rounded-full transition-colors',
        saving ? 'bg-blue-500 animate-pulse' : 'bg-green-400')} />
      <span className="hidden sm:inline">
        {saving ? 'Enregistrement…' : 'Toutes les modifications sont enregistrées'}
      </span>
    </div>
  );
}

// ─── Live timer ───────────────────────────────────────────────────────────────

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function LiveTimer({ consultation }: { consultation: Consultation }) {
  const [elapsed, setElapsed] = useState(() => {
    if (consultation.status === 'en_cours' && consultation.startedAt) {
      return Math.floor((Date.now() - new Date(consultation.startedAt).getTime()) / 1000);
    }
    return 0;
  });

  const prevStatusRef = useRef(consultation.status);

  // Reset to 0 when consultation first starts
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = consultation.status;
    if ((prev === 'en_attente' || prev === 'planifiee') && consultation.status === 'en_cours') {
      setElapsed(0);
    }
  }, [consultation.status]);

  // Run interval only while en_cours
  useEffect(() => {
    if (consultation.status !== 'en_cours') return;
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [consultation.status]);

  if (consultation.status === 'en_attente' || consultation.status === 'planifiee') return null;

  const running = consultation.status === 'en_cours';
  return (
    <div className={cn('flex items-center gap-1.5 text-xs font-mono shrink-0 px-2 py-1 rounded-md',
      running ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500')}>
      <Clock size={11} className={running ? 'text-blue-500' : 'text-gray-400'} />
      <span>{formatTimer(elapsed)}</span>
    </div>
  );
}

// ─── Age helper ───────────────────────────────────────────────────────────────

function calcAge(dateOfBirth?: string): string {
  if (!dateOfBirth) return '—';
  const years = Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000));
  return `${years} ans`;
}

// ─── Main header ──────────────────────────────────────────────────────────────

interface Props {
  consultation: Consultation;
  saving?: boolean;
  onStatusChange: (status: ConsultationStatus) => void;
  onTerminer: () => void;
  onPrint: () => void;
}

export function ConsultationHeader({ consultation: c, saving = false, onStatusChange, onTerminer, onPrint }: Props) {
  const [, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Fetch patient enrichment data from the real API (allergies, DOB, blood type)
  const [apiPatient, setApiPatient] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    if (!c.patientId) return;
    apiClient.get<Record<string, unknown>>(`/patients/${c.patientId}`)
      .then(r => setApiPatient(r))
      .catch(() => {}); // enrichment only — silent failure is acceptable
  }, [c.patientId]);

  const nameParts = c.patientName.split(' ');
  const allergies = (apiPatient?.medical as any)?.allergies ?? [];
  const diseases  = (apiPatient?.medical as any)?.chronicDiseases ?? [];
  const bloodType = (apiPatient?.medical as any)?.bloodType ?? (apiPatient?.bloodType as string | undefined);
  const age       = calcAge(apiPatient?.dateOfBirth as string | undefined);
  const gender    = apiPatient?.gender as string | undefined;
  const priority  = (c as any).priority as ConsultationPriority | undefined;

  const canStart    = c.status === 'en_attente' || c.status === 'planifiee';
  const canSuspend  = c.status === 'en_cours';
  const canResume   = c.status === 'suspendue';
  const canTerminer = c.status === 'en_cours' || c.status === 'suspendue';
  const isReadOnly  = c.status === 'terminee' || c.status === 'annulee' || c.status === 'patient_absent';

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm print:shadow-none">

      {/* ── Row 1: navigation + controls ────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 lg:px-6 py-2.5 border-b border-gray-100">

        {/* Back */}
        <button
          onClick={() => setLocation('/consultations')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors shrink-0"
        >
          <ArrowLeft size={14} />
          <span className="hidden sm:inline">Consultations</span>
        </button>
        <span className="text-gray-300 text-xs">/</span>
        <span className="font-mono text-sm text-blue-700 font-semibold shrink-0">{c.number}</span>

        {/* Right side */}
        <div className="flex items-center gap-2 ml-auto flex-wrap justify-end">
          <AutoSaveIndicator saving={saving} />
          <SyncIndicator status={c.syncStatus} />
          <LiveTimer consultation={c} />

          {isReadOnly && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full hidden sm:inline-flex">
              Lecture seule
            </span>
          )}

          {/* Status action buttons */}
          {canStart && (
            <button onClick={() => onStatusChange('en_cours')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Play size={11} /> Commencer
            </button>
          )}
          {canSuspend && (
            <button onClick={() => onStatusChange('suspendue')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-200 transition-colors">
              <Pause size={11} /> Suspendre
            </button>
          )}
          {canResume && (
            <button onClick={() => onStatusChange('en_cours')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-200 transition-colors">
              <Play size={11} /> Reprendre
            </button>
          )}
          {canTerminer && (
            <button onClick={onTerminer}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              <CheckCircle2 size={11} /> Terminer
            </button>
          )}

          {/* Print */}
          <button onClick={onPrint}
            title="Imprimer le CR"
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors">
            <Printer size={14} />
          </button>

          {/* Overflow menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors">
              <MoreVertical size={14} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-9 z-50 w-48 bg-white border border-gray-200 rounded-xl shadow-xl py-1">
                  {([
                    { label: 'Voir le patient',    action: () => setLocation(`/patients/${c.patientId}`) },
                    c.admissionId ? { label: "Voir l'admission", action: () => setLocation('/admissions') } : null,
                    { label: 'Imprimer le CR',     action: () => onPrint() },
                    { label: 'Annuler la consultation', action: () => onStatusChange('annulee'), danger: true },
                  ] as any[]).filter(Boolean).map((item: any) => (
                    <button key={item.label} onClick={() => { setMenuOpen(false); item.action(); }}
                      className={cn('flex w-full px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors',
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

      {/* ── Row 2: patient info bar ──────────────────────────────────────── */}
      <div className="flex items-start gap-3 px-4 lg:px-6 py-2.5 bg-gradient-to-r from-blue-50/60 to-indigo-50/30">

        {/* Avatar */}
        <div className="shrink-0 mt-0.5">
          <PatientAvatar
            firstName={nameParts[nameParts.length - 1] ?? ''}
            lastName={nameParts[0] ?? ''}
            size="sm"
          />
        </div>

        {/* Patient identity block */}
        <div className="flex-1 min-w-0">

          {/* Name + demography */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900">{c.patientName}</span>
            <span className="font-mono text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{c.patientMpi}</span>

            {/* Age · Gender · Blood type */}
            <span className="text-xs text-gray-500">
              {age}
              {gender && <span className="ml-1">{gender === 'M' ? '♂' : '♀'}</span>}
              {bloodType && <span className="ml-1 font-medium text-blue-600">{bloodType}</span>}
            </span>

            {/* Allergies */}
            {(allergies as string[]).map((a: string) => (
              <span key={a} className="flex items-center gap-1 text-xs bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-full font-medium">
                <ShieldAlert size={10} /> {a}
              </span>
            ))}

            {/* Chronic diseases as small chips */}
            {(diseases as string[]).slice(0, 2).map((d: string) => (
              <span key={d} className="text-xs bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded-full">
                {d}
              </span>
            ))}
            {diseases.length > 2 && (
              <span className="text-xs text-gray-400">+{diseases.length - 2}</span>
            )}
          </div>

          {/* Doctor + Service + Specialty + Badges */}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-xs text-gray-600 font-medium">{c.doctorName}</span>
            <span className="text-gray-300 text-xs">·</span>
            <span className="text-xs text-gray-500">{c.specialty}</span>
            <span className="text-gray-300 text-xs">·</span>
            <span className="text-xs text-gray-500">{c.serviceName}</span>
            <span className="text-gray-300 text-xs">·</span>

            {/* Status badge */}
            <ConsultationStatusBadge status={c.status} size="sm" />

            {/* Type badge */}
            <ConsultationTypeBadge type={c.type} />

            {/* Priority badge (if not normale) */}
            {priority && priority !== 'normale' && (() => {
              const cfg = PRIORITY_CFG[priority];
              return (
                <span className={cn('flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-semibold border', cfg.bg, cfg.color, 'border-current/20')}>
                  <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
                  {cfg.label}
                </span>
              );
            })()}

            {/* Admission link */}
            {c.admissionId && (
              <span className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">
                Lié à l'admission
              </span>
            )}
          </div>
        </div>

        {/* Scheduled date/time (right) */}
        <div className="text-right text-xs text-gray-500 shrink-0 hidden sm:block">
          <p className="font-medium text-gray-700">
            {new Date(c.scheduledAt).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          <p className="font-mono">{c.scheduledAt.substring(11, 16)}</p>
        </div>
      </div>
    </div>
  );
}
