import { useState } from 'react';
import { Clock, History } from 'lucide-react';
import type { Consultation, ConsultationVersion } from '@/types/consultation';

// ─── Chronologie — dérivée uniquement des champs PostgreSQL réels ─────────────

interface TimelineEvent {
  time: string;
  title: string;
  desc?: string;
  color: string;
  icon: string;
}

function hhmm(iso?: string): string {
  if (!iso || iso.length < 16) return '—';
  return iso.substring(11, 16);
}

function buildTimeline(c: Consultation): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      time: hhmm(c.scheduledAt ?? c.createdAt),
      title: 'Consultation planifiée',
      desc: c.reason ? `Motif : ${c.reason}` : undefined,
      color: 'bg-gray-200',
      icon: '📋',
    },
  ];
  if (c.startedAt) {
    events.push({ time: hhmm(c.startedAt), title: 'Consultation démarrée', desc: `Médecin : ${c.doctorName}`, color: 'bg-blue-400', icon: '▶️' });
  }
  if (c.diagnosis?.trim()) {
    events.push({ time: '-', title: 'Diagnostic renseigné', desc: c.diagnosis, color: 'bg-purple-400', icon: '📊' });
  }
  if (c.notes?.trim()) {
    events.push({ time: '-', title: 'Notes du dossier renseignées', color: 'bg-teal-400', icon: '📝' });
  }
  if (c.endedAt) {
    events.push({ time: hhmm(c.endedAt), title: 'Consultation terminée', desc: c.duration ? `Durée : ${c.duration} min` : undefined, color: 'bg-green-500', icon: '✅' });
  }
  return events;
}

function TimelineTab({ consultation }: { consultation: Consultation }) {
  const events = buildTimeline(consultation);
  return (
    <div className="space-y-0">
      {events.map((evt, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className={`w-3 h-3 rounded-full ${evt.color} flex-shrink-0 mt-0.5`} />
            {i < events.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
          </div>
          <div className="pb-4">
            <div className="flex items-center gap-2">
              <span className="text-base">{evt.icon}</span>
              <span className="font-medium text-sm text-gray-800">{evt.title}</span>
              {evt.time !== '-' && <span className="text-xs text-gray-400 font-mono">{evt.time}</span>}
            </div>
            {evt.desc && <p className="text-xs text-gray-500 mt-0.5 ml-6 line-clamp-2">{evt.desc}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Versions ─────────────────────────────────────────────────────────────────

function VersionsTab({ versions }: { versions?: ConsultationVersion[] }) {
  if (!versions || versions.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <History size={32} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">Aucune modification après clôture</p>
        <p className="text-xs mt-1">Les modifications après "Terminer" créent une nouvelle version ici.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {versions.map(v => (
        <div key={v.version} className="border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm">Version {v.version}</span>
            <span className="text-xs text-gray-400 font-mono">{v.modifiedAt.substring(0, 16).replace('T', ' à ')}</span>
          </div>
          <p className="text-xs text-gray-600 mt-1">Par <strong>{v.modifiedBy}</strong></p>
          {v.reason && <p className="text-xs text-gray-500 mt-1 italic">Motif : {v.reason}</p>}
        </div>
      ))}
    </div>
  );
}

// ─── Panneau ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'timeline', label: 'Chronologie', icon: Clock },
  { id: 'versions', label: 'Versions',    icon: History },
];

interface Props { consultation: Consultation }

export function ConsultationHistoryPanel({ consultation }: Props) {
  const [tab, setTab] = useState('timeline');
  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? 'border-blue-500 text-blue-700 font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'timeline' && <TimelineTab consultation={consultation} />}
      {tab === 'versions' && <VersionsTab versions={consultation.versions} />}
    </div>
  );
}
