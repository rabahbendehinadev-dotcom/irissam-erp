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
import { MOCK_DASHBOARD_STATS } from "@/mock";
import { formatNumber } from "@/utils/format";

import { Users, Calendar, Bed, ClipboardList, AlertTriangle, Stethoscope, FlaskConical, Scan, Receipt, TrendingUp } from "lucide-react";

export default function Dashboard() {
  const { t } = useLanguage();

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
            title={t("stat.patients.total")} value={formatNumber(MOCK_DASHBOARD_STATS.totalPatients)} trend={MOCK_DASHBOARD_STATS.totalPatientsTrend} trendText={t("stat.patients.trend")}
          />
          <StatsCard 
            icon={<Calendar className="w-5 h-5" />} iconBgColor="bg-purple-100" iconColor="text-purple-600"
            title={t("stat.appointments.today")} value={MOCK_DASHBOARD_STATS.appointmentsToday} trend={MOCK_DASHBOARD_STATS.appointmentsTodayTrend} trendText={t("stat.appointments.trend")}
          />
          <StatsCard 
            icon={<Bed className="w-5 h-5" />} iconBgColor="bg-teal-100" iconColor="text-teal-600"
            title={t("stat.hospitalized")} value={MOCK_DASHBOARD_STATS.hospitalizedPatients} trend={MOCK_DASHBOARD_STATS.hospitalizedPatientsTrend} trendText={t("stat.hospitalized.trend")}
          />
          <StatsCard 
            icon={<ClipboardList className="w-5 h-5" />} iconBgColor="bg-orange-100" iconColor="text-orange-500"
            title={t("stat.admissions.today")} value={MOCK_DASHBOARD_STATS.admissionsToday} trend={MOCK_DASHBOARD_STATS.admissionsTodayTrend} trendText={t("stat.admissions.trend")}
          />
          <StatsCard 
            icon={<AlertTriangle className="w-5 h-5" />} iconBgColor="bg-red-100" iconColor="text-red-500"
            title={t("stat.emergencies.waiting")} value={MOCK_DASHBOARD_STATS.emergenciesWaiting} trend={MOCK_DASHBOARD_STATS.emergenciesWaitingTrend} trendText={t("stat.emergencies.trend")}
          />
        </div>

        {/* Stats Row 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatsCard 
            icon={<Stethoscope className="w-5 h-5" />} iconBgColor="bg-blue-100" iconColor="text-blue-600"
            title={t("stat.consultations.today")} value={MOCK_DASHBOARD_STATS.consultationsToday} trend={MOCK_DASHBOARD_STATS.consultationsTodayTrend} trendText={t("stat.consultations.trend")}
          />
          <StatsCard 
            icon={<FlaskConical className="w-5 h-5" />} iconBgColor="bg-green-100" iconColor="text-green-600"
            title={t("stat.analyses.today")} value={MOCK_DASHBOARD_STATS.analysesToday} trend={MOCK_DASHBOARD_STATS.analysesTodayTrend} trendText={t("stat.analyses.trend")}
          />
          <StatsCard 
            icon={<Scan className="w-5 h-5" />} iconBgColor="bg-purple-100" iconColor="text-purple-600"
            title={t("stat.imaging.today")} value={MOCK_DASHBOARD_STATS.imagingToday} trend={MOCK_DASHBOARD_STATS.imagingTodayTrend} trendText={t("stat.imaging.trend")}
          />
          <StatsCard 
            icon={<Receipt className="w-5 h-5" />} iconBgColor="bg-orange-100" iconColor="text-orange-500"
            title={t("stat.invoices.today")} value={MOCK_DASHBOARD_STATS.invoicesToday} trend={MOCK_DASHBOARD_STATS.invoicesTodayTrend} trendText={t("stat.invoices.trend")}
          />
          <StatsCard 
            icon={<TrendingUp className="w-5 h-5" />} iconBgColor="bg-green-100" iconColor="text-green-600"
            title={t("stat.revenue.today")} value={formatNumber(MOCK_DASHBOARD_STATS.revenueToday)} trend={MOCK_DASHBOARD_STATS.revenueTodayTrend} trendText={t("stat.revenue.trend")}
          />
          <StatsCard 
            icon={<Bed className="w-5 h-5" />} iconBgColor="bg-teal-100" iconColor="text-teal-600"
            title={t("stat.bed_occupancy")} value={`${MOCK_DASHBOARD_STATS.bedOccupancyRate}%`} trend={MOCK_DASHBOARD_STATS.bedOccupancyTrend} trendText={t("stat.bed_occupancy.trend")}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[300px]">
          <div className="lg:col-span-5 h-full">
            <ChartConsultations />
          </div>
          <div className="lg:col-span-4 h-full">
            <ChartAdmissions />
          </div>
          <div className="lg:col-span-3 h-full">
            <ChartServices />
          </div>
        </div>

        {/* Lists Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[320px]">
          <div className="h-full">
            <AlertsPanel />
          </div>
          <div className="h-full">
            <RecentPatients />
          </div>
          <div className="h-full">
            <UpcomingAppointments />
          </div>
        </div>

        {/* Mini Widgets */}
        <div>
          <MiniWidgets />
        </div>

        {/* Footer */}
        <div className="pt-4 text-center">
          <p className="text-[10px] text-gray-400">{t("footer.copyright")}</p>
        </div>

      </div>
    </DashboardLayout>
  );
}