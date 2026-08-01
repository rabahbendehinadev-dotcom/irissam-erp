import { useState } from 'react';
import { Plus, Trash2, Printer, AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PrescriptionItem } from '@/types/consultation';

const MOCK_MEDICATIONS = [
  'Amoxicilline', 'Augmentin', 'Azithromycine', 'Ciprofloxacine',
  'Amlodipine', 'Perindopril', 'Metformine', 'Gliclazide',
  'Paracétamol', 'Ibuprofène', 'Diclofénac', 'Tramadol',
  'Oméprazole', 'Pantoprazole', 'Atorvastatine', 'Metoprolol',
  'Furosémide', 'Spironolactone', 'Bisoprolol', 'Ramipril',
  'Loratadine', 'Cétirizine', 'Prednisone', 'Dexaméthasone',
];

const FORMS = ['Comprimé', 'Gélule', 'Sirop', 'Solution buvable', 'Injectable (IV)', 'Injectable (IM)', 'Pommade', 'Suppositoire', 'Spray', 'Gouttes'];
const ROUTES = ['Oral', 'Intra-veineux (IV)', 'Intra-musculaire (IM)', 'Sous-cutané', 'Topique', 'Nasal', 'Ophtalmique', 'Rectal'];
const FREQUENCIES = ['1×/jour', '2×/jour', '3×/jour', '4×/jour', 'Toutes les 8h', 'Toutes les 12h', 'Si besoin', '1×/semaine', '1×/mois'];
const TIMINGS = ['Le matin', 'Le soir', 'Avant repas', 'Pendant repas', 'Après repas', 'À jeun', 'Au coucher', 'Si douleur'];

const ALLERGIES_WARN: Record<string, string[]> = {
  'Pénicilline':   ['Amoxicilline', 'Augmentin'],
  'Aspirine':      ['Ibuprofène', 'Diclofénac'],
  'Sulfamides':    ['Furosémide', 'Spironolactone'],
};

function checkAllergyWarning(medication: string, patientAllergies: string[]): string | undefined {
  for (const allergen of patientAllergies) {
    const warned = ALLERGIES_WARN[allergen] ?? [];
    if (warned.some(m => m.toLowerCase() === medication.toLowerCase())) {
      return `⚠ Allergie connue : ${allergen}`;
    }
  }
  return undefined;
}

const SEL = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white';
const INP = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400';

const EMPTY_RX: Omit<PrescriptionItem, 'id'> = {
  medication: '', form: 'Comprimé', dosage: '', route: 'Oral',
  frequency: '1×/jour', duration: '7 jours', quantity: '7',
  instructions: '', timing: 'Le matin', renewable: false, notes: '',
};

function RxRow({
  item, patientAllergies, readOnly, onChange, onRemove,
}: {
  item: PrescriptionItem; patientAllergies: string[];
  readOnly: boolean; onChange: (i: PrescriptionItem) => void; onRemove: () => void;
}) {
  const [medSearch, setMedSearch] = useState('');
  const warning = checkAllergyWarning(item.medication, patientAllergies);
  const medResults = medSearch.length > 1
    ? MOCK_MEDICATIONS.filter(m => m.toLowerCase().includes(medSearch.toLowerCase())).slice(0, 5)
    : [];

  return (
    <div className={cn('border rounded-xl p-4 space-y-3', warning ? 'border-red-300 bg-red-50/30' : 'border-gray-200 bg-white')}>
      {warning && (
        <div className="flex items-center gap-2 p-2.5 bg-red-100 border border-red-300 rounded-lg text-sm text-red-700">
          <AlertTriangle size={14} /> {warning}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Medication with autocomplete */}
        <div className="relative sm:col-span-2">
          <label className="text-xs text-gray-500 mb-1 block">Médicament *</label>
          <input
            type="text"
            value={medSearch || item.medication}
            onChange={e => { setMedSearch(e.target.value); onChange({ ...item, medication: e.target.value, allergyWarning: checkAllergyWarning(e.target.value, patientAllergies) }); }}
            disabled={readOnly}
            placeholder="Nom du médicament…"
            className={cn(INP, warning ? 'border-red-400' : '')}
          />
          {medResults.length > 0 && (
            <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              {medResults.map(m => (
                <button key={m} className="w-full px-3 py-2 text-sm hover:bg-blue-50 text-left"
                  onClick={() => { onChange({ ...item, medication: m, allergyWarning: checkAllergyWarning(m, patientAllergies) }); setMedSearch(''); }}>
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Forme</label>
          <select value={item.form} onChange={e => onChange({ ...item, form: e.target.value })} disabled={readOnly} className={SEL}>
            {FORMS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Dosage</label>
          <input type="text" value={item.dosage} onChange={e => onChange({ ...item, dosage: e.target.value })} disabled={readOnly} placeholder="500 mg" className={INP} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Voie</label>
          <select value={item.route} onChange={e => onChange({ ...item, route: e.target.value })} disabled={readOnly} className={SEL}>
            {ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Fréquence</label>
          <select value={item.frequency} onChange={e => onChange({ ...item, frequency: e.target.value })} disabled={readOnly} className={SEL}>
            {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Durée</label>
          <input type="text" value={item.duration} onChange={e => onChange({ ...item, duration: e.target.value })} disabled={readOnly} placeholder="7 jours" className={INP} />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Quantité</label>
          <input type="text" value={item.quantity} onChange={e => onChange({ ...item, quantity: e.target.value })} disabled={readOnly} placeholder="14" className={INP} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Moment de prise</label>
          <select value={item.timing ?? ''} onChange={e => onChange({ ...item, timing: e.target.value })} disabled={readOnly} className={SEL}>
            <option value="">—</option>
            {TIMINGS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Instructions</label>
          <input type="text" value={item.instructions ?? ''} onChange={e => onChange({ ...item, instructions: e.target.value })} disabled={readOnly} placeholder="Instructions complémentaires" className={INP} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={item.renewable} onChange={e => onChange({ ...item, renewable: e.target.checked })} disabled={readOnly}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          <RefreshCw size={12} className="text-gray-400" />
          Renouvelable
        </label>
        {!readOnly && (
          <button onClick={onRemove} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
            <Trash2 size={13} /> Supprimer
          </button>
        )}
      </div>
    </div>
  );
}

interface Props {
  prescriptions: PrescriptionItem[];
  patientAllergies?: string[];
  onChange: (items: PrescriptionItem[]) => void;
  readOnly?: boolean;
}

export function PrescriptionBuilder({ prescriptions, patientAllergies = [], onChange, readOnly = false }: Props) {
  const add = () => onChange([...prescriptions, { ...EMPTY_RX, id: `rx-new-${Date.now()}` }]);
  const update = (i: number, item: PrescriptionItem) => onChange(prescriptions.map((x, j) => j === i ? item : x));
  const remove = (i: number) => onChange(prescriptions.filter((_, j) => j !== i));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-gray-800 text-sm">Ordonnance / Prescriptions</h4>
          <p className="text-xs text-gray-500 mt-0.5">{prescriptions.length} médicament{prescriptions.length !== 1 ? 's' : ''} prescrit{prescriptions.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          {prescriptions.length > 0 && (
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
              <Printer size={14} /> Imprimer
            </button>
          )}
          {!readOnly && (
            <button onClick={add} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus size={14} /> Ajouter
            </button>
          )}
        </div>
      </div>

      {patientAllergies.length > 0 && (
        <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          <AlertTriangle size={13} />
          <span>Allergies patient : <strong>{patientAllergies.join(', ')}</strong> — vérification des interactions activée.</span>
        </div>
      )}

      {prescriptions.length === 0 ? (
        <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <p className="text-sm">Aucune prescription</p>
          {!readOnly && <button onClick={add} className="text-sm text-blue-600 hover:underline mt-1">+ Ajouter un médicament</button>}
        </div>
      ) : (
        <div className="space-y-3">
          {prescriptions.map((item, i) => (
            <RxRow key={item.id} item={item} patientAllergies={patientAllergies} readOnly={readOnly}
              onChange={upd => update(i, upd)} onRemove={() => remove(i)} />
          ))}
        </div>
      )}
    </div>
  );
}
