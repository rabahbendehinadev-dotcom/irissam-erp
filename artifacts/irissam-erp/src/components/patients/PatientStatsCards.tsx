import { Stethoscope, Bed, ArrowRightFromLine, AlertCircle, FlaskConical, Scan, Pill, Receipt, CreditCard, CalendarClock } from 'lucide-react';
import type { Patient } from '@/types';
import { formatDate } from '@/utils/format';

interface StatCard {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  bg: string;
}

/** Deterministic mock stats based on patient ID so numbers feel consistent */
function getMockStats(patientId: string): Record<string, number> {
  const seed = patientId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const n = (base: number, mod: number) => base + (seed % mod);
  return {
    consultations:     n(3, 12),
    hospitalizations:  n(0, 4),
    admissions:        n(1, 5),
    emergencies:       n(0, 3),
    analyses:          n(2, 10),
    imageries:         n(1, 6),
    prescriptions:     n(3, 8),
    billed:            n(15000, 85000),
    paid:              n(10000, 75000),
  };
}

interface Props {
  patient: Patient;
}

export function PatientStatsCards({ patient }: Props) {
  const s = getMockStats(patient.id);
  const lastVisit = patient.updatedAt;

  const cards: StatCard[] = [
    { icon: Stethoscope,         label: 'Consultations',     value: s.consultations,    color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { icon: Bed,                 label: 'Hospitalisations',  value: s.hospitalizations, color: 'text-orange-600', bg: 'bg-orange-50' },
    { icon: ArrowRightFromLine,  label: 'Admissions',        value: s.admissions,       color: 'text-blue-600',   bg: 'bg-blue-50' },
    { icon: AlertCircle,         label: 'Urgences',          value: s.emergencies,      color: 'text-red-600',    bg: 'bg-red-50' },
    { icon: FlaskConical,        label: 'Analyses',          value: s.analyses,         color: 'text-teal-600',   bg: 'bg-teal-50' },
    { icon: Scan,                label: 'Imageries',         value: s.imageries,        color: 'text-purple-600', bg: 'bg-purple-50' },
    { icon: Pill,                label: 'Prescriptions',     value: s.prescriptions,    color: 'text-green-600',  bg: 'bg-green-50' },
    { icon: Receipt,             label: 'Montant facturé',   value: `${s.billed.toLocaleString('fr-DZ')} DA`, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { icon: CreditCard,          label: 'Montant payé',      value: `${s.paid.toLocaleString('fr-DZ')} DA`,   color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { icon: CalendarClock,       label: 'Dernière visite',   value: formatDate(lastVisit), color: 'text-gray-600', bg: 'bg-gray-100' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-5">
      {cards.map(card => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-2">
            <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
              <Icon size={15} className={card.color} />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 leading-none">{card.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
