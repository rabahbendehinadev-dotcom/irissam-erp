/**
 * useAutoRefresh
 *
 * Wraps a react-query / tanstack `refetch` callback with:
 *   - An interval-based auto-refetch (default 30 s, configurable).
 *   - A `lastUpdated` Date that is set whenever `data` or `refetch` resolves.
 *   - A human-readable `lastUpdatedLabel` that re-computes every 15 s.
 *
 * Usage:
 *   const { lastUpdatedLabel } = useAutoRefresh({ refetch, data });
 */

import { useState, useEffect, useRef, useCallback } from "react";

/** Default polling interval in milliseconds (30 seconds). */
const DEFAULT_INTERVAL_MS = 30_000;

/** How often the relative-time label is recomputed. */
const LABEL_TICK_MS = 15_000;

interface UseAutoRefreshOptions {
  /** The `refetch` function returned by a react-query hook. */
  refetch: () => void;
  /** Any piece of data from the query – when it changes, lastUpdated is stamped. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  /** Polling interval in ms. Default: 30 000 (30 s). */
  intervalMs?: number;
  /** Pause polling when true (e.g. modal open or tab hidden). */
  paused?: boolean;
}

interface UseAutoRefreshResult {
  /** ISO Date of the last successful data update (null before first load). */
  lastUpdated: Date | null;
  /** Human-readable French label, e.g. "Mis à jour à l'instant" or "il y a 45 s". */
  lastUpdatedLabel: string;
}

function toRelativeLabel(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 10) return "Mis à jour à l'instant";
  if (diffSec < 60) return `Mis à jour il y a ${diffSec} s`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin === 1) return "Mis à jour il y a 1 min";
  return `Mis à jour il y a ${diffMin} min`;
}

export function useAutoRefresh({
  refetch,
  data,
  intervalMs = DEFAULT_INTERVAL_MS,
  paused = false,
}: UseAutoRefreshOptions): UseAutoRefreshResult {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [label, setLabel] = useState("Chargement…");

  // Stamp lastUpdated whenever data changes
  const prevDataRef = useRef<unknown>(undefined);
  useEffect(() => {
    if (data !== undefined && data !== prevDataRef.current) {
      prevDataRef.current = data;
      setLastUpdated(new Date());
    }
  }, [data]);

  // Compute the relative label immediately and again every LABEL_TICK_MS
  useEffect(() => {
    if (!lastUpdated) return;
    setLabel(toRelativeLabel(lastUpdated));
    const tick = setInterval(() => {
      setLabel(toRelativeLabel(lastUpdated));
    }, LABEL_TICK_MS);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  // Polling interval
  const refetchRef = useRef(refetch);
  useEffect(() => { refetchRef.current = refetch; }, [refetch]);

  const stableRefetch = useCallback(() => refetchRef.current(), []);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(stableRefetch, intervalMs);
    return () => clearInterval(id);
  }, [paused, intervalMs, stableRefetch]);

  return { lastUpdated, lastUpdatedLabel: lastUpdated ? label : "" };
}
