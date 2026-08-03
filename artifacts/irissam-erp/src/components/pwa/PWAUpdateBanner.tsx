/**
 * PWAUpdateBanner — shown when a new Service Worker is waiting.
 *
 * Flow:
 *   1. index.html dispatches "sw-update-available" when a new SW enters waiting state.
 *   2. This component listens for that event and shows a banner.
 *   3. User clicks "Mettre à jour" → sends SKIP_WAITING → SW takes over.
 *   4. index.html's controllerchange listener reloads the page ONCE (loop-guard).
 *   5. User can dismiss and be reminded later (banner re-appears on next navigation).
 */
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, X } from 'lucide-react';

export function PWAUpdateBanner() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ registration: ServiceWorkerRegistration }>;
      if (ev.detail?.registration) {
        setRegistration(ev.detail.registration);
        setDismissed(false); // re-show if previously dismissed
      }
    };
    window.addEventListener('sw-update-available', handler);
    return () => window.removeEventListener('sw-update-available', handler);
  }, []);

  const handleUpdate = useCallback(() => {
    if (!registration?.waiting) return;
    // Tell the waiting SW to skip waiting and take control.
    // The controllerchange listener in index.html will then reload once.
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }, [registration]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  if (!registration || dismissed) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[400] w-[min(calc(100vw-2rem),420px)]"
    >
      <div className="bg-[#1B2A4A] text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-500/30 flex items-center justify-center shrink-0">
          <RefreshCw size={16} className="text-blue-300" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">
            Une nouvelle version est disponible.
          </p>
          <p className="text-xs text-blue-200 mt-0.5">
            Mettez à jour pour profiter des dernières améliorations.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleUpdate}
            className="bg-blue-500 hover:bg-blue-400 active:bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            Mettre à jour
          </button>
          <button
            onClick={handleDismiss}
            aria-label="Ignorer"
            className="p-1.5 rounded-full hover:bg-white/10 text-blue-200 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
