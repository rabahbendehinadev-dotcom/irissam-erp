import { CheckCircle2, Clock, AlertCircle, Syringe } from 'lucide-react';
import { cn } from '@/lib/utils';

type VaccineStatus = 'administre' | 'planifie' | 'en_retard' | 'refuse';

interface VaccineRecord {
  id: string;
  vaccine: string;
  disease: string;
  dose: string;
  dateGiven?: string;
  nextDose?: string;
  doctor?: string;
  service: string;
  lot?: string;
  status: VaccineStatus;
  notes?: string;
}

const STATUS_CFG: Record<VaccineStatus, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  administre: { label: 'Administré',  icon: CheckCircle2, color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  planifie:   { label: 'Planifié',    icon: Clock,        color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  en_retard:  { label: 'En retard',   icon: AlertCircle,  color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
  refuse:     { label: 'Refusé',      icon: AlertCircle,  color: 'text-gray-600',   bg: 'bg-gray-100',  border: 'border-gray-200' },
};

const MOCK_VACCINES: VaccineRecord[] = [
  {
    id: 'v-1',
    vaccine: 'BCG',
    disease: 'Tuberculose',
    dose: 'Dose unique',
    dateGiven: '2024-01-15',
    nextDose: undefined,
    doctor: 'Dr. Meziane Farid',
    service: 'Médecine préventive',
    lot: 'BCG-2024-0012',
    status: 'administre',
  },
  {
    id: 'v-2',
    vaccine: 'Hépatite B',
    disease: 'Hépatite B',
    dose: 'Dose 1/3',
    dateGiven: '2024-02-20',
    nextDose: '2024-04-20',
    doctor: 'Dr. Meziane Farid',
    service: 'Médecine préventive',
    lot: 'HBV-2024-0088',
    status: 'administre',
  },
  {
    id: 'v-3',
    vaccine: 'Hépatite B',
    disease: 'Hépatite B',
    dose: 'Dose 2/3',
    dateGiven: '2024-04-20',
    nextDose: '2025-02-20',
    doctor: 'Dr. Karim Benamara',
    service: 'Médecine préventive',
    lot: 'HBV-2024-0091',
    status: 'administre',
  },
  {
    id: 'v-4',
    vaccine: 'COVID-19 (Moderna)',
    disease: 'COVID-19',
    dose: 'Dose 1',
    dateGiven: '2024-09-10',
    nextDose: '2024-10-08',
    doctor: 'Dr. Benali Sofiane',
    service: 'Vaccination COVID',
    lot: 'MOD-2024-3310',
    status: 'administre',
  },
  {
    id: 'v-5',
    vaccine: 'COVID-19 (Moderna)',
    disease: 'COVID-19',
    dose: 'Dose 2 (rappel)',
    dateGiven: '2024-10-08',
    nextDose: '2025-10-08',
    doctor: 'Dr. Benali Sofiane',
    service: 'Vaccination COVID',
    lot: 'MOD-2024-3318',
    status: 'administre',
  },
  {
    id: 'v-6',
    vaccine: 'Grippe saisonnière 2025',
    disease: 'Influenza',
    dose: 'Annuelle',
    dateGiven: undefined,
    nextDose: '2025-10-01',
    doctor: undefined,
    service: 'Médecine préventive',
    status: 'planifie',
    notes: 'Campagne grippe automne 2025',
  },
  {
    id: 'v-7',
    vaccine: 'Hépatite B',
    disease: 'Hépatite B',
    dose: 'Dose 3/3',
    dateGiven: undefined,
    nextDose: '2025-02-20',
    doctor: undefined,
    service: 'Médecine préventive',
    status: 'en_retard',
    notes: 'Rappel en retard de 6 mois — contacter le patient',
  },
  {
    id: 'v-8',
    vaccine: 'Pneumocoque (PPV23)',
    disease: 'Pneumonie',
    dose: 'Dose unique (adulte)',
    dateGiven: undefined,
    nextDose: '2025-12-01',
    doctor: undefined,
    service: 'Médecine préventive',
    status: 'planifie',
  },
];

function fmt(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function PatientVaccinationsTab() {
  const stats = {
    total:      MOCK_VACCINES.length,
    administre: MOCK_VACCINES.filter(v => v.status === 'administre').length,
    planifie:   MOCK_VACCINES.filter(v => v.status === 'planifie').length,
    en_retard:  MOCK_VACCINES.filter(v => v.status === 'en_retard').length,
  };

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',       value: stats.total,      color: 'text-gray-800',  bg: 'bg-gray-50',   border: 'border-gray-200' },
          { label: 'Administrés', value: stats.administre, color: 'text-green-700', bg: 'bg-green-50',  border: 'border-green-200' },
          { label: 'Planifiés',   value: stats.planifie,   color: 'text-blue-700',  bg: 'bg-blue-50',   border: 'border-blue-200' },
          { label: 'En retard',   value: stats.en_retard,  color: 'text-red-700',   bg: 'bg-red-50',    border: 'border-red-200' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl border p-3 text-center', s.bg, s.border)}>
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Vaccin', 'Maladie', 'Dose', 'Date d\'administration', 'Prochaine dose', 'Médecin', 'Service', 'Lot', 'Statut'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {MOCK_VACCINES.map(v => {
              const cfg = STATUS_CFG[v.status];
              const Icon = cfg.icon;
              return (
                <tr key={v.id} className={cn('hover:bg-gray-50 transition-colors', v.status === 'en_retard' ? 'bg-red-50/30' : '')}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <Syringe size={13} className="text-indigo-600" />
                      </div>
                      <span className="font-medium text-gray-800 whitespace-nowrap">{v.vaccine}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">{v.disease}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">{v.dose}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">{fmt(v.dateGiven)}</td>
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                    <span className={cn(v.status === 'en_retard' ? 'text-red-600 font-semibold' : 'text-gray-600')}>
                      {fmt(v.nextDose)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap text-xs">{v.doctor ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{v.service}</td>
                  <td className="px-4 py-3 font-mono text-gray-400 whitespace-nowrap text-xs">{v.lot ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium', cfg.color, cfg.bg, cfg.border)}>
                      <Icon size={10} />
                      {cfg.label}
                    </span>
                    {v.notes && (
                      <p className="text-xs text-gray-400 mt-0.5 max-w-[180px]">{v.notes}</p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 text-center">Données mock — le carnet vaccinal complet sera synchronisé depuis le registre national.</p>
    </div>
  );
}
