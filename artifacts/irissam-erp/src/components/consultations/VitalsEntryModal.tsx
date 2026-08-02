import { useState } from 'react';
import { X, Activity, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Consultation, VitalSigns } from '@/types/consultation';

interface Props {
  consultation: Consultation;
  onSave: (consultationId: string, vitals: VitalSigns) => void;
  onClose: () => void;
}

const INP = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20';

const VITAL_FIELDS: {
  key: keyof VitalSigns;
  label: string;
  unit: string;
  low: number;
  high: number;
  step?: number;
}[] = [
  { key: 'weight',           label: 'Poids',              unit: 'kg',     low: 30,  high: 300, step: 0.5 },
  { key: 'height',           label: 'Taille',             unit: 'cm',     low: 50,  high: 250, step: 1   },
  { key: 'temperature',      label: 'Température',        unit: '°C',     low: 36,  high: 38.5, step: 0.1 },
  { key: 'systolicBP',       label: 'Tension syst.',      unit: 'mmHg',   low: 90,  high: 140, step: 1   },
  { key: 'diastolicBP',      label: 'Tension diast.',     unit: 'mmHg',   low: 60,  high: 90,  step: 1   },
  { key: 'heartRate',        label: 'Fréq. cardiaque',    unit: 'bpm',    low: 60,  high: 100, step: 1   },
  { key: 'respiratoryRate',  label: 'Fréq. respiratoire', unit: '/min',   low: 12,  high: 20,  step: 1   },
  { key: 'oxygenSaturation', label: 'SpO₂',               unit: '%',      low: 95,  high: 100, step: 1   },
  { key: 'bloodGlucose',     label: 'Glycémie',           unit: 'mmol/L', low: 3.9, high: 7.8, step: 0.1 },
  { key: 'painLevel',        label: 'Douleur (EVA)',      unit: '/10',    low: 0,   high: 10,  step: 1   },
];

export function VitalsEntryModal({ consultation, onSave, onClose }: Props) {
  const [vitals, setVitals] = useState<VitalSigns>(consultation.vitalSigns ?? {});
  const [saved, setSaved] = useState(false);

  const set = (k: keyof VitalSigns, raw: string | boolean) => {
    if (typeof raw === 'boolean') {
      setVitals(v => ({ ...v, [k]: raw }));
      return;
    }
    const n = parseFloat(raw);
    const next: VitalSigns = { ...vitals, [k]: isNaN(n) ? undefined : n };
    // Auto-compute BMI
    const w = next.weight, h = next.height;
    if (w && h) next.bmi = parseFloat((w / (h / 100) ** 2).toFixed(1));
    setVitals(next);
  };

  const handleSave = () => {
    onSave(consultation.id, vitals);
    setSaved(true);
    setTimeout(onClose, 800);
  };

  const hasAnyValue = VITAL_FIELDS.some(f => vitals[f.key] !== undefined && vitals[f.key] !== '');

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                <Activity size={18} className="text-blue-700" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 text-base">Saisie des signes vitaux</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {consultation.patientName} · {consultation.number}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">

            {/* Patient info chip */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 flex items-center gap-3 text-sm">
              <span className="text-blue-700 font-medium">{consultation.patientName}</span>
              <span className="text-blue-400">·</span>
              <span className="text-blue-600 font-mono text-xs">{consultation.patientMpi}</span>
              <span className="ml-auto text-xs text-blue-500">
                {consultation.doctorName} — {consultation.specialty}
              </span>
            </div>

            {/* Vital fields grid */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Mesures</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {VITAL_FIELDS.map(f => {
                  const val = vitals[f.key] as number | undefined;
                  const anomaly = val !== undefined && (val < f.low || val > f.high);
                  return (
                    <div key={f.key as string}>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">{f.label}</label>
                      <div className="flex gap-1.5 items-center">
                        <input
                          type="number"
                          step={f.step ?? 0.1}
                          value={val ?? ''}
                          onChange={e => set(f.key, e.target.value)}
                          className={cn(INP, 'flex-1', anomaly ? 'border-red-400 bg-red-50' : '')}
                          placeholder="—"
                        />
                        <span className="text-xs text-gray-400 whitespace-nowrap">{f.unit}</span>
                      </div>
                      {anomaly && (
                        <p className="text-xs text-red-500 mt-0.5">⚠ Valeur anormale</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* BMI */}
            {vitals.bmi && (
              <div className={cn('p-3 rounded-xl text-sm font-medium',
                vitals.bmi < 18.5 ? 'bg-blue-50 text-blue-700' :
                vitals.bmi < 25   ? 'bg-green-50 text-green-700' :
                vitals.bmi < 30   ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700')}>
                IMC calculé : <strong>{vitals.bmi}</strong>
                {vitals.bmi < 18.5 ? ' — Insuffisance pondérale' :
                 vitals.bmi < 25   ? ' — Normal ✓' :
                 vitals.bmi < 30   ? ' — Surpoids' : ' — Obésité'}
              </div>
            )}

            {/* Consciousness */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                État de conscience
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { value: 'alerte',      label: 'Alerte',              cls: 'border-green-400 bg-green-50 text-green-700' },
                  { value: 'voix',        label: 'Répond à la voix',    cls: 'border-blue-400 bg-blue-50 text-blue-700' },
                  { value: 'douleur',     label: 'Répond à la douleur', cls: 'border-amber-400 bg-amber-50 text-amber-700' },
                  { value: 'inconscient', label: 'Inconscient',         cls: 'border-red-500 bg-red-50 text-red-700' },
                ].map(opt => {
                  const sel = vitals.consciousnessState === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setVitals(v => ({ ...v, consciousnessState: sel ? undefined : opt.value }))}
                      className={cn(
                        'py-1.5 px-2 rounded-lg border-2 text-xs font-medium transition-all text-center',
                        sel ? opt.cls : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Oxygen */}
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={vitals.oxygenAdministered ?? false}
                  onChange={e => setVitals(v => ({
                    ...v,
                    oxygenAdministered: e.target.checked,
                    oxygenFlowRate: e.target.checked ? v.oxygenFlowRate : undefined,
                  }))}
                  className="rounded border-gray-300 text-blue-600"
                />
                Oxygène administré
              </label>
              {vitals.oxygenAdministered && (
                <div className="flex items-center gap-2">
                  <input
                    type="number" step="0.5" min={0} max={15}
                    value={vitals.oxygenFlowRate ?? ''}
                    onChange={e => { const n = parseFloat(e.target.value); setVitals(v => ({ ...v, oxygenFlowRate: isNaN(n) ? undefined : n })); }}
                    className="w-20 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="—"
                  />
                  <span className="text-xs text-gray-500">L/min</span>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={vitals.pregnancy ?? false}
                  onChange={e => setVitals(v => ({ ...v, pregnancy: e.target.checked }))}
                  className="rounded border-gray-300 text-pink-500"
                />
                Grossesse en cours
              </label>
            </div>

            {/* Nursing notes */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                Notes infirmières
              </label>
              <textarea
                value={vitals.nursingNotes ?? ''}
                onChange={e => setVitals(v => ({ ...v, nursingNotes: e.target.value || undefined }))}
                rows={3}
                placeholder="Observations, comportement du patient, contexte de la prise en charge…"
                className={`${INP} resize-none`}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 bg-gray-50/60">
            <p className="text-xs text-gray-400">
              Les signes vitaux seront visibles par le médecin à l'ouverture de la consultation.
            </p>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={!hasAnyValue || saved}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium transition-all',
                  saved
                    ? 'bg-green-500 text-white cursor-default'
                    : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed'
                )}
              >
                {saved ? (
                  <><CheckCircle2 size={15} /> Enregistré</>
                ) : (
                  <><Activity size={15} /> Enregistrer les vitaux</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
