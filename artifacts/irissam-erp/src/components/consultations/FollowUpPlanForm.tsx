import { Calendar, CheckSquare, UserPlus, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FollowUpPlan } from '@/types/consultation';

const EMPTY: FollowUpPlan = {
  recommendedTreatment: '', medicalAdvice: '', diet: '', rest: '',
  monitoring: '', controlDate: '', newAppointment: false,
  specialistReferral: '', admissionRecommended: false,
  hospitalizationRecommended: false, returnToEmergencyIfWorse: true,
};

const INP = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20';
const TA = `${INP} resize-none`;

interface Props {
  plan?: FollowUpPlan;
  onChange: (p: FollowUpPlan) => void;
  readOnly?: boolean;
}

export function FollowUpPlanForm({ plan, onChange, readOnly = false }: Props) {
  const p = plan ?? EMPTY;
  const set = <K extends keyof FollowUpPlan>(k: K, v: FollowUpPlan[K]) =>
    onChange({ ...p, [k]: v });

  const Flag = ({
    k, label, color = 'blue',
  }: { k: 'newAppointment' | 'admissionRecommended' | 'hospitalizationRecommended' | 'returnToEmergencyIfWorse'; label: string; color?: string }) => (
    <label className={cn('flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors', (p[k] as boolean)
      ? `bg-${color}-50 border-${color}-300 text-${color}-700`
      : 'bg-gray-50 border-gray-200 text-gray-500')}>
      <input type="checkbox" checked={p[k] as boolean} onChange={e => set(k, e.target.checked as any)}
        disabled={readOnly} className="rounded border-gray-300 focus:ring-blue-500" />
      <span className="text-sm font-medium">{label}</span>
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Calendar size={16} className="text-green-600" />
        <h4 className="font-semibold text-gray-800 text-sm">Plan de suivi</h4>
      </div>

      {/* Text fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Traitement recommandé</label>
          <textarea value={p.recommendedTreatment ?? ''} onChange={e => set('recommendedTreatment', e.target.value)}
            disabled={readOnly} rows={2} placeholder="Traitement prescrit, à poursuivre…" className={TA} />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Conseils médicaux</label>
          <textarea value={p.medicalAdvice ?? ''} onChange={e => set('medicalAdvice', e.target.value)}
            disabled={readOnly} rows={2} placeholder="Activité physique, hygiène de vie…" className={TA} />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Régime alimentaire</label>
          <textarea value={p.diet ?? ''} onChange={e => set('diet', e.target.value)}
            disabled={readOnly} rows={2} placeholder="Régime hyposodé, diabétique…" className={TA} />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Repos</label>
          <textarea value={p.rest ?? ''} onChange={e => set('rest', e.target.value)}
            disabled={readOnly} rows={2} placeholder="Repos complet, arrêt de travail…" className={TA} />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Surveillance à domicile</label>
          <textarea value={p.monitoring ?? ''} onChange={e => set('monitoring', e.target.value)}
            disabled={readOnly} rows={2} placeholder="Tension artérielle quotidienne, glycémie…" className={TA} />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Date de contrôle</label>
          <input type="date" value={p.controlDate ?? ''} onChange={e => set('controlDate', e.target.value)}
            disabled={readOnly} className={INP} />
          <label className="text-xs text-gray-500 mb-1 block mt-2">Référence spécialiste</label>
          <input type="text" value={p.specialistReferral ?? ''} onChange={e => set('specialistReferral', e.target.value)}
            disabled={readOnly} placeholder="Cardiologue, Dr Settouf…" className={INP} />
        </div>
      </div>

      {/* Boolean flags */}
      <div className="grid grid-cols-2 gap-3">
        <Flag k="newAppointment"           label="Nouveau RDV à planifier"       color="blue" />
        <Flag k="admissionRecommended"     label="Admission recommandée"         color="orange" />
        <Flag k="hospitalizationRecommended" label="Hospitalisation recommandée" color="red" />
        <Flag k="returnToEmergencyIfWorse" label="Revenir aux urgences si aggravation" color="red" />
      </div>

      {/* Warning banners */}
      {p.admissionRecommended && (
        <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-300 rounded-xl text-sm text-orange-800">
          <ArrowUpRight size={16} />
          <span>Admission recommandée — pensez à créer une admission depuis le module Admissions.</span>
        </div>
      )}
      {p.hospitalizationRecommended && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-300 rounded-xl text-sm text-red-800">
          <AlertTriangle size={16} />
          <span>Hospitalisation recommandée — contactez le service d'hospitalisation.</span>
        </div>
      )}
      {p.returnToEmergencyIfWorse && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          <UserPlus size={14} />
          <span>Consigne donnée au patient : <strong>revenir aux urgences en cas d'aggravation.</strong></span>
        </div>
      )}
    </div>
  );
}
