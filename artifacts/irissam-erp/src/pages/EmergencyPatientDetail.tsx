import { useState, Suspense, lazy } from 'react';
import { useRoute } from 'wouter';
import {
  Activity, FlaskConical, Scan, Pill, FileText,
  Eye, ClipboardList, CheckCircle2, Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmergencyDossierProvider } from '@/contexts/EmergencyDossierContext';
import { useMockRepository } from '@/store/MockRepository';
import { DossierHeader } from '@/components/emergencies/dossier/DossierHeader';
import { DossierAlertBanner } from '@/components/emergencies/dossier/DossierAlertBanner';
import { DossierTimeline } from '@/components/emergencies/dossier/DossierTimeline';

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
      {/* Sticky header + alert banner + timeline */}
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
                  'flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap',
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
      <main className="flex-1 overflow-x-hidden max-w-7xl mx-auto w-full px-4 py-4 pb-12">
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
      </main>
    </div>
  );
}

// ─── Exported route component ─────────────────────────────────────────────────

export default function EmergencyPatientDetail() {
  const [, params] = useRoute('/emergencies/:id');
  const patientId = params?.id ?? 'ep-01';
  const { getPatient } = useMockRepository();
  const patient = getPatient(patientId);

  return (
    <EmergencyDossierProvider patientId={patientId} patient={patient}>
      <DossierPage />
    </EmergencyDossierProvider>
  );
}
