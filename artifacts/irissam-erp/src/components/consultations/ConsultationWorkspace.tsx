import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ScrollableTabBar } from '@/components/ui/ScrollableTabBar';
import {
  ClipboardList, Activity, Stethoscope, Brain, Pill,
  FlaskConical, Scan, FileText, Calendar, History, Shield,
} from 'lucide-react';
import { ConsultationHeader } from './ConsultationHeader';
import { ConsultationSummaryModal } from './ConsultationSummaryModal';
import { ConsultationPrintModal } from './ConsultationPrintModal';
import { DiagnosisBuilder } from './DiagnosisBuilder';
import { PrescriptionBuilder } from './PrescriptionBuilder';
import { LabOrderBuilder, ImagingOrderBuilder } from './LabAndImagingBuilders';
import { ClinicalExamForm } from './ClinicalExamForm';
import { MedicalDocumentBuilder } from './MedicalDocumentBuilder';
import { FollowUpPlanForm } from './FollowUpPlanForm';
import { ConsultationHistoryPanel } from './ConsultationHistoryPanel';
import { apiClient } from '@/services/api/client';
import type { Consultation, ConsultationStatus, VitalSigns, AuditEntry } from '@/types/consultation';
import { useAuth } from '@/store/AuthContext';

// ─── VitalSigns display + edit ────────────────────────────────────────────────

function VitalAlert({ label, value, unit, low, high }: {
  label: string; value?: number; unit: string; low: number; high: number;
}) {
  if (!value) return null;
  const anomaly = value < low || value > high;
  return (
    <div className={cn(
      'flex items-center justify-between px-3 py-2 rounded-lg text-sm border',
      anomaly ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'
    )}>
      <span className="text-xs text-gray-500">{label}</span>
      <span className={cn('font-semibold', anomaly ? 'text-red-600' : 'text-gray-800')}>
        {value} <span className="text-xs font-normal">{unit}</span>
      </span>
    </div>
  );
}

function VitalsTab({ vitals, readOnly, onChange }: {
  vitals?: VitalSigns; readOnly: boolean; onChange: (v: VitalSigns) => void;
}) {
  if (readOnly && !vitals) {
    return <div className="text-center py-10 text-gray-400 text-sm">Aucun signe vital enregistré.</div>;
  }

  const INP = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20';

  const set = (k: keyof VitalSigns, raw: string | boolean) => {
    if (typeof raw === 'boolean') { onChange({ ...(vitals ?? {}), [k]: raw }); return; }
    const v = parseFloat(raw);
    const next: VitalSigns = { ...(vitals ?? {}), [k]: isNaN(v) ? undefined : v };
    if (next.weight && next.height) {
      next.bmi = parseFloat((next.weight / (next.height / 100) ** 2).toFixed(1));
    }
    onChange(next);
  };

  const fields: { key: keyof VitalSigns; label: string; unit: string; low: number; high: number }[] = [
    { key: 'weight',           label: 'Poids',              unit: 'kg',     low: 30,  high: 300 },
    { key: 'height',           label: 'Taille',             unit: 'cm',     low: 50,  high: 250 },
    { key: 'temperature',      label: 'Température',        unit: '°C',     low: 36,  high: 38.5 },
    { key: 'systolicBP',       label: 'Tension syst.',      unit: 'mmHg',   low: 90,  high: 140 },
    { key: 'diastolicBP',      label: 'Tension diast.',     unit: 'mmHg',   low: 60,  high: 90  },
    { key: 'heartRate',        label: 'Fréq. cardiaque',    unit: 'bpm',    low: 60,  high: 100 },
    { key: 'respiratoryRate',  label: 'Fréq. respiratoire', unit: '/min',   low: 12,  high: 20  },
    { key: 'oxygenSaturation', label: 'SpO₂',               unit: '%',      low: 95,  high: 100 },
    { key: 'bloodGlucose',     label: 'Glycémie',           unit: 'mmol/L', low: 3.9, high: 7.8 },
    { key: 'painLevel',        label: 'Douleur',            unit: '/10',    low: 0,   high: 10  },
  ];

  // Read-only display
  if (readOnly && vitals) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {fields.map(f => (
            <VitalAlert key={f.key} label={f.label}
              value={vitals[f.key] as number} unit={f.unit} low={f.low} high={f.high} />
          ))}
        </div>
        {vitals.bmi && (
          <div className={cn('p-3 rounded-lg text-sm font-medium',
            vitals.bmi < 18.5 ? 'bg-blue-50 text-blue-700' :
            vitals.bmi < 25   ? 'bg-green-50 text-green-700' :
            vitals.bmi < 30   ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700')}>
            IMC : <strong>{vitals.bmi}</strong>
            {vitals.bmi < 18.5 ? ' — Insuffisance pondérale' : vitals.bmi < 25 ? ' — Normal ✓' : vitals.bmi < 30 ? ' — Surpoids' : ' — Obésité'}
          </div>
        )}
        {vitals.consciousnessState && (
          <div className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            État de conscience : <strong>{vitals.consciousnessState}</strong>
          </div>
        )}
        {vitals.oxygenAdministered && (
          <div className="flex items-center gap-2 p-2.5 bg-cyan-50 border border-cyan-200 rounded-lg text-sm text-cyan-700">
            Oxygène administré{vitals.oxygenFlowRate ? ` : ${vitals.oxygenFlowRate} L/min` : ''}
          </div>
        )}
        {vitals.pregnancy && (
          <div className="flex items-center gap-2 p-2.5 bg-pink-50 border border-pink-200 rounded-lg text-sm text-pink-700">
            🤰 Grossesse en cours
          </div>
        )}
        {vitals.clinicalComment && (
          <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
            <strong>Commentaire clinique :</strong> {vitals.clinicalComment}
          </div>
        )}
        {vitals.nursingNotes && (
          <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
            <strong>Notes infirmières :</strong> {vitals.nursingNotes}
          </div>
        )}
      </div>
    );
  }

  // Editable
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {fields.map(f => {
          const val = vitals?.[f.key] as number | undefined;
          const anomaly = val !== undefined && (val < f.low || val > f.high);
          return (
            <div key={f.key}>
              <label className="text-xs font-medium text-gray-500 mb-1 block">{f.label}</label>
              <div className="flex gap-1.5 items-center">
                <input type="number" step="0.1" value={val ?? ''} onChange={e => set(f.key, e.target.value)}
                  className={cn(INP, 'flex-1', anomaly ? 'border-red-400 bg-red-50' : '')} placeholder="—" />
                <span className="text-xs text-gray-400 whitespace-nowrap">{f.unit}</span>
              </div>
              {anomaly && <p className="text-xs text-red-500 mt-0.5">⚠ Valeur anormale</p>}
            </div>
          );
        })}
      </div>

      {vitals?.bmi && (
        <div className={cn('p-3 rounded-lg text-sm font-medium',
          vitals.bmi < 18.5 ? 'bg-blue-50 text-blue-700' :
          vitals.bmi < 25   ? 'bg-green-50 text-green-700' :
          vitals.bmi < 30   ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700')}>
          IMC calculé : <strong>{vitals.bmi}</strong>
          {vitals.bmi < 18.5 ? ' — Insuffisance pondérale' : vitals.bmi < 25 ? ' — Normal ✓' : vitals.bmi < 30 ? ' — Surpoids' : ' — Obésité'}
        </div>
      )}

      {/* Extra vitals from form */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Tour de taille</label>
          <div className="flex gap-1.5 items-center">
            <input type="number" step="0.5"
              value={(vitals?.waistCircumference as number | undefined) ?? ''}
              onChange={e => { const v = parseFloat(e.target.value); onChange({ ...(vitals ?? {}), waistCircumference: isNaN(v) ? undefined : v }); }}
              className={cn(INP, 'flex-1')} placeholder="—" />
            <span className="text-xs text-gray-400">cm</span>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Score de Glasgow</label>
          <div className="flex gap-1.5 items-center">
            <input type="number" step="1" min={3} max={15}
              value={(vitals?.glasgowScore as number | undefined) ?? ''}
              onChange={e => { const v = parseFloat(e.target.value); onChange({ ...(vitals ?? {}), glasgowScore: isNaN(v) ? undefined : v }); }}
              className={cn(INP, 'flex-1',
                (vitals?.glasgowScore as number | undefined) !== undefined && (vitals?.glasgowScore as number) < 8 ? 'border-red-400 bg-red-50' :
                (vitals?.glasgowScore as number | undefined) !== undefined && (vitals?.glasgowScore as number) < 14 ? 'border-amber-400 bg-amber-50' : ''
              )} placeholder="3–15" />
            <span className="text-xs text-gray-400">/15</span>
          </div>
        </div>
      </div>

      {/* État de conscience */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1.5 block">État de conscience</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { value: 'alerte', label: 'Alerte', col: 'border-green-400 bg-green-50 text-green-700' },
            { value: 'voix', label: 'Répond à la voix', col: 'border-blue-400 bg-blue-50 text-blue-700' },
            { value: 'douleur', label: 'Répond à la douleur', col: 'border-amber-400 bg-amber-50 text-amber-700' },
            { value: 'inconscient', label: 'Inconscient', col: 'border-red-500 bg-red-50 text-red-700' },
          ].map(opt => {
            const sel = (vitals?.consciousnessState as string | undefined) === opt.value;
            return (
              <button key={opt.value} type="button"
                onClick={() => onChange({ ...(vitals ?? {}), consciousnessState: sel ? undefined : opt.value })}
                className={cn('py-1.5 px-2 rounded-lg border-2 text-xs font-medium transition-all text-center',
                  sel ? opt.col : 'border-gray-200 text-gray-500 hover:border-gray-300')}>
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* O2 */}
      <div className="flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox"
            checked={(vitals?.oxygenAdministered as boolean | undefined) ?? false}
            onChange={e => onChange({ ...(vitals ?? {}), oxygenAdministered: e.target.checked, oxygenFlowRate: e.target.checked ? (vitals?.oxygenFlowRate as number | undefined) : undefined })}
            className="rounded border-gray-300 text-blue-600" />
          Oxygène administré
        </label>
        {(vitals?.oxygenAdministered as boolean | undefined) && (
          <div className="flex items-center gap-2">
            <input type="number" step="0.5" min={0} max={15}
              value={(vitals?.oxygenFlowRate as number | undefined) ?? ''}
              onChange={e => { const v = parseFloat(e.target.value); onChange({ ...(vitals ?? {}), oxygenFlowRate: isNaN(v) ? undefined : v }); }}
              className="w-20 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="—" />
            <span className="text-xs text-gray-500">L/min</span>
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={vitals?.pregnancy ?? false}
          onChange={e => set('pregnancy', e.target.checked)}
          className="rounded border-gray-300 text-pink-500" />
        Grossesse en cours
      </label>

      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Commentaire clinique</label>
        <textarea value={(vitals?.clinicalComment as string | undefined) ?? ''}
          onChange={e => onChange({ ...(vitals ?? {}), clinicalComment: e.target.value || undefined })}
          rows={2} placeholder="Observations cliniques rapides…" className={`${INP} resize-none`} />
      </div>

      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Notes infirmières</label>
        <textarea value={vitals?.nursingNotes ?? ''} onChange={e => onChange({ ...(vitals ?? {}), nursingNotes: e.target.value })}
          rows={2} placeholder="Observations infirmières…" className={`${INP} resize-none`} />
      </div>
    </div>
  );
}

// ─── Context / Motif tab ──────────────────────────────────────────────────────

function ContextTab({ consultation: c, readOnly, onChange }: {
  consultation: Consultation; readOnly: boolean; onChange: (partial: Partial<Consultation>) => void;
}) {
  const INP = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20';
  const TA  = `${INP} resize-none`;

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Motif de consultation</label>
        <textarea value={c.reason} onChange={e => onChange({ reason: e.target.value })} disabled={readOnly} rows={2} className={TA} />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Plainte principale</label>
        <textarea value={c.chiefComplaint ?? ''} onChange={e => onChange({ chiefComplaint: e.target.value })} disabled={readOnly} rows={2}
          placeholder="Description de la plainte principale…" className={TA} />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Histoire de la maladie actuelle</label>
        <textarea value={c.historyOfPresentIllness ?? ''} onChange={e => onChange({ historyOfPresentIllness: e.target.value })} disabled={readOnly} rows={4}
          placeholder="Antécédents de la maladie, évolution…" className={TA} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Date d'apparition</label>
          <input type="date" value={c.onsetDate ?? ''} onChange={e => onChange({ onsetDate: e.target.value })} disabled={readOnly} className={INP} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Durée / Évolution</label>
          <input type="text" value={c.onsetDuration ?? ''} onChange={e => onChange({ onsetDuration: e.target.value })} disabled={readOnly}
            placeholder="3 jours, 2 semaines…" className={INP} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Facteurs aggravants</label>
          <textarea value={c.aggravatingFactors ?? ''} onChange={e => onChange({ aggravatingFactors: e.target.value })} disabled={readOnly} rows={2} className={TA} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Facteurs soulageants</label>
          <textarea value={c.relievingFactors ?? ''} onChange={e => onChange({ relievingFactors: e.target.value })} disabled={readOnly} rows={2} className={TA} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Contexte familial</label>
          <textarea value={c.familyContext ?? ''} onChange={e => onChange({ familyContext: e.target.value })} disabled={readOnly} rows={2} className={TA} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Contexte professionnel</label>
          <textarea value={c.professionalContext ?? ''} onChange={e => onChange({ professionalContext: e.target.value })} disabled={readOnly} rows={2} className={TA} />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Notes libres</label>
        <textarea value={c.freeNotes ?? ''} onChange={e => onChange({ freeNotes: e.target.value })} disabled={readOnly} rows={3}
          placeholder="Observations complémentaires…" className={TA} />
      </div>
    </div>
  );
}

// ─── Audit helpers ────────────────────────────────────────────────────────────

/** Returns a short "Browser / OS" string from the current User-Agent. */
function getDeviceInfo(): string {
  const ua = navigator.userAgent;
  let browser = 'Navigateur';
  let os = 'OS inconnu';

  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('OPR/') || ua.includes('Opera')) browser = 'Opera';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';

  if (ua.includes('Windows NT 10') || ua.includes('Windows NT 11')) os = 'Windows';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return `${browser} / ${os}`;
}

/** Maps a set of changed keys to a human-readable French action label. */
function inferAction(changedKeys: string[]): string {
  if (changedKeys.includes('vitalSigns'))              return 'Saisie des signes vitaux';
  if (changedKeys.includes('clinicalExam'))            return 'Examen clinique mis à jour';
  if (changedKeys.includes('diagnoses'))               return 'Diagnostic modifié';
  if (changedKeys.includes('prescriptions'))           return 'Prescription modifiée';
  if (changedKeys.includes('labOrders'))               return 'Demande d\'analyses modifiée';
  if (changedKeys.includes('imagingOrders'))           return 'Demande d\'imagerie modifiée';
  if (changedKeys.includes('documents'))               return 'Document médical modifié';
  if (changedKeys.includes('followUp'))                return 'Plan de suivi mis à jour';
  if (changedKeys.includes('chiefComplaint') ||
      changedKeys.includes('historyOfPresentIllness') ||
      changedKeys.includes('reason'))                  return 'Contexte clinique mis à jour';
  return 'Consultation mise à jour';
}

/** Generates a collision-resistant ID without crypto dependency. */
function makeAuditId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Audit tab ────────────────────────────────────────────────────────────────

function AuditTab({ consultationNumber, entries }: {
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
        <h3 className="font-semibold text-gray-800">Journal d'audit — {consultationNumber}</h3>
        <span className="text-xs text-gray-400">{entries.length} entrée{entries.length !== 1 ? 's' : ''}</span>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">Aucune action enregistrée pour cette session.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Heure', 'Utilisateur', 'Rôle', 'Action', 'Appareil', 'Sync'].map(h => (
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
                  <td className="px-4 py-2.5">
                    {entry.syncStatus === 'synced' ? (
                      <span className="text-green-600 font-medium">✓ Sync</span>
                    ) : (
                      <span className="text-amber-500 font-medium">⏳ En attente</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        Les entrées en attente seront envoyées à l'API lors de la prochaine synchronisation.
      </p>
    </div>
  );
}

// ─── Tabs config ──────────────────────────────────────────────────────────────

interface Tab {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

function buildTabs(c: Consultation): Tab[] {
  return [
    { id: 'context',      label: 'Contexte',      icon: ClipboardList },
    { id: 'vitals',       label: 'Signes vitaux',  icon: Activity,     badge: c.vitalSigns ? undefined : 0 },
    { id: 'exam',         label: 'Examen clin.',   icon: Stethoscope },
    { id: 'diagnosis',    label: 'Diagnostic',     icon: Brain,        badge: c.diagnoses?.length },
    { id: 'prescription', label: 'Prescription',   icon: Pill,         badge: c.prescriptions?.length },
    { id: 'lab',          label: 'Analyses',       icon: FlaskConical, badge: c.labOrders?.length },
    { id: 'imaging',      label: 'Imagerie',       icon: Scan,         badge: c.imagingOrders?.length },
    { id: 'documents',    label: 'Documents',      icon: FileText,     badge: c.documents?.length },
    { id: 'followup',     label: 'Suivi',          icon: Calendar },
    { id: 'history',      label: 'Historique',     icon: History },
    { id: 'audit',        label: 'Audit',          icon: Shield },
  ];
}

// ─── Main workspace ───────────────────────────────────────────────────────────

interface Props {
  consultation: Consultation;
  onChange: (c: Consultation) => void;
  onStatusChange: (status: ConsultationStatus) => void;
}

export function ConsultationWorkspace({ consultation, onChange, onStatusChange }: Props) {
  const { user } = useAuth();
  const [activeTab, setActiveTab]   = useState('context');
  const [showSummary, setShowSummary] = useState(false);
  const [showPrint, setShowPrint]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Audit log: seed from existing consultation data then grow locally ──────
  const [auditLog, setAuditLog] = useState<AuditEntry[]>(
    () => consultation.auditLog ?? []
  );

  const deviceInfo = useRef<string>(getDeviceInfo());

  /** Builds an AuditEntry for the current user/device. */
  const makeEntry = useCallback((action: string): AuditEntry => {
    const userName = user
      ? `${user.firstName} ${user.lastName}`.trim()
      : 'Utilisateur inconnu';
    const userRole = user?.role ?? 'Inconnu';
    const userId   = user?.id ?? 'anonymous';
    return {
      id: makeAuditId(),
      at: new Date().toISOString(),
      userId,
      userName,
      userRole,
      action,
      device: deviceInfo.current,
      syncStatus: 'pending',
    };
  }, [user]);

  // Record "workspace opened" once per mount
  const openedRef = useRef(false);
  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    const entry = makeEntry('Ouverture de la consultation');
    setAuditLog(prev => {
      const updated = [...prev, entry];
      onChange({ ...consultation, auditLog: updated, updatedAt: new Date().toISOString() });
      return updated;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch patient allergies from the real API for PrescriptionBuilder conflict detection
  const [patientAllergies, setPatientAllergies] = useState<string[]>([]);
  useEffect(() => {
    if (!consultation.patientId) return;
    apiClient.get<Record<string, unknown>>(`/patients/${consultation.patientId}`)
      .then(r => setPatientAllergies((r?.medical as any)?.allergies ?? []))
      .catch((err) => console.warn('[ConsultationWorkspace] Patient allergies fetch failed — PrescriptionBuilder conflict detection degraded:', err));
  }, [consultation.patientId]);

  const readOnly = consultation.status === 'terminee' || consultation.status === 'annulee' || consultation.status === 'patient_absent';

  // Debounced auto-save: shows "Enregistrement…" for 2s after last edit
  const update = useCallback((partial: Partial<Consultation>) => {
    const changedKeys = Object.keys(partial);
    const action = inferAction(changedKeys);
    const entry  = makeEntry(action);

    setAuditLog(prev => {
      const updated = [...prev, entry];
      onChange({
        ...consultation,
        ...partial,
        auditLog: updated,
        updatedAt: new Date().toISOString(),
      });
      return updated;
    });

    setSaving(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaving(false), 2000);
  }, [consultation, onChange, makeEntry]);

  // Cleanup on unmount
  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); }, []);

  const handleTerminer          = () => setShowSummary(true);
  const handleConfirmTerminer   = (_reason: string) => { onStatusChange('terminee'); setShowSummary(false); };
  const handlePrint             = () => setShowPrint(true);

  const tabs = buildTabs(consultation);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">

      {/* Sticky header */}
      <ConsultationHeader
        consultation={consultation}
        saving={saving}
        onStatusChange={onStatusChange}
        onTerminer={handleTerminer}
        onPrint={handlePrint}
      />

      {/* Tab bar — scrollable on all devices */}
      <div className="bg-white border-b border-gray-200 sticky top-[var(--header-h,105px)] z-20">
        <ScrollableTabBar
          tabs={tabs.map(tab => ({ id: tab.id, label: tab.label, icon: tab.icon, badge: tab.badge }))}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          iconSize={13}
          mobileCompact
          className="px-2"
        />
      </div>

      {/* Tab content — all mounted, only active is visible (preserves state across tab switches) */}
      <div className="flex-1 p-4 lg:p-6 max-w-5xl w-full mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 lg:p-6">

          <div className={activeTab === 'context'      ? '' : 'hidden'}>
            <ContextTab consultation={consultation} readOnly={readOnly} onChange={update} />
          </div>
          <div className={activeTab === 'vitals'       ? '' : 'hidden'}>
            <VitalsTab vitals={consultation.vitalSigns} readOnly={readOnly} onChange={v => update({ vitalSigns: v })} />
          </div>
          <div className={activeTab === 'exam'         ? '' : 'hidden'}>
            <ClinicalExamForm exam={consultation.clinicalExam} onChange={e => update({ clinicalExam: e })} readOnly={readOnly} defaultTemplate="medecine_generale" />
          </div>
          <div className={activeTab === 'diagnosis'    ? '' : 'hidden'}>
            <DiagnosisBuilder diagnoses={consultation.diagnoses ?? []} onChange={d => update({ diagnoses: d })} readOnly={readOnly} />
          </div>
          <div className={activeTab === 'prescription' ? '' : 'hidden'}>
            <PrescriptionBuilder prescriptions={consultation.prescriptions ?? []} patientAllergies={patientAllergies} onChange={p => update({ prescriptions: p })} readOnly={readOnly} />
          </div>
          <div className={activeTab === 'lab'          ? '' : 'hidden'}>
            <LabOrderBuilder orders={consultation.labOrders ?? []} onChange={o => update({ labOrders: o })} readOnly={readOnly} />
          </div>
          <div className={activeTab === 'imaging'      ? '' : 'hidden'}>
            <ImagingOrderBuilder orders={consultation.imagingOrders ?? []} onChange={o => update({ imagingOrders: o })} readOnly={readOnly} />
          </div>
          <div className={activeTab === 'documents'    ? '' : 'hidden'}>
            <MedicalDocumentBuilder documents={consultation.documents ?? []} onChange={d => update({ documents: d })} readOnly={readOnly} doctorName={consultation.doctorName} />
          </div>
          <div className={activeTab === 'followup'     ? '' : 'hidden'}>
            <FollowUpPlanForm plan={consultation.followUp} onChange={f => update({ followUp: f })} readOnly={readOnly} />
          </div>
          <div className={activeTab === 'history'      ? '' : 'hidden'}>
            <ConsultationHistoryPanel consultation={consultation} />
          </div>
          <div className={activeTab === 'audit'        ? '' : 'hidden'}>
            <AuditTab consultationNumber={consultation.number} entries={auditLog} />
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
