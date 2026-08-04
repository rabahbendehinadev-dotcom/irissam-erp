import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/store/AuthContext';
import { apiClient } from '@/services/api/client';
import { DoctorPortalLayout } from '@/layouts/DoctorPortalLayout';
import {
  Calendar,
  Clock,
  CheckCircle2,
  FlaskConical,
  AlertTriangle,
  BedDouble,
  AlertCircle,
  Pill,
  MessageSquare,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardKpis {
  appointmentsToday: number;
  pendingPatients: number;
  completedConsultations: number;
  labResultsToReview: number;
  criticalResults: number;
  hospitalizedCount: number;
  emergenciesAssigned: number;
  prescriptionsToday: number;
  overdueTasks: number;
  unreadMessages: number;
}

interface NextPatient {
  id: string;
  patient_id: string;
  patient_name: string;
  mrn: string;
  appointment_time: string;
  notes: string;
}

interface CriticalLab {
  id: string;
  patient_name: string;
  test_name: string;
  result_value: string;
  result_unit: string;
}

interface DashboardData {
  kpis: DashboardKpis;
  nextPatient: NextPatient | null;
  criticalLabs: CriticalLab[];
}

const defaultKpis: DashboardKpis = {
  appointmentsToday: 0,
  pendingPatients: 0,
  completedConsultations: 0,
  labResultsToReview: 0,
  criticalResults: 0,
  hospitalizedCount: 0,
  emergenciesAssigned: 0,
  prescriptionsToday: 0,
  overdueTasks: 0,
  unreadMessages: 0,
};

function KpiCard({
  label,
  count,
  icon: Icon,
  colorClass,
  pulse,
}: {
  label: string;
  count: number;
  icon: React.ElementType;
  colorClass: string;
  pulse?: boolean;
}) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-4',
        pulse && count > 0 && 'ring-2 ring-red-400 ring-offset-1',
      )}
    >
      <div className={cn('w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0', colorClass)}>
        <Icon size={22} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900">{count}</p>
        <p className="text-xs text-gray-500 leading-tight">{label}</p>
      </div>
      {pulse && count > 0 && (
        <span className="ml-auto w-3 h-3 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
      )}
    </div>
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('bg-gray-200 rounded-lg animate-pulse', className)} />;
}

export default function DoctorDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [data, setData] = useState<DashboardData>({
    kpis: defaultKpis,
    nextPatient: null,
    criticalLabs: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acknowledging, setAcknowledging] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<DashboardData>('/api/doctor-portal/dashboard');
      setData(res as DashboardData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const acknowledge = async (id: string) => {
    setAcknowledging((prev) => new Set(prev).add(id));
    try {
      await apiClient.post(`/api/doctor-portal/results/${id}/acknowledge?type=lab`, {});
      setData((prev) => ({
        ...prev,
        criticalLabs: prev.criticalLabs.filter((l) => l.id !== id),
      }));
    } catch {
      // silent fail — retry available
    } finally {
      setAcknowledging((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const kpiDefs: {
    key: keyof DashboardKpis;
    label: string;
    icon: React.ElementType;
    color: string;
    pulse?: boolean;
  }[] = [
    { key: 'appointmentsToday',      label: 'RDV aujourd\'hui',        icon: Calendar,     color: 'bg-blue-500' },
    { key: 'pendingPatients',        label: 'Patients en attente',     icon: Clock,        color: 'bg-orange-500' },
    { key: 'completedConsultations', label: 'Consultations terminées', icon: CheckCircle2, color: 'bg-green-500' },
    { key: 'labResultsToReview',     label: 'Résultats à examiner',    icon: FlaskConical, color: 'bg-purple-500' },
    { key: 'criticalResults',        label: 'Résultats critiques',     icon: AlertTriangle, color: 'bg-red-500', pulse: true },
    { key: 'hospitalizedCount',      label: 'Hospitalisés',            icon: BedDouble,    color: 'bg-teal-500' },
    { key: 'emergenciesAssigned',    label: 'Urgences assignées',      icon: AlertCircle,  color: 'bg-red-600' },
    { key: 'prescriptionsToday',     label: 'Ordonnances du jour',     icon: Pill,         color: 'bg-indigo-500' },
    { key: 'overdueTasks',           label: 'Tâches en retard',        icon: Clock,        color: 'bg-amber-500' },
    { key: 'unreadMessages',         label: 'Messages non lus',        icon: MessageSquare, color: 'bg-slate-500' },
  ];

  if (loading) {
    return (
      <DoctorPortalLayout>
        <div className="p-6 space-y-6">
          <SkeletonBlock className="h-8 w-64" />
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-20" />
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <SkeletonBlock className="h-48" />
            <SkeletonBlock className="h-48" />
          </div>
        </div>
      </DoctorPortalLayout>
    );
  }

  if (error) {
    return (
      <DoctorPortalLayout>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <AlertCircle className="mx-auto text-red-400 mb-3" size={32} />
            <p className="text-red-700 font-medium mb-4">{error}</p>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
            >
              <RefreshCw size={14} />
              Réessayer
            </button>
          </div>
        </div>
      </DoctorPortalLayout>
    );
  }

  const { kpis, nextPatient, criticalLabs } = data;

  const quickActions = [
    { label: 'Nouvelle consultation', href: '/doctor-portal/patients-today', color: 'bg-blue-600 hover:bg-blue-700' },
    { label: 'Demander analyse',      href: '/doctor-portal/lab-orders/new',   color: 'bg-purple-600 hover:bg-purple-700' },
    { label: 'Prescrire',             href: '/doctor-portal/prescriptions/new', color: 'bg-indigo-600 hover:bg-indigo-700' },
    { label: 'Ajouter note',          href: '/doctor-portal/notes/new',         color: 'bg-teal-600 hover:bg-teal-700' },
    { label: 'Mes urgences',          href: '/doctor-portal/emergencies',        color: 'bg-red-600 hover:bg-red-700' },
    { label: 'Hospitalisés',          href: '/doctor-portal/hospitalized',       color: 'bg-green-600 hover:bg-green-700' },
  ];

  return (
    <DoctorPortalLayout>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Bonjour Dr. {user?.lastName}
          </h1>
          <p className="text-gray-500 text-sm capitalize mt-1">{today}</p>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {kpiDefs.map(({ key, label, icon, color, pulse }) => (
            <KpiCard
              key={key}
              label={label}
              count={kpis[key] ?? 0}
              icon={icon}
              colorClass={color}
              pulse={pulse}
            />
          ))}
        </div>

        {/* Two-col section */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Next Patient */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Clock size={16} className="text-blue-500" />
              Prochain patient
            </h2>
            {nextPatient ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900">{nextPatient.patient_name}</p>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                    {nextPatient.mrn}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  🕐 {nextPatient.appointment_time}
                </p>
                {nextPatient.notes && (
                  <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-2">
                    {nextPatient.notes}
                  </p>
                )}
                <button
                  onClick={() => setLocation(`/patients/${nextPatient.patient_id}`)}
                  className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm hover:bg-blue-100 transition-colors"
                >
                  Ouvrir le dossier <ChevronRight size={14} />
                </button>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Calendar size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aucun prochain patient</p>
              </div>
            )}
          </div>

          {/* Critical Results */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500" />
              Résultats critiques
              {criticalLabs.length > 0 && (
                <span className="ml-auto bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full animate-pulse">
                  {criticalLabs.length}
                </span>
              )}
            </h2>
            {criticalLabs.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {criticalLabs.map((lab) => (
                  <div key={lab.id} className="flex items-center justify-between bg-red-50 rounded-lg p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{lab.patient_name}</p>
                      <p className="text-xs text-red-600">
                        {lab.test_name}: <strong>{lab.result_value} {lab.result_unit}</strong>
                      </p>
                    </div>
                    <button
                      onClick={() => acknowledge(lab.id)}
                      disabled={acknowledging.has(lab.id)}
                      className="ml-2 flex-shrink-0 text-xs px-2 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {acknowledging.has(lab.id) ? '...' : 'Accuser réception'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <CheckCircle2 size={32} className="mx-auto mb-2 opacity-50 text-green-400" />
                <p className="text-sm">Aucun résultat critique</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Actions rapides</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.href}
                onClick={() => setLocation(action.href)}
                className={cn(
                  'px-3 py-3 rounded-xl text-white text-sm font-medium transition-colors text-center',
                  action.color,
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </DoctorPortalLayout>
  );
}
