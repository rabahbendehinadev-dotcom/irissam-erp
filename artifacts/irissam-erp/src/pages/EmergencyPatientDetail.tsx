import { useState, Suspense, lazy, useEffect } from 'react';
import { useRoute } from 'wouter';
import {
  Activity, FlaskConical, Scan, Pill, FileText,
  Eye, ClipboardList, CheckCircle2, Shield, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmergencyDossierProvider } from '@/contexts/EmergencyDossierContext';
import { apiClient } from '@/services/api/client';
import { DossierHeader } from '@/components/emergencies/dossier/DossierHeader';
import { DossierAlertBanner } from '@/components/emergencies/dossier/DossierAlertBanner';
import { DossierTimeline } from '@/components/emergencies/dossier/DossierTimeline';
import type { EmergencyPatient } from '@/types/emergency';

// ─── Lazy tab content ─────────────────────────────────────────────────────────

const TabEvaluation  = lazy(() => import('@/components/emergencies/dossier/TabEvaluation').then(m => ({ default: m.TabEvaluation })));
const TabExamen      = lazy(() => import('@/components/emergencies/dossier/TabExamen').then(m => ({ default: m.TabExamen })));
const TabOrdres      = lazy(() => import('@/components/emergencies/dossier/TabOrdres').then(m => ({ default: m.TabOrdres })));
const TabTraitement  = lazy(() => import('@/components/emergencies/dossier/TabTraitement').then(m => ({ default: m.TabTraitement })));
const TabNotes       = lazy(() => import('@/components/emergencies/dossier/TabNotes').then(m => ({ default: m.TabNotes })));
const TabObservation = lazy(() => import('@/components/emergencies/dossier/TabObservation').then(m => ({ default: m.TabObservation })));
const TabDecision    = lazy(() => import('@/components/emergencies/dossier/TabDecision').then(m => ({ default: m.TabDecision })));
const TabAudit       = lazy(() => import('@/components/emergencies/dossier/TabAudit').then(m => ({ default: m.TabAudit })));

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabKey = 'evaluation' | 'examen' | 'ordres' | 'traitement' | 'notes' | 'observation' | 'decision' | 'audit';

const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode; shortLabel?: string }> = [
  { key: 'evaluation',  label: 'Évaluation',        shortLabel: 'Éval.',    icon: <Activity size={13} /> },
  { key: 'examen',      label: 'Examen clinique',    shortLabel: 'Examen',   icon: <ClipboardList size={13} /> },
  { key: 'ordres',      label: 'Ordres',             shortLabel: 'Ordres',   icon: <FlaskConical size={13} /> },
  { key: 'traitement',  label: 'Traitement',         shortLabel: 'Traitem.', icon: <Pill size={13} /> },
  { key: 'notes',       label: 'Notes',              shortLabel: 'Notes',    icon: <FileText size={13} /> },
  { key: 'observation', label: 'Observation',        shortLabel: 'Obs.',     icon: <Eye size={13} /> },
  { key: 'decision',    label: 'Décision',           shortLabel: 'Décision', icon: <CheckCircle2 size={13} /> },
  { key: 'audit',       label: 'Audit',              shortLabel: 'Audit',    icon: <Shield size={13} /> },
];

function TabSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-24 bg-gray-100 rounded-xl" />
      ))}
    </div>
  );
}

// ─── Inner page (has dossier context) ────────────────────────────────────────

function DossierPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('evaluation');

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <DossierHeader />
      <DossierAlertBanner />
      <DossierTimeline />

      {/* Tab bar */}
      <div className="sticky top-[104px] z-20 bg-white border-b border-gray-200 shadow-sm print:hidden">
        <div className="overflow-x-auto">
          <div className="flex min-w-max px-4">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors',
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                )}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel ?? tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        <Suspense fallback={<TabSkeleton />}>
          {activeTab === 'evaluation'  && <TabEvaluation />}
          {activeTab === 'examen'      && <TabExamen />}
          {activeTab === 'ordres'      && <TabOrdres />}
          {activeTab === 'traitement'  && <TabTraitement />}
          {activeTab === 'notes'       && <TabNotes />}
          {activeTab === 'observation' && <TabObservation />}
          {activeTab === 'decision'    && <TabDecision />}
          {activeTab === 'audit'       && <TabAudit />}
        </Suspense>
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 animate-pulse">
      <div className="h-28 bg-white border-b border-gray-200 shadow-sm" />
      <div className="h-12 bg-white border-b border-gray-200" />
      <div className="flex-1 p-6 space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
      </div>
    </div>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────

function PatientError({ status, onRetry }: { status: number; onRetry: () => void }) {
  const is404 = status === 404;
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 gap-4 p-6">
      <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
        <AlertTriangle size={32} className="text-red-500" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-1">
          {is404 ? 'Patient introuvable' : 'Erreur de chargement'}
        </h2>
        <p className="text-sm text-gray-500 max-w-xs">
          {is404
            ? 'Ce patient n\'existe pas ou a été supprimé du registre.'
            : 'Impossible de charger les données patient. Vérifiez votre connexion.'}
        </p>
      </div>
      {!is404 && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw size={14} />
          Réessayer
        </button>
      )}
    </div>
  );
}

// ─── API patient shape ────────────────────────────────────────────────────────

interface ApiPatient {
  id: string;
  mrn?: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  bloodType?: string;
  allergies?: string[];
  chronicDiseases?: string[];
  phone?: string;
  mpiId?: string;
}

function apiPatientToEmergency(p: ApiPatient): EmergencyPatient {
  return {
    id:              p.id,
    mrn:             p.mrn ?? p.mpiId ?? p.id,
    firstName:       p.firstName,
    lastName:        p.lastName,
    dateOfBirth:     p.dateOfBirth ?? '',
    gender:          (p.gender as 'M' | 'F' | 'other') ?? 'other',
    bloodType:       p.bloodType ?? '',
    allergies:       p.allergies ?? [],
    chronicDiseases: p.chronicDiseases ?? [],
    phone:           p.phone ?? '',
    mpiId:           p.mpiId ?? p.id,
  };
}

// ─── Main page component ─────────────────────────────────────────────────────

export default function EmergencyPatientDetail() {
  const [, params] = useRoute('/emergencies/:id');
  const patientId = params?.id ?? '';

  const [patient, setPatient] = useState<EmergencyPatient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<number | null>(null);

  const loadPatient = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<ApiPatient>(`/patients/${patientId}`);
      setPatient(apiPatientToEmergency(data));
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status ?? 500;
      setError(status);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (patientId) loadPatient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  if (loading) return <PageSkeleton />;
  if (error)   return <PatientError status={error} onRetry={loadPatient} />;

  return (
    <EmergencyDossierProvider patientId={patientId} patient={patient}>
      <DossierPage />
    </EmergencyDossierProvider>
  );
}
