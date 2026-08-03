import { lazy, Suspense, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ScrollableTabBar } from "@/components/ui/ScrollableTabBar";
import { Package } from "lucide-react";

const StockDashboard    = lazy(() => import("@/components/medical-stock/StockDashboard"));
const ItemsPage         = lazy(() => import("@/components/medical-stock/ItemsPage"));
const BatchesPage       = lazy(() => import("@/components/medical-stock/BatchesPage"));
const MovementsPage     = lazy(() => import("@/components/medical-stock/MovementsPage"));
const PurchaseOrdersPage = lazy(() => import("@/components/medical-stock/PurchaseOrdersPage"));
const TransfersPage     = lazy(() => import("@/components/medical-stock/TransfersPage"));
const AdjustmentsPage   = lazy(() => import("@/components/medical-stock/AdjustmentsPage"));
const InventoryPage     = lazy(() => import("@/components/medical-stock/InventoryPage"));
const ConsumptionsPage  = lazy(() => import("@/components/medical-stock/ConsumptionsPage"));
const SuppliersPage     = lazy(() => import("@/components/medical-stock/SuppliersPage"));
const CategoriesPage    = lazy(() => import("@/components/medical-stock/CategoriesPage"));

type TabId =
  | "dashboard" | "items" | "batches" | "movements"
  | "purchase_orders" | "transfers" | "adjustments"
  | "inventory" | "consumptions" | "suppliers" | "categories";

const TABS = [
  { id: "dashboard",       label: "Tableau de bord" },
  { id: "items",           label: "Articles" },
  { id: "batches",         label: "Lots" },
  { id: "movements",       label: "Mouvements" },
  { id: "purchase_orders", label: "Commandes" },
  { id: "transfers",       label: "Transferts" },
  { id: "adjustments",     label: "Ajustements" },
  { id: "inventory",       label: "Inventaires" },
  { id: "consumptions",    label: "Consommations" },
  { id: "suppliers",       label: "Fournisseurs" },
  { id: "categories",      label: "Catégories" },
];

function LoadingTab() {
  return (
    <div className="space-y-4 animate-pulse p-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
      </div>
      <div className="h-64 bg-gray-200 rounded-xl" />
    </div>
  );
}

export default function MedicalStockPage() {
  const [tab, setTab] = useState<TabId>("dashboard");

  const content = () => {
    switch (tab) {
      case "dashboard":       return <StockDashboard />;
      case "items":           return <ItemsPage />;
      case "batches":         return <BatchesPage />;
      case "movements":       return <MovementsPage />;
      case "purchase_orders": return <PurchaseOrdersPage />;
      case "transfers":       return <TransfersPage />;
      case "adjustments":     return <AdjustmentsPage />;
      case "inventory":       return <InventoryPage />;
      case "consumptions":    return <ConsumptionsPage />;
      case "suppliers":       return <SuppliersPage />;
      case "categories":      return <CategoriesPage />;
      default:                return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Stock Médical</h1>
            <p className="text-xs text-gray-500">Gestion des articles, lots, commandes et inventaires</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <ScrollableTabBar
            tabs={TABS}
            activeTab={tab}
            onTabChange={(id) => setTab(id as TabId)}
          />
          <div className="p-4">
            <Suspense fallback={<LoadingTab />}>
              {content()}
            </Suspense>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
