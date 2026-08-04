import {
  Hospital, ArrowRight, Bed, LogOut, AlertCircle,
  MessageSquare, FlaskConical, ClipboardCheck, Clock, Activity,
} from 'lucide-react';
import { useLanguage } from '@/i18n';
import type { AdmissionTimelineEvent, AdmissionTimelineEventType } from '@/types/admission';
import { formatDate, formatTime } from '@/utils/format';

const ICON_MAP: Record<AdmissionTimelineEventType, React.ReactNode> = {
  admission:              <Hospital size={14} />,
  transfer:               <ArrowRight size={14} />,
  bed_change:             <Bed size={14} />,
  discharge:              <LogOut size={14} />,
  status_change:          <AlertCircle size={14} />,
  note:                   <MessageSquare size={14} />,
  exam_ordered:           <FlaskConical size={14} />,
  exam_result:            <ClipboardCheck size={14} />,
  preadmission_converted: <Clock size={14} />,
  vitals:                 <Activity size={14} />,
};

const COLOR_MAP: Record<AdmissionTimelineEventType, string> = {
  admission:              'bg-blue-100 text-blue-700 border-blue-200',
  transfer:               'bg-amber-100 text-amber-700 border-amber-200',
  bed_change:             'bg-purple-100 text-purple-700 border-purple-200',
  discharge:              'bg-gray-100 text-gray-600 border-gray-200',
  status_change:          'bg-orange-100 text-orange-700 border-orange-200',
  note:                   'bg-green-100 text-green-700 border-green-200',
  exam_ordered:           'bg-teal-100 text-teal-700 border-teal-200',
  exam_result:            'bg-indigo-100 text-indigo-700 border-indigo-200',
  preadmission_converted: 'bg-blue-50 text-blue-600 border-blue-100',
  vitals:                 'bg-rose-100 text-rose-700 border-rose-200',
};

// ─── Vitals helpers ────────────────────────────────────────────────────────────

type VitalStatus = 'normal' | 'warning' | 'critical';

function getVitalStatus(key: string, value: number): VitalStatus {
  switch (key) {
    case 'fc':
      if (value < 40 || value > 150) return 'critical';
      if (value < 60 || value > 100) return 'warning';
      return 'normal';
    case 'taSys':
      if (value > 180 || value < 80) return 'critical';
      if (value < 90 || value > 140) return 'warning';
      return 'normal';
    case 'taDia':
      if (value < 50 || value > 120) return 'critical';
      if (value < 60 || value > 90) return 'warning';
      return 'normal';
    case 'temp':
      if (value < 35 || value > 39) return 'critical';
      if (value < 36 || value > 37.5) return 'warning';
      return 'normal';
    case 'spo2':
      if (value < 90) return 'critical';
      if (value < 95) return 'warning';
      return 'normal';
    case 'glycemie':
      if (value < 0.5 || value > 3) return 'critical';
      if (value < 0.7 || value > 1.8) return 'warning';
      return 'normal';
    default:
      return 'normal';
  }
}

const STATUS_CLASSES: Record<VitalStatus, string> = {
  normal:   'text-gray-700 bg-gray-50 border-gray-200',
  warning:  'text-amber-700 bg-amber-50 border-amber-200 font-semibold',
  critical: 'text-red-700 bg-red-50 border-red-200 font-bold',
};

interface VitalChipProps { label: string; value: string; vitalKey: string; raw: number }
function VitalChip({ label, value, vitalKey, raw }: VitalChipProps) {
  const status = getVitalStatus(vitalKey, raw);
  return (
    <div className={`flex flex-col items-center rounded-lg border px-2.5 py-1.5 min-w-[60px] ${STATUS_CLASSES[status]}`}>
      <span className="text-[10px] uppercase tracking-wide opacity-60 leading-none mb-0.5">{label}</span>
      <span className="text-xs leading-none">{value}</span>
    </div>
  );
}

function VitalsCard({ meta }: { meta?: Record<string, string> }) {
  if (!meta) return null;

  const chips: { label: string; key: string; value: string; raw: number }[] = [];

  if (meta.fc)       chips.push({ label: 'FC',     key: 'fc',       value: `${meta.fc} bpm`,   raw: Number(meta.fc) });
  if (meta.taSys && meta.taDia)
                     chips.push({ label: 'TA',      key: 'taSys',    value: `${meta.taSys}/${meta.taDia}`, raw: Number(meta.taSys) });
  if (meta.temp)     chips.push({ label: 'T°',      key: 'temp',     value: `${meta.temp}°C`,  raw: Number(meta.temp) });
  if (meta.spo2)     chips.push({ label: 'SpO₂',   key: 'spo2',     value: `${meta.spo2}%`,    raw: Number(meta.spo2) });
  if (meta.glycemie) chips.push({ label: 'Glyc.',  key: 'glycemie', value: `${meta.glycemie} g/L`, raw: Number(meta.glycemie) });

  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {chips.map(c => (
        <VitalChip key={c.key} label={c.label} value={c.value} vitalKey={c.key} raw={c.raw} />
      ))}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface Props { events: AdmissionTimelineEvent[] }

export function AdmissionTimeline({ events }: Props) {
  const { t } = useLanguage();

  if (!events.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-gray-400">
        <Clock size={32} className="opacity-30 mb-2" />
        <p className="text-sm">{t('adm.timeline.empty')}</p>
      </div>
    );
  }

  const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <ol className="relative border-l border-gray-200 space-y-6 pl-6">
      {sorted.map((ev) => (
        <li key={ev.id} className="relative">
          {/* Dot */}
          <span className={`absolute -left-[1.65rem] top-0 flex items-center justify-center w-8 h-8 rounded-full border shadow-sm ${COLOR_MAP[ev.type]}`}>
            {ICON_MAP[ev.type]}
          </span>

          <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-gray-800 leading-snug">{ev.description}</p>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-semibold text-gray-700">{formatTime(ev.date)}</p>
                <p className="text-xs text-gray-400">{formatDate(ev.date)}</p>
              </div>
            </div>

            {/* Vitals chips */}
            {ev.type === 'vitals' && <VitalsCard meta={ev.meta} />}

            <p className="text-xs text-gray-400 mt-1">{ev.userName}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
