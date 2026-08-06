/**
 * Personnel — Medical staff directory from HR PostgreSQL.
 * Replaces MockRepository (erDoctors/erNurses) with real /hr/employees data.
 */
import { useState, useMemo } from 'react';
import { User, Users, Stethoscope, Activity, AlertCircle, RefreshCw } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useQuery } from '@/hooks/useQuery';

type CategoryFilter = 'all' | 'medical' | 'paramedical';

const TODAY_STATUS_LABEL: Record<string, string> = {
  present:      'Présent',
  absent:       'Absent',
  retard:       'Retard',
  sorti:        'Parti',
  en_pause:     'Pause',
  en_mission:   'Mission',
  en_garde:     'Garde',
  non_pointe:   'Non pointé',
};
const TODAY_STATUS_COLOR: Record<string, string> = {
  present:    'bg-green-100 text-green-700',
  absent:     'bg-red-100 text-red-700',
  retard:     'bg-amber-100 text-amber-700',
  sorti:      'bg-gray-100 text-gray-600',
  en_pause:   'bg-sky-100 text-sky-700',
  en_mission: 'bg-purple-100 text-purple-700',
  en_garde:   'bg-indigo-100 text-indigo-700',
  non_pointe: 'bg-gray-100 text-gray-400',
};
const EMP_STATUS_COLOR: Record<string, string> = {
  actif:    'bg-green-100 text-green-700',
  absent:   'bg-red-100 text-red-700',
  en_conge: 'bg-sky-100 text-sky-700',
  suspendu: 'bg-orange-100 text-orange-700',
  archive:  'bg-gray-200 text-gray-500',
};

export default function Personnel() {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');

  // Fetch medical + paramedical staff (two queries, merge client-side)
  const { data: medRes,    loading: medLoading,  error: medError,    refetch: refetchMed }  =
    useQuery<any>('/hr/employees?category=medical&limit=200&status=actif');
  const { data: paraRes,   loading: paraLoading, error: paraError,   refetch: refetchPara } =
    useQuery<any>('/hr/employees?category=paramedical&limit=200&status=actif');

  const loading = medLoading || paraLoading;
  const error   = medError ?? paraError;

  function refetch() { refetchMed(); refetchPara(); }

  const medical    = Array.isArray(medRes?.data)  ? medRes.data  : [];
  const paramedical = Array.isArray(paraRes?.data) ? paraRes.data : [];

  // Merge and filter
  const allStaff: any[] = useMemo(() => {
    if (categoryFilter === 'medical')    return medical;
    if (categoryFilter === 'paramedical') return paramedical;
    return [...medical, ...paramedical];
  }, [medical, paramedical, categoryFilter]);

  const filtered = useMemo(() => {
    if (!search) return allStaff;
    const q = search.toLowerCase();
    return allStaff.filter(e =>
      (e.last_name  + ' ' + e.first_name).toLowerCase().includes(q) ||
      (e.position_name   ?? '').toLowerCase().includes(q) ||
      (e.department_name ?? '').toLowerCase().includes(q)
    );
  }, [allStaff, search]);

  const doctors   = useMemo(() => filtered.filter(e => e.category === 'medical'),    [filtered]);
  const nurses    = useMemo(() => filtered.filter(e => e.category === 'paramedical'), [filtered]);

  if (loading) return (
    <DashboardLayout>
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-8 bg-white/10 rounded-lg w-1/3"/>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-white/10 rounded-xl"/>)}
        </div>
        <div className="h-64 bg-white/10 rounded-xl"/>
      </div>
    </DashboardLayout>
  );

  if (error) return (
    <DashboardLayout>
      <div className="p-6 max-w-md mx-auto text-center mt-20">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-red-400"/>
        <p className="text-white font-semibold mb-1">Impossible de charger le personnel</p>
        <p className="text-white/50 text-sm mb-4">{error}</p>
        <button onClick={refetch}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 text-sm">
          <RefreshCw className="w-4 h-4"/> Réessayer
        </button>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5">
        <PageHeader
          title="Personnel médical"
          subtitle="Annuaire du personnel médical et paramédical actif"
          actions={
            <button onClick={refetch}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white/10 text-white rounded-lg hover:bg-white/20">
              <RefreshCw className="w-4 h-4"/> Actualiser
            </button>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Médecins',             value: medical.length,     icon: Stethoscope, color: 'text-blue-400',   bg: 'bg-blue-500/10   border-blue-500/20' },
            { label: 'Médecins présents',     value: medical.filter((e: any) => e.today_status === 'present' || e.today_status === 'en_garde').length, icon: User, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
            { label: 'Paramédicaux',          value: paramedical.length, icon: Users,       color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
            { label: 'Paramédicaux présents', value: paramedical.filter((e: any) => e.today_status === 'present' || e.today_status === 'en_garde').length, icon: Activity, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
          ].map(s => (
            <div key={s.label} className={`border rounded-xl p-4 flex items-center gap-3 ${s.bg}`}>
              <s.icon size={20} className={s.color} />
              <div>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-white/60">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          {([['all','Tous'], ['medical','Médecins'], ['paramedical','Paramédicaux']] as [CategoryFilter, string][]).map(([v, l]) => (
            <button key={v} onClick={() => setCategoryFilter(v)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                categoryFilter === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/10 border-white/20 text-white/70 hover:bg-white/20'
              }`}>
              {l}
            </button>
          ))}
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Nom, poste ou département…"
            className="text-sm border border-white/20 rounded-lg px-3 py-1.5 bg-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/40"/>
        </div>

        {/* Doctors table */}
        {(categoryFilter !== 'paramedical') && doctors.length > 0 && (
          <StaffTable title="Médecins" icon={<Stethoscope size={16} className="text-blue-400"/>} staff={doctors}/>
        )}

        {/* Paramedical table */}
        {(categoryFilter !== 'medical') && nurses.length > 0 && (
          <StaffTable title="Personnel paramédical" icon={<Users size={16} className="text-purple-400"/>} staff={nurses}/>
        )}

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-white/40 gap-3">
            <Users size={40} className="opacity-30" />
            <p className="text-sm font-medium">Aucun personnel trouvé</p>
            {search && <p className="text-xs text-white/30">Essayez un autre terme de recherche.</p>}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StaffTable({ title, icon, staff }: {
  title: string;
  icon: React.ReactNode;
  staff: any[];
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
        {icon}
        <h2 className="font-bold text-white">{title}</h2>
        <span className="text-xs text-white/40 ml-auto">{staff.length} employé{staff.length > 1 ? 's' : ''}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-white/40 uppercase tracking-wide border-b border-white/10">
            <tr>
              <th className="px-4 py-3 text-left">Nom</th>
              <th className="px-4 py-3 text-left hidden sm:table-cell">Poste</th>
              <th className="px-4 py-3 text-left hidden md:table-cell">Département</th>
              <th className="px-4 py-3 text-center">Statut emploi</th>
              <th className="px-4 py-3 text-center">Présence aujourd'hui</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {staff.map((e: any) => (
              <tr key={e.id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 font-medium text-white">
                  {e.last_name} {e.first_name}
                  <span className="block text-xs text-white/40 sm:hidden">{e.position_name ?? '—'}</span>
                </td>
                <td className="px-4 py-3 text-white/60 hidden sm:table-cell">{e.position_name ?? '—'}</td>
                <td className="px-4 py-3 text-white/60 hidden md:table-cell">{e.department_name ?? '—'}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${EMP_STATUS_COLOR[e.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {e.status ?? '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {e.today_status
                    ? <span className={`px-2 py-0.5 text-xs rounded-full ${TODAY_STATUS_COLOR[e.today_status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {TODAY_STATUS_LABEL[e.today_status] ?? e.today_status}
                      </span>
                    : <span className="text-xs text-white/30">—</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
