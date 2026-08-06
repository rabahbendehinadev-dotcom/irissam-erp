/**
 * Settings — System configuration page.
 * Demo data reset is only available in development (import.meta.env.DEV).
 * In production, links to Super Admin for real system configuration.
 */
import { useState } from 'react';
import { Link } from 'wouter';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { RotateCcw, CheckCircle2, Database, Info, Settings as SettingsIcon, Shield, ExternalLink } from 'lucide-react';
import { useAdmissions } from '@/store/AdmissionsContext';

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Paramètres</h1>
          <p className="text-white/60 text-sm mt-1">Configuration du système IRISSAM</p>
        </div>

        {/* System configuration card */}
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
            <SettingsIcon className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <div>
              <h2 className="text-white font-semibold text-sm">Configuration système</h2>
              <p className="text-white/50 text-xs mt-0.5">Paramètres avancés et administration</p>
            </div>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-white/60 text-sm">
              Les paramètres système (intégrations, migrations, sécurité, sessions, sauvegardes)
              sont gérés depuis le tableau de bord Super Administration.
            </p>
            <Link href="/super-admin">
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer">
                <Shield className="w-4 h-4" />
                Ouvrir Super Administration
                <ExternalLink className="w-3 h-3" />
              </span>
            </Link>
          </div>
        </div>

        {/* Demo data section — DEVELOPMENT ONLY */}
        {import.meta.env.DEV && <DemoDataSection />}
      </div>
    </DashboardLayout>
  );
}

/** Reset demo data — available only in development builds. Never rendered in production. */
function DemoDataSection() {
  const { resetToDefaults } = useAdmissions();
  const [confirmed, setConfirmed] = useState(false);
  const [justReset, setJustReset] = useState(false);

  function handleReset() {
    if (!confirmed) { setConfirmed(true); return; }
    resetToDefaults();
    setConfirmed(false);
    setJustReset(true);
    setTimeout(() => setJustReset(false), 3000);
  }

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-amber-500/20 flex items-center gap-3">
        <Database className="w-5 h-5 text-amber-400 flex-shrink-0" />
        <div>
          <h2 className="text-amber-200 font-semibold text-sm">
            Données de démonstration
            <span className="ml-2 text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">DEV</span>
          </h2>
          <p className="text-amber-300/60 text-xs mt-0.5">Disponible uniquement en mode développement</p>
        </div>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
          <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-amber-200 text-xs leading-relaxed">
            Les admissions locales (congés, transferts, annulations) sont sauvegardées dans le stockage
            local du navigateur. Utilisez ce bouton pour réinitialiser les données à leur état d'origine.
          </p>
        </div>
        {justReset && (
          <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">Données réinitialisées avec succès.</span>
          </div>
        )}
        {confirmed ? (
          <div className="space-y-3">
            <p className="text-amber-300 text-sm font-medium">⚠️ Confirmer la réinitialisation ?</p>
            <p className="text-white/60 text-xs">
              Toutes les modifications locales seront perdues et les données d'origine restaurées.
            </p>
            <div className="flex gap-2">
              <button onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors">
                <RotateCcw className="w-4 h-4" /> Oui, réinitialiser
              </button>
              <button onClick={() => setConfirmed(false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium rounded-lg transition-colors">
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium rounded-lg border border-white/10 transition-colors">
            <RotateCcw className="w-4 h-4" /> Réinitialiser les données de démonstration
          </button>
        )}
      </div>
    </div>
  );
}
