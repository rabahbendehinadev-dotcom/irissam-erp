import { ExecFilters } from '@/services/api/executive-dashboard';
import { DrillTarget } from '@/pages/ExecutiveDashboard';
import {
  Users, BedDouble, Clock, Stethoscope, DollarSign, TrendingUp,
  TrendingDown, AlertTriangle, Package, Wrench, UserCheck, ShieldCheck,
  Activity, HeartPulse, FlaskConical
} from 'lucide-react';

interface Props {
  overview: any;
  loading: boolean;
  filters: ExecFilters;
  onDrill: (t: DrillTarget) => void;
}

interface KPIProps {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; color: string; trend?: 'up'|'down'|'neutral';
  alert?: boolean; onClick?: () => void;
}

function KPI({ label, value, sub, icon, color, trend, alert, onClick }: KPIProps) {
  return (
    <button onClick={onClick}
      className={`bg-white rounded-xl p-4 shadow-sm border flex flex-col gap-2 text-left w-full transition-all
        hover:shadow-md hover:-translate-y-0.5 active:scale-95
        ${alert ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-100'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
        {trend === 'up'   && <TrendingUp   className="w-4 h-4 text-green-500 mt-1" />}
        {trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500 mt-1" />}
        {alert && <AlertTriangle className="w-4 h-4 text-red-500 mt-1" />}
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-xs font-medium text-gray-500 mt-0.5">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </button>
  );
}

function Skeleton() {
  return <div className="h-28 bg-gray-100 rounded-xl animate-pulse" />;
}

export default function ExecOverview({ overview: d, loading, onDrill }: Props) {
  if (loading && !d) {
    return (
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {Array.from({length:20}).map((_,i) => <Skeleton key={i} />)}
      </div>
    );
  }
  if (!d) return null;

  const occRate = d.beds?.occupancyRate ?? 0;
  const icuRate = d.icu?.rate ?? 0;

  return (
    <div className="p-4 space-y-6">
      {/* Section Activité */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Activité médicale</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <KPI label="Total patients" value={d.patients?.total?.toLocaleString() ?? 0}
            icon={<Users className="w-5 h-5 text-blue-600" />} color="bg-blue-50" />
          <KPI label="Nouveaux aujourd'hui" value={d.patients?.newToday ?? 0}
            icon={<Users className="w-5 h-5 text-indigo-600" />} color="bg-indigo-50" />
          <KPI label="Admissions" value={d.admissions?.period ?? 0}
            sub="Période sélectionnée"
            icon={<BedDouble className="w-5 h-5 text-purple-600" />} color="bg-purple-50" />
          <KPI label="Sorties" value={d.admissions?.discharges ?? 0}
            icon={<Activity className="w-5 h-5 text-teal-600" />} color="bg-teal-50" />
          <KPI label="Consultations" value={d.activity?.consultations ?? 0}
            icon={<Stethoscope className="w-5 h-5 text-cyan-600" />} color="bg-cyan-50" />
          <KPI label="Analyses lab." value={d.activity?.lab ?? 0}
            icon={<FlaskConical className="w-5 h-5 text-violet-600" />} color="bg-violet-50" />
          <KPI label="Examens imagerie" value={d.activity?.imaging ?? 0}
            icon={<Activity className="w-5 h-5 text-sky-600" />} color="bg-sky-50" />
          <KPI label="Interventions bloc" value={d.activity?.bloc ?? 0}
            icon={<Stethoscope className="w-5 h-5 text-rose-600" />} color="bg-rose-50" />
        </div>
      </section>

      {/* Section Capacités */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Capacités</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <KPI label="Occupation lits"
            value={`${occRate}%`}
            sub={`${d.beds?.occupied ?? 0} / ${d.beds?.total ?? 0} lits`}
            icon={<BedDouble className="w-5 h-5 text-orange-600" />} color="bg-orange-50"
            alert={occRate >= 90}
            onClick={() => onDrill({ metric:'bed_occupancy', label:'Occupation des lits' })} />
          <KPI label="Lits disponibles" value={d.beds?.available ?? 0}
            icon={<BedDouble className="w-5 h-5 text-green-600" />} color="bg-green-50" />
          <KPI label="Réanimation (ICU)"
            value={`${icuRate}%`}
            sub={`${d.icu?.occupied ?? 0} / ${d.icu?.total ?? 0} lits`}
            icon={<HeartPulse className="w-5 h-5 text-red-600" />} color="bg-red-50"
            alert={icuRate >= 100} />
          <KPI label="Urgences en attente" value={d.urgences?.waiting ?? 0}
            icon={<AlertTriangle className="w-5 h-5 text-amber-600" />} color="bg-amber-50"
            onClick={() => onDrill({ metric:'urgences_waiting', label:'Urgences en attente' })} />
          <KPI label="Temps moyen attente" value={`${d.urgences?.avgWaitMinutes ?? 0} min`}
            icon={<Clock className="w-5 h-5 text-orange-600" />} color="bg-orange-50"
            alert={(d.urgences?.avgWaitMinutes ?? 0) > 60} />
        </div>
      </section>

      {/* Section Finance */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Finance</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <KPI label="CA aujourd'hui"
            value={`${Math.round((d.finance?.caToday ?? 0)/1000)}K`}
            sub="DZD"
            icon={<DollarSign className="w-5 h-5 text-green-600" />} color="bg-green-50" />
          <KPI label="CA du mois"
            value={`${Math.round((d.finance?.caMonth ?? 0)/1000000)}M`}
            sub="DZD"
            icon={<TrendingUp className="w-5 h-5 text-emerald-600" />} color="bg-emerald-50" />
          <KPI label="Montant encaissé"
            value={`${Math.round((d.finance?.encaisse ?? 0)/1000)}K`}
            sub="DZD aujourd'hui"
            icon={<DollarSign className="w-5 h-5 text-teal-600" />} color="bg-teal-50" />
          <KPI label="Reste à recouvrer"
            value={`${Math.round((d.finance?.resteARecouvrer ?? 0)/1000000)}M`}
            sub="DZD"
            icon={<TrendingDown className="w-5 h-5 text-red-600" />} color="bg-red-50"
            onClick={() => onDrill({ metric:'reste_a_recouvrer', label:'Factures impayées' })} />
          <KPI label="Créances assurance"
            value={`${Math.round((d.finance?.creancesAssurance ?? 0)/1000)}K`}
            sub="DZD"
            icon={<ShieldCheck className="w-5 h-5 text-blue-600" />} color="bg-blue-50"
            onClick={() => onDrill({ metric:'creances_assurance', label:'Créances assurance' })} />
          <KPI label="Claims en attente"
            value={d.finance?.claimsEnAttente ?? 0}
            icon={<AlertTriangle className="w-5 h-5 text-amber-600" />} color="bg-amber-50" />
        </div>
      </section>

      {/* Section Stock, Biomédical, RH, Qualité */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Opérations</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <KPI label="Stock critique" value={d.stock?.critique ?? 0}
            icon={<Package className="w-5 h-5 text-red-600" />} color="bg-red-50"
            alert={(d.stock?.critique ?? 0) > 0}
            onClick={() => onDrill({ metric:'stock_critique', label:'Articles en stock critique' })} />
          <KPI label="Lots expirant" value={d.stock?.expirant ?? 0}
            sub="dans 30 jours"
            icon={<Package className="w-5 h-5 text-amber-600" />} color="bg-amber-50"
            onClick={() => onDrill({ metric:'lots_expirant', label:'Lots expirant bientôt' })} />
          <KPI label="Équip. en panne" value={d.biomedical?.enPanne ?? 0}
            icon={<Wrench className="w-5 h-5 text-red-600" />} color="bg-red-50"
            alert={(d.biomedical?.enPanne ?? 0) > 0}
            onClick={() => onDrill({ metric:'equipements_en_panne', label:'Équipements en panne' })} />
          <KPI label="Maintenance retard" value={d.biomedical?.maintenancesEnRetard ?? 0}
            icon={<Wrench className="w-5 h-5 text-orange-600" />} color="bg-orange-50"
            onClick={() => onDrill({ metric:'maintenance_retard', label:'Maintenances en retard' })} />
          <KPI label="Personnel présent" value={d.rh?.present ?? 0}
            icon={<UserCheck className="w-5 h-5 text-green-600" />} color="bg-green-50" />
          <KPI label="Personnel absent" value={d.rh?.absent ?? 0}
            icon={<UserCheck className="w-5 h-5 text-red-600" />} color="bg-red-50"
            onClick={() => onDrill({ metric:'personnel_absent', label:'Personnel absent' })} />
          <KPI label="Retards" value={d.rh?.retards ?? 0}
            sub="aujourd'hui"
            icon={<Clock className="w-5 h-5 text-amber-600" />} color="bg-amber-50" />
          <KPI label="Contrats expirant" value={d.rh?.contratsExpirant ?? 0}
            sub="dans 30 jours"
            icon={<UserCheck className="w-5 h-5 text-orange-600" />} color="bg-orange-50" />
          <KPI label="Incidents qualité" value={d.qualite?.incidentsOuverts ?? 0}
            icon={<ShieldCheck className="w-5 h-5 text-red-600" />} color="bg-red-50"
            alert={(d.qualite?.incidentsOuverts ?? 0) > 0}
            onClick={() => onDrill({ metric:'incidents_ouverts', label:'Incidents qualité ouverts' })} />
          <KPI label="CAPA en retard" value={d.qualite?.capaEnRetard ?? 0}
            icon={<AlertTriangle className="w-5 h-5 text-amber-600" />} color="bg-amber-50"
            onClick={() => onDrill({ metric:'capa_retard', label:'CAPA en retard' })} />
          <KPI label="Risques critiques" value={d.qualite?.risquesCritiques ?? 0}
            icon={<AlertTriangle className="w-5 h-5 text-red-600" />} color="bg-red-50"
            alert={(d.qualite?.risquesCritiques ?? 0) > 0} />
        </div>
      </section>
    </div>
  );
}
