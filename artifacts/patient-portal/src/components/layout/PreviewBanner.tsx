import { useEffect, useState } from 'react';
import { Eye, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';

export function PreviewBanner() {
  const { previewInfo, exitPreview } = useAuth();
  const [, setLocation] = useLocation();
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!previewInfo?.expiresAt) return;
    const update = () => {
      const diff = new Date(previewInfo.expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        exitPreview();
        setLocation('/login');
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}:${String(s).padStart(2, '0')}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [previewInfo?.expiresAt]);

  const handleExit = () => {
    exitPreview();
    try { window.close(); } catch {}
    setLocation('/login');
  };

  if (!previewInfo) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between text-sm font-medium shadow-lg">
      <div className="flex items-center gap-2">
        <Eye className="w-4 h-4" />
        <span className="font-bold">Mode aperçu employé — lecture seule</span>
        <span className="opacity-75">·</span>
        <span>Vue de : <strong>{previewInfo.staffName}</strong></span>
      </div>
      <div className="flex items-center gap-3">
        <span className="tabular-nums font-mono bg-amber-600/30 px-2 py-0.5 rounded text-xs">Expire dans {timeLeft}</span>
        <button onClick={handleExit} className="flex items-center gap-1 bg-amber-700 text-amber-50 px-3 py-1 rounded text-xs hover:bg-amber-800 transition-colors">
          <LogOut className="w-3 h-3" />
          Quitter l'aperçu
        </button>
      </div>
    </div>
  );
}
