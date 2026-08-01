import { createContext, useContext, useState, useCallback } from 'react';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  createdAt: string;
  link?: string;
}

interface NotificationsContextType {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (n: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([
    { id: 'n-1', title: 'Résultat critique', body: 'Potassium élevé – Fatima Zahra', type: 'error', isRead: false, createdAt: new Date().toISOString() },
    { id: 'n-2', title: 'Stock faible', body: 'Paracétamol 1G – 15 unités', type: 'warning', isRead: false, createdAt: new Date().toISOString() },
  ]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const addNotification = useCallback((n: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>) => {
    setNotifications(prev => [{
      ...n,
      id: `n-${Date.now()}`,
      createdAt: new Date().toISOString(),
      isRead: false,
    }, ...prev]);
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, addNotification, markAsRead, markAllAsRead, clearAll }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
