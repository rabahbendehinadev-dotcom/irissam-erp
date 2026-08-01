import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { X, Phone, MapPin, Droplets, ArrowRight, AlertTriangle, User } from 'lucide-react';
import { MOCK_PATIENTS } from '@/mock';
import { PatientAvatar } from '@/components/shared/PatientAvatar';
import { PatientStatusBadge } from '@/components/patients/PatientStatusBadge';
import { calculateAge, formatDate } from '@/utils/format';
import { cn } from '@/lib/utils';
import { useGetPatientsList } from '@workspace/api-client-react';
import type { Patient } from '@/types';

interface PatientDrawerProps {
  patientId: string | null;
  onClose: () => void;
}

/** Build a Patient-compatible object from API list item data. */
function apiToDrawerPatient(raw: Record<string, unknown>): Patient {
  const firstName = (raw.firstName as string) ?? '';
  const lastName  = (raw.lastName  as string) ?? '';
  return {
    id:           raw.id as string,
    mpiId:        (raw.mpiId as string) ?? '',
    fileNumber:   (raw.internalNumber as string) ?? (raw.mpiId as string) ?? '',
    firstName,
    lastName,
    status:       (raw.status as Patient['status']) ?? 'active',
    gender:       (raw.gender as Patient['gender']) ?? 'M',
    dateOfBirth:  (raw.dateOfBirth as string) ?? '',
    bloodType:    (raw.bloodType as Patient['bloodType']) ?? undefined,
    rhesus:       undefined,
    phone:        (raw.phone as string) ?? undefined,
    wilaya:       undefined,
    commune:      undefined,
    isIncomplete: Boolean(raw.isIncomplete),
    potentialDuplicate: Boolean(raw.potentialDuplicate),
    syncStatus:   (raw.syncStatus as Patient['syncStatus']) ?? 'synced',
    medical:      undefined,
    createdAt:    (raw.createdAt as string) ?? new Date().toISOString(),
    updatedAt:    (raw.updatedAt as string) ?? new Date().toISOString(),
  } as unknown as Patient;
}

export function PatientDrawer({ patientId, onClose }: PatientDrawerProps) {
  const [, setLocation] = useLocation();

  // Always call the hook; result is cached from Patients page visits
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: apiPatients } = useGetPatientsList({} as any);

  // 1. Try mock data first (handles p-* IDs from mock-only pages)
  // 2. Fall back to API list (handles db-* IDs from real API data)
  const patient: Patient | null = (() => {
    if (!patientId) return null;
    const mock = MOCK_PATIENTS.find(p => p.id === patientId);
    if (mock) return mock;
    const apiMatch = (apiPatients ?? []).find(
      (p) => (p as unknown as Record<string, unknown>).id === patientId,
    );
    return apiMatch ? apiToDrawerPatient(apiMatch as unknown as Record<string, unknown>) : null;
  })();

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const isOpen = !!patientId;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-200',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={cn(
          'fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-sm font-semibold text-gray-700">Dossier patient</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!patient ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2 p-8">
              <User size={40} className="opacity-30" />
              <p className="text-sm text-center">
                {patientId
                  ? 'Patient introuvable.'
                  : 'Aucun patient sélectionné.'}
              </p>
            </div>
          ) : (
            <>
              {/* Critical notes banner */}
              {patient.medical?.criticalNotes && (
                <div className="flex items-start gap-2 px-5 py-3 bg-red-50 border-b border-red-200">
                  <AlertTriangle size={14} className="text-red-600 shrink-0 mt-0.5" />
                  <p className="text-xs font-medium text-red-700">{patient.medical.criticalNotes}</p>
                </div>
              )}

              {/* Profile header */}
              <div className="px-5 py-5 border-b border-gray-100">
                <div className="flex items-start gap-3">
                  <PatientAvatar
                    firstName={patient.firstName}
                    lastName={patient.lastName}
                    size="lg"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-base leading-tight">
                      {patient.lastName} {patient.firstName}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <PatientStatusBadge status={patient.status} />
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {patient.mpiId && (
                        <span className="text-[11px] font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                          MPI {patient.mpiId}
                        </span>
                      )}
                      {patient.fileNumber && (
                        <span className="text-[11px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                          {patient.fileNumber}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Key info */}
              <div className="px-5 py-4 space-y-3">
                {/* Demographics */}
                {patient.dateOfBirth && (
                  <Row
                    icon={<User size={14} className="text-gray-400" />}
                    label={`${patient.gender === 'M' ? 'Homme' : 'Femme'} · ${calculateAge(patient.dateOfBirth)} ans`}
                    sub={formatDate(patient.dateOfBirth)}
                  />
                )}

                {/* Blood type */}
                {patient.bloodType && (
                  <Row
                    icon={<Droplets size={14} className="text-red-500" />}
                    label={`${patient.bloodType}${patient.rhesus ? ` (Rh ${patient.rhesus})` : ''}`}
                    highlight="red"
                  />
                )}

                {/* Phone */}
                {patient.phone && (
                  <Row
                    icon={<Phone size={14} className="text-gray-400" />}
                    label={patient.phone}
                  />
                )}

                {/* Location */}
                {(patient.wilaya || patient.commune) && (
                  <Row
                    icon={<MapPin size={14} className="text-gray-400" />}
                    label={[patient.commune, patient.wilaya].filter(Boolean).join(', ')}
                  />
                )}
              </div>

              {/* Allergies */}
              {(patient.medical?.allergies?.length ?? 0) > 0 && (
                <div className="px-5 pb-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Allergies</p>
                  <div className="flex flex-wrap gap-1.5">
                    {patient.medical!.allergies!.map(a => (
                      <span key={a} className="text-xs bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Chronic diseases */}
              {(patient.medical?.chronicDiseases?.length ?? 0) > 0 && (
                <div className="px-5 pb-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Maladies chroniques</p>
                  <div className="flex flex-wrap gap-1.5">
                    {patient.medical!.chronicDiseases!.map(d => (
                      <span key={d} className="text-xs bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer CTA */}
        {patient && (
          <div className="shrink-0 px-5 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => { onClose(); setLocation(`/patients/${patient.id}`); }}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              Voir le dossier complet
              <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function Row({
  icon,
  label,
  sub,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  highlight?: 'red';
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className={cn('text-sm', highlight === 'red' ? 'font-semibold text-red-700' : 'text-gray-800')}>
          {label}
        </p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}
