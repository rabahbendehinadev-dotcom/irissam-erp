import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ClipboardList, Activity, Stethoscope, Brain, Pill, FlaskConical, Scan, FileText, Calendar, History, User } from 'lucide-react';
import { ConsultationHeader } from './ConsultationHeader';
import { ConsultationSummaryModal } from './ConsultationSummaryModal';
import { DiagnosisBuilder } from './DiagnosisBuilder';
import { PrescriptionBuilder } from './PrescriptionBuilder';
import { LabOrderBuilder, ImagingOrderBuilder } from './LabAndImagingBuilders';
import { ClinicalExamForm } from './ClinicalExamForm';
import { MedicalDocumentBuilder } from './MedicalDocumentBuilder';
import { FollowUpPlanForm } from './FollowUpPlanForm';
import { ConsultationHistoryPanel } from './ConsultationHistoryPanel';
import type { Consultation, ConsultationStatus, VitalSigns, Diagnosis, PrescriptionItem, LabOrder, ImagingOrder, MedicalDocument, FollowUpPlan, ClinicalExam } from '@/types/consultation';

// ─── VitalSigns display + edit ────────────────────────────────────────────────

function VitalAlert({ label, value, unit, low, high }: { label: string; value?: number; unit: string; low: number; high: number }) {
  if (!value) return null;
  const anomaly = value < low || value > high;
  return (
    <div className={cn('flex items-center justify-between px-3 py-2 rounded-lg text-sm', anomaly ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-100')}>
      <span className="text-xs text-gray-500">{label}</span>
      <span className={cn('font-semibold', anomaly ? 'text-red-600' : 'text-gray-800')}>{value} <span className="text-xs font-normal">{unit}</span></span>
    </div>
  );
}

function VitalsTab({ vitals, readOnly, onChange }: { vitals?: VitalSigns; readOnly: boolean; onChange: (v: VitalSigns) => void }) {
  if (readOnly && !vitals) {
    return <div className="text-center py-10 text-gray-400 text-sm">Aucun signe vital enregistré.</div>;
  }

  const INP = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20';

  const set = (k: keyof VitalSigns, raw: string) => {
    const v = parseFloat(raw);
    const next: VitalSigns = { ...(vitals ?? {}), [k]: isNaN(v) ? undefined : v };
    if (next.weight && next.height) {
      next.bmi = parseFloat((next.weight / (next.height / 100) ** 2).toFixed(1));
    }
    onChange(next);
  };

  const fields: { key: keyof VitalSigns; label: string; unit: string; low: number; high: number }[] = [
    { key: 'weight',            label: 'Poids',               unit: 'kg',     low: 30,  high: 300 },
    { key: 'height',            label: 'Taille',              unit: 'cm',     low: 50,  high: 250 },
    { key: 'temperature',       label: 'Température',         unit: '°C',     low: 35,  high: 42  },
    { key: 'systolicBP',        label: 'Tension syst.',       unit: 'mmHg',   low: 70,  high: 180 },
    { key: 'diastolicBP',       label: 'Tension diast.',      unit: 'mmHg',   low: 40,  high: 120 },
    { key: 'heartRate',         label: 'Fréq. cardiaque',     unit: 'bpm',    low: 40,  high: 180 },
    { key: 'respiratoryRate',   label: 'Fréq. respiratoire',  unit: '/min',   low: 8,   high: 40  },
    { key: 'oxygenSaturation',  label: 'SpO₂',                unit: '%',      low: 90,  high: 100 },
    { key: 'bloodGlucose',      label: 'Glycémie',            unit: 'mmol/L', low: 2.8, high: 16  },
    { key: 'painLevel',         label: 'Douleur',             unit: '/10',    low: 0,   high: 10  },
  ];

  if (readOnly && vitals) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {fields.map(f => <VitalAlert key={f.key} label={f.label} value={vitals[f.key] as number} unit={f.unit} low={f.low} high={f.high} />)}
        </div>
        {vitals.bmi && (
          <div className={cn('p-3 rounded-lg text-sm font-medium',
            vitals.bmi < 18.5 ? 'bg-blue-50 text-blue-700' :
            vitals.bmi < 25   ? 'bg-green-50 text-green-700' :
            vitals.bmi < 30   ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700')}>
            IMC : <strong>{vitals.bmi}</strong>{vitals.bmi < 18.5 ? ' — Insuffisance pondérale' : vitals.bmi < 25 ? ' — Normal ✓' : vitals.bmi < 30 ? ' — Surpoids' : ' — Obésité'}
          </div>
        )}
        {vitals.pregnancy && <div className="flex items-center gap-2 p-2.5 bg-pink-50 border border-pink-200 rounded-lg text-sm text-pink-700">🤰 Grossesse en cours</div>}
        {vitals.nursingNotes && <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700"><strong>Notes infirmières :</strong> {vitals.nursingNotes}</div>}
      </div>
    );
  }

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
              {anomaly && <p className="text-xs text-red-500 mt-0.5">Valeur anormale !</p>}
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
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={vitals?.pregnancy ?? false}
          onChange={e => onChange({ ...(vitals ?? {}), pregnancy: e.target.checked })}
          className="rounded border-gray-300 text-pink-500 focus:ring-pink-500" />
        Grossesse en cours
      </label>
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Notes infirmières</label>
        <textarea value={vitals?.nursingNotes ?? ''} onChange={e => onChange({ ...(vitals ?? {}), nursingNotes: e.target.value })}
          rows={2} placeholder="Observations infirmières…" className={`${INP} resize-none`} />
      </div>
    </div>
  );
}

// ─── Context / Motif tab ──────────────────────────────────────────────────────

function ContextTab({ consultation: c, readOnly, onChange }: { consultation: Consultation; readOnly: boolean; onChange: (partial: Partial<Consultation>) => void }) {
  const INP = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20';
  const TA = `${INP} resize-none`;

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Motif de consultation</label>
        <textarea value={c.reason} onChange={e => onChange({ reason: e.target.value })} disabled={readOnly} rows={2} className={TA} />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Plainte principale</label>
        <textarea value={c.chiefComplaint ?? ''} onChange={e => onChange({ chiefComplaint: e.target.value })} disabled={readOnly} rows={2} placeholder="Description de la plainte principale…" className={TA} />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Histoire de la maladie actuelle</label>
        <textarea value={c.historyOfPresentIllness ?? ''} onChange={e => onChange({ historyOfPresentIllness: e.target.value })} disabled={readOnly} rows={4} placeholder="Antécédents de la maladie, évolution…" className={TA} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Date d'apparition</label>
          <input type="date" value={c.onsetDate ?? ''} onChange={e => onChange({ onsetDate: e.target.value })} disabled={readOnly} className={INP} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Durée / Evolution</label>
          <input type="text" value={c.onsetDuration ?? ''} onChange={e => onChange({ onsetDuration: e.target.value })} disabled={readOnly} placeholder="3 jours, 2 semaines…" className={INP} />
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
        <textarea value={c.freeNotes ?? ''} onChange={e => onChange({ freeNotes: e.target.value })} disabled={readOnly} rows={3} placeholder="Observations complémentaires…" className={TA} />
      </div>
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
    { id: 'context',     label: 'Contexte',     icon: ClipboardList },
    { id: 'vitals',      label: 'Signes vitaux', icon: Activity,     badge: c.vitalSigns ? undefined : 0 },
    { id: 'exam',        label: 'Examen clin.',  icon: Stethoscope },
    { id: 'diagnosis',   label: 'Diagnostics',   icon: Brain,        badge: c.diagnoses?.length },
    { id: 'prescription',label: 'Ordonnance',    icon: Pill,         badge: c.prescriptions?.length },
    { id: 'lab',         label: 'Analyses',      icon: FlaskConical, badge: c.labOrders?.length },
    { id: 'imaging',     label: 'Imagerie',      icon: Scan,         badge: c.imagingOrders?.length },
    { id: 'documents',   label: 'Documents',     icon: FileText,     badge: c.documents?.length },
    { id: 'followup',    label: 'Suivi',         icon: Calendar },
    { id: 'history',     label: 'Historique',    icon: History },
  ];
}

// ─── Main workspace ───────────────────────────────────────────────────────────

interface Props {
  consultation: Consultation;
  onChange: (c: Consultation) => void;
  onStatusChange: (status: ConsultationStatus) => void;
}

export function ConsultationWorkspace({ consultation, onChange, onStatusChange }: Props) {
  const [activeTab, setActiveTab] = useState('context');
  const [showSummary, setShowSummary] = useState(false);
  const [saving, setSaving] = useState(false);

  const readOnly = consultation.status === 'terminee' || consultation.status === 'annulee' || consultation.status === 'patient_absent';

  const update = useCallback((partial: Partial<Consultation>) => {
    setSaving(true);
    onChange({ ...consultation, ...partial, updatedAt: new Date().toISOString() });
    // Mock auto-save
    setTimeout(() => setSaving(false), 1200);
  }, [consultation, onChange]);

  const handleTerminer = () => setShowSummary(true);
  const handleConfirmTerminer = (reason: string) => {
    onStatusChange('terminee');
    setShowSummary(false);
  };

  const tabs = buildTabs(consultation);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <ConsultationHeader
        consultation={consultation}
        saving={saving}
        onStatusChange={onStatusChange}
        onTerminer={handleTerminer}
      />

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-4 overflow-x-auto">
        <div className="flex gap-0.5 min-w-max">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-3 text-sm border-b-2 -mb-px transition-colors whitespace-nowrap',
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-700 font-medium'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                )}
              >
                <Icon size={13} />
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 p-6 max-w-4xl w-full mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          {activeTab === 'context' && (
            <ContextTab consultation={consultation} readOnly={readOnly} onChange={update} />
          )}
          {activeTab === 'vitals' && (
            <VitalsTab
              vitals={consultation.vitalSigns}
              readOnly={readOnly}
              onChange={v => update({ vitalSigns: v })}
            />
          )}
          {activeTab === 'exam' && (
            <ClinicalExamForm
              exam={consultation.clinicalExam}
              onChange={e => update({ clinicalExam: e })}
              readOnly={readOnly}
              defaultTemplate="medecine_generale"
            />
          )}
          {activeTab === 'diagnosis' && (
            <DiagnosisBuilder
              diagnoses={consultation.diagnoses ?? []}
              onChange={d => update({ diagnoses: d })}
              readOnly={readOnly}
            />
          )}
          {activeTab === 'prescription' && (
            <PrescriptionBuilder
              prescriptions={consultation.prescriptions ?? []}
              patientAllergies={[]}
              onChange={p => update({ prescriptions: p })}
              readOnly={readOnly}
            />
          )}
          {activeTab === 'lab' && (
            <LabOrderBuilder
              orders={consultation.labOrders ?? []}
              onChange={o => update({ labOrders: o })}
              readOnly={readOnly}
            />
          )}
          {activeTab === 'imaging' && (
            <ImagingOrderBuilder
              orders={consultation.imagingOrders ?? []}
              onChange={o => update({ imagingOrders: o })}
              readOnly={readOnly}
            />
          )}
          {activeTab === 'documents' && (
            <MedicalDocumentBuilder
              documents={consultation.documents ?? []}
              onChange={d => update({ documents: d })}
              readOnly={readOnly}
              doctorName={consultation.doctorName}
            />
          )}
          {activeTab === 'followup' && (
            <FollowUpPlanForm
              plan={consultation.followUp}
              onChange={f => update({ followUp: f })}
              readOnly={readOnly}
            />
          )}
          {activeTab === 'history' && (
            <ConsultationHistoryPanel consultation={consultation} />
          )}
        </div>
      </div>

      {showSummary && (
        <ConsultationSummaryModal
          consultation={consultation}
          onConfirm={handleConfirmTerminer}
          onClose={() => setShowSummary(false)}
        />
      )}
    </div>
  );
}
