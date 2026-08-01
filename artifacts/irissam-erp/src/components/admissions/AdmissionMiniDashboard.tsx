import { BedDouble, LogIn, LogOut, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/i18n';
import {
  MOCK_ADMISSIONS, MOCK_BEDS,
  countFreeBeds, getOccupancyRate, getTodayAdmissions, getTodayDischarges,
  getHospitalizedCount, getUrgentCount,
} from '@/mock';

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export function AdmissionMiniDashboard() {
  const { t } = useLanguage();
  const todayAdm = getTodayAdmissions();
  const todayDis = getTodayDischarges();
  const hospitalized = getHospitalizedCount();
  const freeBeds = countFreeBeds();
  const totalBeds = MOCK_BEDS.length;
  const occupancy = getOccupancyRate();
  const urgent = getUrgentCount();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      <StatCard
        icon={<LogIn size={20} className="text-blue-600" />}
        label={t('adm.stats.today_admissions')}
        value={todayAdm.length}
        color="bg-blue-50"
      />
      <StatCard
        icon={<LogOut size={20} className="text-green-600" />}
        label={t('adm.stats.today_discharges')}
        value={todayDis.length}
        color="bg-green-50"
      />
      <StatCard
        icon={<Users size={20} className="text-indigo-600" />}
        label={t('adm.stats.hospitalized')}
        value={hospitalized}
        color="bg-indigo-50"
      />
      <StatCard
        icon={<BedDouble size={20} className="text-teal-600" />}
        label={t('adm.stats.free_beds')}
        value={freeBeds}
        sub={`/ ${totalBeds} lits`}
        color="bg-teal-50"
      />
      <StatCard
        icon={<TrendingUp size={20} className="text-purple-600" />}
        label={t('adm.stats.occupancy')}
        value={`${occupancy}%`}
        color="bg-purple-50"
      />
      <StatCard
        icon={<AlertTriangle size={20} className="text-red-600" />}
        label={t('adm.stats.urgent')}
        value={urgent}
        color="bg-red-50"
      />
    </div>
  );
}
