import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { apiClient } from '@/services/api/client';
import { DoctorPortalLayout } from '@/layouts/DoctorPortalLayout';
import { Search, UserCheck, AlertCircle, RefreshCw, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MyPatient {
  id: string;
  patient_name: string;
  mrn: string;
  date_of_birth: string;
  gender: 'M' | 'F' | 'male' | 'female' | string;
  blood_type: string | null;
  allergies: string[];
  chronic_diseases: string[];
}

interface PatientsResponse {
  patients: MyPatient[];
  total: number;
}

function calcAge(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

function initials(name: string): string {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

const GENDER_ICON: Record<string, string> = { M: '♂', male: '♂', F: '♀', female: '♀' };

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-teal-500',
  'bg-indigo-500', 'bg-pink-500', 'bg-amber-500', 'bg-red-500',
];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('bg-gray-200 rounded-lg animate-pulse', className)} />;
}

export default function DoctorMyPatients() {
  const [, setLocation] = useLocation();
  const [patients, setPatients] = useState<MyPatient[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [hospitalizedOnly, setHospitalizedOnly] = useState(false);
  const LIMIT = 20;

  const fetchPatients = useCallback(async (p: number, reset: boolean) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(LIMIT),
        ...(hospitalizedOnly ? { hospitalized: 'true' } : {}),
      });
      const res = await apiClient.get<PatientsResponse>(`/api/doctor-portal/patients?${params}`);
      const data = res as PatientsResponse;
      const list = Array.isArray(data?.patients) ? data.patients : [];
      if (reset) {
        setPatients(list);
      } else {
        setPatients((prev) => [...prev, ...list]);
      }
      setTotal(data?.total ?? list.length);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [hospitalizedOnly]);

  useEffect(() => {
    setPage(1);
    fetchPatients(1, true);
  }, [fetchPatients]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPatients(next, false);
  };

  const filtered = patients.filter((p) => {
    if (!search) return true;
    return (
      p.patient_name.toLowerCase().includes(search.toLowerCase()) ||
      p.mrn.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <DoctorPortalLayout>
      <div className="p-4 sm:p-6 space-y-5">
        <h1 className="text-xl font-bold text-gray-900">Mes patients</h1>

        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom ou MRN…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm">
            <input
              type="checkbox"
              checked={hospitalizedOnly}
              onChange={(e) => setHospitalizedOnly(e.target.checked)}
              className="rounded border-gray-300 text-blue-600"
            />
            <span className="text-gray-700">Hospitalisés</span>
          </label>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle size={18} className="text-red-500" />
            <p className="text-red-700 text-sm flex-1">{error}</p>
            <button onClick={() => fetchPatients(1, true)} className="text-sm text-red-600 flex items-center gap-1">
              <RefreshCw size={14} /> Réessayer
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-36" />
            ))}
          </div>
        )}

        {/* Patient cards */}
        {!loading && !error && (
          <>
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <UserCheck size={40} className="mx-auto mb-3 opacity-40" />
                <p className="font-medium">Aucun patient trouvé</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {filtered.map((patient) => {
                    const age = patient.date_of_birth ? calcAge(patient.date_of_birth) : null;
                    const genderIcon = GENDER_ICON[patient.gender] ?? '';
                    return (
                      <div
                        key={patient.id}
                        className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3"
                      >
                        {/* Header */}
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0',
                              avatarColor(patient.patient_name),
                            )}
                          >
                            {initials(patient.patient_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{patient.patient_name}</p>
                            <span className="text-xs text-gray-400">{patient.mrn}</span>
                          </div>
                        </div>

                        {/* Details */}
                        <div className="flex items-center gap-3 flex-wrap text-sm text-gray-600">
                          {patient.date_of_birth && (
                            <span>
                              {new Date(patient.date_of_birth).toLocaleDateString('fr-FR')}
                              {age !== null && ` (${age} ans)`}
                            </span>
                          )}
                          {genderIcon && <span>{genderIcon}</span>}
                          {patient.blood_type && (
                            <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded-full text-xs font-medium">
                              {patient.blood_type}
                            </span>
                          )}
                        </div>

                        {/* Allergies + diseases */}
                        <div className="flex flex-wrap gap-2">
                          {patient.allergies.length > 0 && (
                            <span className="flex items-center gap-1 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                              ⚠ {patient.allergies.length} allergie{patient.allergies.length > 1 ? 's' : ''}
                            </span>
                          )}
                          {patient.chronic_diseases.slice(0, 2).map((d) => (
                            <span key={d} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {d}
                            </span>
                          ))}
                          {patient.chronic_diseases.length > 2 && (
                            <span className="text-xs text-gray-400">
                              +{patient.chronic_diseases.length - 2} autre{patient.chronic_diseases.length - 2 > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>

                        {/* Action */}
                        <button
                          onClick={() => setLocation(`/doctor-portal/patient/${patient.id}`)}
                          className="w-full px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                        >
                          Voir dossier →
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Load more */}
                {patients.length < total && (
                  <div className="text-center pt-2">
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      {loadingMore ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                      Charger plus ({total - patients.length} restants)
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </DoctorPortalLayout>
  );
}
