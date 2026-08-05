/**
 * PatientAppointmentsTab — Rendez-vous d'un patient.
 */
import { useState, useEffect, useCallback } from 'react';
import { Calendar, RefreshCw, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Appointment {
  id: string;
  patientId: string;
  doctorName: string;
  departmentName: string;
  scheduledAt: string;
  duration: number;
  status: string;
  type: string;
  notes: string | null;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:    { label: 'En attente',  color: 'bg-yellow-100 text-yellow-700' },
  confirmed:  { label: 'Confirmé',    color: 'bg-green-100 text-green-700' },
  completed:  { label: 'Terminé',     color: 'bg-blue-100 text-blue-700' },
  cancelled:  { label: 'Annulé',      color: 'bg-red-100 text-red-500' },
  no_show:    { label: 'Non présenté',color: 'bg-gray-100 text-gray-500' },
};

const TYPE_MAP: Record<string, string> = {
  consultation_externe: 'Consultation externe',
  suivi:                'Suivi',
  urgence:              'Urgence',
  examen:               'Examen',
  intervention:         'Intervention',
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString('fr-DZ', { weekday:'short', day: '2-digit', month: 'long', year: 'numeric' });
}
function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' });
}

export function PatientAppointmentsTab({ patientId }: { patientId: string }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<Appointment[]>(`/appointments?patientId=${encodeURIComponent(patientId)}`);
      const items = Array.isArray(data) ? data : [];
      // Sort: upcoming first, then past
      items.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
      setAppointments(items);
    } catch {
      setError('Impossible de charger les rendez-vous.');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] gap-3 text-red-500">
        <AlertTriangle size={32} className="opacity-60" />
        <p className="text-sm">{error}</p>
        <button onClick={load} className="flex items-center gap-1.5 text-xs border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
          <RefreshCw size={12} /> Réessayer
        </button>
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] text-gray-400 gap-2">
        <Calendar size={40} className="opacity-20" />
        <p className="font-semibold text-sm">Aucun rendez-vous enregistré</p>
        <p className="text-xs">Les rendez-vous de ce patient apparaîtront ici.</p>
      </div>
    );
  }

  const now = new Date();
  const upcoming = appointments.filter(a => new Date(a.scheduledAt) >= now && a.status !== 'cancelled');
  const past     = appointments.filter(a => new Date(a.scheduledAt) < now || a.status === 'cancelled');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Rendez-vous</h3>
        <div className="flex items-center gap-2">
          {upcoming.length > 0 && (
            <span className="text-xs text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
              {upcoming.length} à venir
            </span>
          )}
          <span className="text-xs text-gray-400">{appointments.length} au total</span>
          <button onClick={load} className="text-gray-400 hover:text-gray-600 transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {appointments.map(a => {
          const s = STATUS_MAP[a.status] ?? { label: a.status, color: 'bg-gray-100 text-gray-500' };
          const isPast = new Date(a.scheduledAt) < now;
          return (
            <div key={a.id} className={`bg-white border rounded-xl p-4 ${isPast ? 'border-gray-100 opacity-75' : 'border-blue-100'}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-gray-800 text-sm">{TYPE_MAP[a.type] ?? a.type}</span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Dr. <span className="font-medium">{a.doctorName}</span> · {a.departmentName}
                  </p>
                  {a.notes && <p className="text-xs text-gray-400 mt-1 italic">{a.notes}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-gray-700">{fmt(a.scheduledAt)}</p>
                  <p className="text-xs text-gray-400">{fmtTime(a.scheduledAt)} · {a.duration} min</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
