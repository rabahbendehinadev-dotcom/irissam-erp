import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';

export default function PreviewInit() {
  const [, setLocation] = useLocation();
  const { startPreview } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const accountId = params.get('account_id');
    if (!token || !accountId) {
      setError('Paramètres manquants.');
      return;
    }
    startPreview(token, accountId)
      .then(() => setLocation('/'))
      .catch(() => setError('Lien de prévisualisation invalide ou expiré.'));
  }, []);

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-8">
        <p className="text-destructive mb-4">{error}</p>
        <button onClick={() => window.close()} className="text-sm underline">Fermer</button>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      <span className="ml-3 text-muted-foreground">Initialisation de l'aperçu...</span>
    </div>
  );
}
