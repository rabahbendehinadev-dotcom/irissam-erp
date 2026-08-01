import { useState } from 'react';
import { Plus, Trash2, ChevronDown, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Diagnosis, DiagnosisKind, DiagnosisStatus, GravityLevel } from '@/types/consultation';

const GRAVITY_MAP: Record<GravityLevel, { label: string; cls: string }> = {
  leger:    { label: 'Léger',    cls: 'bg-green-50 text-green-700 border-green-200' },
  modere:   { label: 'Modéré',   cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  grave:    { label: 'Grave',    cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  critique: { label: 'Critique', cls: 'bg-red-50 text-red-700 border-red-200' },
};

const MOCK_ICD10 = [
  { code: 'I10',  label: 'Hypertension artérielle essentielle' },
  { code: 'E11',  label: 'Diabète de type 2' },
  { code: 'J06',  label: 'Infection aiguë des voies respiratoires supérieures' },
  { code: 'M54',  label: 'Dorsalgie / Rachialgie' },
  { code: 'I25',  label: 'Cardiopathie ischémique chronique' },
  { code: 'J18',  label: 'Pneumopathie, sans précision' },
  { code: 'K29',  label: 'Gastrite et duodénite' },
  { code: 'N18',  label: 'Insuffisance rénale chronique' },
  { code: 'E78',  label: 'Troubles du métabolisme des lipoprotéines' },
  { code: 'F41',  label: 'Autres troubles anxieux' },
  { code: 'Z00',  label: 'Examen général / bilan de santé' },
  { code: 'R51',  label: 'Céphalée' },
  { code: 'R50',  label: 'Fièvre d\'origine inconnue' },
  { code: 'R10',  label: 'Douleurs abdominales et pelviennes' },
];

const SEL = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white';
const INP = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400';

const EMPTY_DX: Omit<Diagnosis, 'id'> = {
  kind: 'principal', status: 'provisoire', icd10Code: '',
  label: '', gravity: undefined, comments: '', confirmedAt: '',
};

function DiagnosisRow({
  dx, index, readOnly, onChange, onRemove,
}: {
  dx: Diagnosis; index: number; readOnly: boolean;
  onChange: (d: Diagnosis) => void; onRemove: () => void;
}) {
  const [open, setOpen] = useState(index === 0);
  const [icdSearch, setIcdSearch] = useState('');

  const icdResults = icdSearch.length > 1
    ? MOCK_ICD10.filter(c =>
        c.code.toLowerCase().includes(icdSearch.toLowerCase()) ||
        c.label.toLowerCase().includes(icdSearch.toLowerCase())
      ).slice(0, 5)
    : [];

  return (
    <div className={cn('border rounded-xl overflow-hidden', dx.kind === 'principal' ? 'border-blue-200' : 'border-gray-200')}>
      {/* Header */}
      <div
        className={cn('flex items-center justify-between px-4 py-3 cursor-pointer', dx.kind === 'principal' ? 'bg-blue-50' : 'bg-gray-50')}
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          {dx.status === 'confirme'
            ? <CheckCircle2 size={15} className="text-green-600" />
            : <AlertTriangle size={15} className="text-yellow-500" />}
          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', dx.kind === 'principal' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600')}>
            {dx.kind === 'principal' ? 'Principal' : 'Secondaire'}
          </span>
          <span className="text-sm font-medium text-gray-800 truncate max-w-[300px]">
            {dx.label || <span className="text-gray-400 font-normal italic">Diagnostic non renseigné</span>}
          </span>
          {dx.icd10Code && <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{dx.icd10Code}</span>}
          {dx.gravity && (
            <span className={cn('text-xs px-2 py-0.5 rounded-full border', GRAVITY_MAP[dx.gravity].cls)}>
              {GRAVITY_MAP[dx.gravity].label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <button onClick={e => { e.stopPropagation(); onRemove(); }} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
              <Trash2 size={13} />
            </button>
          )}
          <ChevronDown size={15} className={cn('text-gray-400 transition-transform', open ? 'rotate-180' : '')} />
        </div>
      </div>

      {/* Form */}
      {open && (
        <div className="p-4 space-y-3 bg-white">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Type</label>
              <select
                value={dx.kind}
                onChange={e => onChange({ ...dx, kind: e.target.value as DiagnosisKind })}
                disabled={readOnly}
                className={SEL}
              >
                <option value="principal">Principal</option>
                <option value="secondaire">Secondaire</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Statut</label>
              <select
                value={dx.status}
                onChange={e => onChange({ ...dx, status: e.target.value as DiagnosisStatus })}
                disabled={readOnly}
                className={SEL}
              >
                <option value="provisoire">Provisoire</option>
                <option value="confirme">Confirmé</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Gravité</label>
              <select
                value={dx.gravity ?? ''}
                onChange={e => onChange({ ...dx, gravity: (e.target.value || undefined) as GravityLevel | undefined })}
                disabled={readOnly}
                className={SEL}
              >
                <option value="">—</option>
                <option value="leger">Léger</option>
                <option value="modere">Modéré</option>
                <option value="grave">Grave</option>
                <option value="critique">Critique</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Date confirmation</label>
              <input
                type="datetime-local"
                value={dx.confirmedAt ?? ''}
                onChange={e => onChange({ ...dx, confirmedAt: e.target.value })}
                disabled={readOnly || dx.status !== 'confirme'}
                className={INP}
              />
            </div>
          </div>

          {/* CIM-10 */}
          <div className="relative">
            <label className="text-xs text-gray-500 mb-1 block">Code CIM-10 (recherche mock)</label>
            <input
              type="text"
              value={icdSearch || dx.icd10Code || ''}
              onChange={e => { setIcdSearch(e.target.value); onChange({ ...dx, icd10Code: e.target.value }); }}
              disabled={readOnly}
              placeholder="Ex: I10, hypertension…"
              className={INP}
            />
            {icdResults.length > 0 && (
              <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {icdResults.map(r => (
                  <button
                    key={r.code}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-blue-50 text-left"
                    onClick={() => { onChange({ ...dx, icd10Code: r.code, label: dx.label || r.label }); setIcdSearch(''); }}
                  >
                    <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">{r.code}</span>
                    <span className="text-gray-700">{r.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Label */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Libellé du diagnostic *</label>
            <input
              type="text"
              value={dx.label}
              onChange={e => onChange({ ...dx, label: e.target.value })}
              disabled={readOnly}
              placeholder="Description du diagnostic…"
              className={INP}
            />
          </div>

          {/* Comments */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Commentaires</label>
            <textarea
              value={dx.comments ?? ''}
              onChange={e => onChange({ ...dx, comments: e.target.value })}
              disabled={readOnly}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  diagnoses: Diagnosis[];
  onChange: (d: Diagnosis[]) => void;
  readOnly?: boolean;
}

export function DiagnosisBuilder({ diagnoses, onChange, readOnly = false }: Props) {
  const add = () => {
    onChange([...diagnoses, { ...EMPTY_DX, id: `dx-new-${Date.now()}`, kind: diagnoses.length === 0 ? 'principal' : 'secondaire' }]);
  };
  const update = (i: number, d: Diagnosis) => onChange(diagnoses.map((x, j) => j === i ? d : x));
  const remove = (i: number) => onChange(diagnoses.filter((_, j) => j !== i));

  const hasPrincipal = diagnoses.some(d => d.kind === 'principal' && d.label);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-gray-800 text-sm">Diagnostics</h4>
          <p className="text-xs text-gray-500 mt-0.5">Ajoutez un diagnostic principal et des diagnostics secondaires</p>
        </div>
        {!readOnly && (
          <button onClick={add} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus size={14} /> Ajouter
          </button>
        )}
      </div>

      {!hasPrincipal && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <AlertTriangle size={14} /> Un diagnostic principal est requis pour terminer la consultation.
        </div>
      )}

      {diagnoses.length === 0 ? (
        <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <p className="text-sm">Aucun diagnostic enregistré</p>
          {!readOnly && <button onClick={add} className="text-sm text-blue-600 hover:underline mt-1">+ Ajouter un diagnostic</button>}
        </div>
      ) : (
        <div className="space-y-2">
          {diagnoses.map((dx, i) => (
            <DiagnosisRow key={dx.id} dx={dx} index={i} readOnly={readOnly}
              onChange={d => update(i, d)} onRemove={() => remove(i)} />
          ))}
        </div>
      )}
    </div>
  );
}
