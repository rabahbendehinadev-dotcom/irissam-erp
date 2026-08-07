import { Stethoscope, Clock, Loader2, CheckCircle2, XCircle, CalendarOff, Timer } from 'lucide-react';
import type { Consultation } from '@/types/consultation';

interface StatCard {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  bg: string;
  spin?: boolean;
}

interface Props {
  /** Consultations réelles (API PostgreSQL) — les statistiques en dérivent. */
  consultations: Consultation[];
}

export function ConsultationStats({ consultations }: Props) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const isToday = (c: Consultation) => (c.scheduledAt ?? c.date ?? '').startsWith(todayStr);

  const today      = consultations.filter(isToday);
  const enAttente  = consultations.filter(c => c.status === 'en_attente' || c.status === 'planifiee').length;
  const enCours    = consultations.filter(c => c.status === 'en_cours').length;
  const terminees  = today.filter(c => c.status === 'terminee').length;
  const annulees   = today.filter(c => c.status === 'annulee').length;
  const sansRdv    = today.filter(c => (c.origin as string) === 'walk_in' || c.origin === 'sans_rdv').length;

  const withDuration = consultations.filter(c => c.status === 'terminee' && typeof c.duration === 'number' && c.duration > 0);
  const avgDuration  = withDuration.length > 0
    ? `${Math.round(withDuration.reduce((sum, c) => sum + (c.duration ?? 0), 0) / withDuration.length)} min`
    : '—';

  const cards: StatCard[] = [
    { icon: Stethoscope,  label: "Consultations aujourd'hui", value: today.length, color: 'text-blue-600',   bg: 'bg-blue-50' },
    { icon: Clock,        label: 'En attente',                value: enAttente,    color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { icon: Loader2,      label: 'En cours',                  value: enCours,      color: 'text-blue-600',   bg: 'bg-blue-50', spin: enCours > 0 },
    { icon: CheckCircle2, label: "Terminées aujourd'hui",     value: terminees,    color: 'text-green-600',  bg: 'bg-green-50' },
    { icon: XCircle,      label: "Annulées aujourd'hui",      value: annulees,     color: 'text-red-500',    bg: 'bg-red-50' },
    { icon: CalendarOff,  label: 'Sans rendez-vous',          value: sansRdv,      color: 'text-gray-600',   bg: 'bg-gray-100' },
    { icon: Timer,        label: 'Durée moyenne',             value: avgDuration,  color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
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
