import { useState } from 'react';
import { ChevronDown, Stethoscope } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ClinicalExam } from '@/types/consultation';

const TEMPLATES: Record<string, { label: string; fields: string[] }> = {
  medecine_generale: {
    label: 'Médecine générale',
    fields: ['generalState', 'consciousness', 'hydration', 'cardiovascular', 'respiratory', 'abdominal', 'neurological', 'skin', 'other'],
  },
  cardiologie: {
    label: 'Cardiologie',
    fields: ['generalState', 'cardiovascular', 'respiratory', 'neurological', 'other'],
  },
  gynecologie: {
    label: 'Gynécologie',
    fields: ['generalState', 'abdominal', 'other'],
  },
  pediatrie: {
    label: 'Pédiatrie',
    fields: ['generalState', 'consciousness', 'hydration', 'cardiovascular', 'respiratory', 'abdominal', 'neurological', 'skin', 'other'],
  },
  orthopedie: {
    label: 'Orthopédie',
    fields: ['generalState', 'neurological', 'other'],
  },
  medecine_interne: {
    label: 'Médecine interne',
    fields: ['generalState', 'consciousness', 'hydration', 'cardiovascular', 'respiratory', 'abdominal', 'neurological', 'skin', 'other'],
  },
  oncologie: {
    label: 'Oncologie',
    fields: ['generalState', 'cardiovascular', 'respiratory', 'abdominal', 'skin', 'other'],
  },
};

const FIELD_LABELS: Record<string, string> = {
  generalState:   'État général',
  consciousness:  'Conscience / Orientation',
  hydration:      'Hydratation',
  cardiovascular: 'Examen cardiovasculaire',
  respiratory:    'Examen respiratoire',
  abdominal:      'Examen abdominal',
  neurological:   'Examen neurologique',
  skin:           'Examen cutané',
  other:          'Autres constatations',
};

const FIELD_HINTS: Record<string, string> = {
  generalState:   'Bon état général, Altéré, Polypnéique, Pâle, Ictérique…',
  consciousness:  'Conscient, orienté temporo-spatialement, GCS 15/15…',
  hydration:      'Bien hydraté, Muqueuses sèches, Déshydratation…',
  cardiovascular: 'Bruits du cœur réguliers, pas de souffle, PA équilibrée…',
  respiratory:    'Murmure vésiculaire normal, sans râles, SpO2 98%…',
  abdominal:      'Abdomen souple, indolore, pas de masse palpable…',
  neurological:   'Déficit moteur ou sensitif, ROT présents, Babinski négatif…',
  skin:           'Pas de lésion cutanée, pas de cicatrice récente…',
  other:          'Autres constatations cliniques…',
};

interface Props {
  exam?: ClinicalExam;
  onChange: (e: ClinicalExam) => void;
  readOnly?: boolean;
  defaultTemplate?: string;
}

export function ClinicalExamForm({ exam, onChange, readOnly = false, defaultTemplate = 'medecine_generale' }: Props) {
  const [template, setTemplate] = useState(exam?.template ?? defaultTemplate);

  const fields = TEMPLATES[template]?.fields ?? TEMPLATES.medecine_generale.fields;

  const update = (k: string, v: string) => {
    onChange({ ...(exam ?? {}), template, [k]: v });
  };

  const setTempl = (t: string) => {
    setTemplate(t);
    onChange({ ...(exam ?? {}), template: t });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Stethoscope size={16} className="text-indigo-600" />
          <h4 className="font-semibold text-gray-800 text-sm">Examen clinique</h4>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Template :</label>
            <div className="relative">
              <select
                value={template}
                onChange={e => setTempl(e.target.value)}
                className="pl-3 pr-8 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white appearance-none"
              >
                {Object.entries(TEMPLATES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {fields.map(field => (
          <div key={field}>
            <label className="text-xs font-medium text-gray-600 mb-1 block">{FIELD_LABELS[field]}</label>
            <textarea
              value={(exam as any)?.[field] ?? ''}
              onChange={e => update(field, e.target.value)}
              disabled={readOnly}
              rows={2}
              placeholder={FIELD_HINTS[field]}
              className={cn(
                'w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none transition-colors',
                readOnly ? 'bg-gray-50 border-gray-100 text-gray-600' : 'border-gray-200 bg-white'
              )}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
