/**
 * Ambulances — Live dispatch board from MockRepository.
 * No local mock data.
 */
import { Truck, CheckCircle, AlertTriangle, Clock, Navigation } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useMockRepository } from '@/store/MockRepository';
import { useAuth } from '@/store/AuthContext';
import type { AmbulanceStatus } from '@/types/emergency';
import type { AuditCtx } from '@/types/repository';

const STATUS_COLOR: Record<AmbulanceStatus, string> = {
  disponible:        'border-green-300 bg-green-50',
  en_route:          'border-blue-300 bg-blue-50',
  vers_patient:      'border-blue-300 bg-blue-50',
  sur_place:         'border-purple-300 bg-purple-50',
  transport_patient: 'border-orange-300 bg-orange-50',
  vers_hopital:      'border-orange-300 bg-orange-50',
  maintenance:       'border-gray-200 bg-gray-50 opacity-70',
  hors_service:      'border-gray-200 bg-gray-50 opacity-50',
};

const STATUS_LABEL: Record<AmbulanceStatus, string> = {
  disponible:        'Disponible',
  en_route:          'En route',
  vers_patient:      'Vers patient',
  sur_place:         'Sur place',
  transport_patient: 'Transport patient',
  vers_hopital:      'Vers hôpital',
  maintenance:       'Maintenance',
  hors_service:      'Hors service',
};

const STATUS_ICON: Record<AmbulanceStatus, React.ElementType> = {
  disponible:        CheckCircle,
  en_route:          Navigation,
  vers_patient:      Navigation,
  sur_place:         AlertTriangle,
  transport_patient: Truck,
  vers_hopital:      Truck,
  maintenance:       Clock,
  hors_service:      AlertTriangle,
};

const FLOW: Partial<Record<AmbulanceStatus, AmbulanceStatus[]>> = {
  disponible:        ['vers_patient', 'en_route'],
  en_route:          ['sur_place', 'vers_hopital', 'disponible'],
  vers_patient:      ['sur_place', 'disponible'],
  sur_place:         ['transport_patient', 'vers_hopital', 'disponible'],
  transport_patient: ['vers_hopital', 'disponible'],
  vers_hopital:      ['disponible'],
};

export default function Ambulances() {
  const { ambulances, updateAmbulanceStatus } = useMockRepository();
  const { user } = useAuth();
  const ctx: AuditCtx = { userId: user?.id ?? 'sys', userName: user ? `${user.firstName} ${user.lastName}` : 'Système', userRole: user?.role ?? 'admin' };

  const disponible = ambulances.filter(a => a.status === 'disponible').length;
  const active     = ambulances.filter(a => ['en_route', 'vers_patient', 'sur_place', 'transport_patient', 'vers_hopital'].includes(a.status)).length;
  const maintenance= ambulances.filter(a => a.status === 'maintenance' || a.status === 'hors_service').length;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5">
        <PageHeader
          title="Ambulances"
          subtitle="Tableau de bord des ambulances en temps réel"
          actions={
            disponible === 0 ? (
              <span className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-red-50 border border-red-200 text-red-700 rounded-full font-medium">
                <AlertTriangle size={12} /> Aucune ambulance disponible
              </span>
            ) : undefined
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Disponibles', value: disponible, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'En mission',  value: active,     icon: Truck,       color: 'text-blue-600',  bg: 'bg-blue-50' },
            { label: 'Maintenance', value: maintenance, icon: Clock,      color: 'text-gray-500',  bg: 'bg-gray-50' },
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

        {/* Ambulance cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ambulances.map(amb => {
            const StatusIcon = STATUS_ICON[amb.status] ?? Truck;
            const nextStatuses = FLOW[amb.status] ?? [];

            return (
              <div key={amb.id} className={`border-2 rounded-2xl p-4 transition-all ${STATUS_COLOR[amb.status] ?? ''}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <StatusIcon size={18} className="text-gray-600" />
                    <div>
                      <p className="font-bold text-gray-800">{amb.callSign}</p>
                      {amb.crew && <p className="text-xs text-gray-500">Équipage : {amb.crew}</p>}
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white/70 border border-white/80">
                    {STATUS_LABEL[amb.status] ?? amb.status}
                  </span>
                </div>

                {amb.patientName && (
                  <div className="bg-white/70 rounded-xl p-2.5 mb-3">
                    <p className="text-xs font-semibold text-gray-700">Patient transporté</p>
                    <p className="text-xs text-gray-500 mt-0.5">{amb.patientName}{amb.chiefComplaint ? ` — ${amb.chiefComplaint}` : ''}</p>
                  </div>
                )}

                {/* Dispatch buttons */}
                {nextStatuses.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {nextStatuses.map(next => (
                      <button
                        key={next}
                        onClick={() => updateAmbulanceStatus(amb.id, next)}
                        className="text-xs bg-white/80 border border-gray-200 text-gray-700 rounded-lg px-2.5 py-1 hover:bg-white transition-colors"
                      >
                        → {STATUS_LABEL[next]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
