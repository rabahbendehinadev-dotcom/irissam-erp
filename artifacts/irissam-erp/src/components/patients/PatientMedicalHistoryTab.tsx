import { useState } from 'react';
import {
  AlertTriangle, Heart, Scissors, Dna, Activity, Brain, Coffee,
  ChevronDown, ChevronUp, Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Patient } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type HistoryCategory =
  | 'diseases'    // Maladies antérieures
  | 'surgeries'   // Interventions chirurgicales
  | 'hereditary'  // Maladies héréditaires
  | 'chronic'     // Maladies chroniques
  | 'psychiatric' // Santé mentale
  | 'lifestyle';  // Mode de vie

interface HistoryRecord {
  id: string;
  category: HistoryCategory;
  label: string;
  date?: string;
  doctor?: string;
  department?: string;
  notes?: string;
  severity?: 'légère' | 'modérée' | 'sévère';
  status?: 'actif' | 'résolu' | 'en_suivi';
}

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORY_CFG: Record<HistoryCategory, {
  icon: React.ElementType; label: string; color: string; bg: string; border: string;
}> = {
  diseases:    { icon: AlertTriangle, label: 'Maladies antérieures',        color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200' },
  surgeries:   { icon: Scissors,      label: 'Interventions chirurgicales', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  hereditary:  { icon: Dna,           label: 'Maladies héréditaires',       color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  chronic:     { icon: Heart,         label: 'Maladies chroniques',         color: 'text-rose-600',   bg: 'bg-rose-50',   border: 'border-rose-200' },
  psychiatric: { icon: Brain,         label: 'Santé mentale',               color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  lifestyle:   { icon: Coffee,        label: 'Mode de vie',                 color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200' },
};

const STATUS_CFG = {
  actif:      { label: 'Actif',     cls: 'bg-red-100 text-red-700 border-red-200' },
  résolu:     { label: 'Résolu',    cls: 'bg-green-100 text-green-700 border-green-200' },
  en_suivi:   { label: 'En suivi', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
};

// ─── Seeded mock data based on patient history ─────────────────────────────────

function buildHistory(patient: Patient): HistoryRecord[] {
  const records: HistoryRecord[] = [];

  // Map majorHistory strings to disease/surgery records
  const majorHistory = patient.medical?.majorHistory ?? [];
  majorHistory.forEach((h, i) => {
    const lc = h.toLowerCase();
    const isSurgery = ['ectomie', 'tomie', 'plastie', 'pontage', 'opération', 'chirurgie', 'appendice',
                       'cholécyst', 'césarienne', 'fracture'].some(kw => lc.includes(kw));

    // Extract year if present
    const yearMatch = h.match(/\d{4}/);
    const date = yearMatch ? `${yearMatch[0]}-01-01` : undefined;
    const label = h.replace(/\s*\d{4}\s*/g, '').trim();

    records.push({
      id: `h-major-${i}`,
      category: isSurgery ? 'surgeries' : 'diseases',
      label: label || h,
      date,
      status: 'résolu',
    });
  });

  // Chronic diseases
  (patient.medical?.chronicDiseases ?? []).forEach((d, i) => {
    records.push({
      id: `h-chronic-${i}`,
      category: 'chronic',
      label: d,
      status: 'actif',
      severity: 'modérée',
    });
  });

  // Hereditary (mock based on existing diseases)
  const diseases = patient.medical?.chronicDiseases ?? [];
  if (diseases.some(d => d.toLowerCase().includes('diabète'))) {
    records.push({ id: 'h-hered-1', category: 'hereditary', label: 'Diabète type 2 — antécédent familial', notes: 'Père diabétique', status: 'en_suivi' });
  }
  if (diseases.some(d => d.toLowerCase().includes('hypertension') || d.toLowerCase().includes('hta'))) {
    records.push({ id: 'h-hered-2', category: 'hereditary', label: 'Hypertension artérielle — antécédent familial', notes: 'Mère hypertendue depuis 60 ans', status: 'en_suivi' });
  }
  if (records.filter(r => r.category === 'hereditary').length === 0) {
    records.push({ id: 'h-hered-none', category: 'hereditary', label: 'Aucun antécédent héréditaire documenté', status: 'résolu' });
  }

  // Psychiatric (mock)
  records.push({
    id: 'h-psych-1', category: 'psychiatric',
    label: 'Aucun antécédent psychiatrique documenté',
    notes: 'Pas d\'épisode dépressif, anxieux ou psychotique signalé',
    status: 'résolu',
  });

  // Lifestyle (fixed mock)
  records.push(
    { id: 'h-life-1', category: 'lifestyle', label: 'Tabagisme',     notes: 'Non fumeur', status: 'résolu' },
    { id: 'h-life-2', category: 'lifestyle', label: 'Alcool',         notes: 'Consommation occasionnelle', status: 'résolu' },
    { id: 'h-life-3', category: 'lifestyle', label: 'Activité physique', notes: 'Sédentaire — recommandation en cours', status: 'en_suivi' },
    { id: 'h-life-4', category: 'lifestyle', label: 'Alimentation',   notes: 'Régime méditerranéen conseillé', status: 'en_suivi' },
  );

  return records;
}

// ─── Category section ─────────────────────────────────────────────────────────

function CategorySection({ category, records }: { category: HistoryCategory; records: HistoryRecord[] }) {
  const [open, setOpen] = useState(true);
  const cfg = CATEGORY_CFG[category];
  const Icon = cfg.icon;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', cfg.bg, cfg.border, 'border')}>
            <Icon size={13} className={cfg.color} />
          </div>
          <span className="font-semibold text-gray-800 text-sm">{cfg.label}</span>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{records.length}</span>
        </div>
        {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {records.length === 0 ? (
            <div className="px-5 py-3 text-sm text-gray-400 italic">Aucun antécédent enregistré</div>
          ) : records.map(rec => {
            const sta = rec.status ? STATUS_CFG[rec.status] : null;
            return (
              <div key={rec.id} className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0', cfg.color.replace('text-', 'bg-'))} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-800">{rec.label}</span>
                    {sta && (
                      <span className={cn('text-xs px-1.5 py-0.5 rounded-full border font-medium', sta.cls)}>
                        {sta.label}
                      </span>
                    )}
                    {rec.severity && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                        {rec.severity}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-0.5">
                    {rec.date && <span className="text-xs text-gray-400">📅 {rec.date.slice(0, 4)}</span>}
                    {rec.doctor && <span className="text-xs text-gray-400">👨‍⚕️ {rec.doctor}</span>}
                    {rec.department && <span className="text-xs text-gray-400">🏥 {rec.department}</span>}
                  </div>
                  {rec.notes && <p className="text-xs text-gray-500 mt-1 italic">{rec.notes}</p>}
                </div>
              </div>
            );
          })}
          <div className="px-5 py-2">
            <button
              onClick={() => alert('Ajout d\'antécédent — disponible avec le backend')}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Plus size={11} /> Ajouter un antécédent
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  patient: Patient;
}

export function PatientMedicalHistoryTab({ patient }: Props) {
  const all = buildHistory(patient);
  const categories: HistoryCategory[] = ['diseases', 'surgeries', 'chronic', 'hereditary', 'psychiatric', 'lifestyle'];

  return (
    <div className="space-y-3">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {categories.map(cat => {
          const count = all.filter(r => r.category === cat).length;
          const cfg = CATEGORY_CFG[cat];
          const Icon = cfg.icon;
          return (
            <div key={cat} className={cn('rounded-lg border p-2.5 flex items-center gap-2', cfg.bg, cfg.border)}>
              <Icon size={13} className={cfg.color} />
              <div>
                <p className="text-xs text-gray-600 leading-tight">{cfg.label.split(' ')[0]}</p>
                <p className="text-sm font-bold text-gray-900">{count}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Category sections */}
      {categories.map(cat => (
        <CategorySection
          key={cat}
          category={cat}
          records={all.filter(r => r.category === cat)}
        />
      ))}
    </div>
  );
}
