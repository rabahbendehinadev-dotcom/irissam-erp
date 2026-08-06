import { lazy, Suspense } from 'react';
import { PageErrorBoundary } from '@/components/shared/PageErrorBoundary';
import { ChunkErrorBoundary } from '@/components/shared/ChunkErrorBoundary';
import { Route, Switch, Router as WouterRouter, Redirect } from 'wouter';
import { AppProvider } from '@/store/AppProvider';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/store/AuthContext';
import { IOSInstallBanner } from '@/components/pwa/IOSInstallBanner';
import { PWAUpdateBanner } from '@/components/pwa/PWAUpdateBanner';

// Lazy-loaded page modules — each produces its own JS chunk
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const PatientsPage = lazy(() => import('@/pages/Patients'));
const PatientDetailPage = lazy(() => import('@/pages/PatientDetail'));
const AdmissionsPage = lazy(() => import('@/pages/Admissions'));
const AdmissionDetailPage = lazy(() => import('@/pages/AdmissionDetail'));
const NotFound = lazy(() => import('@/pages/not-found'));
const Appointments = lazy(() => import('@/pages/Appointments'));
const AlertsPage = lazy(() => import('@/pages/Alerts'));
const Consultations = lazy(() => import('@/pages/Consultations'));
const ConsultationWorkspacePage = lazy(() => import('@/pages/ConsultationWorkspacePage'));
const LoginPage = lazy(() => import('@/pages/Login'));
const PharmacyPage = lazy(() => import('@/pages/Pharmacy'));
const LaboratoryPage = lazy(() => import('@/pages/Laboratory'));
const ImagingPage = lazy(() => import('@/pages/Imaging'));
const EmergenciesPage = lazy(() => import('@/pages/Emergencies'));
const EmergencyPatientDetail = lazy(() => import('@/pages/EmergencyPatientDetail'));
const HospitalizationPage = lazy(() => import('@/pages/Hospitalization'));
const ResuscitationPage = lazy(() => import('@/pages/Resuscitation'));
const OperatingRoomPage = lazy(() => import('@/pages/OperatingRoom'));
const PersonnelPage = lazy(() => import('@/pages/Personnel'));

const DevTestRunnerPage = lazy(() => import('@/pages/DevTestRunner'));
const ChangePasswordPage = lazy(() => import('@/pages/ChangePassword'));
const FacturationPage = lazy(() => import('@/pages/Facturation'));

const SettingsPage = lazy(() => import('@/pages/Settings'));
const InsurancePage    = lazy(() => import('@/pages/InsurancePage'));
const HRPage           = lazy(() => import('@/pages/HR'));
const MedicalStockPage = lazy(() => import('@/pages/MedicalStock'));
const BiomedicalPage   = lazy(() => import('@/pages/Biomedical'));
const QualityPage            = lazy(() => import('@/pages/Quality'));
const ExecutiveDashboardPage = lazy(() => import('@/pages/ExecutiveDashboard'));
const DocumentsPage          = lazy(() => import('@/pages/Documents'));
const PayrollPage            = lazy(() => import('@/pages/Payroll'));
const SuperAdminPage         = lazy(() => import('@/pages/SuperAdmin'));
const PatientPortalAdminPage = lazy(() => import('@/pages/PatientPortalAdmin'));

// Doctor Portal pages
const DoctorPortalIndex    = lazy(() => import('@/pages/doctor-portal/DoctorPortalIndex'));
const DoctorDashboard      = lazy(() => import('@/pages/doctor-portal/DoctorDashboard'));
const DoctorAgenda         = lazy(() => import('@/pages/doctor-portal/DoctorAgenda'));
const DoctorPatientsToday  = lazy(() => import('@/pages/doctor-portal/DoctorPatientsToday'));
const DoctorMyPatients     = lazy(() => import('@/pages/doctor-portal/DoctorMyPatients'));
const DoctorPatientWorkspace = lazy(() => import('@/pages/doctor-portal/DoctorPatientWorkspace'));
const DoctorResults        = lazy(() => import('@/pages/doctor-portal/DoctorResults'));
const DoctorHospitalized   = lazy(() => import('@/pages/doctor-portal/DoctorHospitalized'));
const DoctorEmergencies    = lazy(() => import('@/pages/doctor-portal/DoctorEmergencies'));
const DoctorPrescriptions  = lazy(() => import('@/pages/doctor-portal/DoctorPrescriptions'));
const DoctorTasks          = lazy(() => import('@/pages/doctor-portal/DoctorTasks'));
const DoctorMessages       = lazy(() => import('@/pages/doctor-portal/DoctorMessages'));
const DoctorProfile        = lazy(() => import('@/pages/doctor-portal/DoctorProfile'));

// ---------------------------------------------------------------------------
// Loading skeleton shown while a lazy chunk is fetching
// ---------------------------------------------------------------------------
function LoadingSkeleton() {
  return (
    <DashboardLayout>
      <div className="p-6 space-y-4 animate-pulse">
        {/* Header placeholder */}
        <div className="h-8 bg-white/10 rounded-lg w-1/3" />
        {/* Card row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-white/10 rounded-xl" />
          ))}
        </div>
        {/* Content block */}
        <div className="h-64 bg-white/10 rounded-xl" />
        <div className="h-48 bg-white/10 rounded-xl" />
      </div>
    </DashboardLayout>
  );
}

// Minimal skeleton for pages that render their own layout (Login, NotFound, etc.)
function FullPageSpinner() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a2540] via-[#0e3460] to-[#1a5c8a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        <p className="text-white/70 text-sm font-medium">Chargement…</p>
      </div>
    </div>
  );
}


/** Shows a full-screen spinner while the session is being restored.
 *  If the API was unreachable, shows an error state with a retry button. */
function AuthLoadingScreen() {
  const { networkError, retryInit } = useAuth();

  if (networkError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a2540] via-[#0e3460] to-[#1a5c8a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 text-center px-6">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <p className="text-white font-semibold text-lg">Impossible de contacter le serveur</p>
            <p className="text-white/60 text-sm mt-1">Vérifiez votre connexion et réessayez.</p>
          </div>
          <button
            onClick={retryInit}
            className="px-6 py-2.5 bg-white/15 hover:bg-white/25 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return <FullPageSpinner />;
}

function DoctorLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a2540] to-[#1a3a5c] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        <p className="text-white/70 text-sm">Chargement du portail médecin…</p>
      </div>
    </div>
  );
}

function DoctorProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return <AuthLoadingScreen />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (user?.forcePasswordChange) return <Redirect to="/change-password" />;
  return (
    <PageErrorBoundary>
      <ChunkErrorBoundary>
        <Suspense fallback={<DoctorLoadingSkeleton />}>
          <Component />
        </Suspense>
      </ChunkErrorBoundary>
    </PageErrorBoundary>
  );
}

/** Wrapper that redirects unauthenticated users to /login.
 *  If the user must change their password, redirects to /change-password first. */
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return <AuthLoadingScreen />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (user?.forcePasswordChange) return <Redirect to="/change-password" />;
  return (
    <PageErrorBoundary>
      <ChunkErrorBoundary>
        <Suspense fallback={<LoadingSkeleton />}>
          <Component />
        </Suspense>
      </ChunkErrorBoundary>
    </PageErrorBoundary>
  );
}

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();

  return (
    <Switch>
      {/* Public route */}
      <Route path="/login">
        {isLoading ? (
          <AuthLoadingScreen />
        ) : isAuthenticated ? (
          // Authenticated but must change password first
          user?.forcePasswordChange ? <Redirect to="/change-password" /> : <Redirect to="/" />
        ) : (
          <ChunkErrorBoundary>
            <Suspense fallback={<FullPageSpinner />}>
              <LoginPage />
            </Suspense>
          </ChunkErrorBoundary>
        )}
      </Route>

      {/* Change-password route — accessible only while authenticated (any forcePasswordChange state) */}
      <Route path="/change-password">
        {isLoading ? (
          <AuthLoadingScreen />
        ) : !isAuthenticated ? (
          <Redirect to="/login" />
        ) : (
          <ChunkErrorBoundary>
            <Suspense fallback={<FullPageSpinner />}>
              <ChangePasswordPage />
            </Suspense>
          </ChunkErrorBoundary>
        )}
      </Route>

      {/* Protected routes */}
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/patients/:id" component={() => <ProtectedRoute component={PatientDetailPage} />} />
      <Route path="/patients" component={() => <ProtectedRoute component={PatientsPage} />} />
      <Route path="/appointments" component={() => <ProtectedRoute component={Appointments} />} />
      <Route path="/admissions/:id" component={() => <ProtectedRoute component={AdmissionDetailPage} />} />
      <Route path="/admissions" component={() => <ProtectedRoute component={AdmissionsPage} />} />
      <Route path="/consultations/:id" component={() => <ProtectedRoute component={ConsultationWorkspacePage} />} />
      <Route path="/consultations" component={() => <ProtectedRoute component={Consultations} />} />
      <Route path="/alerts" component={() => <ProtectedRoute component={AlertsPage} />} />
      <Route path="/emergencies/:id" component={() => <ProtectedRoute component={EmergencyPatientDetail} />} />
      <Route path="/emergencies" component={() => <ProtectedRoute component={EmergenciesPage} />} />
      <Route path="/hospitalization" component={() => <ProtectedRoute component={HospitalizationPage} />} />
      <Route path="/operating-room" component={() => <ProtectedRoute component={OperatingRoomPage} />} />
      <Route path="/resuscitation" component={() => <ProtectedRoute component={ResuscitationPage} />} />
      <Route path="/maternity" component={() => <Redirect to="/" />} />
      <Route path="/laboratory" component={() => <ProtectedRoute component={LaboratoryPage} />} />
      <Route path="/imaging" component={() => <ProtectedRoute component={ImagingPage} />} />
      <Route path="/pharmacy" component={() => <ProtectedRoute component={PharmacyPage} />} />
      <Route path="/blood-bank" component={() => <Redirect to="/" />} />
      <Route path="/medical-stock" component={() => <ProtectedRoute component={MedicalStockPage} />} />
      <Route path="/biomedical" component={() => <ProtectedRoute component={BiomedicalPage} />} />
      <Route path="/quality" component={() => <ProtectedRoute component={QualityPage} />} />
      <Route path="/executive-dashboard" component={() => <ProtectedRoute component={ExecutiveDashboardPage} />} />
      <Route path="/documents" component={() => <ProtectedRoute component={DocumentsPage} />} />
      <Route path="/payroll"   component={() => <ProtectedRoute component={PayrollPage}   />} />
      <Route path="/super-admin" component={() => <ProtectedRoute component={SuperAdminPage} />} />
      <Route path="/patient-portal-admin" component={() => <ProtectedRoute component={PatientPortalAdminPage} />} />
      <Route path="/doctors" component={() => <ProtectedRoute component={PersonnelPage} />} />
      <Route path="/hr/employees/:id" component={() => <ProtectedRoute component={HRPage} />} />
      <Route path="/hr/:tab" component={() => <ProtectedRoute component={HRPage} />} />
      <Route path="/hr" component={() => <ProtectedRoute component={HRPage} />} />
      <Route path="/finance" component={() => <ProtectedRoute component={FacturationPage} />} />
      <Route path="/insurance" component={() => <ProtectedRoute component={InsurancePage} />} />
      <Route path="/ambulances" component={() => <Redirect to="/" />} />
      <Route path="/dev/tests" component={() => <ProtectedRoute component={DevTestRunnerPage} />} />
      <Route path="/archives" component={() => <Redirect to="/" />} />
      <Route path="/reports" component={() => <Redirect to="/" />} />
      <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />

      {/* Doctor Portal routes */}
      <Route path="/doctor-portal/dashboard"      component={() => <DoctorProtectedRoute component={DoctorDashboard} />} />
      <Route path="/doctor-portal/agenda"         component={() => <DoctorProtectedRoute component={DoctorAgenda} />} />
      <Route path="/doctor-portal/patients-today" component={() => <DoctorProtectedRoute component={DoctorPatientsToday} />} />
      <Route path="/doctor-portal/my-patients"    component={() => <DoctorProtectedRoute component={DoctorMyPatients} />} />
      <Route path="/doctor-portal/patient/:id"    component={() => <DoctorProtectedRoute component={DoctorPatientWorkspace} />} />
      <Route path="/doctor-portal/results"        component={() => <DoctorProtectedRoute component={DoctorResults} />} />
      <Route path="/doctor-portal/hospitalized"   component={() => <DoctorProtectedRoute component={DoctorHospitalized} />} />
      <Route path="/doctor-portal/emergencies"    component={() => <DoctorProtectedRoute component={DoctorEmergencies} />} />
      <Route path="/doctor-portal/prescriptions"  component={() => <DoctorProtectedRoute component={DoctorPrescriptions} />} />
      <Route path="/doctor-portal/tasks"          component={() => <DoctorProtectedRoute component={DoctorTasks} />} />
      <Route path="/doctor-portal/messages"       component={() => <DoctorProtectedRoute component={DoctorMessages} />} />
      <Route path="/doctor-portal/profile"        component={() => <DoctorProtectedRoute component={DoctorProfile} />} />
      <Route path="/doctor-portal"                component={() => <DoctorProtectedRoute component={DoctorPortalIndex} />} />

      <Route component={() => (
        <ChunkErrorBoundary>
          <Suspense fallback={<FullPageSpinner />}>
            <NotFound />
          </Suspense>
        </ChunkErrorBoundary>
      )} />
    </Switch>
  );
}

function App() {
  return (
    <AppProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Router />
        <IOSInstallBanner />
        <PWAUpdateBanner />
      </WouterRouter>
    </AppProvider>
  );
}

export default App;
