import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/store/AuthContext';
import { authService } from '@/services/authService';
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';

/** Minimum password requirements */
const MIN_LENGTH = 8;

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const checks = [
    { label: '8 caractères min.', ok: password.length >= MIN_LENGTH },
    { label: 'Majuscule',          ok: /[A-Z]/.test(password) },
    { label: 'Minuscule',          ok: /[a-z]/.test(password) },
    { label: 'Chiffre',            ok: /[0-9]/.test(password) },
    { label: 'Spécial (!@#…)',     ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter(c => c.ok).length;
  const color = score <= 2 ? 'bg-red-500' : score <= 3 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="mt-1 space-y-1">
      <div className="flex gap-1">
        {checks.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < score ? color : 'bg-gray-200'}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {checks.map(c => (
          <span key={c.label} className={`text-xs ${c.ok ? 'text-green-600' : 'text-gray-400'}`}>
            {c.ok ? '✓' : '○'} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  const { user, token, logout } = useAuth();
  const [, setLocation] = useLocation();

  const [current,  setCurrent]  = useState('');
  const [next,     setNext]     = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showCur,  setShowCur]  = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (next.length < MIN_LENGTH) {
      setError(`Le nouveau mot de passe doit contenir au moins ${MIN_LENGTH} caractères.`);
      return;
    }
    if (next !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (next === current) {
      setError('Le nouveau mot de passe doit être différent de l\'actuel.');
      return;
    }

    setLoading(true);
    try {
      await authService.changePassword(current, next);
      setSuccess(true);
      // Backend revokes all sessions — force logout after 2s then redirect to login
      setTimeout(async () => {
        await logout();
        setLocation('/login');
      }, 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors du changement de mot de passe.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a2540] via-[#0e3460] to-[#1a5c8a] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Mot de passe modifié</h2>
          <p className="text-gray-500 text-sm">
            Votre mot de passe a été mis à jour. Vous allez être redirigé vers la page de connexion…
          </p>
          <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a2540] via-[#0e3460] to-[#1a5c8a] flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-blue-400/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <img src="/logo.png" alt="IRISSAM Hospital" className="w-20 h-20 object-contain drop-shadow-2xl" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">IRISSAM HOSPITAL</h1>
          <p className="text-blue-200 text-sm mt-1">Première connexion — Sécurisez votre compte</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-400" />

          <div className="p-8">
            <div className="flex items-center gap-3 mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
              <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-900">Changement de mot de passe requis</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Bienvenue {user?.firstName} {user?.lastName}. Définissez un mot de passe personnel avant de continuer.
                </p>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Current password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Mot de passe actuel
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showCur ? 'text' : 'password'}
                    value={current}
                    onChange={e => setCurrent(e.target.value)}
                    required
                    autoFocus
                    className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Votre mot de passe temporaire"
                  />
                  <button type="button" onClick={() => setShowCur(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showCur ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={next}
                    onChange={e => setNext(e.target.value)}
                    required
                    className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Minimum 8 caractères"
                  />
                  <button type="button" onClick={() => setShowNew(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <PasswordStrength password={next} />
              </div>

              {/* Confirm */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirmer le nouveau mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    className={`w-full pl-10 pr-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                      confirm && confirm !== next ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}
                    placeholder="Répétez le nouveau mot de passe"
                  />
                </div>
                {confirm && confirm !== next && (
                  <p className="text-xs text-red-500 mt-1">Les mots de passe ne correspondent pas</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !current || !next || !confirm}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Modification en cours…
                  </span>
                ) : (
                  'Définir mon mot de passe'
                )}
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-6">
              © 2026 IRISSAM Hospital — Accès réservé au personnel autorisé
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
