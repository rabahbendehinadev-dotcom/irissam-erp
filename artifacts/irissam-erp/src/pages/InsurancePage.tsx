import { useState, lazy, Suspense } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useLanguage } from '@/i18n';
import { Shield, LayoutDashboard, Building2, FileText, Package, Banknote } from 'lucide-react';
import { cn } from '@/lib/utils';

const InsuranceDashboard    = lazy(() => import('@/components/insurance/InsuranceDashboard'));
const InsuranceOrganizations = lazy(() => import('@/components/insurance/InsuranceOrganizations'));
const InsuranceClaims       = lazy(() => import('@/components/insurance/InsuranceClaims'));
const InsuranceBordereaux   = lazy(() => import('@/components/insurance/InsuranceBordereaux'));
const InsurancePayments     = lazy(() => import('@/components/insurance/InsurancePayments'));

type Tab = 'dashboard' | 'orgs' | 'claims' | 'bordereaux' | 'payments';

export default function InsurancePage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>('dashboard');

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard',  label: t('insurance.dashboard'),  icon: LayoutDashboard },
    { id: 'orgs',       label: t('insurance.orgs'),        icon: Building2 },
    { id: 'claims',     label: t('insurance.claims'),      icon: FileText },
    { id: 'bordereaux', label: t('insurance.bordereaux'),  icon: Package },
    { id: 'payments',   label: t('insurance.payments'),    icon: Banknote },
  ];

  return (
    <DashboardLayout>
      <div className="min-h-full bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
              <Shield size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{t('insurance.title')}</h1>
              <p className="text-xs text-gray-500 hidden sm:block">{t('insurance.subtitle')}</p>
            </div>
          </div>

          {/* Tabs — scrollable on mobile */}
          <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-hide -mb-px">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0',
                  tab === id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          <Suspense fallback={
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Array.from({length:8}).map((_,i)=>(
                <div key={i} className="h-28 bg-white rounded-xl border border-gray-100 animate-pulse" />
              ))}
            </div>
          }>
            {tab === 'dashboard'  && <InsuranceDashboard />}
            {tab === 'orgs'       && <InsuranceOrganizations />}
            {tab === 'claims'     && <InsuranceClaims />}
            {tab === 'bordereaux' && <InsuranceBordereaux />}
            {tab === 'payments'   && <InsurancePayments />}
          </Suspense>
        </div>
      </div>
    </DashboardLayout>
  );
}
