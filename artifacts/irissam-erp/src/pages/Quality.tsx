import { lazy, Suspense, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ScrollableTabBar } from '@/components/ui/ScrollableTabBar';
import { useTranslation } from '@/i18n';

const QualityDashboard       = lazy(() => import('@/components/quality/QualityDashboard'));
const IncidentsPage          = lazy(() => import('@/components/quality/IncidentsPage'));
const NonConformitiesPage    = lazy(() => import('@/components/quality/NonConformitiesPage'));
const CapaPage               = lazy(() => import('@/components/quality/CapaPage'));
const RisksPage              = lazy(() => import('@/components/quality/RisksPage'));
const AuditsPage             = lazy(() => import('@/components/quality/AuditsPage'));
const DocumentsPage          = lazy(() => import('@/components/quality/DocumentsPage'));
const IndicatorsPage         = lazy(() => import('@/components/quality/IndicatorsPage'));
const MeetingsPage           = lazy(() => import('@/components/quality/MeetingsPage'));
const ChecklistsPage         = lazy(() => import('@/components/quality/ChecklistsPage'));
const ImprovementsPage       = lazy(() => import('@/components/quality/ImprovementsPage'));
const QualityAnalyticsPage   = lazy(() => import('@/components/quality/QualityAnalyticsPage'));

const TABS = [
  { id: 'dashboard',       label: 'Tableau de bord' },
  { id: 'incidents',       label: 'Incidents' },
  { id: 'nc',              label: 'Non-conformités' },
  { id: 'capa',            label: 'CAPA' },
  { id: 'risks',           label: 'Risques' },
  { id: 'audits',          label: 'Audits' },
  { id: 'documents',       label: 'Documents' },
  { id: 'indicators',      label: 'Indicateurs' },
  { id: 'meetings',        label: 'Réunions' },
  { id: 'checklists',      label: 'Checklists' },
  { id: 'improvements',    label: 'Améliorations' },
  { id: 'analytics',       label: 'Analytics' },
];

const TAB_COMPONENTS: Record<string, React.ComponentType> = {
  dashboard:    QualityDashboard,
  incidents:    IncidentsPage,
  nc:           NonConformitiesPage,
  capa:         CapaPage,
  risks:        RisksPage,
  audits:       AuditsPage,
  documents:    DocumentsPage,
  indicators:   IndicatorsPage,
  meetings:     MeetingsPage,
  checklists:   ChecklistsPage,
  improvements: ImprovementsPage,
  analytics:    QualityAnalyticsPage,
};

const Skeleton = () => (
  <div className="space-y-4 p-4">
    {[1,2,3].map(i => (
      <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
    ))}
  </div>
);

export default function QualityPage() {
  const [tab, setTab] = useState(() => {
    try { return localStorage.getItem('quality-tab') ?? 'dashboard'; } catch { return 'dashboard'; }
  });
  const { t } = useTranslation();

  const handleTab = (id: string) => {
    setTab(id);
    try { localStorage.setItem('quality-tab', id); } catch {}
  };

  const ActiveComponent = TAB_COMPONENTS[tab] ?? QualityDashboard;

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">
        <ScrollableTabBar
          tabs={TABS}
          activeTab={tab}
          onTabChange={handleTab}
        />
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <Suspense fallback={<Skeleton />}>
            <ActiveComponent />
          </Suspense>
        </div>
      </div>
    </DashboardLayout>
  );
}
