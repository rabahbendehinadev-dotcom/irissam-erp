import { useState } from 'react';
import {
  Clock, FlaskConical, Scan, Pill, FileText, CheckCircle2, X,
  Printer, ChevronRight, Activity, User, MapPin, Stethoscope, Heart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEmergencyDossier } from '@/contexts/EmergencyDossierContext';

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('fr-DZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ─── Event types ──────────────────────────────────────────────────────────────

type TEventKind = 'arrival' | 'triage' | 'doctor' | 'nurse' | 'room'
  | 'vitals' | 'lab_req' | 'lab_res' | 'img_req' | 'img_res'
  | 'prescription' | 'administered' | 'procedure' | 'note' | 'decision' | 'status';

interface TEvent {
  id: string;
  time: string;
  kind: TEventKind;
  label: string;
  detail: string;
  by?: string;
  highlight?: boolean;
}

const KIND_CFG: Record<TEventKind, { icon: React.ReactNode; dot: string; card: string }> = {
  arrival:      { icon: <Clock size={11} />,       dot: 'bg-blue-500',   card: 'border-blue-200 bg-blue-50' },
  triage:       { icon: <Activity size={11} />,    dot: 'bg-purple-500', card: 'border-purple-200 bg-purple-50' },
  doctor:       { icon: <Stethoscope size={11} />, dot: 'bg-blue-400',   card: 'border-blue-100 bg-blue-50' },
  nurse:        { icon: <User size={11} />,        dot: 'bg-sky-400',    card: 'border-sky-100 bg-sky-50' },
  room:         { icon: <MapPin size={11} />,      dot: 'bg-teal-400',   card: 'border-teal-100 bg-teal-50' },
  vitals:       { icon: <Heart size={11} />,       dot: 'bg-pink-500',   card: 'border-pink-100 bg-pink-50' },
  lab_req:      { icon: <FlaskConical size={11} />, dot: 'bg-green-500', card: 'border-green-100 bg-green-50' },
  lab_res:      { icon: <CheckCircle2 size={11} />, dot: 'bg-emerald-500',card: 'border-emerald-200 bg-emerald-50' },
  img_req:      { icon: <Scan size={11} />,        dot: 'bg-cyan-500',   card: 'border-cyan-100 bg-cyan-50' },
  img_res:      { icon: <CheckCircle2 size={11} />, dot: 'bg-cyan-600',  card: 'border-cyan-200 bg-cyan-50' },
  prescription: { icon: <Pill size={11} />,        dot: 'bg-amber-500',  card: 'border-amber-100 bg-amber-50' },
  administered: { icon: <CheckCircle2 size={11} />, dot: 'bg-orange-500',card: 'border-orange-100 bg-orange-50' },
  procedure:    { icon: <Activity size={11} />,    dot: 'bg-indigo-500', card: 'border-indigo-100 bg-indigo-50' },
  note:         { icon: <FileText size={11} />,    dot: 'bg-gray-400',   card: 'border-gray-100 bg-gray-50' },
  decision:     { icon: <CheckCircle2 size={11} />, dot: 'bg-red-500',   card: 'border-red-200 bg-red-50' },
  status:       { icon: <Activity size={11} />,    dot: 'bg-slate-500',  card: 'border-slate-100 bg-slate-50' },
};

// ─── Build events from dossier ────────────────────────────────────────────────

function useTimelineEvents(): TEvent[] {
  const { dossier, patient } = useEmergencyDossier();
  if (!patient) return [];

  const events: TEvent[] = [];
  let uid = 0;
  const id = () => `te-${uid++}`;

  // Arrival
  events.push({ id: id(), time: patient.arrivalTime, kind: 'arrival', label: 'Arrivée aux urgences', detail: patient.chiefComplaint, highlight: true });

  // Workflow transitions
  dossier.workflowHistory.forEach(t => {
    events.push({
      id: id(), time: t.at, kind: 'status',
      label: `Statut → ${t.to.replace(/_/g, ' ')}`,
      detail: t.notes ?? '', by: t.by,
    });
  });

  // Vitals
  dossier.vitalReadings.forEach((r, i) => {
    if (i % 2 !== 0 && i !== dossier.vitalReadings.length - 1) return; // sample
    events.push({
      id: id(), time: r.timestamp, kind: 'vitals',
      label: 'Constantes enregistrées',
      detail: [r.hr && `FC ${r.hr}`, r.bp && `PA ${r.bp}`, r.spo2 && `SpO₂ ${r.spo2}%`].filter(Boolean).join(' · '),
      by: r.recordedBy,
    });
  });

  // Lab requests & results
  dossier.labRequests.forEach(r => {
    events.push({ id: id(), time: r.requestedAt, kind: 'lab_req', label: `Analyse demandée: ${r.test}`, detail: `Priorité ${r.urgency}`, by: r.requestedBy });
    if (r.resultAt) events.push({ id: id(), time: r.resultAt, kind: 'lab_res', label: `Résultat: ${r.test}`, detail: r.result ?? '', highlight: r.isCritical });
  });

  // Imaging
  dossier.imagingRequests.forEach(r => {
    events.push({ id: id(), time: r.requestedAt, kind: 'img_req', label: `Imagerie: ${r.exam}`, detail: r.region, by: r.requestedBy });
    if (r.resultAt) events.push({ id: id(), time: r.resultAt, kind: 'img_res', label: `CR imagerie: ${r.exam}`, detail: r.result ?? '' });
  });

  // Prescriptions
  dossier.prescriptions.forEach(p => {
    events.push({ id: id(), time: p.prescribedAt, kind: 'prescription', label: `Prescrit: ${p.drug}`, detail: `${p.dosage} ${p.route}`, by: p.prescribedBy });
    if (p.administeredAt) events.push({ id: id(), time: p.administeredAt, kind: 'administered', label: `Administré: ${p.drug}`, detail: `Par ${p.administeredBy ?? '—'}` });
  });

  // Procedures
  dossier.procedures.forEach(p => {
    events.push({ id: id(), time: p.performedAt, kind: 'procedure', label: `Procédure: ${p.name}`, detail: p.notes ?? '', by: p.performedBy });
  });

  // Notes
  [...dossier.medicalNotes, ...dossier.nursingNotes].forEach(n => {
    events.push({ id: id(), time: n.createdAt, kind: 'note', label: `Note (${n.type})`, detail: n.content.slice(0, 80), by: n.author });
  });

  // Decision
  if (dossier.finalDecision.decidedAt && dossier.finalDecision.decision) {
    events.push({ id: id(), time: dossier.finalDecision.decidedAt, kind: 'decision', label: `Décision: ${dossier.finalDecision.decision}`, detail: dossier.finalDecision.notes, by: dossier.finalDecision.decidedBy, highlight: true });
  }

  return events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

function EventDrawer({ event, onClose }: { event: TEvent; onClose: () => void }) {
  const cfg = KIND_CFG[event.kind];
  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col">
      <div className={cn('flex items-center justify-between px-4 py-3 border-b border-gray-100', cfg.card)}>
        <div className="flex items-center gap-2">
          <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-white', cfg.dot)}>
            {cfg.icon}
          </span>
          <div>
            <p className="text-xs font-bold text-gray-800">{event.label}</p>
            <p className="text-[10px] text-gray-500">{fmtDate(event.time)}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {event.detail && (
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Détails</p>
            <p className="text-sm text-gray-800 leading-relaxed">{event.detail}</p>
          </div>
        )}
        {event.by && (
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Effectué par</p>
            <p className="text-sm text-gray-700">{event.by}</p>
          </div>
        )}
        <div>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Horodatage</p>
          <p className="text-sm text-gray-700">{fmtDate(event.time)}</p>
        </div>
      </div>
      <div className="px-4 py-3 border-t border-gray-100">
        <button
          onClick={() => window.print()}
          className="w-full flex items-center justify-center gap-2 text-xs border border-gray-200 hover:border-gray-400 rounded-lg px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <Printer size={12} />Imprimer cet événement
        </button>
      </div>
    </div>
  );
}

// ─── Timeline component ───────────────────────────────────────────────────────

export function DossierTimeline() {
  const events = useTimelineEvents();
  const [selected, setSelected] = useState<TEvent | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div className="bg-white border-b border-gray-100 print:hidden">
        <button
          onClick={() => setCollapsed(false)}
          className="w-full flex items-center gap-2 px-4 py-1.5 text-[10px] text-gray-400 hover:text-gray-600 font-semibold uppercase tracking-wide hover:bg-gray-50 transition-colors"
        >
          <Clock size={10} />Chronologie ({events.length} événements)
          <ChevronRight size={10} className="ml-auto" />
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white border-b border-gray-100 print:hidden">
        <button
          onClick={() => setCollapsed(true)}
          className="w-full flex items-center gap-2 px-4 py-1.5 text-[10px] text-gray-400 hover:text-gray-600 font-semibold uppercase tracking-wide hover:bg-gray-50 transition-colors"
        >
          <Clock size={10} />Chronologie — {events.length} événements
          <ChevronRight size={10} className="ml-auto rotate-90" />
        </button>
        <div className="overflow-x-auto pb-2.5 px-4">
          <div className="flex items-center gap-0 min-w-max">
            {[...events].reverse().map((ev, i) => {
              const cfg = KIND_CFG[ev.kind];
              return (
                <div key={ev.id} className="flex items-center">
                  <button
                    onClick={() => setSelected(ev)}
                    className={cn(
                      'flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg border text-center min-w-[58px] cursor-pointer hover:opacity-90 transition-opacity',
                      ev.highlight ? cfg.card + ' ring-1 ring-current' : cfg.card,
                    )}
                  >
                    <span className="text-[9px] font-bold opacity-60">{fmt(ev.time)}</span>
                    <div className="flex items-center gap-0.5">
                      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', cfg.dot)} />
                      <span className="text-[9px] font-semibold leading-tight max-w-[48px] truncate">{ev.label.split(':')[0]}</span>
                    </div>
                  </button>
                  {i < events.length - 1 && <div className="h-px w-3 bg-gray-200 flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selected && <EventDrawer event={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
