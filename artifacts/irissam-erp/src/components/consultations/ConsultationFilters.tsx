import { Search, X } from 'lucide-react';

export interface ConsultationFiltersState {
  search: string;
  status: string;
  type: string;
  origin: string;
  doctor: string;
  specialty: string;
  service: string;
  dateFrom: string;
  dateTo: string;
}

export const DEFAULT_FILTERS: ConsultationFiltersState = {
  search: '', status: 'all', type: 'all', origin: 'all',
  doctor: 'all', specialty: 'all', service: 'all', dateFrom: '', dateTo: '',
};

const STATUSES = [
  { value: 'planifiee', label: 'Planifiée' },
  { value: 'en_attente', label: 'En attente' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'suspendue', label: 'Suspendue' },
  { value: 'terminee', label: 'Terminée' },
  { value: 'annulee', label: 'Annulée' },
  { value: 'patient_absent', label: 'Patient absent' },
];

const TYPES = [
  { value: 'programmee', label: 'Programmée' },
  { value: 'sans_rdv', label: 'Sans rendez-vous' },
  { value: 'controle', label: 'Contrôle' },
  { value: 'specialisee', label: 'Spécialisée' },
  { value: 'ambulatoire', label: 'Ambulatoire' },
  { value: 'teleconsultation', label: 'Téléconsultation' },
  { value: 'urgences', label: 'Issue des urgences' },
  { value: 'hospitalisation', label: 'Liée hospitalisation' },
];

const ORIGINS = [
  { value: 'rdv', label: 'Rendez-vous' },
  { value: 'urgence', label: 'Urgence' },
  { value: 'admission', label: 'Admission' },
  { value: 'sans_rdv', label: 'Sans rendez-vous' },
];

const DOCTORS = [
  { value: 'Dr Karim Benamara', label: 'Dr Karim Benamara' },
  { value: 'Dr Amira Douahi', label: 'Dr Amira Douahi' },
  { value: 'Dr Mourad Settouf', label: 'Dr Mourad Settouf' },
  { value: 'Dr Sofiane Boudali', label: 'Dr Sofiane Boudali' },
  { value: 'Dr Nadia Ferhat', label: 'Dr Nadia Ferhat' },
];

const SPECIALTIES = [
  { value: 'Médecine interne', label: 'Médecine interne' },
  { value: 'Médecine générale', label: 'Médecine générale' },
  { value: 'Cardiologie', label: 'Cardiologie' },
  { value: 'Gynécologie', label: 'Gynécologie' },
  { value: 'Pédiatrie', label: 'Pédiatrie' },
  { value: 'Chirurgie', label: 'Chirurgie' },
];

const SELECT_CLS = 'px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white min-w-[150px]';

interface Props {
  filters: ConsultationFiltersState;
  onChange: (f: ConsultationFiltersState) => void;
  total: number;
}

export function ConsultationFilters({ filters, onChange, total }: Props) {
  const set = (k: keyof ConsultationFiltersState, v: string) =>
    onChange({ ...filters, [k]: v });

  const isActive = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <div className="space-y-3">
      {/* Row 1: search + status + type + origin */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={filters.search}
            onChange={e => set('search', e.target.value)}
            placeholder="Patient, MPI, N° consultation, médecin, motif…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
          />
        </div>
        <select value={filters.status} onChange={e => set('status', e.target.value)} className={SELECT_CLS}>
          <option value="all">Tous les statuts</option>
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={filters.type} onChange={e => set('type', e.target.value)} className={SELECT_CLS}>
          <option value="all">Tous les types</option>
          {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={filters.origin} onChange={e => set('origin', e.target.value)} className={SELECT_CLS}>
          <option value="all">Toutes les origines</option>
          {ORIGINS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Row 2: doctor + specialty + dates + reset */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={filters.doctor} onChange={e => set('doctor', e.target.value)} className={SELECT_CLS}>
          <option value="all">Tous les médecins</option>
          {DOCTORS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <select value={filters.specialty} onChange={e => set('specialty', e.target.value)} className={SELECT_CLS}>
          <option value="all">Toutes les spécialités</option>
          {SPECIALTIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Du</span>
          <input type="date" value={filters.dateFrom} onChange={e => set('dateFrom', e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white" />
          <span className="text-xs text-gray-500">au</span>
          <input type="date" value={filters.dateTo} onChange={e => set('dateTo', e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white" />
        </div>
        {isActive && (
          <button onClick={() => onChange(DEFAULT_FILTERS)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors">
            <X size={14} /> Réinitialiser
          </button>
        )}
        <span className="ml-auto text-sm text-gray-500">
          <span className="font-semibold text-gray-800">{total}</span> consultation{total !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
