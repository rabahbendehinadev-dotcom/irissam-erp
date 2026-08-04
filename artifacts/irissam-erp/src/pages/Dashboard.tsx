import { useState, useMemo } from "react";
import React, { Component, type ReactNode } from "react";
import { useLanguage } from "@/i18n";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ChartConsultations } from "@/components/dashboard/ChartConsultations";
import { ChartAdmissions } from "@/components/dashboard/ChartAdmissions";
import { ChartServices } from "@/components/dashboard/ChartServices";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { RecentPatients } from "@/components/dashboard/RecentPatients";
import { UpcomingAppointments } from "@/components/dashboard/UpcomingAppointments";
import { MiniWidgets } from "@/components/dashboard/MiniWidgets";
import { PatientDrawer } from "@/components/shared/PatientDrawer";
import { MOCK_DASHBOARD_STATS } from "@/mock";
import { formatNumber } from "@/utils/format";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { useAdmissions } from "@/store/AdmissionsContext";
import { useMockRepository } from "@/store/MockRepository";

import { Users, Calendar, Bed, ClipboardList, AlertTriangle, Stethoscope, FlaskConical, Scan, Receipt, TrendingUp } from "lucide-react";

function fmtN(n: number | undefined): string {
  if (n === undefined) return "—";
  return formatNumber(n);
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
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

  // ── Live admission data from AdmissionsContext ────────────────────────────
  const { admissions } = useAdmissions();
  const today = todayDateString();

  const hospitalized = useMemo(
    () => admissions.filter(a => a.status === 'active').length,
    [admissions],
  );

  const admissionsToday = useMemo(
    () => admissions.filter(a => a.admissionDate === today).length,
    [admissions, today],
  );

  // ── Live bed occupancy from MockRepository ────────────────────────────────
  const repo = useMockRepository();
  const bedOccupancyPercent = useMemo(() => {
    const beds = repo.beds;
    if (beds.length === 0) return 0;
    const occupied = beds.filter(b => b.status === 'occupe').length;
    return Math.round((occupied / beds.length) * 100);
  }, [repo.beds]);

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
            title={t("stat.patients.total")} value={fmtN(apiStats?.totalPatients)} trend={MOCK_DASHBOARD_STATS.totalPatientsTrend} trendText={t("stat.patients.trend")}
          />
          <StatsCard 
            icon={<Calendar className="w-5 h-5" />} iconBgColor="bg-purple-100" iconColor="text-purple-600"
            title={t("stat.appointments.today")} value={fmtN(apiStats?.appointmentsToday)} trend={MOCK_DASHBOARD_STATS.appointmentsTodayTrend} trendText={t("stat.appointments.trend")}
          />
          <StatsCard 
            icon={<Bed className="w-5 h-5" />} iconBgColor="bg-teal-100" iconColor="text-teal-600"
            title={t("stat.hospitalized")} value={fmtN(hospitalized)} trend={MOCK_DASHBOARD_STATS.hospitalizedPatientsTrend} trendText={t("stat.hospitalized.trend")}
          />
          <StatsCard 
            icon={<ClipboardList className="w-5 h-5" />} iconBgColor="bg-orange-100" iconColor="text-orange-500"
            title={t("stat.admissions.today")} value={fmtN(admissionsToday)} trend={MOCK_DASHBOARD_STATS.admissionsTodayTrend} trendText={t("stat.admissions.trend")}
          />
          <StatsCard 
            icon={<AlertTriangle className="w-5 h-5" />} iconBgColor="bg-red-100" iconColor="text-red-500"
            title={t("stat.emergencies.waiting")} value={fmtN(apiStats?.emergenciesWaiting)} trend={MOCK_DASHBOARD_STATS.emergenciesWaitingTrend} trendText={t("stat.emergencies.trend")}
          />
        </div>

        {/* Stats Row 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatsCard 
            icon={<Stethoscope className="w-5 h-5" />} iconBgColor="bg-blue-100" iconColor="text-blue-600"
            title={t("stat.consultations.today")} value={fmtN(apiStats?.consultationsToday)} trend={MOCK_DASHBOARD_STATS.consultationsTodayTrend} trendText={t("stat.consultations.trend")}
          />
          <StatsCard 
            icon={<FlaskConical className="w-5 h-5" />} iconBgColor="bg-green-100" iconColor="text-green-600"
            title={t("stat.analyses.today")} value={fmtN(apiStats?.analysesToday)} trend={MOCK_DASHBOARD_STATS.analysesTodayTrend} trendText={t("stat.analyses.trend")}
          />
          <StatsCard 
            icon={<Scan className="w-5 h-5" />} iconBgColor="bg-purple-100" iconColor="text-purple-600"
            title={t("stat.imaging.today")} value={fmtN(apiStats?.imagingToday)} trend={MOCK_DASHBOARD_STATS.imagingTodayTrend} trendText={t("stat.imaging.trend")}
          />
          <StatsCard 
            icon={<Receipt className="w-5 h-5" />} iconBgColor="bg-orange-100" iconColor="text-orange-500"
            title={t("stat.invoices.today")} value={fmtN(apiStats?.invoicesToday)} trend={MOCK_DASHBOARD_STATS.invoicesTodayTrend} trendText={t("stat.invoices.trend")}
          />
          <StatsCard 
            icon={<TrendingUp className="w-5 h-5" />} iconBgColor="bg-green-100" iconColor="text-green-600"
            title={t("stat.revenue.today")} value={fmtN(apiStats?.revenueToday)} trend={MOCK_DASHBOARD_STATS.revenueTodayTrend} trendText={t("stat.revenue.trend")}
          />
          <StatsCard 
            icon={<Bed className="w-5 h-5" />} iconBgColor="bg-teal-100" iconColor="text-teal-600"
            title={t("stat.bed_occupancy")} value={`${bedOccupancyPercent}%`} trend={MOCK_DASHBOARD_STATS.bedOccupancyTrend} trendText={t("stat.bed_occupancy.trend")}
          />
        </div>

        {/* Charts Row — fixed height on desktop, auto on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:h-[300px]">
          <div className="lg:col-span-5 h-[260px] lg:h-full">
            <WidgetErrorBoundary label="ChartConsultations">
              <ChartConsultations />
            </WidgetErrorBoundary>
          </div>
          <div className="lg:col-span-4 h-[260px] lg:h-full">
            <WidgetErrorBoundary label="ChartAdmissions">
              <ChartAdmissions />
            </WidgetErrorBoundary>
          </div>
          <div className="lg:col-span-3 h-[260px] lg:h-full">
            <WidgetErrorBoundary label="ChartServices">
              <ChartServices />
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
            <MiniWidgets />
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
