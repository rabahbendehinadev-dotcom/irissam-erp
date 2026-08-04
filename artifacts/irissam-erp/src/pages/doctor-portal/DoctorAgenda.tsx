import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { apiClient } from '@/services/api/client';
import { DoctorPortalLayout } from '@/layouts/DoctorPortalLayout';
import { ChevronLeft, ChevronRight, RefreshCw, AlertCircle, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewType = 'jour' | 'semaine' | 'liste';

interface Appointment {
  id: string;
  patient_id: string;
  patient_name: string;
  mrn: string;
  appointment_time: string;
  appointment_date: string;
  duration: number;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'no_show' | 'cancelled';
  department: string;
  notes: string;
}

const STATUS_LABELS: Record<Appointment['status'], string> = {
  pending: 'En attente',
  confirmed: 'Confirmé',
  in_progress: 'En cours',
  completed: 'Terminé',
  no_show: 'Absent',
  cancelled: 'Annulé',
};

const STATUS_COLORS: Record<Appointment['status'], string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  no_show: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function groupByDate(appointments: Appointment[]): Record<string, Appointment[]> {
  const groups: Record<string, Appointment[]> = {};
  for (const apt of appointments) {
    const key = apt.appointment_date ?? apt.appointment_time?.split('T')[0] ?? 'unknown';
    if (!groups[key]) groups[key] = [];
    groups[key].push(apt);
  }
  return groups;
}

function AppointmentCard({
  apt,
  onStatusUpdate,
  onOpenRecord,
  onStart,
}: {
  apt: Appointment;
  onStatusUpdate: (id: string, status: string) => void;
  onOpenRecord: (patientId: string) => void;
  onStart: () => void;
}) {
  const isCancelled = apt.status === 'cancelled';
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3',
        isCancelled && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn('font-medium text-gray-900', isCancelled && 'line-through')}>
            {apt.patient_name}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{apt.mrn}</p>
        </div>
        <span className={cn('text-xs px-2 py-1 rounded-full flex-shrink-0', STATUS_COLORS[apt.status])}>
          {STATUS_LABELS[apt.status]}
        </span>
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-600">
        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded font-mono text-xs">
          {apt.appointment_time}
        </span>
        <span>{apt.duration} min</span>
        {apt.department && <span className="text-gray-400">• {apt.department}</span>}
      </div>

      {apt.notes && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded p-2 leading-relaxed">
          {apt.notes}
        </p>
      )}

      {!isCancelled && (
        <div className="flex flex-wrap gap-2 pt-1">
          {apt.status === 'pending' || apt.status === 'confirmed' ? (
            <button
              onClick={() => onStatusUpdate(apt.id, 'in_progress')}
              className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Marquer arrivé
            </button>
          ) : null}
          {apt.status === 'in_progress' && (
            <button
              onClick={onStart}
              className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Commencer
            </button>
          )}
          <button
            onClick={() => onOpenRecord(apt.patient_id)}
            className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Ouvrir dossier
          </button>
        </div>
      )}
    </div>
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('bg-gray-200 rounded-lg animate-pulse', className)} />;
}

export default function DoctorAgenda() {
  const [, setLocation] = useLocation();
  const [view, setView] = useState<ViewType>('jour');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgenda = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let start: string;
      let end: string;
      if (view === 'jour') {
        start = formatDate(currentDate);
        end = formatDate(currentDate);
      } else if (view === 'semaine') {
        const day = currentDate.getDay();
        const monday = addDays(currentDate, -(day === 0 ? 6 : day - 1));
        const sunday = addDays(monday, 6);
        start = formatDate(monday);
        end = formatDate(sunday);
      } else {
        start = formatDate(currentDate);
        end = formatDate(addDays(currentDate, 6));
      }
      const res = await apiClient.get<Appointment[]>(`/api/doctor-portal/agenda?start=${start}&end=${end}`);
      setAppointments(Array.isArray(res) ? res : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [view, currentDate]);

  useEffect(() => { fetchAgenda(); }, [fetchAgenda]);

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await apiClient.patch(`/api/doctor-portal/agenda/${id}/status`, { status });
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: status as Appointment['status'] } : a)),
      );
    } catch {
      // silent fail
    }
  };

  const navigate = (direction: -1 | 1) => {
    if (view === 'jour') setCurrentDate((d) => addDays(d, direction));
    else setCurrentDate((d) => addDays(d, direction * 7));
  };

  const currentDateLabel = view === 'jour'
    ? currentDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    : `Semaine du ${formatDate(currentDate)}`;

  return (
    <DoctorPortalLayout>
      <div className="p-4 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900 flex-1">Agenda</h1>

          {/* View switcher */}
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            {(['jour', 'semaine', 'liste'] as ViewType[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors',
                  view === v ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700',
                )}
              >
                {v === 'jour' ? 'Jour' : v === 'semaine' ? 'Semaine' : 'Liste'}
              </button>
            ))}
          </div>

          {/* Date navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Précédent"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium"
            >
              Aujourd'hui
            </button>
            <button
              onClick={() => navigate(1)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Suivant"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-500 capitalize">{currentDateLabel}</p>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
            <p className="text-red-700 text-sm flex-1">{error}</p>
            <button
              onClick={fetchAgenda}
              className="flex items-center gap-1 text-sm text-red-600 hover:text-red-800"
            >
              <RefreshCw size={14} /> Réessayer
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-28" />
            ))}
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          <>
            {appointments.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Calendar size={40} className="mx-auto mb-3 opacity-40" />
                <p className="font-medium">Aucun rendez-vous pour cette période</p>
              </div>
            ) : (
              <>
                {(view === 'jour') && (
                  <div className="space-y-3">
                    {[...appointments]
                      .sort((a, b) => (a.appointment_time > b.appointment_time ? 1 : -1))
                      .map((apt) => (
                        <AppointmentCard
                          key={apt.id}
                          apt={apt}
                          onStatusUpdate={handleStatusUpdate}
                          onOpenRecord={(pid) => setLocation(`/patients/${pid}`)}
                          onStart={() => setLocation('/doctor-portal/patients-today')}
                        />
                      ))}
                  </div>
                )}

                {(view === 'semaine' || view === 'liste') && (
                  <div className="space-y-6">
                    {Object.entries(groupByDate(appointments))
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([date, apts]) => (
                        <div key={date}>
                          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2 px-1">
                            {new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long',
                            })}
                          </h3>
                          <div className="space-y-3">
                            {[...apts]
                              .sort((a, b) => (a.appointment_time > b.appointment_time ? 1 : -1))
                              .map((apt) => (
                                <AppointmentCard
                                  key={apt.id}
                                  apt={apt}
                                  onStatusUpdate={handleStatusUpdate}
                                  onOpenRecord={(pid) => setLocation(`/patients/${pid}`)}
                                  onStart={() => setLocation('/doctor-portal/patients-today')}
                                />
                              ))}
                          </div>
                        </div>
                      ))}
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
