import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/store/AuthContext';
import { Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react';

// Demo shortcuts are only available in development builds.
// In production, these are not rendered — credentials must be entered manually.
const IS_DEV = import.meta.env.DEV;

const DEMO_USERS = IS_DEV
  ? [
      { label: 'Administrateur', email: 'admin@irissam.dz', password: 'Admin@2026!', color: 'bg-blue-600' },
    ]
  : [];

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      setLocation('/');
    }
  }, [isAuthenticated, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      // Redirect to change-password on first login, dashboard otherwise
      if (user?.forcePasswordChange) {
        setLocation('/change-password');
      } else {
        setLocation('/');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Identifiants invalides.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (u: typeof DEMO_USERS[number]) => {
    setEmail(u.email);
    setPassword(u.password);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a2540] via-[#0e3460] to-[#1a5c8a] flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-blue-600/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo & Hospital name */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <img
              src="/logo.png"
              alt="IRISSAM Hospital"
              className="w-28 h-28 object-contain drop-shadow-2xl"
            />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">IRISSAM HOSPITAL</h1>
          <p className="text-blue-200 text-sm mt-1">Système de Gestion Hospitalière</p>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-400" />

          <div className="p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Connexion</h2>
            <p className="text-sm text-gray-500 mb-6">Accédez à votre espace de travail sécurisé</p>

            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-5">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Adresse e-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    required
                    className="w-full h-10 pl-10 pr-4 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full h-10 pl-10 pr-10 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-[#0a2540] hover:bg-[#0e3460] disabled:opacity-60 text-white font-semibold rounded-lg text-sm transition-all flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Connexion en cours…
                  </>
                ) : (
                  'Se connecter'
                )}
              </button>
            </form>

            {/* Demo accounts — development mode only */}
            {IS_DEV && DEMO_USERS.length > 0 && (
              <div className="mt-6 pt-5 border-t border-gray-100">
                <p className="text-xs text-gray-400 text-center mb-3 font-medium uppercase tracking-wide">
                  Accès rapide — développement uniquement
                </p>
                <div className="flex gap-2">
                  {DEMO_USERS.map(u => (
                    <button
                      key={u.email}
                      onClick={() => fillDemo(u)}
                      className={`flex-1 text-center py-2 px-2 rounded-lg text-white text-xs font-semibold transition-all hover:opacity-90 hover:shadow-md ${u.color}`}
                    >
                      {u.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 text-center mt-2">
                  Cliquez sur un rôle puis &quot;Se connecter&quot;
                </p>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-blue-200/60 text-xs mt-6">
          © {new Date().getFullYear()} IRISSAM Hospital — Accès réservé au personnel autorisé
        </p>
      </div>
    </div>
  );
}
