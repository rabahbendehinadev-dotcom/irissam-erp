import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ClipboardList, Activity, Brain, History, Shield, Pill,
  Syringe, Paperclip, FileText,
} from 'lucide-react';
import { ScrollableTabBar } from '@/components/ui/ScrollableTabBar';
import { ConsultationHeader } from './ConsultationHeader';
import { ConsultationSummaryModal } from './ConsultationSummaryModal';
import { ConsultationPrintModal } from './ConsultationPrintModal';
import { DiagnosisBuilder } from './DiagnosisBuilder';
import { ConsultationHistoryPanel } from './ConsultationHistoryPanel';
import { ConsultationPrescriptionsPanel } from './ConsultationPrescriptionsPanel';
import { ConsultationTreatmentsPanel } from './ConsultationTreatmentsPanel';
import { ConsultationDocumentsPanel } from './ConsultationDocumentsPanel';
import { OrdonnancePanel } from './OrdonnanceModal';
import type { Consultation, ConsultationStatus, AuditEntry } from '@/types/consultation';
import { useAuth } from '@/store/AuthContext';

/**
 * Espace de travail d'une consultation — 100 % données réelles.
 *
 * Onglets affichés : uniquement ceux adossés à des données PostgreSQL
 * (contexte, diagnostic, médicaments, traitements, documents, ordonnance)
 * ou à des états honnêtes (signes vitaux ; historique ; journal de session).
 * Flux médecin : Diagnostic → Médicaments → Traitements → Documents →
 * Ordonnance. Les prescriptions sont rattachées à la consultation (médicament
 * du stock pharmacie) puis suivent le flux préparation → délivrance (stock
 * déduit). Documents : téléversement réel en deux temps (stockage objet →
 * rattachement audité). Les anciens onglets de démonstration (examen
 * clinique, analyses, imagerie, suivi) restent retirés tant que leurs
 * modules n'existent pas.
 */

// ─── Libellés type / origine (valeurs enum PostgreSQL + héritées) ────────────

const TYPE_LABELS: Record<string, string> = {
  consultation_externe: 'Consultation externe',
  teleconsultation:     'Téléconsultation',
  urgence:              'Urgence',
  hospitalier:          'Hospitalière',
  programmee:           'Programmée',
  sans_rdv:             'Sans rendez-vous',
  controle:             'Contrôle',
  specialisee:          'Spécialisée',
  ambulatoire:          'Ambulatoire',
  urgences:             'Issue des urgences',
  hospitalisation:      'Hospitalisation',
};

const ORIGIN_LABELS: Record<string, string> = {
  rdv:             'Rendez-vous',
  walk_in:         'Sans rendez-vous',
  sans_rdv:        'Sans rendez-vous',
  urgence:         'Urgences',
  hospitalisation: 'Hospitalisation',
  admission:       'Admission',
  controle:        'Contrôle',
};

function fmtDateTime(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

// ─── Onglet Contexte — lecture seule, champs PostgreSQL uniquement ───────────

function ContextTab({ consultation: c }: { consultation: Consultation }) {
  const rows: { label: string; value: string }[] = [
    { label: 'Type',        value: TYPE_LABELS[c.type] ?? c.type },
    { label: 'Origine',     value: ORIGIN_LABELS[c.origin] ?? c.origin },
    { label: 'Date prévue', value: fmtDateTime(c.scheduledAt) },
    { label: 'Début',       value: fmtDateTime(c.startedAt) },
    { label: 'Fin',         value: fmtDateTime(c.endedAt) },
    { label: 'Durée',       value: c.duration ? `${c.duration} min` : '—' },
  ];

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
          Motif de consultation
        </label>
        <p className="text-sm text-gray-800 whitespace-pre-wrap p-4 bg-gray-50 border border-gray-200 rounded-xl">
          {c.reason?.trim() || <span className="italic text-gray-400">Non renseigné</span>}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {rows.map(r => (
          <div key={r.label} className="p-3 bg-gray-50 border border-gray-100 rounded-lg">
            <p className="text-xs text-gray-400">{r.label}</p>
            <p className="text-sm font-medium text-gray-800 mt-0.5">{r.value}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400">
        Informations issues du dossier PostgreSQL de la consultation (lecture
        seule). Les champs modifiables sont le statut, les notes du dossier et
        le diagnostic.
      </p>
    </div>
  );
}

// ─── Onglet Signes vitaux — état vide honnête (aucun backend consultations) ──

function VitalsTab() {
  return (
    <div className="text-center py-12 max-w-md mx-auto">
      <Activity size={36} className="mx-auto mb-3 text-gray-300" />
      <p className="text-sm font-medium text-gray-600">
        Aucun signe vital enregistré pour cette consultation
      </p>
      <p className="text-xs text-gray-400 mt-2 leading-relaxed">
        La saisie des signes vitaux n'est pas encore disponible dans le module
        Consultations : elle n'existe aujourd'hui que dans le module Urgences
        (visites d'urgence). Aucune valeur fictive n'est affichée ici.
      </p>
    </div>
  );
}

// ─── Journal de session ───────────────────────────────────────────────────────

/** Chaîne courte « Navigateur / OS » dérivée du User-Agent réel. */
function getDeviceInfo(): string {
  const ua = navigator.userAgent;
  let browser = 'Navigateur';
  let os = 'OS inconnu';

  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('OPR/') || ua.includes('Opera')) browser = 'Opera';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';

  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  return `${browser} / ${os}`;
}

function makeAuditId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function SessionJournalTab({ consultationNumber, entries }: {
  consultationNumber: string;
  entries: AuditEntry[];
}) {
  const sorted = [...entries].sort((a, b) => a.at.localeCompare(b.at));

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Journal de session — {consultationNumber}</h3>
        <span className="text-xs text-gray-400">{entries.length} entrée{entries.length !== 1 ? 's' : ''}</span>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">Aucune action enregistrée pour cette session.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Heure', 'Utilisateur', 'Rôle', 'Action', 'Appareil'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 font-semibold text-gray-500 uppercase tracking-wide text-xs whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-gray-500 whitespace-nowrap">{formatTime(entry.at)}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap">{entry.userName}</td>
                  <td className="px-4 py-2.5">
                    <span className="bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-full text-xs whitespace-nowrap">
                      {entry.userRole}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{entry.action}</td>
                  <td className="px-4 py-2.5 font-mono text-gray-400 whitespace-nowrap">{entry.device}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        Journal local de la session en cours (non persisté). L'audit officiel des
        enregistrements — création, statut, notes, diagnostic — est conservé côté
        serveur dans la table <code className="font-mono">audit_logs</code>.
      </p>
    </div>
  );
}

// ─── Onglets ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'context',       label: 'Contexte',      icon: ClipboardList },
  { id: 'diagnosis',     label: 'Diagnostic',    icon: Brain },
  { id: 'prescriptions', label: 'Médicaments',   icon: Pill },
  { id: 'treatments',    label: 'Traitements',   icon: Syringe },
  { id: 'documents',     label: 'Documents',     icon: Paperclip },
  { id: 'ordonnance',    label: 'Ordonnance',    icon: FileText },
  { id: 'vitals',        label: 'Signes vitaux', icon: Activity },
  { id: 'history',       label: 'Historique',    icon: History },
  { id: 'journal',       label: 'Session',       icon: Shield },
];

// ─── Espace de travail principal ──────────────────────────────────────────────

interface Props {
  consultation: Consultation;
  onStatusChange: (status: ConsultationStatus) => void;
  /** Persiste le diagnostic (PATCH /consultations/:id { diagnosis }). Résout à true si enregistré. */
  onSaveDiagnosis: (diagnosis: string) => Promise<boolean>;
  diagnosisSaving: boolean;
  /** Un PATCH réel (notes / diagnostic) est en cours — affiché dans l'en-tête. */
  saving?: boolean;
  /** Recharge la consultation depuis l'API (ex. après rattachement patient). */
  onReload?: () => void;
}

export function ConsultationWorkspace({
  consultation, onStatusChange, onSaveDiagnosis, diagnosisSaving, saving = false, onReload,
}: Props) {
  const { user } = useAuth();
  const [activeTab, setActiveTab]     = useState('context');
  const [showSummary, setShowSummary] = useState(false);
  const [showPrint, setShowPrint]     = useState(false);

  // Journal de session : actions de l'utilisateur RÉEL sur cet écran.
  const [sessionLog, setSessionLog] = useState<AuditEntry[]>([]);
  const deviceInfo = useRef<string>(getDeviceInfo());

  const pushEntry = useCallback((action: string) => {
    const entry: AuditEntry = {
      id: makeAuditId(),
      at: new Date().toISOString(),
      userId:   user?.id ?? 'anonymous',
      userName: user ? `${user.firstName} ${user.lastName}`.trim() : 'Utilisateur inconnu',
      userRole: user?.role ?? 'Inconnu',
      action,
      device: deviceInfo.current,
      syncStatus: 'synced',
    };
    setSessionLog(prev => [...prev, entry]);
  }, [user]);

  // « Ouverture » : une seule fois par montage.
  const openedRef = useRef(false);
  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    pushEntry('Ouverture de la consultation');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const readOnly = consultation.status === 'terminee' || consultation.status === 'annulee' || consultation.status === 'patient_absent';

  const handleStatusChange = (status: ConsultationStatus) => {
    pushEntry(`Changement de statut demandé → ${status}`);
    onStatusChange(status);
  };

  const handleSaveDiagnosis = async (diagnosis: string): Promise<boolean> => {
    const ok = await onSaveDiagnosis(diagnosis);
    if (ok) pushEntry('Diagnostic enregistré (PostgreSQL + audit serveur)');
    return ok;
  };

  const handleTerminer        = () => setShowSummary(true);
  const handleConfirmTerminer = () => { handleStatusChange('terminee'); setShowSummary(false); };
  const handlePrint           = () => setShowPrint(true);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">

      {/* En-tête sticky */}
      <ConsultationHeader
        consultation={consultation}
        saving={saving}
        onStatusChange={handleStatusChange}
        onTerminer={handleTerminer}
        onPrint={handlePrint}
        onReload={onReload}
      />

      {/* Barre d'onglets */}
      <div className="bg-white border-b border-gray-200 sticky top-[var(--header-h,105px)] z-20">
        <ScrollableTabBar
          tabs={TABS.map(tab => ({ id: tab.id, label: tab.label, icon: tab.icon }))}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          iconSize={13}
          mobileCompact
          className="px-2"
        />
      </div>

      {/* Contenu — tous montés, seul l'actif est visible (préserve l'état) */}
      <div className="flex-1 p-4 lg:p-6 max-w-5xl w-full mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 lg:p-6">

          <div className={activeTab === 'context'   ? '' : 'hidden'}>
            <ContextTab consultation={consultation} />
          </div>
          <div className={activeTab === 'vitals'    ? '' : 'hidden'}>
            <VitalsTab />
          </div>
          <div className={activeTab === 'diagnosis' ? '' : 'hidden'}>
            <DiagnosisBuilder
              value={consultation.diagnosis ?? ''}
              onSave={handleSaveDiagnosis}
              saving={diagnosisSaving}
              readOnly={readOnly}
            />
          </div>
          <div className={activeTab === 'prescriptions' ? '' : 'hidden'}>
            <ConsultationPrescriptionsPanel
              consultation={consultation}
              readOnly={readOnly}
              onLog={pushEntry}
            />
          </div>
          <div className={activeTab === 'treatments' ? '' : 'hidden'}>
            <ConsultationTreatmentsPanel
              consultation={consultation}
              readOnly={readOnly}
              onLog={pushEntry}
            />
          </div>
          <div className={activeTab === 'documents' ? '' : 'hidden'}>
            <ConsultationDocumentsPanel
              consultation={consultation}
              readOnly={readOnly}
              onLog={pushEntry}
            />
          </div>
          <div className={activeTab === 'ordonnance' ? '' : 'hidden'}>
            <OrdonnancePanel
              consultation={consultation}
              onLog={pushEntry}
            />
          </div>
          <div className={activeTab === 'history'   ? '' : 'hidden'}>
            <ConsultationHistoryPanel consultation={consultation} />
          </div>
          <div className={activeTab === 'journal'   ? '' : 'hidden'}>
            <SessionJournalTab consultationNumber={consultation.number} entries={sessionLog} />
          </div>

        </div>
      </div>

      {showSummary && (
        <ConsultationSummaryModal
          consultation={consultation}
          onConfirm={handleConfirmTerminer}
          onClose={() => setShowSummary(false)}
        />
      )}

      {showPrint && (
        <ConsultationPrintModal
          consultation={consultation}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  );
}
