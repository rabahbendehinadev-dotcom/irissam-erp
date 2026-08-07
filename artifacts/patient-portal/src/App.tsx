import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AuthProvider } from '@/contexts/AuthContext';

import AppLayout from '@/components/layout/AppLayout';
import Login from '@/pages/auth/Login';
import PreviewInit from '@/pages/auth/PreviewInit';
import Activate from '@/pages/auth/Activate';
import ForgotPassword from '@/pages/auth/ForgotPassword';
import ResetPassword from '@/pages/auth/ResetPassword';
import Dashboard from '@/pages/dashboard/Dashboard';
import Appointments from '@/pages/appointments/Appointments';
import AppointmentRequest from '@/pages/appointments/AppointmentRequest';
import Profile from '@/pages/settings/Profile';
import Documents from '@/pages/documents/Documents';
import Insurance from '@/pages/insurance/Insurance';
import Consents from '@/pages/consents/Consents';
import Notifications from '@/pages/notifications/Notifications';
import Privacy from '@/pages/settings/Privacy';
import Sessions from '@/pages/settings/Sessions';
import Messages from '@/pages/messages/Messages';
import LabResults from '@/pages/results/LabResults';
import LabResultDetail from '@/pages/results/LabResultDetail';
import Imaging from '@/pages/results/Imaging';
import Prescriptions from '@/pages/prescriptions/Prescriptions';
import Invoices from '@/pages/invoices/Invoices';
import Hospitalizations from '@/pages/hospitalizations/Hospitalizations';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoutes() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/appointments" component={Appointments} />
        <Route path="/appointments/request" component={AppointmentRequest} />
        <Route path="/profile" component={Profile} />
        <Route path="/documents" component={Documents} />
        <Route path="/insurance" component={Insurance} />
        <Route path="/consents" component={Consents} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/lab-results" component={LabResults} />
        <Route path="/lab-results/:id" component={LabResultDetail} />
        <Route path="/imaging" component={Imaging} />
        <Route path="/prescriptions" component={Prescriptions} />
        <Route path="/invoices" component={Invoices} />
        <Route path="/hospitalizations" component={Hospitalizations} />
        <Route path="/messages" component={Messages} />
        <Route path="/sessions" component={Sessions} />
        <Route path="/privacy" component={Privacy} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/activate" component={Activate} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/preview" component={PreviewInit} />
      
      {/* Fallback to protected layout for everything else.
          NB: pas de path — un <Route> sans path matche toujours (fallback de Switch).
          L'ancien pattern "/:rest*" ne matchait PAS les chemins multi-segments
          (ex. /lab-results/:id, /appointments/request) → Switch ne rendait rien
          → page blanche sans erreur ni requête réseau. */}
      <Route>
        <ProtectedRoutes />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
