import { useState, lazy, Suspense } from "react";
import React, { Component, type ReactNode } from "react";
import { useLanguage } from "@/i18n";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { RecentPatients } from "@/components/dashboard/RecentPatients";
import { UpcomingAppointments } from "@/components/dashboard/UpcomingAppointments";
import { PatientDrawer } from "@/components/shared/PatientDrawer";
import { ChartSkeleton, MiniWidgetsSkeleton } from "@/components/dashboard/ChartSkeleton";
import { WhenVisible } from "@/components/dashboard/WhenVisible";

// ── Lazy chart chunks — Recharts + D3 load only when these components render ──
const ChartConsultations = lazy(() =>
  import("@/components/dashboard/ChartConsultations").then(m => ({ default: m.ChartConsultations }))
);
const ChartAdmissions = lazy(() =>
  import("@/components/dashboard/ChartAdmissions").then(m => ({ default: m.ChartAdmissions }))
);
const ChartServices = lazy(() =>
  import("@/components/dashboard/ChartServices").then(m => ({ default: m.ChartServices }))
);
const MiniWidgets = lazy(() =>
  import("@/components/dashboard/MiniWidgets").then(m => ({ default: m.MiniWidgets }))
);

import { formatNumber } from "@/utils/format";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { useQuery } from "@/hooks/useQuery";

import { Users, Calendar, Bed, ClipboardList, AlertTriangle, Stethoscope, FlaskConical, Scan, Receipt, TrendingUp } from "lucide-react";

function fmtN(n: number | undefined): string {
  if (n === undefined) return "—";
  return formatNumber(n);
}

// ── Widget-level error boundary ───────────────────────────────────────────────
// Isolates each dashboard section so one failing widget can't blank the whole page.
class WidgetErrorBoundary extends Component<{ children: ReactNode; label?: string }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; label?: string }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) {
    console.error('[WidgetErrorBoundary]', this.props.label, error.message);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full min-h-[80px] bg-gray-50 border border-dashed border-gray-200 rounded-lg">
          <div className="text-center px-4">
            <AlertTriangle className="w-5 h-5 text-amber-400 mx-auto mb-1" />
            <p className="text-xs text-gray-400">Widget indisponible</p>
            <button
              className="mt-1 text-[10px] text-blue-500 hover:underline"
              onClick={() => this.setState({ hasError: false })}
            >
              Réessayer
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Dashboard() {
  const { t } = useLanguage();
  const { data: apiStats } = useGetDashboardStats({ query: { refetchInterval: 30_000 } });
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // ── Live bed occupancy from real API ─────────────────────────────────────
  const { data: bedSummary } = useQuery<{ occupancyPercent: number }>('/beds/summary');
  const bedOccupancyPercent = bedSummary?.occupancyPercent ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">
        
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{t("dashboard.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("dashboard.subtitle")}</p>
        </div>

        {/* Stats Row 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatsCard 
            icon={<Users className="w-5 h-5" />} iconBgColor="bg-blue-100" iconColor="text-blue-600"
            title={t("stat.patients.total")} value={fmtN(apiStats?.totalPatients)} trend={0} trendText={t("stat.patients.trend")}
          />
          <StatsCard 
            icon={<Calendar className="w-5 h-5" />} iconBgColor="bg-purple-100" iconColor="text-purple-600"
            title={t("stat.appointments.today")} value={fmtN(apiStats?.appointmentsToday)} trend={0} trendText={t("stat.appointments.trend")}
          />
          <StatsCard 
            icon={<Bed className="w-5 h-5" />} iconBgColor="bg-teal-100" iconColor="text-teal-600"
            title={t("stat.hospitalized")} value={fmtN(apiStats?.hospitalized)} trend={0} trendText={t("stat.hospitalized.trend")}
          />
          <StatsCard 
            icon={<ClipboardList className="w-5 h-5" />} iconBgColor="bg-orange-100" iconColor="text-orange-500"
            title={t("stat.admissions.today")} value={fmtN(apiStats?.admissionsToday)} trend={0} trendText={t("stat.admissions.trend")}
          />
          <StatsCard 
            icon={<AlertTriangle className="w-5 h-5" />} iconBgColor="bg-red-100" iconColor="text-red-500"
            title={t("stat.emergencies.waiting")} value={fmtN(apiStats?.emergenciesWaiting)} trend={0} trendText={t("stat.emergencies.trend")}
          />
        </div>

        {/* Stats Row 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatsCard 
            icon={<Stethoscope className="w-5 h-5" />} iconBgColor="bg-blue-100" iconColor="text-blue-600"
            title={t("stat.consultations.today")} value={fmtN(apiStats?.consultationsToday)} trend={0} trendText={t("stat.consultations.trend")}
          />
          <StatsCard 
            icon={<FlaskConical className="w-5 h-5" />} iconBgColor="bg-green-100" iconColor="text-green-600"
            title={t("stat.analyses.today")} value={fmtN(apiStats?.analysesToday)} trend={0} trendText={t("stat.analyses.trend")}
          />
          <StatsCard 
            icon={<Scan className="w-5 h-5" />} iconBgColor="bg-purple-100" iconColor="text-purple-600"
            title={t("stat.imaging.today")} value={fmtN(apiStats?.imagingToday)} trend={0} trendText={t("stat.imaging.trend")}
          />
          <StatsCard 
            icon={<Receipt className="w-5 h-5" />} iconBgColor="bg-orange-100" iconColor="text-orange-500"
            title={t("stat.invoices.today")} value={fmtN(apiStats?.invoicesToday)} trend={0} trendText={t("stat.invoices.trend")}
          />
          <StatsCard 
            icon={<TrendingUp className="w-5 h-5" />} iconBgColor="bg-green-100" iconColor="text-green-600"
            title={t("stat.revenue.today")} value={fmtN(apiStats?.revenueToday)} trend={0} trendText={t("stat.revenue.trend")}
          />
          <StatsCard 
            icon={<Bed className="w-5 h-5" />} iconBgColor="bg-teal-100" iconColor="text-teal-600"
            title={t("stat.bed_occupancy")} value={`${bedOccupancyPercent}%`} trend={0} trendText={t("stat.bed_occupancy.trend")}
          />
        </div>

        {/* Charts Row — fixed height on desktop, auto on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:h-[300px]">
          <div className="lg:col-span-5 h-[260px] lg:h-full">
            <WidgetErrorBoundary label="ChartConsultations">
              <WhenVisible fallback={<ChartSkeleton />} className="h-full">
                <Suspense fallback={<ChartSkeleton />}>
                  <ChartConsultations />
                </Suspense>
              </WhenVisible>
            </WidgetErrorBoundary>
          </div>
          <div className="lg:col-span-4 h-[260px] lg:h-full">
            <WidgetErrorBoundary label="ChartAdmissions">
              <WhenVisible fallback={<ChartSkeleton />} className="h-full">
                <Suspense fallback={<ChartSkeleton />}>
                  <ChartAdmissions />
                </Suspense>
              </WhenVisible>
            </WidgetErrorBoundary>
          </div>
          <div className="lg:col-span-3 h-[260px] lg:h-full">
            <WidgetErrorBoundary label="ChartServices">
              <WhenVisible fallback={<ChartSkeleton />} className="h-full">
                <Suspense fallback={<ChartSkeleton />}>
                  <ChartServices />
                </Suspense>
              </WhenVisible>
            </WidgetErrorBoundary>
          </div>
        </div>

        {/* Lists Row — fixed height on desktop, auto on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:h-[320px]">
          <div className="h-[280px] lg:h-full">
            <WidgetErrorBoundary label="AlertsPanel">
              <AlertsPanel />
            </WidgetErrorBoundary>
          </div>
          <div className="h-[280px] lg:h-full">
            <WidgetErrorBoundary label="RecentPatients">
              <RecentPatients onPatientClick={setSelectedPatientId} />
            </WidgetErrorBoundary>
          </div>
          <div className="h-[280px] lg:h-full">
            <WidgetErrorBoundary label="UpcomingAppointments">
              <UpcomingAppointments onPatientClick={setSelectedPatientId} />
            </WidgetErrorBoundary>
          </div>
        </div>

        {/* Mini Widgets */}
        <div>
          <WidgetErrorBoundary label="MiniWidgets">
            <WhenVisible fallback={<MiniWidgetsSkeleton />}>
              <Suspense fallback={<MiniWidgetsSkeleton />}>
                <MiniWidgets />
              </Suspense>
            </WhenVisible>
          </WidgetErrorBoundary>
        </div>

        {/* Footer */}
        <div className="pt-4 text-center">
          <p className="text-[10px] text-gray-400">{t("footer.copyright")}</p>
        </div>

      </div>
      <PatientDrawer
        patientId={selectedPatientId}
        onClose={() => setSelectedPatientId(null)}
      />
    </DashboardLayout>
  );
}
