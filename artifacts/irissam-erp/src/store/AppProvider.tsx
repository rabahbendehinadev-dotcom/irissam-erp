import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { I18nProvider } from '@/i18n';
import { AuthProvider } from './AuthContext';
import { SiteProvider } from './SiteContext';
import { ThemeProvider } from './ThemeContext';
import { NotificationsProvider } from './NotificationsContext';
import { AdmissionsProvider } from './AdmissionsContext';
import { MockRepositoryProvider } from './MockRepository';
import { ApiRepositoryProvider } from './ApiRepository';
import { AppointmentStoreProvider } from './AppointmentStore';
import { QUERY_STALE_TIME, QUERY_CACHE_TIME } from '@/config/constants';

/**
 * When VITE_USE_API_REPOSITORY=true the ApiRepositoryProvider is used.
 * Clinical records (lab orders, imaging orders, prescriptions, encounters) are then
 * persisted to PostgreSQL via the API server and survive page refresh.
 *
 * Set VITE_USE_API_REPOSITORY=false (or omit) to keep the in-memory MockRepository
 * for local development without a running API server.
 */
const USE_API_REPOSITORY = import.meta.env.VITE_USE_API_REPOSITORY === 'true';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_TIME,
      gcTime: QUERY_CACHE_TIME,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const RepositoryProvider = USE_API_REPOSITORY ? ApiRepositoryProvider : MockRepositoryProvider;

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ThemeProvider>
          <AuthProvider>
            <SiteProvider>
              <NotificationsProvider>
                <AdmissionsProvider>
                  <AppointmentStoreProvider>
                    <RepositoryProvider>
                      <TooltipProvider>
                        {children}
                        <Toaster />
                      </TooltipProvider>
                    </RepositoryProvider>
                  </AppointmentStoreProvider>
                </AdmissionsProvider>
              </NotificationsProvider>
            </SiteProvider>
          </AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
