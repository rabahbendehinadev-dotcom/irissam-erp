import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AppProvider } from '@/store/AppProvider';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import Dashboard from '@/pages/Dashboard';
import NotFound from '@/pages/not-found';
import { useLanguage } from '@/i18n';

function PlaceholderPage() {
  const { t } = useLanguage();
  return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center text-gray-500">
          <h2 className="text-2xl font-bold mb-2">{t('page.coming_soon' as any)}</h2>
          <p className="text-sm">{t('page.coming_soon_desc' as any)}</p>
        </div>
      </div>
    </DashboardLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/patients" component={PlaceholderPage} />
      <Route path="/appointments" component={PlaceholderPage} />
      <Route path="/admissions" component={PlaceholderPage} />
      <Route path="/emergencies" component={PlaceholderPage} />
      <Route path="/consultations" component={PlaceholderPage} />
      <Route path="/hospitalization" component={PlaceholderPage} />
      <Route path="/operating-room" component={PlaceholderPage} />
      <Route path="/resuscitation" component={PlaceholderPage} />
      <Route path="/maternity" component={PlaceholderPage} />
      <Route path="/laboratory" component={PlaceholderPage} />
      <Route path="/imaging" component={PlaceholderPage} />
      <Route path="/pharmacy" component={PlaceholderPage} />
      <Route path="/blood-bank" component={PlaceholderPage} />
      <Route path="/medical-stock" component={PlaceholderPage} />
      <Route path="/biomedical" component={PlaceholderPage} />
      <Route path="/doctors" component={PlaceholderPage} />
      <Route path="/hr" component={PlaceholderPage} />
      <Route path="/finance" component={PlaceholderPage} />
      <Route path="/ambulances" component={PlaceholderPage} />
      <Route path="/archives" component={PlaceholderPage} />
      <Route path="/reports" component={PlaceholderPage} />
      <Route path="/settings" component={PlaceholderPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AppProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Router />
      </WouterRouter>
    </AppProvider>
  );
}

export default App;
