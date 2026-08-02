/**
 * Personnel — Live doctor/nurse workload from MockRepository.
 * No local mock data.
 */
import { useState } from 'react';
import { User, Users, Activity, Stethoscope } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useMockRepository } from '@/store/MockRepository';

type RoleFilter = 'all' | 'doctors' | 'nurses';

const STATUS_COLOR: Record<string, string> = {
  disponible:   'bg-green-100 text-green-700',
  occupe:       'bg-red-100 text-red-700',
  pause:        'bg-amber-100 text-amber-700',
  repos:        'bg-gray-100 text-gray-500',
  indisponible: 'bg-gray-200 text-gray-500',
};

export default function Personnel() {
  const { erDoctors, erNurses, patients } = useMockRepository();
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [search, setSearch] = useState('');

  const docStats = {
    total:  erDoctors.length,
    actif:  erDoctors.filter(d => d.status === 'actif').length,
    pause:  erDoctors.filter(d => d.status === 'pause').length,
  };
  const nurseStats = {
    total:  erNurses.length,
    actif:  erNurses.filter(n => n.status === 'actif').length,
    pause:  erNurses.filter(n => n.status === 'pause').length,
  };

  const filteredDoctors = erDoctors.filter(d => {
    if (roleFilter === 'nurses') return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()) &&
        !d.specialty.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const filteredNurses = erNurses.filter(n => {
    if (roleFilter === 'doctors') return false;
    if (search && !n.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Count patients per staff member
  const patientsByDoctor = patients.reduce<Record<string, number>>((acc, p) => {
    if (p.assignedDoctor) acc[p.assignedDoctor] = (acc[p.assignedDoctor] ?? 0) + 1;
    return acc;
  }, {});
  const patientsByNurse = patients.reduce<Record<string, number>>((acc, p) => {
    if (p.assignedNurse) acc[p.assignedNurse] = (acc[p.assignedNurse] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5">
        <PageHeader title="Personnel" subtitle="Charge de travail en temps réel — Médecins & Infirmiers" />

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Médecins',        value: docStats.total,   icon: Stethoscope, color: 'text-blue-600',  bg: 'bg-blue-50' },
            { label: 'Médecins actifs',  value: docStats.actif,   icon: User,        color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Infirmiers',       value: nurseStats.total, icon: Users,       color: 'text-purple-600',bg: 'bg-purple-50' },
            { label: 'Infirmiers actifs',value: nurseStats.actif, icon: Activity,    color: 'text-green-600', bg: 'bg-green-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border border-gray-100 rounded-xl p-4 flex items-center gap-3`}>
              <s.icon size={20} className={s.color} />
              <div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          {(['all', 'doctors', 'nurses'] as RoleFilter[]).map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${roleFilter === r ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {r === 'all' ? 'Tous' : r === 'doctors' ? 'Médecins' : 'Infirmiers'}
            </button>
          ))}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom ou spécialité…"
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>

        {/* Doctors table */}
        {roleFilter !== 'nurses' && filteredDoctors.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
              <Stethoscope size={16} className="text-blue-600" />
              <h2 className="font-bold text-gray-800">Médecins</h2>
              <span className="text-xs text-gray-500 ml-auto">{filteredDoctors.length} au total</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Nom</th>
                    <th className="px-4 py-3 text-left">Spécialité</th>
                    <th className="px-4 py-3 text-center">Patients</th>
                    <th className="px-4 py-3 text-center">Salle</th>
                    <th className="px-4 py-3 text-center">Disponibilité</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredDoctors.map(d => (
                    <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{d.name}</td>
                      <td className="px-4 py-3 text-gray-500">{d.specialty ?? '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold text-gray-800">{d.patientCount}</span>
                        <span className="text-gray-400"> / {d.maxPatients}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500">—</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[d.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Nurses table */}
        {roleFilter !== 'doctors' && filteredNurses.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
              <Users size={16} className="text-purple-600" />
              <h2 className="font-bold text-gray-800">Infirmiers</h2>
              <span className="text-xs text-gray-500 ml-auto">{filteredNurses.length} au total</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Nom</th>
                    <th className="px-4 py-3 text-center">Patients</th>
                    <th className="px-4 py-3 text-center">Salle</th>
                    <th className="px-4 py-3 text-center">Disponibilité</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredNurses.map(n => (
                    <tr key={n.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{n.name}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold text-gray-800">{n.patientCount}</span>
                        <span className="text-gray-400"> / {n.maxPatients}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500">—</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[n.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {n.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
