import { Route, Switch, Router as WouterRouter, Redirect } from 'wouter';
import { AppProvider } from '@/store/AppProvider';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import Dashboard from '@/pages/Dashboard';
import PatientsPage from '@/pages/Patients';
import PatientDetailPage from '@/pages/PatientDetail';
import AdmissionsPage from '@/pages/Admissions';
import NotFound from '@/pages/not-found';
import { useLanguage } from '@/i18n';
import Appointments from '@/pages/Appointments';
import AlertsPage from '@/pages/Alerts';
import Consultations from '@/pages/Consultations';
import ConsultationWorkspacePage from '@/pages/ConsultationWorkspacePage';
import LoginPage from '@/pages/Login';
import PharmacyPage from '@/pages/Pharmacy';
import { useAuth } from '@/store/AuthContext';

function PlaceholderPage() {
  const { t } = useLanguage();
  return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center text-gray-500">
          <h2 className="text-2xl font-bold mb-2">{t('page.coming_soon')}</h2>
          <p className="text-sm">{t('page.coming_soon_desc')}</p>
        </div>
      </div>
    </DashboardLayout>
  );
}

/** Shows a full-screen spinner while the session is being restored */
function AuthLoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a2540] via-[#0e3460] to-[#1a5c8a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        <p className="text-white/70 text-sm font-medium">Chargement…</p>
      </div>
    </div>
  );
}

/** Wrapper that redirects unauthenticated users to /login */
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <AuthLoadingScreen />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <Component />;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {/* Public route */}
      <Route path="/login">
        {isLoading ? (
          <AuthLoadingScreen />
        ) : isAuthenticated ? (
          <Redirect to="/" />
        ) : (
          <LoginPage />
        )}
      </Route>

      {/* Protected routes */}
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/patients/:id" component={() => <ProtectedRoute component={PatientDetailPage} />} />
      <Route path="/patients" component={() => <ProtectedRoute component={PatientsPage} />} />
      <Route path="/appointments" component={() => <ProtectedRoute component={Appointments} />} />
      <Route path="/admissions" component={() => <ProtectedRoute component={AdmissionsPage} />} />
      <Route path="/consultations/:id" component={() => <ProtectedRoute component={ConsultationWorkspacePage} />} />
      <Route path="/consultations" component={() => <ProtectedRoute component={Consultations} />} />
      <Route path="/alerts" component={() => <ProtectedRoute component={AlertsPage} />} />
      <Route path="/emergencies" component={() => <ProtectedRoute component={PlaceholderPage} />} />
      <Route path="/hospitalization" component={() => <ProtectedRoute component={PlaceholderPage} />} />
      <Route path="/operating-room" component={() => <ProtectedRoute component={PlaceholderPage} />} />
      <Route path="/resuscitation" component={() => <ProtectedRoute component={PlaceholderPage} />} />
      <Route path="/maternity" component={() => <ProtectedRoute component={PlaceholderPage} />} />
      <Route path="/laboratory" component={() => <ProtectedRoute component={PlaceholderPage} />} />
      <Route path="/imaging" component={() => <ProtectedRoute component={PlaceholderPage} />} />
      <Route path="/pharmacy" component={() => <ProtectedRoute component={PharmacyPage} />} />
      <Route path="/blood-bank" component={() => <ProtectedRoute component={PlaceholderPage} />} />
      <Route path="/medical-stock" component={() => <ProtectedRoute component={PlaceholderPage} />} />
      <Route path="/biomedical" component={() => <ProtectedRoute component={PlaceholderPage} />} />
      <Route path="/doctors" component={() => <ProtectedRoute component={PlaceholderPage} />} />
      <Route path="/hr" component={() => <ProtectedRoute component={PlaceholderPage} />} />
      <Route path="/finance" component={() => <ProtectedRoute component={PlaceholderPage} />} />
      <Route path="/ambulances" component={() => <ProtectedRoute component={PlaceholderPage} />} />
      <Route path="/archives" component={() => <ProtectedRoute component={PlaceholderPage} />} />
      <Route path="/reports" component={() => <ProtectedRoute component={PlaceholderPage} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={PlaceholderPage} />} />
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
