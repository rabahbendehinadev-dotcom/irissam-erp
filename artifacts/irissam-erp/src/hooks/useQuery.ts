/**
 * Lightweight data-fetching hook used by HR (and other) module components.
 *
 * Features:
 *  - Fires on mount and whenever `url` changes.
 *  - Exposes `refetch()` for manual refresh.
 *  - Sends the JWT bearer token via the shared apiClient.
 *  - Generic: `useQuery<MyType>(url)` → `{ data: MyType | null, loading, error, refetch }`.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "@/services/api/client";

export interface UseQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useQuery<T = unknown>(url: string | null): UseQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(!!url);
  const [error, setError] = useState<string | null>(null);
  // Track whether the component is still mounted to avoid state updates after unmount
  const mounted = useRef(true);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!url) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    let aborted = false;
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    apiClient
      .request<T>(url, { method: "GET", signal: controller.signal })
      .then(result => {
        if (!aborted && mounted.current) {
          setData(result);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!aborted && mounted.current) {
          if (err?.name !== "AbortError") {
            setError(err?.message ?? "Erreur réseau");
          }
          setLoading(false);
        }
      });

    return () => {
      aborted = true;
      controller.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, tick]);

  return { data, loading, error, refetch };
}
