/**
 * HR page — main entry point for the Ressources Humaines module.
 * Hosts tab-based navigation + sub-routes for employee detail.
 */
import { lazy, Suspense } from "react";
import { Route, Switch, useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ScrollableTabBar } from "@/components/ui/ScrollableTabBar";
import { PageErrorBoundary } from "@/components/shared/PageErrorBoundary";
import {
  LayoutDashboard, Users, FileText, Calendar,
  Clock, Plane, AlertCircle, Timer, Building2,
  CreditCard, UserCircle, Settings
} from "lucide-react";

// Lazy-loaded HR sub-pages
const HRDashboard   = lazy(() => import("@/components/hr/HRDashboard"));
const EmployeeList  = lazy(() => import("@/components/hr/EmployeeList"));
const EmployeeDetail = lazy(() => import("@/components/hr/EmployeeDetail"));
const ContractsPage = lazy(() => import("@/components/hr/ContractsPage"));
const PlanningPage  = lazy(() => import("@/components/hr/PlanningPage"));
const AttendancePage = lazy(() => import("@/components/hr/AttendancePage"));
const LeavesPage    = lazy(() => import("@/components/hr/LeavesPage"));
const AbsencesPage  = lazy(() => import("@/components/hr/AbsencesPage"));
const LateRecordsPage = lazy(() => import("@/components/hr/LateRecordsPage"));
const OvertimePage  = lazy(() => import("@/components/hr/OvertimePage"));
const PositionsPage = lazy(() => import("@/components/hr/PositionsPage"));
const BadgesPage    = lazy(() => import("@/components/hr/BadgesPage"));

const HR_TABS = [
  { path: "/hr",           label: "Tableau de bord",  icon: LayoutDashboard },
  { path: "/hr/employees", label: "Employés",         icon: Users },
  { path: "/hr/contracts", label: "Contrats",         icon: FileText },
  { path: "/hr/planning",  label: "Planning",         icon: Calendar },
  { path: "/hr/attendance",label: "Pointage",         icon: Clock },
  { path: "/hr/leaves",    label: "Congés",           icon: Plane },
  { path: "/hr/absences",  label: "Absences",         icon: AlertCircle },
  { path: "/hr/late",      label: "Retards",          icon: Timer },
  { path: "/hr/overtime",  label: "Heures Sup.",      icon: UserCircle },
  { path: "/hr/positions", label: "Postes / Dép.",    icon: Building2 },
  { path: "/hr/badges",    label: "Badges",           icon: CreditCard },
];

function HRTabNav() {
  const [location] = useLocation();
  const active = HR_TABS.findIndex(t =>
    t.path === "/hr" ? location === "/hr" : location.startsWith(t.path)
  );

  const activeId = active === -1 ? "hr-0" : `hr-${active}`;

  return (
    <ScrollableTabBar
      tabs={HR_TABS.map((t, i) => ({ id: `hr-${i}`, label: t.label, icon: t.icon }))}
      activeTab={activeId}
      onTabChange={(id: string) => {
        const idx = parseInt(id.replace("hr-",""), 10);
        if (!isNaN(idx)) window.history.pushState(null, "", HR_TABS[idx].path);
      }}
    />
  );
}

function HRSkeleton() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      <div className="h-8 bg-gray-100 rounded w-1/4" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
      </div>
      <div className="h-64 bg-gray-100 rounded-xl" />
    </div>
  );
}

export default function HRPage() {
  const [location] = useLocation();
  // Don't show tab nav on employee detail sub-page
  const isDetail = /^\/hr\/employees\/[^/]+$/.test(location);

  return (
    <DashboardLayout>
      {!isDetail && <HRTabNav />}
      <PageErrorBoundary>
        <Suspense fallback={<HRSkeleton />}>
          <Switch>
            <Route path="/hr/employees/:id" component={EmployeeDetail} />
            <Route path="/hr/employees"     component={EmployeeList} />
            <Route path="/hr/contracts"     component={ContractsPage} />
            <Route path="/hr/planning"      component={PlanningPage} />
            <Route path="/hr/attendance"    component={AttendancePage} />
            <Route path="/hr/leaves"        component={LeavesPage} />
            <Route path="/hr/absences"      component={AbsencesPage} />
            <Route path="/hr/late"          component={LateRecordsPage} />
            <Route path="/hr/overtime"      component={OvertimePage} />
            <Route path="/hr/positions"     component={PositionsPage} />
            <Route path="/hr/badges"        component={BadgesPage} />
            <Route path="/hr"               component={HRDashboard} />
          </Switch>
        </Suspense>
      </PageErrorBoundary>
    </DashboardLayout>
  );
}
