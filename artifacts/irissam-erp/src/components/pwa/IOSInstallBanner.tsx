/**
 * IOSInstallBanner — shown on iOS Safari when not in standalone mode.
 * Dismissible, stored in localStorage for 7 days.
 */
import { useState, useEffect } from "react";
import { X, Share, PlusSquare } from "lucide-react";

const DISMISSED_KEY = "pwa_ios_banner_dismissed";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function IOSInstallBanner() {
  const [visible, setVisible] = useState(false);

  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) && !(window as any).MSStream;
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;

  useEffect(() => {
    if (!isIOS || isStandalone) return;

    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed) {
      const ts = parseInt(dismissed, 10);
      if (Date.now() - ts < DISMISS_TTL_MS) return;
    }

    // Small delay so it doesn't flash on load
    const t = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(t);
  }, [isIOS, isStandalone]);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[200] pb-safe">
      <div className="m-3 bg-white rounded-2xl shadow-2xl border border-gray-200 p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#1B2A4A] flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-xs text-center leading-tight">IRIS<br/>SAM</span>
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Installer IRISSAM ERP</p>
              <p className="text-xs text-gray-500">Accès rapide depuis votre écran d'accueil</p>
            </div>
          </div>
          <button onClick={dismiss} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 shrink-0 ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Steps */}
        <div className="space-y-2 mb-4">
          <Step n={1} icon={<Share className="w-4 h-4 text-blue-500" />}>
            Appuyez sur l'icône <strong>Partager</strong> <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-100 text-blue-600 rounded text-xs">⬆</span> en bas de Safari
          </Step>
          <Step n={2} icon={<PlusSquare className="w-4 h-4 text-blue-500" />}>
            Faites défiler et choisissez <strong>«&nbsp;Sur l'écran d'accueil&nbsp;»</strong>
          </Step>
          <Step n={3} icon={<span className="text-blue-500 font-bold text-sm">✓</span>}>
            Appuyez sur <strong>«&nbsp;Ajouter&nbsp;»</strong> en haut à droite
          </Step>
        </div>

        <button
          onClick={dismiss}
          className="w-full bg-[#1B2A4A] hover:bg-[#243660] text-white rounded-xl py-3 text-sm font-semibold transition-colors"
        >
          Compris
        </button>
      </div>
    </div>
  );
}

function Step({ n, icon, children }: { n: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
      <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
        {n}
      </div>
      <div className="text-xs text-gray-700 flex-1">{children}</div>
      <div className="shrink-0">{icon}</div>
    </div>
  );
}

/**
 * IOSInstallInstructions — inline version for the Settings page.
 */
export function IOSInstallInstructions() {
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) && !(window as any).MSStream;
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;

  if (isStandalone) {
    return (
      <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-700">
        ✅ L'application est déjà installée sur cet appareil.
      </div>
    );
  }

  if (!isIOS) {
    return (
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-sm text-gray-600">
        Utilisez le bouton <strong>«&nbsp;Installer l'application&nbsp;»</strong> dans la barre du haut ou dans le menu utilisateur.
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 space-y-3">
      <p className="text-sm font-semibold text-blue-800">Installer IRISSAM ERP sur iPhone / iPad</p>
      <div className="space-y-2">
        <Step n={1} icon={<Share className="w-4 h-4 text-blue-500" />}>
          Appuyez sur l'icône <strong>Partager</strong> en bas de Safari
        </Step>
        <Step n={2} icon={<PlusSquare className="w-4 h-4 text-blue-500" />}>
          Choisissez <strong>«&nbsp;Sur l'écran d'accueil&nbsp;»</strong>
        </Step>
        <Step n={3} icon={<span className="text-blue-500 font-bold text-sm">✓</span>}>
          Appuyez sur <strong>«&nbsp;Ajouter&nbsp;»</strong>
        </Step>
      </div>
    </div>
  );
}
