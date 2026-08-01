import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  ArrowLeft, Printer, Save, CheckCircle2, Clock, User, Stethoscope,
  Pause, Play, X, FileDown, AlertCircle, Wifi, WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmergencyPriorityBadge, PRIORITY_CFG } from '@/components/emergencies/EmergencyPriorityBadge';
import { useEmergencyDossier } from '@/contexts/EmergencyDossierContext';
import { usePermission } from '@/hooks/usePermission';

// ─── Status label map ─────────────────────────────────────────────────────────

export const WORKFLOW_LABELS: Record<string, { label: string; cls: string }> = {
  arrive:             { label: 'Arrivé',               cls: 'bg-gray-100 text-gray-700 border-gray-300' },
  en_triage:          { label: 'En triage',             cls: 'bg-purple-100 text-purple-700 border-purple-300' },
  attente_medecin:    { label: 'Attente médecin',       cls: 'bg-orange-100 text-orange-700 border-orange-300' },
  en_prise_en_charge: { label: 'En prise en charge',    cls: 'bg-blue-100 text-blue-700 border-blue-300' },
  en_soins:           { label: 'En soins',              cls: 'bg-blue-200 text-blue-800 border-blue-400' },
  en_observation:     { label: 'En observation',        cls: 'bg-teal-100 text-teal-700 border-teal-300' },
  attente_resultats:  { label: 'Attente résultats',     cls: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  decision_attente:   { label: 'Décision en attente',   cls: 'bg-amber-100 text-amber-700 border-amber-300' },
  hospitalise:        { label: 'Hospitalisé',           cls: 'bg-green-100 text-green-700 border-green-300' },
  transfere:          { label: 'Transféré',             cls: 'bg-cyan-100 text-cyan-700 border-cyan-300' },
  sorti:              { label: 'Sorti',                 cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  decede:             { label: 'Décédé',                cls: 'bg-gray-800 text-white border-gray-900' },
  cloture:            { label: 'Dossier clôturé',       cls: 'bg-slate-200 text-slate-700 border-slate-400' },
};

function waitDuration(arrivalIso: string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(arrivalIso).getTime()) / 60_000));
  const h = Math.floor(diff / 60), m = diff % 60;
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}min` : `${m} min`;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DossierHeader() {
  const { dossier, patient, saveState, lastSaved, startCare, suspendCare, closeFile, triggerSave, appendAudit } = useEmergencyDossier();
  const { can } = usePermission();
  const [, setLocation] = useLocation();
  const [waitStr, setWaitStr] = useState('');

  useEffect(() => {
    if (!patient) return;
    const update = () => setWaitStr(waitDuration(patient.arrivalTime));
    update();
    const iv = setInterval(update, 30_000);
    return () => clearInterval(iv);
  }, [patient]);

  if (!patient) return null;

  const pCfg = PRIORITY_CFG[patient.priority];
  const statusCfg = WORKFLOW_LABELS[dossier.workflowStatus] ?? { label: dossier.workflowStatus, cls: 'bg-gray-100 text-gray-600' };
  const isClosed = dossier.workflowStatus === 'cloture';
  const careActive = ['en_prise_en_charge', 'en_soins', 'en_observation'].includes(dossier.workflowStatus);
  const canStart = can('emergencies.start_care');
  const canClose = can('emergencies.close');
  const canPrint = can('emergencies.print');
  const canExport = can('emergencies.export');

  return (
    <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm print:hidden">
      {/* Row 1: identity */}
      <div className="flex items-center gap-2 px-4 pt-2.5 pb-1.5 flex-wrap">
        <button
          onClick={() => setLocation('/emergencies')}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-300 rounded-lg px-2 py-1.5 transition-colors flex-shrink-0"
        >
          <ArrowLeft size={13} />Urgences
        </button>

        <EmergencyPriorityBadge priority={patient.priority} size="md" showLabel="both" />

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h1 className="font-black text-gray-900 text-sm leading-none truncate">
              {patient.lastName} {patient.firstName}
            </h1>
            <span className="text-xs text-gray-400">{patient.age} ans · {patient.gender === 'M' ? 'M' : 'F'}</span>
            <span className="text-[10px] text-gray-400 font-mono">MPI {patient.mpiId}</span>
            <span className="text-[10px] text-gray-400 font-mono">#{dossier.dossierNumber}</span>
            {dossier.bloodType && (
              <span className="text-[10px] font-bold bg-red-100 text-red-700 border border-red-300 px-1.5 py-0.5 rounded-full">{dossier.bloodType}</span>
            )}
            {dossier.rareBloodType && (
              <span className="text-[10px] font-bold bg-red-200 text-red-800 border border-red-400 px-1.5 py-0.5 rounded-full">Groupe rare</span>
            )}
            {patient.isMinor && (
              <span className="text-[10px] font-bold bg-yellow-100 text-yellow-800 border border-yellow-300 px-1.5 py-0.5 rounded-full">MINEUR</span>
            )}
            {patient.byAmbulance && (
              <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full">🚑 SMUR</span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', statusCfg.cls)}>
              {statusCfg.label}
            </span>
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <Clock size={9} />Arrivée {fmt(patient.arrivalTime)}
            </span>
            {dossier.triageStartTime && (
              <span className="text-[10px] text-gray-400">Triage {fmt(dossier.triageStartTime)}</span>
            )}
            {dossier.careStartTime && (
              <span className="text-[10px] text-gray-400">Prise en charge {fmt(dossier.careStartTime)}</span>
            )}
            <span className="text-[10px] font-semibold text-amber-600 flex items-center gap-1">
              ⏱ {waitStr || waitDuration(patient.arrivalTime)}
            </span>
            {patient.assignedDoctor && (
              <span className="text-[10px] text-gray-500 flex items-center gap-1">
                <Stethoscope size={9} />{patient.assignedDoctor}
              </span>
            )}
            {patient.assignedNurse && (
              <span className="text-[10px] text-gray-500 flex items-center gap-1">
                <User size={9} />{patient.assignedNurse}
              </span>
            )}
            {patient.assignedRoom && (
              <span className="text-[10px] text-gray-500">🛏 {patient.assignedRoom}</span>
            )}
          </div>
        </div>

        {/* Save indicator + actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto flex-wrap">
          {/* Sync state */}
          <span className={cn('flex items-center gap-1 text-[10px] font-medium px-1.5 py-1 rounded-lg',
            saveState === 'saving' ? 'text-amber-600 bg-amber-50 animate-pulse' :
            saveState === 'saved'  ? 'text-green-600 bg-green-50' :
            saveState === 'error'  ? 'text-red-600 bg-red-50' :
            'text-gray-400',
          )}>
            {saveState === 'saving' ? <><Wifi size={10} />Synchronisation…</> :
             saveState === 'saved'  ? <><CheckCircle2 size={10} />{lastSaved ? `Sauvegardé ${fmt(lastSaved)}` : 'Sauvegardé'}</> :
             saveState === 'error'  ? <><WifiOff size={10} />Erreur de sync</> : null}
          </span>

          {/* Workflow action buttons */}
          {canStart && !careActive && !isClosed && (
            <button
              onClick={startCare}
              className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg px-2.5 py-1.5 font-semibold transition-colors"
            >
              <Play size={12} fill="white" />Commencer
            </button>
          )}
          {canStart && careActive && (
            <button
              onClick={suspendCare}
              className="flex items-center gap-1 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-2.5 py-1.5 font-semibold transition-colors"
            >
              <Pause size={12} />Suspendre
            </button>
          )}
          {canStart && dossier.workflowStatus === 'attente_medecin' && (
            <button
              onClick={startCare}
              className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-2.5 py-1.5 font-semibold transition-colors"
            >
              <Play size={12} />Reprendre
            </button>
          )}

          <button
            onClick={triggerSave}
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-200 hover:border-gray-400 rounded-lg px-2 py-1.5 transition-colors"
          >
            <Save size={12} />Sauvegarder
          </button>
          {canPrint && (
            <button
              onClick={() => { appendAudit({ action: 'Impression du dossier', category: 'system', details: '' }); window.print(); }}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-200 hover:border-gray-400 rounded-lg px-2 py-1.5 transition-colors"
            >
              <Printer size={12} />Imprimer
            </button>
          )}
          {canExport && (
            <button
              onClick={() => appendAudit({ action: 'Export PDF demandé', category: 'system', details: '' })}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-200 hover:border-gray-400 rounded-lg px-2 py-1.5 transition-colors"
            >
              <FileDown size={12} />PDF
            </button>
          )}
          {canClose && !isClosed && (
            <button
              onClick={closeFile}
              className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 border border-red-200 hover:border-red-400 rounded-lg px-2 py-1.5 transition-colors"
            >
              <X size={12} />Clôturer
            </button>
          )}
          {isClosed && (
            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-300 px-2 py-1 rounded-lg">
              Dossier clôturé
            </span>
          )}
        </div>
      </div>

      {/* Motif strip */}
      {patient.chiefComplaint && (
        <div className="flex items-center gap-2 px-4 pb-2 text-[11px] text-gray-600 border-t border-gray-50 pt-1">
          <AlertCircle size={10} className="text-gray-400 flex-shrink-0" />
          <span className="truncate">{patient.chiefComplaint}</span>
        </div>
      )}
    </div>
  );
}
