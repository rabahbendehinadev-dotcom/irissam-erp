import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import { apiClient } from '@/services/api/client';
import { DoctorPortalLayout } from '@/layouts/DoctorPortalLayout';
import { Search, Users, AlertTriangle, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TodayPatient {
  id: string;
  patient_id: string;
  patient_name: string;
  mrn: string;
  date_of_birth: string;
  appointment_time: string;
  wait_time_minutes: number;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'no_show';
  notes: string;
  allergies: string[];
  encounter_id: string | null;
}

type StatusFilter = 'all' | 'waiting' | 'in_progress' | 'completed' | 'no_show';

const STATUS_LABELS: Record<TodayPatient['status'], string> = {
  pending: 'En attente',
  confirmed: 'En attente',
  in_progress: 'En cours',
  completed: 'Terminé',
  no_show: 'Absent',
};

const STATUS_COLORS: Record<TodayPatient['status'], string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  no_show: 'bg-red-100 text-red-700',
};

const AVATAR_COLORS: Record<TodayPatient['status'], string> = {
  pending: 'bg-amber-400',
  confirmed: 'bg-blue-400',
  in_progress: 'bg-purple-500',
  completed: 'bg-green-500',
  no_show: 'bg-red-400',
};

function calcAge(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

function formatWaitTime(minutes: number): string {
  if (minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

function formatTime(isoOrTime: string): string {
  if (!isoOrTime) return '';
  if (isoOrTime.includes('T')) {
    return new Date(isoOrTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  return isoOrTime;
}

function initials(name: string): string {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('bg-gray-200 rounded-lg animate-pulse', className)} />;
}

export default function DoctorPatientsToday() {
  const [, setLocation] = useLocation();
  const [patients, setPatients] = useState<TodayPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<TodayPatient[]>('/api/doctor-portal/patients/today');
      setPatients(Array.isArray(res) ? res : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
    intervalRef.current = setInterval(fetchPatients, 60000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchPatients]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => setDebouncedSearch(value), 300);
  };

  const filtered = patients.filter((p) => {
    const searchMatch =
      !debouncedSearch ||
      p.patient_name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      p.mrn.toLowerCase().includes(debouncedSearch.toLowerCase());

    const statusMatch =
      statusFilter === 'all' ||
      (statusFilter === 'waiting' && (p.status === 'pending' || p.status === 'confirmed')) ||
      (statusFilter === 'in_progress' && p.status === 'in_progress') ||
      (statusFilter === 'completed' && p.status === 'completed') ||
      (statusFilter === 'no_show' && p.status === 'no_show');

    return searchMatch && statusMatch;
  });

  const startConsultation = async (patient: TodayPatient) => {
    try {
      await apiClient.post('/api/doctor-portal/consultations', {
        patientId: patient.patient_id,
        encounterId: patient.encounter_id,
      });
      setLocation(`/patients/${patient.patient_id}`);
    } catch {
      setLocation(`/patients/${patient.patient_id}`);
    }
  };

  const filterChips: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'Tous' },
    { id: 'waiting', label: 'En attente' },
    { id: 'in_progress', label: 'En cours' },
    { id: 'completed', label: 'Terminé' },
    { id: 'no_show', label: 'Absent' },
  ];

  return (
    <DoctorPortalLayout>
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Patients du jour</h1>
          <button
            onClick={fetchPatients}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
            aria-label="Rafraîchir"
          >
            <RefreshCw size={18} className={cn(loading && 'animate-spin')} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom ou MRN…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        {/* Status filter chips */}
        <div className="flex flex-wrap gap-2">
          {filterChips.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setStatusFilter(id)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                statusFilter === id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
            <p className="text-red-700 text-sm flex-1">{error}</p>
            <button onClick={fetchPatients} className="text-sm text-red-600 hover:text-red-800 flex items-center gap-1">
              <RefreshCw size={14} /> Réessayer
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-24" />
            ))}
          </div>
        )}

        {/* Patient list */}
        {!loading && !error && (
          <>
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Users size={40} className="mx-auto mb-3 opacity-40" />
                <p className="font-medium">Aucun patient trouvé</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((patient) => {
                  const age = patient.date_of_birth ? calcAge(patient.date_of_birth) : null;
                  const waitDisplay = formatWaitTime(patient.wait_time_minutes);
                  return (
                    <div
                      key={patient.id}
                      className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div
                          className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0',
                            AVATAR_COLORS[patient.status],
                          )}
                        >
                          {initials(patient.patient_name)}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-gray-900">{patient.patient_name}</p>
                            <span className="text-xs text-gray-400">{patient.mrn}</span>
                            {patient.allergies.length > 0 && (
                              <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                <AlertTriangle size={10} /> Allergies
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-gray-500">
                            {age !== null && <span>{age} ans</span>}
                            <span>🕐 {formatTime(patient.appointment_time)}</span>
                            {waitDisplay && (
                              <span className="text-amber-600 font-medium">Attente: {waitDisplay}</span>
                            )}
                            <span className={cn('px-2 py-0.5 rounded-full', STATUS_COLORS[patient.status])}>
                              {STATUS_LABELS[patient.status]}
                            </span>
                          </div>

                          {patient.notes && (
                            <p className="mt-1.5 text-xs text-gray-400 truncate">{patient.notes}</p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-3 flex-wrap">
                        <button
                          onClick={() => setLocation(`/patients/${patient.patient_id}`)}
                          className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          Ouvrir dossier
                        </button>
                        {patient.status !== 'completed' && patient.status !== 'no_show' && (
                          <button
                            onClick={() => startConsultation(patient)}
                            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Commencer consultation
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </DoctorPortalLayout>
  );
}
