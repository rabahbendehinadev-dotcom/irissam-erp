import { useState } from 'react';
import { X, Search, ChevronRight, ChevronLeft, Stethoscope, User, Activity, Check, ExternalLink } from 'lucide-react';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { PatientAvatar } from '@/components/shared/PatientAvatar';
import { MOCK_PATIENTS } from '@/mock';
import type { Patient } from '@/types';
import type { Consultation, ConsultationType, ConsultationOrigin, VitalSigns } from '@/types/consultation';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPES: { value: ConsultationType; label: string }[] = [
  { value: 'programmee',      label: 'Consultation programmée' },
  { value: 'sans_rdv',        label: 'Sans rendez-vous' },
  { value: 'controle',        label: 'Consultation de contrôle' },
  { value: 'specialisee',     label: 'Consultation spécialisée' },
  { value: 'ambulatoire',     label: 'Consultation ambulatoire' },
  { value: 'teleconsultation',label: 'Téléconsultation (placeholder)' },
  { value: 'urgences',        label: 'Issue des urgences' },
  { value: 'hospitalisation', label: 'Liée à une hospitalisation' },
];

const ORIGINS: { value: ConsultationOrigin; label: string }[] = [
  { value: 'rdv',      label: 'Rendez-vous' },
  { value: 'urgence',  label: 'Urgence' },
  { value: 'admission',label: 'Admission' },
  { value: 'sans_rdv', label: 'Sans rendez-vous' },
];

const DOCTORS = ['Dr Karim Benamara', 'Dr Amira Douahi', 'Dr Mourad Settouf', 'Dr Sofiane Boudali', 'Dr Nadia Ferhat'];
const SPECIALTIES = ['Médecine interne', 'Médecine générale', 'Cardiologie', 'Gynécologie', 'Pédiatrie', 'Chirurgie', 'Oncologie', 'Orthopédie'];
const SERVICES = ['Médecine interne', 'Chirurgie', 'Pédiatrie', 'Gynécologie', 'Cardiologie', 'Urgences', 'Radiologie', 'Laboratoire'];

// ─── Step 1: PatientSelector ──────────────────────────────────────────────────

function PatientSelector({ selected, onSelect }: { selected: Patient | null; onSelect: (p: Patient | null) => void }) {
  const [query, setQuery] = useState('');
  const [, setLocation] = useLocation();
  const q = query.toLowerCase();

  const results = q.length > 1
    ? MOCK_PATIENTS.filter(p =>
        `${p.lastName} ${p.firstName} ${p.mpiId} ${p.phone}`.toLowerCase().includes(q)
      ).slice(0, 6)
    : [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Recherchez un patient existant par nom, MPI ou téléphone.</p>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Nom, prénom, N° MPI, téléphone…"
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          autoFocus
        />
      </div>

      {/* Search results */}
      {results.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-50">
          {results.map(p => (
            <button
              key={p.id}
              onClick={() => { onSelect(p); setQuery(''); }}
              className="flex items-center gap-3 w-full px-4 py-3 hover:bg-blue-50 transition-colors text-left"
            >
              <PatientAvatar firstName={p.firstName} lastName={p.lastName} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{p.lastName} {p.firstName}</p>
                <p className="text-xs text-gray-500 font-mono">{p.mpiId} · {p.phone}</p>
              </div>
              {p.medical?.criticalNotes && (
                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full flex-shrink-0">⚠ Critique</span>
              )}
            </button>
          ))}
        </div>
      )}

      {query.length > 1 && results.length === 0 && (
        <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-xl space-y-2">
          <p className="text-sm">Aucun patient trouvé pour « {query} »</p>
          <button
            onClick={() => setLocation('/patients')}
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
          >
            <ExternalLink size={13} /> Créer un nouveau patient dans le module Patients
          </button>
        </div>
      )}

      {/* Selected card */}
      {selected && (
        <div className="border-2 border-blue-500 rounded-xl p-4 bg-blue-50">
          <div className="flex items-start gap-3">
            <PatientAvatar firstName={selected.firstName} lastName={selected.lastName} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-gray-900">{selected.lastName} {selected.firstName}</p>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-mono">{selected.mpiId}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{selected.phone}{selected.wilaya ? ` · ${selected.wilaya}` : ''}</p>
              {selected.medical?.allergies?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {selected.medical.allergies.map(a => (
                    <span key={a} className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">⚠ {a}</span>
                  ))}
                </div>
              )}
              {selected.medical?.chronicDiseases?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {selected.medical.chronicDiseases.map(d => (
                    <span key={d} className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">{d}</span>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => onSelect(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 2: Context Form ─────────────────────────────────────────────────────

interface ContextForm {
  doctor: string; specialty: string; service: string;
  date: string; time: string; type: ConsultationType; origin: ConsultationOrigin;
  reason: string; companion: string;
}

function ContextFormStep({ form, onChange }: { form: ContextForm; onChange: (f: ContextForm) => void }) {
  const set = (k: keyof ContextForm, v: string) => onChange({ ...form, [k]: v });
  const SEL = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white';
  const INP = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Médecin *</label>
          <select value={form.doctor} onChange={e => set('doctor', e.target.value)} className={SEL}>
            <option value="">Sélectionner…</option>
            {DOCTORS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Spécialité *</label>
          <select value={form.specialty} onChange={e => set('specialty', e.target.value)} className={SEL}>
            <option value="">Sélectionner…</option>
            {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Service *</label>
          <select value={form.service} onChange={e => set('service', e.target.value)} className={SEL}>
            <option value="">Sélectionner…</option>
            {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Type de consultation *</label>
          <select value={form.type} onChange={e => set('type', e.target.value as ConsultationType)} className={SEL}>
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Date *</label>
          <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={INP} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Heure *</label>
          <input type="time" value={form.time} onChange={e => set('time', e.target.value)} className={INP} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Origine</label>
          <select value={form.origin} onChange={e => set('origin', e.target.value as ConsultationOrigin)} className={SEL}>
            {ORIGINS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Accompagnant (optionnel)</label>
          <input type="text" value={form.companion} onChange={e => set('companion', e.target.value)}
            placeholder="Nom de l'accompagnant" className={INP} />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Motif de consultation *</label>
        <textarea
          value={form.reason}
          onChange={e => set('reason', e.target.value)}
          rows={3}
          placeholder="Décrivez le motif principal de la consultation…"
          className={`${INP} resize-none`}
        />
      </div>
    </div>
  );
}

// ─── Step 3: Vital Signs ──────────────────────────────────────────────────────

type VS = Partial<VitalSigns>;

function VitalsStep({ vitals, onChange }: { vitals: VS; onChange: (v: VS) => void }) {
  const set = (k: keyof VS, v: string) => {
    const num = parseFloat(v);
    const next = { ...vitals, [k]: isNaN(num) ? undefined : num };
    // Compute BMI
    if (next.weight && next.height) {
      next.bmi = parseFloat((next.weight / Math.pow(next.height / 100, 2)).toFixed(1));
    }
    onChange(next);
  };
  const INP = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400';

  const alertClass = (key: keyof VS, low: number, high: number) => {
    const v = vitals[key] as number | undefined;
    if (!v) return '';
    return (v < low || v > high) ? 'border-red-400 bg-red-50' : 'border-green-300';
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { key: 'weight' as const,            label: 'Poids',                unit: 'kg',     low: 30,  high: 300 },
          { key: 'height' as const,            label: 'Taille',               unit: 'cm',     low: 50,  high: 250 },
          { key: 'temperature' as const,       label: 'Température',          unit: '°C',     low: 35,  high: 42  },
          { key: 'systolicBP' as const,        label: 'Tension syst.',        unit: 'mmHg',   low: 70,  high: 180 },
          { key: 'diastolicBP' as const,       label: 'Tension diast.',       unit: 'mmHg',   low: 40,  high: 120 },
          { key: 'heartRate' as const,         label: 'Fréq. cardiaque',      unit: 'bpm',    low: 40,  high: 180 },
          { key: 'respiratoryRate' as const,   label: 'Fréq. respiratoire',   unit: '/min',   low: 8,   high: 40  },
          { key: 'oxygenSaturation' as const,  label: 'Saturation O₂',        unit: '%',      low: 90,  high: 100 },
          { key: 'bloodGlucose' as const,      label: 'Glycémie',             unit: 'mmol/L', low: 2.8, high: 16  },
          { key: 'painLevel' as const,         label: 'Douleur (0–10)',        unit: '/10',    low: 0,   high: 10  },
        ].map(f => (
          <div key={f.key}>
            <label className="text-xs font-medium text-gray-600 mb-1 block">{f.label}</label>
            <div className="flex gap-1.5 items-center">
              <input
                type="number"
                step="0.1"
                value={vitals[f.key] ?? ''}
                onChange={e => set(f.key, e.target.value)}
                className={cn(INP, 'flex-1', alertClass(f.key, f.low, f.high))}
                placeholder="—"
                min={f.low} max={f.key === 'painLevel' ? 10 : undefined}
              />
              <span className="text-xs text-gray-400 whitespace-nowrap">{f.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* BMI */}
      {vitals.bmi && (
        <div className={cn(
          'flex items-center gap-3 p-3 rounded-lg text-sm font-medium',
          vitals.bmi < 18.5 ? 'bg-blue-50 text-blue-700' :
          vitals.bmi < 25   ? 'bg-green-50 text-green-700' :
          vitals.bmi < 30   ? 'bg-yellow-50 text-yellow-700' :
                              'bg-red-50 text-red-700'
        )}>
          <span>IMC calculé :</span>
          <span className="font-bold">{vitals.bmi}</span>
          <span>
            {vitals.bmi < 18.5 ? '— Insuffisance pondérale' :
             vitals.bmi < 25   ? '— Poids normal ✓' :
             vitals.bmi < 30   ? '— Surpoids' :
                                 '— Obésité'}
          </span>
        </div>
      )}

      {/* Pregnancy */}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={vitals.pregnancy ?? false}
          onChange={e => onChange({ ...vitals, pregnancy: e.target.checked })}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        Grossesse en cours
      </label>

      {/* Nursing notes */}
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Notes infirmières</label>
        <textarea
          value={vitals.nursingNotes ?? ''}
          onChange={e => onChange({ ...vitals, nursingNotes: e.target.value })}
          rows={2}
          placeholder="Observations infirmières…"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
        />
      </div>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, icon: User,        label: 'Patient' },
  { id: 2, icon: Stethoscope, label: 'Contexte' },
  { id: 3, icon: Activity,    label: 'Signes vitaux' },
];

interface Props {
  onClose: () => void;
  onCreated: (c: Partial<Consultation>) => void;
  initialPatientId?: string;
}

export function ConsultationForm({ onClose, onCreated, initialPatientId }: Props) {
  const [step, setStep] = useState(1);
  const [patient, setPatient] = useState<Patient | null>(
    () => MOCK_PATIENTS.find(p => p.id === initialPatientId) ?? null
  );
  const [ctx, setCtx] = useState<ContextForm>({
    doctor: '', specialty: '', service: '', date: '2026-08-01', time: '09:00',
    type: 'programmee', origin: 'rdv', reason: '', companion: '',
  });
  const [vitals, setVitals] = useState<VS>({});

  const canNext = step === 1
    ? !!patient
    : step === 2
    ? !!(ctx.doctor && ctx.specialty && ctx.service && ctx.date && ctx.time && ctx.reason)
    : true;

  const handleCreate = () => {
    const now = new Date().toISOString();
    const id = `c-new-${Date.now()}`;
    const newConsultation: Partial<Consultation> = {
      id,
      number: `CON-2026-${String(Math.floor(Math.random() * 100) + 60).padStart(4, '0')}`,
      patientId: patient!.id,
      patientName: `${patient!.lastName} ${patient!.firstName}`,
      patientMpi: patient!.mpiId,
      doctorName: ctx.doctor,
      specialty: ctx.specialty,
      serviceName: ctx.service,
      date: ctx.date,
      scheduledAt: `${ctx.date}T${ctx.time}:00`,
      type: ctx.type,
      origin: ctx.origin,
      reason: ctx.reason,
      companion: ctx.companion || undefined,
      status: 'en_attente',
      syncStatus: 'pending',
      vitalSigns: Object.keys(vitals).length > 0 ? vitals : undefined,
      createdAt: now,
      updatedAt: now,
      createdById: 'u-current',
    };
    onCreated(newConsultation);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-900 text-lg">Nouvelle consultation</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-0 px-6 pt-4 pb-3">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const done = step > s.id;
            const active = step === s.id;
            return (
              <div key={s.id} className="flex items-center gap-0 flex-1">
                <div className="flex flex-col items-center gap-1">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
                    done   ? 'bg-green-500 text-white' :
                    active ? 'bg-blue-600 text-white' :
                             'bg-gray-100 text-gray-400'
                  )}>
                    {done ? <Check size={14} /> : <Icon size={14} />}
                  </div>
                  <span className={cn('text-xs', active ? 'font-semibold text-blue-700' : done ? 'text-green-600' : 'text-gray-400')}>
                    {s.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={cn('flex-1 h-px mx-2 mt-[-16px]', step > s.id ? 'bg-green-400' : 'bg-gray-200')} />
                )}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 1 && <PatientSelector selected={patient} onSelect={setPatient} />}
          {step === 2 && <ContextFormStep form={ctx} onChange={setCtx} />}
          {step === 3 && <VitalsStep vitals={vitals} onChange={setVitals} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={step === 1 ? onClose : () => setStep(s => s - 1)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <ChevronLeft size={15} /> {step === 1 ? 'Annuler' : 'Retour'}
          </button>
          <button
            onClick={step < 3 ? () => setStep(s => s + 1) : handleCreate}
            disabled={!canNext}
            className="flex items-center gap-1.5 px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {step < 3 ? (
              <><ChevronRight size={15} /> Suivant</>
            ) : (
              <><Check size={15} /> Créer la consultation</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
