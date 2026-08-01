import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { I18nProvider } from '@/i18n';
import { AuthProvider } from './AuthContext';
import { SiteProvider } from './SiteContext';
import { ThemeProvider } from './ThemeContext';
import { NotificationsProvider } from './NotificationsContext';
import { AdmissionsProvider } from './AdmissionsContext';
import { QUERY_STALE_TIME, QUERY_CACHE_TIME } from '@/config/constants';

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

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ThemeProvider>
          <AuthProvider>
            <SiteProvider>
              <NotificationsProvider>
                <AdmissionsProvider>
                  <TooltipProvider>
                    {children}
                    <Toaster />
                  </TooltipProvider>
                </AdmissionsProvider>
              </NotificationsProvider>
            </SiteProvider>
          </AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
