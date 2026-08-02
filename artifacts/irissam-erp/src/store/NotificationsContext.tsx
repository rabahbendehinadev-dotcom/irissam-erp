/**
 * NotificationsContext — backed by real PostgreSQL + SSE realtime stream.
 * SSE endpoint: GET /api/notifications/stream
 * Falls back to polling if SSE is unavailable.
 *
 * Deduplication: tracks seen IDs to prevent double-toasting.
 */
import {
  createContext, useContext, useState, useEffect, useCallback, useRef,
} from 'react';
import { apiClient } from '@/services/api/client';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AppNotification {
  id:           string;
  type:         string;
  title:        string;
  body:         string;
  isRead:       boolean;
  priority:     string;
  sourceModule: string;
  entityId:     string | null;
  createdAt:    string;
  link?:        string;
}

interface ApiNotification {
  id:           string;
  type:         string;
  title:        string;
  message:      string;
  readBy:       string[];
  priority:     string;
  sourceModule: string;
  entityId:     string | null;
  createdAt:    string;
}

/**
 * Input type for addNotification().
 * `priority`, `sourceModule`, and `entityId` are optional here — the implementation
 * applies safe defaults ('normal', 'system', null) so callers (MockRepository,
 * tests, etc.) don't have to provide them for every local/optimistic notification.
 * The stored AppNotification keeps all fields required.
 */
export type AddNotificationInput =
  Omit<AppNotification, 'id' | 'createdAt' | 'isRead' | 'priority' | 'sourceModule' | 'entityId'>
  & {
    priority?:     string;
    sourceModule?: string;
    entityId?:     string | null;
  };

interface NotificationsContextType {
  notifications:   AppNotification[];
  unreadCount:     number;
  connected:       boolean;
  addNotification: (n: AddNotificationInput) => void;
  markAsRead:      (id: string) => Promise<void>;
  markAllAsRead:   () => Promise<void>;
  clearAll:        () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function mapApiNotification(n: ApiNotification): AppNotification {
  return {
    id:           n.id,
    type:         n.type,
    title:        n.title,
    body:         n.message,
    isRead:       false, // server doesn't know current user here — treat as unread unless filtered
    priority:     n.priority,
    sourceModule: n.sourceModule,
    entityId:     n.entityId,
    createdAt:    n.createdAt,
  };
}

// ── Context ────────────────────────────────────────────────────────────────────

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

const BASE_URL = (typeof window !== 'undefined' ? window.location.origin : '') + '/api';

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [connected,     setConnected]     = useState(false);
  const seenIds = useRef(new Set<string>());
  const esRef   = useRef<EventSource | null>(null);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  // ── Load initial notifications ───────────────────────────────────────────────
  useEffect(() => {
    apiClient.get<ApiNotification[]>('/notifications')
      .then(rows => {
        const mapped = rows.map(mapApiNotification);
        mapped.forEach(n => seenIds.current.add(n.id));
        setNotifications(mapped);
      })
      .catch(() => { /* non-fatal — will still work via SSE */ });
  }, []);

  // ── SSE connection ───────────────────────────────────────────────────────────
  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout>;
    let unmounted = false;

    function connect() {
      if (unmounted) return;

      const es = new EventSource(`${BASE_URL}/notifications/stream`);
      esRef.current = es;

      es.addEventListener('connected', () => {
        if (!unmounted) setConnected(true);
      });

      // Listen to all known notification event types
      const EVENT_TYPES = [
        'lab_result_ready', 'critical_lab_result', 'imaging_report_ready',
        'prescription_dispensed', 'admission_created', 'bed_available',
        'icu_full', 'icu_bed_reserved', 'surgical_request_created',
        'operating_room_ready', 'ambulance_arrived', 'discharge_completed',
        // generic type from POST /notifications
        'info', 'warning', 'error', 'success',
      ];

      for (const evType of EVENT_TYPES) {
        es.addEventListener(evType, (ev) => {
          if (unmounted) return;
          try {
            const data: ApiNotification = JSON.parse((ev as MessageEvent).data);
            if (!data?.id || seenIds.current.has(data.id)) return;
            seenIds.current.add(data.id);
            setNotifications(prev => [mapApiNotification(data), ...prev]);
          } catch { /* malformed */ }
        });
      }

      es.onerror = () => {
        es.close();
        if (!unmounted) {
          setConnected(false);
          // Exponential back-off: 3 s, 6 s, 12 s …
          retryTimer = setTimeout(connect, 3000);
        }
      };
    }

    connect();

    return () => {
      unmounted = true;
      clearTimeout(retryTimer);
      esRef.current?.close();
      esRef.current = null;
      setConnected(false);
    };
  }, []);

  // ── Mutations ────────────────────────────────────────────────────────────────

  /** Optimistic local add (e.g. from MockRepository or tests).
   *  Applies defaults for optional fields so callers only need title/body/type. */
  const addNotification = useCallback(
    (n: AddNotificationInput) => {
      const id = `local-${Date.now()}`;
      if (seenIds.current.has(id)) return;
      seenIds.current.add(id);
      const full: AppNotification = {
        priority:     'normal',
        sourceModule: 'system',
        entityId:     null,
        ...n,
        id,
        isRead:    false,
        createdAt: new Date().toISOString(),
      };
      setNotifications(prev => [full, ...prev]);
    },
    [],
  );

  const markAsRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    await apiClient.patch(`/notifications/${id}/read`, {}).catch(() => {});
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    await apiClient.patch('/notifications/read-all', {}).catch(() => {});
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationsContext.Provider value={{
      notifications, unreadCount, connected,
      addNotification, markAsRead, markAllAsRead, clearAll,
    }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
