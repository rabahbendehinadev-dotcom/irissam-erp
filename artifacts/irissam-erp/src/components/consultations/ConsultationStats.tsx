import { Stethoscope, Clock, Loader2, CheckCircle2, XCircle, CalendarOff, Timer, UserCheck } from 'lucide-react';
import { getConsultationStats } from '@/mock/consultations';

interface StatCard {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  bg: string;
  spin?: boolean;
}

export function ConsultationStats() {
  const s = getConsultationStats();

  const cards: StatCard[] = [
    { icon: Stethoscope,  label: "Consultations aujourd'hui", value: s.todayTotal,   color: 'text-blue-600',    bg: 'bg-blue-50' },
    { icon: Clock,        label: 'En attente',                value: s.enAttente,    color: 'text-yellow-600',  bg: 'bg-yellow-50' },
    { icon: Loader2,      label: 'En cours',                  value: s.enCours,      color: 'text-blue-600',    bg: 'bg-blue-50',  spin: true },
    { icon: CheckCircle2, label: 'Terminées',                 value: s.terminees,    color: 'text-green-600',   bg: 'bg-green-50' },
    { icon: XCircle,      label: 'Annulées',                  value: s.annulees,     color: 'text-red-500',     bg: 'bg-red-50' },
    { icon: CalendarOff,  label: 'Sans rendez-vous',          value: s.sansRdv,      color: 'text-gray-600',    bg: 'bg-gray-100' },
    { icon: Timer,        label: 'Durée moyenne',             value: `${s.avgDuration} min`, color: 'text-purple-600', bg: 'bg-purple-50' },
    { icon: UserCheck,    label: 'Patients à revoir',         value: s.aRevoir,      color: 'text-orange-600',  bg: 'bg-orange-50' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
      {cards.map(card => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-2">
            <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
              <Icon size={15} className={`${card.color} ${card.spin ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 leading-none">{card.value}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-tight">{card.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
