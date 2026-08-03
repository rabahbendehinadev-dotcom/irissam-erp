import { useState, Suspense, lazy, useEffect } from 'react';
import { useRoute } from 'wouter';
import { ScrollableTabBar } from '@/components/ui/ScrollableTabBar';
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

      {/* Tab bar — scrollable on all devices */}
      <div className="sticky top-[104px] z-20 bg-white border-b border-gray-200 shadow-sm print:hidden">
        <ScrollableTabBar
          tabs={TABS.map(tab => ({
            id: tab.key,
            label: tab.label,
            icon: tab.icon,
            shortLabel: tab.shortLabel,
          }))}
          activeTab={activeTab}
          onTabChange={id => setActiveTab(id as TabKey)}
          iconSize={13}
          className="px-2"
        />
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

interface ApiVisit {
  visitId: string;
  patientId: string;
  encounterId: string;
  priority: string;
  status: string;
  chiefComplaint: string;
  mechanism?: string | null;
  triageNotes?: string | null;
  byAmbulance: boolean;
  isMinor: boolean;
  tags: string[];
  arrivalTime: string;
  assignedDoctorName?: string | null;
  assignedNurseName?: string | null;
  assignedRoomName?: string | null;
}

function buildEmergencyPatient(p: ApiPatient, v: ApiVisit | null): EmergencyPatient {
  return {
    id:               v?.visitId ?? p.id,
    visitId:          v?.visitId,
    patientId:        p.id,
    mpiId:            p.mpiId ?? p.mrn ?? p.id,
    firstName:        p.firstName,
    lastName:         p.lastName,
    dateOfBirth:      p.dateOfBirth ?? '',
    gender:           (p.gender === 'F' ? 'F' : 'M') as 'M' | 'F',
    bloodType:        p.bloodType ?? '',
    allergies:        p.allergies ?? [],
    chronicDiseases:  p.chronicDiseases ?? [],
    phone:            p.phone ?? '',
    age:              p.dateOfBirth
      ? Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
      : 0,
    // Visit fields (may fall back to safe defaults if no active visit)
    priority:         (v?.priority as EmergencyPatient['priority']) ?? 'P3',
    status:           (v?.status as EmergencyPatient['status']) ?? 'en_soins',
    arrivalTime:      v?.arrivalTime ?? new Date().toISOString(),
    chiefComplaint:   v?.chiefComplaint ?? '',
    mechanism:        v?.mechanism ?? undefined,
    triageNotes:      v?.triageNotes ?? undefined,
    byAmbulance:      v?.byAmbulance ?? false,
    isMinor:          v?.isMinor ?? false,
    tags:             v?.tags ?? [],
    assignedDoctor:   v?.assignedDoctorName ?? undefined,
    assignedNurse:    v?.assignedNurseName  ?? undefined,
    assignedRoom:     v?.assignedRoomName   ?? undefined,
  };
}

// ─── Main page component ─────────────────────────────────────────────────────

export default function EmergencyPatientDetail() {
  const [, params] = useRoute('/emergencies/:id');
  const patientId = params?.id ?? '';

  const [patient, setPatient] = useState<EmergencyPatient | null>(null);
  const [visitId, setVisitId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<number | null>(null);

  const loadPatient = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load patient demographics and active emergency visit in parallel
      const [patientData, visitData] = await Promise.allSettled([
        apiClient.get<ApiPatient>(`/patients/${patientId}`),
        apiClient.get<ApiVisit>(`/emergencies/visits/by-patient/${patientId}`),
      ]);

      if (patientData.status === 'rejected') {
        const status = (patientData.reason as { status?: number })?.status ?? 500;
        setError(status);
        return;
      }

      const apiPatient = patientData.value;
      const apiVisit   = visitData.status === 'fulfilled' ? visitData.value : null;

      const merged = buildEmergencyPatient(apiPatient, apiVisit);
      setPatient(merged);
      setVisitId(apiVisit?.visitId);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status ?? 500;
      setError(status);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (patientId) void loadPatient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  if (loading) return <PageSkeleton />;
  if (error)   return <PatientError status={error} onRetry={loadPatient} />;

  return (
    <EmergencyDossierProvider patientId={patientId} visitId={visitId} patient={patient}>
      <DossierPage />
    </EmergencyDossierProvider>
  );
}
