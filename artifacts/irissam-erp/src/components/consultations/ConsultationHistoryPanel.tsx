import { useState } from 'react';
import { Clock, History, Shield, ChevronRight } from 'lucide-react';
import type { Consultation, ConsultationVersion } from '@/types/consultation';

// ─── Mock audit entries ───────────────────────────────────────────────────────

const MOCK_AUDIT = [
  { id: 1, user: 'Dr Karim Benamara',  role: 'Médecin',     action: 'Ouverture consultation',      at: '08:05',  device: 'PC-MED-01' },
  { id: 2, user: 'Inf. Sara Medjdoub', role: 'Infirmier',   action: 'Saisie des signes vitaux',    at: '08:08',  device: 'TAB-NRS-03' },
  { id: 3, user: 'Dr Karim Benamara',  role: 'Médecin',     action: 'Ajout diagnostic principal',  at: '08:12',  device: 'PC-MED-01' },
  { id: 4, user: 'Dr Karim Benamara',  role: 'Médecin',     action: 'Prescription créée',          at: '08:18',  device: 'PC-MED-01' },
  { id: 5, user: 'Dr Karim Benamara',  role: 'Médecin',     action: 'Demande analyse ajoutée',     at: '08:22',  device: 'PC-MED-01' },
  { id: 6, user: 'Dr Karim Benamara',  role: 'Médecin',     action: 'Plan de suivi complété',      at: '08:28',  device: 'PC-MED-01' },
  { id: 7, user: 'Dr Karim Benamara',  role: 'Médecin',     action: 'Consultation terminée',       at: '08:32',  device: 'PC-MED-01' },
];

// ─── Timeline ─────────────────────────────────────────────────────────────────

interface TimelineEvent {
  time: string;
  title: string;
  desc?: string;
  color: string;
  icon: string;
}

function buildTimeline(c: Consultation): TimelineEvent[] {
  const events: TimelineEvent[] = [
    { time: c.scheduledAt.substring(11, 16), title: 'Consultation planifiée', desc: `Type : ${c.type} · Motif : ${c.reason}`, color: 'bg-gray-200', icon: '📋' },
  ];
  if (c.startedAt) events.push({ time: c.startedAt.substring(11, 16), title: 'Consultation démarrée', desc: `Médecin : ${c.doctorName}`, color: 'bg-blue-400', icon: '▶️' });
  if (c.vitalSigns) events.push({ time: '-', title: 'Signes vitaux saisis', desc: c.vitalSigns.temperature ? `T° ${c.vitalSigns.temperature}°C · TA ${c.vitalSigns.systolicBP}/${c.vitalSigns.diastolicBP} mmHg` : undefined, color: 'bg-teal-400', icon: '❤️' });
  if (c.clinicalExam) events.push({ time: '-', title: 'Examen clinique renseigné', color: 'bg-indigo-400', icon: '🩺' });
  if ((c.diagnoses?.length ?? 0) > 0) events.push({ time: '-', title: `${c.diagnoses!.length} diagnostic(s) posé(s)`, desc: c.diagnoses![0]?.label, color: 'bg-purple-400', icon: '📊' });
  if ((c.prescriptions?.length ?? 0) > 0) events.push({ time: '-', title: `Ordonnance : ${c.prescriptions!.length} médicament(s)`, color: 'bg-green-400', icon: '💊' });
  if ((c.labOrders?.length ?? 0) > 0) events.push({ time: '-', title: `${c.labOrders!.length} analyse(s) demandée(s)`, color: 'bg-teal-500', icon: '🧪' });
  if ((c.imagingOrders?.length ?? 0) > 0) events.push({ time: '-', title: `${c.imagingOrders!.length} examen(s) d\'imagerie`, color: 'bg-cyan-400', icon: '🔬' });
  if ((c.documents?.length ?? 0) > 0) events.push({ time: '-', title: `${c.documents!.length} document(s) généré(s)`, color: 'bg-violet-400', icon: '📝' });
  if (c.followUp?.controlDate) events.push({ time: '-', title: 'Plan de suivi établi', desc: `Contrôle : ${c.followUp.controlDate}`, color: 'bg-orange-400', icon: '📅' });
  if (c.endedAt) events.push({ time: c.endedAt.substring(11, 16), title: 'Consultation terminée', desc: c.duration ? `Durée : ${c.duration} min` : undefined, color: 'bg-green-500', icon: '✅' });
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
          <div className={`pb-4 ${i < events.length - 1 ? '' : ''}`}>
            <div className="flex items-center gap-2">
              <span className="text-base">{evt.icon}</span>
              <span className="font-medium text-sm text-gray-800">{evt.title}</span>
              {evt.time !== '-' && <span className="text-xs text-gray-400 font-mono">{evt.time}</span>}
            </div>
            {evt.desc && <p className="text-xs text-gray-500 mt-0.5 ml-6">{evt.desc}</p>}
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

// ─── Audit ───────────────────────────────────────────────────────────────────

function AuditTab() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {['Heure', 'Utilisateur', 'Rôle', 'Action', 'Appareil'].map(h => (
              <th key={h} className="text-left px-3 py-2 font-semibold text-gray-500 uppercase tracking-wide text-xs">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {MOCK_AUDIT.map(entry => (
            <tr key={entry.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-mono text-gray-500">{entry.at}</td>
              <td className="px-3 py-2 font-medium text-gray-800">{entry.user}</td>
              <td className="px-3 py-2">
                <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{entry.role}</span>
              </td>
              <td className="px-3 py-2 text-gray-700">{entry.action}</td>
              <td className="px-3 py-2 text-gray-400 font-mono">{entry.device}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'timeline', label: 'Chronologie',     icon: Clock },
  { id: 'versions', label: 'Versions',         icon: History },
  { id: 'audit',    label: 'Journal d\'audit', icon: Shield },
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
      {tab === 'audit' && <AuditTab />}
    </div>
  );
}
