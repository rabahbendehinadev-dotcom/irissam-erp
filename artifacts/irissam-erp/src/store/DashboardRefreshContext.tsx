import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface DashboardRefreshContextValue {
  lastSyncAt: Date | null;
  isRefreshing: boolean;
  refreshAll: () => void;
}

const DashboardRefreshContext = createContext<DashboardRefreshContextValue>({
  lastSyncAt: null,
  isRefreshing: false,
  refreshAll: () => {},
});

/** Keys of all dashboard-related API queries */
const DASHBOARD_PREFIXES = ["/api/dashboard", "/api/alerts", "/api/patients/recent", "/api/appointments/upcoming", "/api/beds/summary", "/api/or/status", "/api/blood-bank/summary", "/api/vehicles/status"];

function isDashboardQuery(queryKey: readonly unknown[]): boolean {
  const first = queryKey[0];
  if (typeof first !== "string") return false;
  return DASHBOARD_PREFIXES.some((prefix) => first.startsWith(prefix));
}

export function DashboardRefreshProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Listen to query cache: update lastSyncAt whenever any dashboard query succeeds
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (
        event.type === "updated" &&
        event.query.state.status === "success" &&
        event.query.state.fetchStatus === "idle" &&
        isDashboardQuery(event.query.queryKey)
      ) {
        setLastSyncAt(new Date());
      }
    });
    return unsubscribe;
  }, [queryClient]);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await queryClient.refetchQueries({
        predicate: (query) => isDashboardQuery(query.queryKey),
      });
      setLastSyncAt(new Date());
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  return (
    <DashboardRefreshContext.Provider value={{ lastSyncAt, isRefreshing, refreshAll }}>
      {children}
    </DashboardRefreshContext.Provider>
  );
}

export function useDashboardRefresh() {
  return useContext(DashboardRefreshContext);
}
