import {
  Hospital, ArrowRight, Bed, LogOut, AlertCircle,
  MessageSquare, FlaskConical, ClipboardCheck, Clock,
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
};

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
      {sorted.map((ev, i) => (
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
            <p className="text-xs text-gray-400 mt-1">{ev.userName}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
