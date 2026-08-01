import { useState, useEffect } from 'react';

export interface OnlineStatus {
  isOnline: boolean;
  lastSync: Date | null;
  pendingSync: number;
}

export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSync] = useState<Date | null>(new Date());

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    lastSync,
    pendingSync: 0, // TODO: implement when offline sync is built
  };
}
