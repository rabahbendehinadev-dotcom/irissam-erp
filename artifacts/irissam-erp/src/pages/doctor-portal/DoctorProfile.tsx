import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { apiClient } from '@/services/api/client';
import { DoctorPortalLayout } from '@/layouts/DoctorPortalLayout';
import { AlertCircle, RefreshCw, Save, CheckCircle2, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfileUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  site: string | null;
  department: string | null;
}

interface Preferences {
  language: 'fr' | 'ar' | 'en';
  notifyOnCriticalResults: boolean;
  notifyOnNewMessages: boolean;
  signatureText: string;
}

interface Session {
  id: string;
  created_at: string;
  ip_address: string;
  user_agent: string;
  is_active: boolean;
}

interface ProfileData {
  user: ProfileUser;
  preferences: Preferences;
  sessions: Session[];
}

const LANGUAGES: { value: 'fr' | 'ar' | 'en'; label: string }[] = [
  { value: 'fr', label: 'Français' },
  { value: 'ar', label: 'العربية' },
  { value: 'en', label: 'English' },
];

function initials(first: string, last: string): string {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('bg-gray-200 rounded-lg animate-pulse', className)} />;
}

export default function DoctorProfile() {
  const [, setLocation] = useLocation();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Preferences form state
  const [language, setLanguage] = useState<'fr' | 'ar' | 'en'>('fr');
  const [notifyCritical, setNotifyCritical] = useState(true);
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [signatureText, setSignatureText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<ProfileData>('/api/doctor-portal/profile');
      const data = res as ProfileData;
      setProfile(data);
      if (data?.preferences) {
        setLanguage(data.preferences.language ?? 'fr');
        setNotifyCritical(data.preferences.notifyOnCriticalResults ?? true);
        setNotifyMessages(data.preferences.notifyOnNewMessages ?? true);
        setSignatureText(data.preferences.signatureText ?? '');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await apiClient.patch('/api/doctor-portal/profile', {
        language,
        signatureText,
        notificationPrefs: {
          criticalResults: notifyCritical,
          newMessages: notifyMessages,
        },
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DoctorPortalLayout>
        <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
          <SkeletonBlock className="h-36" />
          <SkeletonBlock className="h-64" />
          <SkeletonBlock className="h-48" />
        </div>
      </DoctorPortalLayout>
    );
  }

  if (error || !profile) {
    return (
      <DoctorPortalLayout>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center max-w-lg mx-auto">
            <AlertCircle className="mx-auto text-red-400 mb-3" size={32} />
            <p className="text-red-700 font-medium mb-4">{error ?? 'Profil introuvable'}</p>
            <button
              onClick={fetchProfile}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
            >
              <RefreshCw size={14} /> Réessayer
            </button>
          </div>
        </div>
      </DoctorPortalLayout>
    );
  }

  const { user, sessions } = profile;

  return (
    <DoctorPortalLayout>
      <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
        <h1 className="text-xl font-bold text-gray-900">Mon profil</h1>

        {/* Profile card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-2xl font-bold">
                {initials(user.firstName, user.lastName)}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Dr. {user.firstName} {user.lastName}
              </h2>
              <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                {user.role}
              </span>
              <p className="text-sm text-gray-500 mt-1">{user.email}</p>
              {(user.site || user.department) && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {[user.site, user.department].filter(Boolean).join(' — ')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Preferences form */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-gray-900 mb-4">Préférences</h2>

          <form onSubmit={handleSavePreferences} className="space-y-5">
            {/* Language */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Langue</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'fr' | 'ar' | 'en')}
                className="w-full sm:w-64 border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>

            {/* Notification prefs */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Notifications</p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyCritical}
                    onChange={(e) => setNotifyCritical(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">Résultats critiques</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyMessages}
                    onChange={(e) => setNotifyMessages(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">Nouveaux messages</span>
                </label>
              </div>
            </div>

            {/* Signature */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Signature électronique</label>
              <textarea
                value={signatureText}
                onChange={(e) => setSignatureText(e.target.value)}
                rows={4}
                placeholder="Votre signature apparaîtra en bas des ordonnances et notes…"
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Feedback */}
            {saveSuccess && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle2 size={16} />
                Préférences enregistrées avec succès
              </div>
            )}
            {saveError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {saveError}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Save size={16} />
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </form>
        </div>

        {/* Sessions */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Sessions actives</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Date', 'Adresse IP', 'Appareil', 'Statut'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                      Aucune session enregistrée
                    </td>
                  </tr>
                ) : (
                  sessions.map((session) => (
                    <tr key={session.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {new Date(session.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{session.ip_address}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate text-xs">
                        {session.user_agent}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full',
                          session.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500',
                        )}>
                          {session.is_active ? 'Actif' : 'Expiré'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Security */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Shield size={18} className="text-gray-500" />
            Sécurité
          </h2>
          <button
            onClick={() => setLocation('/change-password')}
            className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Changer mon mot de passe
          </button>
        </div>
      </div>
    </DoctorPortalLayout>
  );
}
