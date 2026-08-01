import { useState } from 'react';
import { ClipboardList, CheckCircle2, AlertCircle, MinusCircle, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEmergencyDossier } from '@/contexts/EmergencyDossierContext';
import type { ExamSectionStatus, ClinicalExamination } from '@/types/emergencyDossier';

// ─── Status configs ───────────────────────────────────────────────────────────

const EXAM_STATUS_CFG: Record<ExamSectionStatus, {
  label: string; icon: React.ReactNode; btn: string; bg: string;
}> = {
  normal:     { label: 'Normal',     icon: <CheckCircle2 size={13} />, btn: 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200', bg: 'bg-green-50' },
  anormal:    { label: 'Anormal',    icon: <AlertCircle size={13} />,  btn: 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200',       bg: 'bg-red-50' },
  non_evalue: { label: 'Non évalué', icon: <MinusCircle size={13} />,  btn: 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200',   bg: 'bg-white' },
};

const EXAM_SECTIONS: Array<{key: keyof Omit<ClinicalExamination, 'provisionalDiagnosis'|'differentialDiagnoses'|'severity'|'icd10Placeholder'|'examinedAt'|'examinedBy'>; label: string}> = [
  { key: 'generalState',    label: 'État général' },
  { key: 'cardiovascular',  label: 'Cardiovasculaire' },
  { key: 'respiratory',     label: 'Respiratoire' },
  { key: 'neurological',    label: 'Neurologique' },
  { key: 'abdominal',       label: 'Abdominal' },
  { key: 'traumatic',       label: 'Traumatique' },
  { key: 'cutaneous',       label: 'Cutané' },
  { key: 'ent',             label: 'ORL' },
  { key: 'musculoskeletal', label: 'Musculo-squelettique' },
  { key: 'other',           label: 'Autres constatations' },
];

const SEVERITY_CFG = {
  non_grave: { label: 'Non grave',  cls: 'bg-green-100 text-green-700 border-green-300' },
  modere:    { label: 'Modéré',     cls: 'bg-amber-100 text-amber-700 border-amber-300' },
  grave:     { label: 'Grave',      cls: 'bg-orange-100 text-orange-700 border-orange-300' },
  critique:  { label: 'CRITIQUE',   cls: 'bg-red-100 text-red-700 border-red-300' },
} as const;

// ─── Component ────────────────────────────────────────────────────────────────

export function TabExamen() {
  const { dossier, updateFullExam } = useEmergencyDossier();
  const exam = dossier.clinicalExamination;
  const [diffInput, setDiffInput] = useState('');
  const [showDiffInput, setShowDiffInput] = useState(false);

  const update = (patch: Partial<ClinicalExamination>) => {
    updateFullExam({ ...exam, ...patch });
  };

  const cycleStatus = (key: typeof EXAM_SECTIONS[number]['key']) => {
    const order: ExamSectionStatus[] = ['non_evalue', 'normal', 'anormal'];
    const current = exam[key].status;
    const next = order[(order.indexOf(current) + 1) % 3];
    update({ [key]: { ...exam[key], status: next } });
  };

  const abnormalCount = EXAM_SECTIONS.filter(s => exam[s.key].status === 'anormal').length;
  const normalCount   = EXAM_SECTIONS.filter(s => exam[s.key].status === 'normal').length;

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-gray-500 font-medium">Résumé :</span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-300">{normalCount} normaux</span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300">{abnormalCount} anormaux</span>
        <span className="text-[10px] text-gray-400">{EXAM_SECTIONS.length - normalCount - abnormalCount} non évalués</span>
        <span className="ml-auto text-[10px] text-gray-400">Examiné le {new Date(exam.examinedAt).toLocaleString('fr-DZ', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })} — {exam.examinedBy}</span>
      </div>

      {/* Exam sections grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {EXAM_SECTIONS.map(({ key, label }) => {
          const sec = exam[key];
          const cfg = EXAM_STATUS_CFG[sec.status];
          return (
            <div key={key} className={cn('border rounded-xl overflow-hidden border-gray-200')}>
              <div className={cn('flex items-center gap-2 px-3 py-2', cfg.bg)}>
                <ClipboardList size={12} className="text-gray-400 flex-shrink-0" />
                <span className="font-semibold text-xs text-gray-700 flex-1">{label}</span>
                <button
                  onClick={() => cycleStatus(key)}
                  className={cn('flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors', cfg.btn)}
                >
                  {cfg.icon}{cfg.label}
                </button>
              </div>
              <div className="px-3 py-2">
                <textarea
                  rows={2}
                  value={sec.findings}
                  onChange={e => update({ [key]: { ...sec, findings: e.target.value } })}
                  className="w-full text-xs text-gray-700 bg-transparent border-0 outline-none resize-none placeholder:text-gray-300 leading-relaxed"
                  placeholder="Constatations…"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Diagnosis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-blue-200 bg-blue-100/50">
            <span className="text-xs font-bold text-blue-700">Diagnostic provisoire</span>
          </div>
          <div className="px-4 py-3">
            <textarea
              rows={3}
              value={exam.provisionalDiagnosis}
              onChange={e => update({ provisionalDiagnosis: e.target.value })}
              className="w-full text-sm text-gray-800 bg-transparent border-0 outline-none resize-none placeholder:text-gray-300"
              placeholder="Diagnostic principal…"
            />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
            <span className="text-xs font-semibold text-gray-700">Diagnostics différentiels</span>
            <button
              onClick={() => setShowDiffInput(v => !v)}
              className="text-[10px] text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Plus size={10} />Ajouter
            </button>
          </div>
          <div className="px-4 py-3 space-y-1.5">
            {exam.differentialDiagnoses.length === 0 && !showDiffInput && (
              <p className="text-xs text-gray-300 italic">Aucun</p>
            )}
            {exam.differentialDiagnoses.map((d, i) => (
              <div key={i} className="flex items-center gap-2 group">
                <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[9px] font-bold flex items-center justify-center flex-shrink-0">{i+1}</span>
                <span className="text-xs text-gray-700 flex-1">{d}</span>
                <button
                  onClick={() => update({ differentialDiagnoses: exam.differentialDiagnoses.filter((_,j)=>j!==i) })}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                >
                  <Minus size={10} />
                </button>
              </div>
            ))}
            {showDiffInput && (
              <input
                autoFocus
                type="text"
                value={diffInput}
                onChange={e => setDiffInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && diffInput.trim()) {
                    update({ differentialDiagnoses: [...exam.differentialDiagnoses, diffInput.trim()] });
                    setDiffInput('');
                    setShowDiffInput(false);
                  }
                  if (e.key === 'Escape') { setDiffInput(''); setShowDiffInput(false); }
                }}
                placeholder="Saisir puis Entrée…"
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400"
              />
            )}
          </div>
        </div>
      </div>

      {/* Severity + ICD-10 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-700 mb-2">Gravité clinique</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(SEVERITY_CFG) as Array<[keyof typeof SEVERITY_CFG, typeof SEVERITY_CFG[keyof typeof SEVERITY_CFG]]>).map(([k, v]) => (
              <button
                key={k}
                onClick={() => update({ severity: k })}
                className={cn(
                  'text-xs font-bold px-3 py-2 rounded-xl border-2 transition-all',
                  exam.severity === k ? v.cls + ' ring-2 ring-current ring-offset-1' : 'border-gray-200 text-gray-500 hover:border-gray-400',
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-700 mb-2">Code CIM-10 (placeholder)</p>
          <input
            type="text"
            value={exam.icd10Placeholder}
            onChange={e => update({ icd10Placeholder: e.target.value })}
            placeholder="Ex: I21.0 — Infarctus aigu…"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <p className="text-[10px] text-gray-400 mt-1">Connexion au référentiel CIM-10 disponible lors de l'intégration backend.</p>
        </div>
      </div>
    </div>
  );
}
