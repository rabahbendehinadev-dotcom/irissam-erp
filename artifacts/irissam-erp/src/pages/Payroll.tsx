import { lazy, Suspense, useState } from 'react';
import { useTranslation } from '@/i18n';
import { ScrollableTabBar } from '@/components/ui/ScrollableTabBar';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageErrorBoundary } from '@/components/shared/PageErrorBoundary';

const PayrollDashboardTab  = lazy(() => import('@/components/payroll/PayrollDashboard'));
const PayrollPeriodsTab    = lazy(() => import('@/components/payroll/PayrollPeriods'));
const PayrollRunsTab       = lazy(() => import('@/components/payroll/PayrollRuns'));
const PayrollPayslipsTab   = lazy(() => import('@/components/payroll/PayrollPayslips'));
const PayrollAdvancesTab   = lazy(() => import('@/components/payroll/PayrollAdvances'));
const PayrollLoansTab      = lazy(() => import('@/components/payroll/PayrollLoans'));
const PayrollComponentsTab = lazy(() => import('@/components/payroll/PayrollComponents'));
const PayrollOrdersTab     = lazy(() => import('@/components/payroll/PayrollOrders'));
const PayrollReportsTab    = lazy(() => import('@/components/payroll/PayrollReports'));
const PayrollSettingsTab   = lazy(() => import('@/components/payroll/PayrollSettings'));

const TABS = [
  { id: 'dashboard',   label: 'nav.payroll.dashboard'   as const },
  { id: 'periods',     label: 'nav.payroll.periods'     as const },
  { id: 'runs',        label: 'nav.payroll.runs'        as const },
  { id: 'payslips',    label: 'nav.payroll.payslips'    as const },
  { id: 'advances',    label: 'nav.payroll.advances'    as const },
  { id: 'loans',       label: 'nav.payroll.loans'       as const },
  { id: 'components',  label: 'nav.payroll.components'  as const },
  { id: 'orders',      label: 'nav.payroll.orders'      as const },
  { id: 'reports',     label: 'nav.payroll.reports'     as const },
  { id: 'settings',    label: 'nav.payroll.settings'    as const },
];

const TAB_COMPONENTS: Record<string, React.LazyExoticComponent<any>> = {
  dashboard:  PayrollDashboardTab,
  periods:    PayrollPeriodsTab,
  runs:       PayrollRunsTab,
  payslips:   PayrollPayslipsTab,
  advances:   PayrollAdvancesTab,
  loans:      PayrollLoansTab,
  components: PayrollComponentsTab,
  orders:     PayrollOrdersTab,
  reports:    PayrollReportsTab,
  settings:   PayrollSettingsTab,
};

export default function PayrollPage() {
  const { t } = useTranslation();
  const stored = localStorage.getItem('payroll-tab');
  const [activeTab, setActiveTab] = useState(stored && TABS.find(x => x.id === stored) ? stored : 'dashboard');

  const handleTabChange = (id: string) => {
    setActiveTab(id);
    localStorage.setItem('payroll-tab', id);
  };

  const tabs = TABS.map(tab => ({ ...tab, label: t(tab.label) }));
  const ActiveComponent = TAB_COMPONENTS[activeTab] ?? PayrollDashboardTab;

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">
        <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
          <div className="px-4 pt-4">
            <h1 className="text-xl font-bold text-gray-900 mb-3">{t('nav.payroll')}</h1>
          </div>
          <ScrollableTabBar
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />
        </div>
        <div className="flex-1 overflow-auto p-4">
          <PageErrorBoundary>
            <Suspense fallback={<div className="animate-pulse bg-gray-100 rounded-lg h-64 w-full" />}>
              <ActiveComponent />
            </Suspense>
          </PageErrorBoundary>
        </div>
      </div>
    </DashboardLayout>
  );
}
