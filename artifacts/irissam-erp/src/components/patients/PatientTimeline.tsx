import { FileText, UserPlus, RefreshCw, Calendar, Bed, FlaskConical, LogOut, Stethoscope } from 'lucide-react';
import { useLanguage } from '@/i18n';
import type { PatientTimelineEvent, TimelineEventType } from '@/types';
import { formatDate, formatTime } from '@/utils/format';

const EVENT_CONFIG: Record<TimelineEventType, { icon: React.ElementType; color: string; bg: string }> = {
  creation:    { icon: UserPlus,    color: 'text-blue-600',   bg: 'bg-blue-100' },
  update:      { icon: RefreshCw,   color: 'text-gray-600',   bg: 'bg-gray-100' },
  document:    { icon: FileText,    color: 'text-purple-600', bg: 'bg-purple-100' },
  appointment: { icon: Calendar,    color: 'text-green-600',  bg: 'bg-green-100' },
  admission:   { icon: Bed,         color: 'text-orange-600', bg: 'bg-orange-100' },
  result:      { icon: FlaskConical,color: 'text-teal-600',   bg: 'bg-teal-100' },
  discharge:   { icon: LogOut,      color: 'text-red-600',    bg: 'bg-red-100' },
  consultation:{ icon: Stethoscope, color: 'text-indigo-600', bg: 'bg-indigo-100' },
};

interface Props {
  events: PatientTimelineEvent[];
}

export function PatientTimeline({ events }: Props) {
  const { t } = useLanguage();

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <FileText size={40} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">{t('pat.timeline.empty')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {events.map((event, idx) => {
        const { icon: Icon, color, bg } = EVENT_CONFIG[event.type];
        const isLast = idx === events.length - 1;
        return (
          <div key={event.id} className="flex gap-4 group">
            {/* Connector */}
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${bg}`}>
                <Icon size={16} className={color} />
              </div>
              {!isLast && <div className="w-px flex-1 bg-gray-200 mt-1 mb-1" />}
            </div>

            {/* Content */}
            <div className={`pb-6 flex-1 ${isLast ? '' : ''}`}>
              <div className="bg-white border border-gray-100 rounded-xl p-3 group-hover:border-gray-200 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{event.title}</p>
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
  );
}
