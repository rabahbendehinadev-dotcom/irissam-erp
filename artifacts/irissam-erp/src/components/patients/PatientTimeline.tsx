import { useState } from 'react';
import {
  FileText, UserPlus, RefreshCw, Calendar, Bed, FlaskConical, LogOut,
  Stethoscope, Pill, Microscope, Scan, AlertCircle, Receipt, CreditCard,
  FilePen, ArrowRight, Syringe, User,
} from 'lucide-react';
import { useLanguage } from '@/i18n';
import { cn } from '@/lib/utils';
import type { PatientTimelineEvent, TimelineEventType } from '@/types';
import { formatDate, formatTime } from '@/utils/format';

const EVENT_CONFIG: Record<TimelineEventType, { icon: React.ElementType; color: string; bg: string; border: string; label: string }> = {
  creation:        { icon: UserPlus,    color: 'text-blue-600',    bg: 'bg-blue-100',    border: 'border-blue-200',    label: 'Création du dossier' },
  update:          { icon: RefreshCw,   color: 'text-gray-600',    bg: 'bg-gray-100',    border: 'border-gray-200',    label: 'Modification dossier' },
  document:        { icon: FileText,    color: 'text-purple-600',  bg: 'bg-purple-100',  border: 'border-purple-200',  label: 'Document ajouté' },
  document_update: { icon: FilePen,     color: 'text-indigo-600',  bg: 'bg-indigo-100',  border: 'border-indigo-200',  label: 'Document modifié' },
  appointment:     { icon: Calendar,    color: 'text-green-600',   bg: 'bg-green-100',   border: 'border-green-200',   label: 'Rendez-vous' },
  admission:       { icon: Bed,         color: 'text-orange-600',  bg: 'bg-orange-100',  border: 'border-orange-200',  label: 'Admission' },
  result:          { icon: FlaskConical,color: 'text-teal-600',    bg: 'bg-teal-100',    border: 'border-teal-200',    label: 'Résultat laboratoire' },
  discharge:       { icon: LogOut,      color: 'text-red-600',     bg: 'bg-red-100',     border: 'border-red-200',     label: 'Sortie' },
  consultation:    { icon: Stethoscope, color: 'text-indigo-600',  bg: 'bg-indigo-100',  border: 'border-indigo-200',  label: 'Consultation' },
  prescription:    { icon: Pill,        color: 'text-violet-600',  bg: 'bg-violet-100',  border: 'border-violet-200',  label: 'Prescription' },
  laboratory:      { icon: Microscope,  color: 'text-teal-600',    bg: 'bg-teal-100',    border: 'border-teal-200',    label: 'Analyse laboratoire' },
  imaging:         { icon: Scan,        color: 'text-cyan-600',    bg: 'bg-cyan-100',    border: 'border-cyan-200',    label: 'Imagerie' },
  hospitalization: { icon: Bed,         color: 'text-orange-700',  bg: 'bg-orange-100',  border: 'border-orange-200',  label: 'Hospitalisation' },
  emergency:       { icon: AlertCircle, color: 'text-red-600',     bg: 'bg-red-100',     border: 'border-red-200',     label: 'Urgence' },
  invoice:         { icon: Receipt,     color: 'text-yellow-600',  bg: 'bg-yellow-100',  border: 'border-yellow-200',  label: 'Facture' },
  payment:         { icon: CreditCard,  color: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-200', label: 'Paiement' },
  vaccination:     { icon: Syringe,     color: 'text-lime-700',    bg: 'bg-lime-100',    border: 'border-lime-200',    label: 'Vaccination' },
};

// Type filter groups
const FILTER_GROUPS: { key: string; label: string; types: TimelineEventType[] }[] = [
  { key: 'all',          label: 'Tout',              types: [] },
  { key: 'clinical',     label: 'Clinique',          types: ['consultation', 'prescription', 'laboratory', 'result', 'imaging', 'emergency'] },
  { key: 'hospitalizations', label: 'Hospitalisations', types: ['admission', 'hospitalization', 'discharge'] },
  { key: 'prevention',   label: 'Prévention',        types: ['vaccination', 'appointment'] },
  { key: 'financier',    label: 'Financier',          types: ['invoice', 'payment'] },
  { key: 'admin',        label: 'Administratif',     types: ['creation', 'update', 'document', 'document_update'] },
];

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
  const [activeView,   setActiveView]   = useState<'timeline' | 'pathway'>('timeline');
  const [activeFilter, setActiveFilter] = useState('all');

  // Sort descending (newest first)
  const sorted = [...events].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filterGroup = FILTER_GROUPS.find(g => g.key === activeFilter);
  const filtered = activeFilter === 'all'
    ? sorted
    : sorted.filter(e => (filterGroup?.types ?? []).includes(e.type));

  const presentTypes = new Set(events.map(e => e.type));

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* View toggle */}
        <div className="flex items-center gap-0.5 p-1 bg-gray-100 rounded-lg">
          {['timeline', 'pathway'].map(v => (
            <button key={v} onClick={() => setActiveView(v as any)}
              className={cn('px-3 py-1.5 text-sm rounded-md transition-colors',
                activeView === v ? 'bg-white shadow-sm text-gray-800 font-medium' : 'text-gray-500 hover:text-gray-700')}>
              {v === 'timeline' ? 'Historique complet' : 'Parcours médical'}
            </button>
          ))}
        </div>

        {/* Type filters (timeline mode only) */}
        {activeView === 'timeline' && (
          <div className="flex items-center gap-1 flex-wrap">
            {FILTER_GROUPS.map(g => (
              <button key={g.key} onClick={() => setActiveFilter(g.key)}
                className={cn('px-3 py-1.5 text-xs rounded-lg border transition-colors',
                  activeFilter === g.key
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300')}>
                {g.label}
                <span className={cn('ml-1 font-semibold', activeFilter === g.key ? 'text-blue-100' : 'text-gray-400')}>
                  {g.key === 'all'
                    ? events.length
                    : events.filter(e => g.types.includes(e.type)).length}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── TIMELINE VIEW ─── */}
      {activeView === 'timeline' && (
        <>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t('pat.timeline.empty')}</p>
            </div>
          ) : (
            <div className="space-y-0 max-w-3xl">
              {filtered.map((event, idx) => {
                const cfg = EVENT_CONFIG[event.type] ?? EVENT_CONFIG.update;
                const { icon: Icon, color, bg, border } = cfg;
                const isLast = idx === filtered.length - 1;
                return (
                  <div key={event.id} className="flex gap-4 group">
                    {/* Connector */}
                    <div className="flex flex-col items-center">
                      <div className={cn('w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border', bg, border)}>
                        <Icon size={15} className={color} />
                      </div>
                      {!isLast && <div className="w-px flex-1 bg-gray-200 mt-1 mb-1" />}
                    </div>

                    {/* Card */}
                    <div className="pb-5 flex-1 min-w-0">
                      <div className="bg-white border border-gray-100 rounded-xl p-3.5 group-hover:border-gray-200 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {/* Title + type badge */}
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <p className="text-sm font-semibold text-gray-800">{event.title}</p>
                              <span className={cn('text-xs px-1.5 py-0.5 rounded-full border font-medium', bg, color, border)}>
                                {cfg.label}
                              </span>
                            </div>

                            {/* Description */}
                            {event.description && (
                              <p className="text-xs text-gray-600 mb-1.5">{event.description}</p>
                            )}

                            {/* Meta: doctor, service, site */}
                            <div className="flex items-center gap-3 flex-wrap text-xs text-gray-400">
                              {event.doctor ? (
                                <span className="flex items-center gap-1">
                                  <User size={10} className="text-gray-400" />
                                  <span className="text-gray-600 font-medium">{event.doctor}</span>
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <User size={10} />
                                  <span>{event.userName}</span>
                                </span>
                              )}
                              {event.service && (
                                <>
                                  <span className="text-gray-200">·</span>
                                  <span className={cn('px-1.5 py-0.5 rounded-full text-xs', bg, color)}>{event.service}</span>
                                </>
                              )}
                              {!event.service && (
                                <>
                                  <span className="text-gray-200">·</span>
                                  <span>{event.siteName}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Date/time */}
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-semibold text-gray-700">{formatDate(event.createdAt)}</p>
                            <p className="text-xs text-gray-400 font-mono">{formatTime(event.createdAt)}</p>
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
              const cfg  = EVENT_CONFIG[step.type];
              const Icon = cfg.icon;
              const isLast = idx === MEDICAL_PATHWAY.length - 1;
              return (
                <div key={step.type} className="flex items-center gap-1">
                  <div className={cn('flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border transition-all',
                    done ? `${cfg.bg} ${cfg.border}` : 'bg-gray-50 border-gray-200 opacity-50')}>
                    <Icon size={18} className={done ? cfg.color : 'text-gray-400'} />
                    <span className={cn('text-xs font-medium whitespace-nowrap', done ? cfg.color : 'text-gray-400')}>
                      {step.label}
                    </span>
                    {done && <span className="text-xs text-green-600 font-bold">✓</span>}
                  </div>
                  {!isLast && <ArrowRight size={14} className="text-gray-300 flex-shrink-0 mx-0.5" />}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-100 border border-blue-200" /><span>Effectuée</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-gray-100 border border-gray-200" /><span>Non effectuée</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
