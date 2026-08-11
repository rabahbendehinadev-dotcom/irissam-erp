import { lazy, Suspense, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ScrollableTabBar } from "@/components/ui/ScrollableTabBar";
import { PageErrorBoundary } from "@/components/shared/PageErrorBoundary";
import { useAuth } from "@/store/AuthContext";
import { Shield } from "lucide-react";

// ── Lazy-loaded tab components ─────────────────────────────────────────────────
const OverviewTab      = lazy(() => import("@/components/super-admin/OverviewTab"));
const UsersTab         = lazy(() => import("@/components/super-admin/UsersTab"));
const HealthTab        = lazy(() => import("@/components/super-admin/HealthTab"));
const DatabaseTab      = lazy(() => import("@/components/super-admin/DatabaseTab"));
const MigrationsTab    = lazy(() => import("@/components/super-admin/MigrationsTab"));
const BackupsTab       = lazy(() => import("@/components/super-admin/BackupsTab"));
const JobsTab          = lazy(() => import("@/components/super-admin/JobsTab"));
const LogsTab          = lazy(() => import("@/components/super-admin/LogsTab"));
const AuditTab         = lazy(() => import("@/components/super-admin/AuditTab"));
const SessionsTab      = lazy(() => import("@/components/super-admin/SessionsTab"));
const SecurityTab      = lazy(() => import("@/components/super-admin/SecurityTab"));
const ApiKeysTab       = lazy(() => import("@/components/super-admin/ApiKeysTab"));
const WebhooksTab      = lazy(() => import("@/components/super-admin/WebhooksTab"));
const IntegrationsTab  = lazy(() => import("@/components/super-admin/IntegrationsTab"));
const FeatureFlagsTab  = lazy(() => import("@/components/super-admin/FeatureFlagsTab"));
const MaintenanceTab   = lazy(() => import("@/components/super-admin/MaintenanceTab"));
const SettingsTab      = lazy(() => import("@/components/super-admin/SettingsTab"));
const VersionTab       = lazy(() => import("@/components/super-admin/VersionTab"));

// ── Tab definitions ────────────────────────────────────────────────────────────
const TABS = [
  { id: "overview",      label: "Vue d'ensemble" },
  { id: "users",         label: "Comptes ERP" },
  { id: "health",        label: "Santé système" },
  { id: "database",      label: "Base de données" },
  { id: "migrations",    label: "Migrations" },
  { id: "backups",       label: "Sauvegardes" },
  { id: "jobs",          label: "Jobs" },
  { id: "logs",          label: "Journaux" },
  { id: "audit",         label: "Audit" },
  { id: "sessions",      label: "Sessions" },
  { id: "security",      label: "Sécurité" },
  { id: "api-keys",      label: "Clés API" },
  { id: "webhooks",      label: "Webhooks" },
  { id: "integrations",  label: "Intégrations" },
  { id: "feature-flags", label: "Feature Flags" },
  { id: "maintenance",   label: "Maintenance" },
  { id: "settings",      label: "Paramètres" },
  { id: "version",       label: "Version" },
];

function TabSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
    </div>
  );
}

function AccessDenied() {
  return (
    <DashboardLayout>
      <div className="flex flex-col items-center justify-center h-64 gap-4 p-6">
        <Shield className="w-16 h-16 text-gray-300" />
        <p className="text-lg font-semibold text-gray-500">Accès refusé</p>
        <p className="text-sm text-gray-400 text-center max-w-sm">
          Vous n'avez pas les permissions nécessaires pour accéder au centre de contrôle système.
          Contactez un administrateur.
        </p>
      </div>
    </DashboardLayout>
  );
}

export default function SuperAdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  // Permission guard
  const hasAccess =
    user?.role === "super_admin" ||
    (user?.role as string) === "system_administrator" ||
    (user?.permissions as string[] | undefined)?.includes("system.view");

  if (!hasAccess) return <AccessDenied />;

  return (
    <DashboardLayout>
      <PageErrorBoundary>
        <div className="flex flex-col min-h-full">
          {/* Page header */}
          <div className="px-4 sm:px-6 pt-4 pb-2 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Shield className="w-5 h-5 text-indigo-700" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Centre de contrôle système</h1>
                <p className="text-xs text-gray-500">
                  Administration avancée · {user?.role?.replace("_", " ")}
                </p>
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="shrink-0">
            <ScrollableTabBar
              tabs={TABS}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0">
            <Suspense fallback={<TabSpinner />}>
              {activeTab === "overview"      && <OverviewTab />}
              {activeTab === "users"         && <UsersTab />}
              {activeTab === "health"        && <HealthTab />}
              {activeTab === "database"      && <DatabaseTab />}
              {activeTab === "migrations"    && <MigrationsTab />}
              {activeTab === "backups"       && <BackupsTab />}
              {activeTab === "jobs"          && <JobsTab />}
              {activeTab === "logs"          && <LogsTab />}
              {activeTab === "audit"         && <AuditTab />}
              {activeTab === "sessions"      && <SessionsTab />}
              {activeTab === "security"      && <SecurityTab />}
              {activeTab === "api-keys"      && <ApiKeysTab />}
              {activeTab === "webhooks"      && <WebhooksTab />}
              {activeTab === "integrations"  && <IntegrationsTab />}
              {activeTab === "feature-flags" && <FeatureFlagsTab />}
              {activeTab === "maintenance"   && <MaintenanceTab />}
              {activeTab === "settings"      && <SettingsTab />}
              {activeTab === "version"       && <VersionTab />}
            </Suspense>
          </div>
        </div>
      </PageErrorBoundary>
    </DashboardLayout>
  );
}
