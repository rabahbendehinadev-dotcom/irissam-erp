/**
 * OfflineBanner — shows a sticky banner when the device loses internet.
 * Network-first: disappears when connection is restored.
 */
import { useState, useEffect } from "react";
import { WifiOff, Wifi } from "lucide-react";

export function OfflineBanner() {
  const [isOnline, setIsOnline]   = useState(navigator.onLine);
  const [showBack, setShowBack]   = useState(false);
  const [visible, setVisible]     = useState(false);

  useEffect(() => {
    const goOffline = () => { setIsOnline(false); setVisible(true); setShowBack(false); };
    const goOnline  = () => {
      setIsOnline(true);
      setShowBack(true);
      setTimeout(() => setVisible(false), 3000);
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online",  goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online",  goOnline);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all ${
      isOnline
        ? "bg-green-500 text-white"
        : "bg-red-600 text-white"
    }`}>
      {isOnline
        ? <><Wifi className="w-4 h-4 shrink-0" /> Connexion rétablie. Les données se synchronisent…</>
        : <><WifiOff className="w-4 h-4 shrink-0" /> Hors ligne — certaines fonctions sont indisponibles. Reconnectez-vous avant d'effectuer des opérations sensibles.</>
      }
    </div>
  );
}
