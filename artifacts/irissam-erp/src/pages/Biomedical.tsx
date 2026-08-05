import { lazy, Suspense, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ScrollableTabBar } from "@/components/ui/ScrollableTabBar";

const BiomedDashboard  = lazy(() => import("@/components/biomedical/BiomedDashboard"));
const EquipmentPage    = lazy(() => import("@/components/biomedical/EquipmentPage"));
const WorkOrdersPage   = lazy(() => import("@/components/biomedical/WorkOrdersPage"));
const CalibrationsPage = lazy(() => import("@/components/biomedical/CalibrationsPage"));
const IncidentsPage    = lazy(() => import("@/components/biomedical/IncidentsPage"));
const SparePartsPage   = lazy(() => import("@/components/biomedical/SparePartsPage"));
const ContractsPage    = lazy(() => import("@/components/biomedical/ContractsPage"));
const InspectionsPage  = lazy(() => import("@/components/biomedical/InspectionsPage"));
const DisposalsPage    = lazy(() => import("@/components/biomedical/DisposalsPage"));
const SuppliersPage    = lazy(() => import("@/components/biomedical/BiomedSuppliersPage"));
const CatalogPage      = lazy(() => import("@/components/biomedical/CatalogPage"));
const AnalyticsPage    = lazy(() => import("@/components/biomedical/BiomedAnalyticsPage"));

const TABS = [
  { id: "dashboard",    label: "Tableau de bord" },
  { id: "equipment",    label: "Équipements" },
  { id: "work-orders",  label: "Ordres de travail" },
  { id: "calibrations", label: "Calibrations" },
  { id: "incidents",    label: "Incidents" },
  { id: "spare-parts",  label: "Pièces détachées" },
  { id: "contracts",    label: "Contrats" },
  { id: "inspections",  label: "Inspections" },
  { id: "disposals",    label: "Réformes" },
  { id: "suppliers",    label: "Fournisseurs" },
  { id: "catalog",      label: "Catalogue" },
  { id: "analytics",    label: "Analytique" },
];

const Spinner = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
  </div>
);

export default function BiomedicalPage() {
  const [activeTab, setActiveTab] = useState(() => {
    try { return localStorage.getItem("biomed-tab") ?? "dashboard"; } catch { return "dashboard"; }
  });

  const handleTabChange = (id: string) => {
    setActiveTab(id);
    try { localStorage.setItem("biomed-tab", id); } catch { /* ignore */ }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full min-h-0">
        <ScrollableTabBar tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />
        <div className="flex-1 overflow-auto">
          <Suspense fallback={<Spinner />}>
            {activeTab === "dashboard"    && <BiomedDashboard />}
            {activeTab === "equipment"    && <EquipmentPage />}
            {activeTab === "work-orders"  && <WorkOrdersPage />}
            {activeTab === "calibrations" && <CalibrationsPage />}
            {activeTab === "incidents"    && <IncidentsPage />}
            {activeTab === "spare-parts"  && <SparePartsPage />}
            {activeTab === "contracts"    && <ContractsPage />}
            {activeTab === "inspections"  && <InspectionsPage />}
            {activeTab === "disposals"    && <DisposalsPage />}
            {activeTab === "suppliers"    && <SuppliersPage />}
            {activeTab === "catalog"      && <CatalogPage />}
            {activeTab === "analytics"    && <AnalyticsPage />}
          </Suspense>
        </div>
      </div>
    </DashboardLayout>
  );
}
