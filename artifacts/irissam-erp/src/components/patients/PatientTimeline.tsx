import { useState } from 'react';
import {
  FileText, UserPlus, RefreshCw, Calendar, Bed, FlaskConical, LogOut,
  Stethoscope, Pill, Microscope, Scan, AlertCircle, Receipt, CreditCard,
  FilePen, ArrowRight,
} from 'lucide-react';
import { useLanguage } from '@/i18n';
import type { PatientTimelineEvent, TimelineEventType } from '@/types';
import { formatDate, formatTime } from '@/utils/format';

const EVENT_CONFIG: Record<TimelineEventType, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  creation:        { icon: UserPlus,    color: 'text-blue-600',    bg: 'bg-blue-100',    label: 'Création du dossier' },
  update:          { icon: RefreshCw,   color: 'text-gray-600',    bg: 'bg-gray-100',    label: 'Modification dossier' },
  document:        { icon: FileText,    color: 'text-purple-600',  bg: 'bg-purple-100',  label: 'Document ajouté' },
  document_update: { icon: FilePen,     color: 'text-indigo-600',  bg: 'bg-indigo-100',  label: 'Document modifié' },
  appointment:     { icon: Calendar,    color: 'text-green-600',   bg: 'bg-green-100',   label: 'Rendez-vous' },
  admission:       { icon: Bed,         color: 'text-orange-600',  bg: 'bg-orange-100',  label: 'Admission' },
  result:          { icon: FlaskConical,color: 'text-teal-600',    bg: 'bg-teal-100',    label: 'Résultat laboratoire' },
  discharge:       { icon: LogOut,      color: 'text-red-600',     bg: 'bg-red-100',     label: 'Sortie' },
  consultation:    { icon: Stethoscope, color: 'text-indigo-600',  bg: 'bg-indigo-100',  label: 'Consultation' },
  prescription:    { icon: Pill,        color: 'text-violet-600',  bg: 'bg-violet-100',  label: 'Prescription' },
  laboratory:      { icon: Microscope,  color: 'text-teal-600',    bg: 'bg-teal-100',    label: 'Analyse laboratoire' },
  imaging:         { icon: Scan,        color: 'text-cyan-600',    bg: 'bg-cyan-100',    label: 'Imagerie' },
  hospitalization: { icon: Bed,         color: 'text-orange-600',  bg: 'bg-orange-100',  label: 'Hospitalisation' },
  emergency:       { icon: AlertCircle, color: 'text-red-600',     bg: 'bg-red-100',     label: 'Urgence' },
  invoice:         { icon: Receipt,     color: 'text-yellow-600',  bg: 'bg-yellow-100',  label: 'Facture' },
  payment:         { icon: CreditCard,  color: 'text-emerald-600', bg: 'bg-emerald-100', label: 'Paiement' },
};

// Medical pathway: ordered steps a patient typically goes through
const MEDICAL_PATHWAY: Array<{ type: TimelineEventType; label: string }> = [
  { type: 'consultation',    label: 'Consultation' },
  { type: 'prescription',    label: 'Prescription' },
  { type: 'laboratory',      label: 'Analyse' },
  { type: 'result',          label: 'Résultat' },
  { type: 'imaging',         label: 'Radiologie' },
  { type: 'admission',       label: 'Admission' },
  { type: 'hospitalization', label: 'Hospitalisation' },
  { type: 'discharge',       label: 'Sortie' },
];

interface Props {
  events: PatientTimelineEvent[];
}

export function PatientTimeline({ events }: Props) {
  const { t } = useLanguage();
  const [activeView, setActiveView] = useState<'timeline' | 'pathway'>('timeline');

  const presentTypes = new Set(events.map(e => e.type));

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        <button
          onClick={() => setActiveView('timeline')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activeView === 'timeline' ? 'bg-white shadow-sm text-gray-800 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Historique complet
        </button>
        <button
          onClick={() => setActiveView('pathway')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activeView === 'pathway' ? 'bg-white shadow-sm text-gray-800 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Parcours médical
        </button>
      </div>

      {/* ─── TIMELINE VIEW ─── */}
      {activeView === 'timeline' && (
        <>
          {events.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t('pat.timeline.empty')}</p>
            </div>
          ) : (
            <div className="space-y-0 max-w-2xl">
              {events.map((event, idx) => {
                const cfg = EVENT_CONFIG[event.type] ?? EVENT_CONFIG.update;
                const { icon: Icon, color, bg } = cfg;
                const isLast = idx === events.length - 1;
                return (
                  <div key={event.id} className="flex gap-4 group">
                    <div className="flex flex-col items-center">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${bg}`}>
                        <Icon size={16} className={color} />
                      </div>
                      {!isLast && <div className="w-px flex-1 bg-gray-200 mt-1 mb-1" />}
                    </div>
                    <div className="pb-6 flex-1">
                      <div className="bg-white border border-gray-100 rounded-xl p-3 group-hover:border-gray-200 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-800">{event.title}</p>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${bg} ${color} font-medium`}>
                                {cfg.label}
                              </span>
                            </div>
                            {event.description && (
                              <p className="text-xs text-gray-500 mt-0.5">{event.description}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-1.5">
                              {t('pat.timeline.by')} <span className="font-medium text-gray-600">{event.userName}</span>
                              {' — '}{event.siteName}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-medium text-gray-600">{formatDate(event.createdAt)}</p>
                            <p className="text-xs text-gray-400">{formatTime(event.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ─── PATHWAY VIEW ─── */}
      {activeView === 'pathway' && (
        <div className="max-w-3xl">
          <p className="text-xs text-gray-500 mb-4">Étapes du parcours médical — les étapes vérifiées sont celles réellement enregistrées dans le dossier.</p>
          <div className="flex flex-wrap items-center gap-1">
            {MEDICAL_PATHWAY.map((step, idx) => {
              const done = presentTypes.has(step.type);
              const cfg = EVENT_CONFIG[step.type];
              const Icon = cfg.icon;
              const isLast = idx === MEDICAL_PATHWAY.length - 1;
              return (
                <div key={step.type} className="flex items-center gap-1">
                  <div className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border transition-all ${
                    done
                      ? `${cfg.bg} border-transparent`
                      : 'bg-gray-50 border-gray-200 opacity-50'
                  }`}>
                    <Icon size={18} className={done ? cfg.color : 'text-gray-400'} />
                    <span className={`text-xs font-medium whitespace-nowrap ${done ? cfg.color : 'text-gray-400'}`}>
                      {step.label}
                    </span>
                    {done && (
                      <span className="text-xs text-green-600 font-semibold">✓</span>
                    )}
                  </div>
                  {!isLast && (
                    <ArrowRight size={14} className="text-gray-300 flex-shrink-0 mx-0.5" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-blue-100" />
              <span>Étape effectuée</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-gray-100 border border-gray-200" />
              <span>Non effectuée</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
