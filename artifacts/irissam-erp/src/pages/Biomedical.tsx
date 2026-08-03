import { lazy, Suspense } from "react";
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
  { id: "dashboard",   label: "Tableau de bord" },
  { id: "equipment",   label: "Équipements" },
  { id: "work-orders", label: "Ordres de travail" },
  { id: "calibrations",label: "Calibrations" },
  { id: "incidents",   label: "Incidents" },
  { id: "spare-parts", label: "Pièces détachées" },
  { id: "contracts",   label: "Contrats" },
  { id: "inspections", label: "Inspections" },
  { id: "disposals",   label: "Réformes" },
  { id: "suppliers",   label: "Fournisseurs" },
  { id: "catalog",     label: "Catalogue" },
  { id: "analytics",   label: "Analytique" },
];

const Spinner = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
  </div>
);

export default function BiomedicalPage() {
  return (
    <DashboardLayout title="Gestion Biomédicale">
      <ScrollableTabBar tabs={TABS} storageKey="biomed-tab">
        {(tab: string) => (
          <Suspense fallback={<Spinner />}>
            {tab === "dashboard"    && <BiomedDashboard />}
            {tab === "equipment"    && <EquipmentPage />}
            {tab === "work-orders"  && <WorkOrdersPage />}
            {tab === "calibrations" && <CalibrationsPage />}
            {tab === "incidents"    && <IncidentsPage />}
            {tab === "spare-parts"  && <SparePartsPage />}
            {tab === "contracts"    && <ContractsPage />}
            {tab === "inspections"  && <InspectionsPage />}
            {tab === "disposals"    && <DisposalsPage />}
            {tab === "suppliers"    && <SuppliersPage />}
            {tab === "catalog"      && <CatalogPage />}
            {tab === "analytics"    && <AnalyticsPage />}
          </Suspense>
        )}
      </ScrollableTabBar>
    </DashboardLayout>
  );
}
