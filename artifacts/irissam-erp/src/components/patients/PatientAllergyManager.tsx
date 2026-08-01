import { useState } from 'react';
import { ShieldAlert, AlertTriangle, Plus, X, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/format';
import type { Patient } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type AllergyType     = 'médicament' | 'aliment' | 'environnemental' | 'chimique' | 'autre';
type AllergySeverity = 'légère' | 'modérée' | 'sévère' | 'critique';
type AllergyStatus   = 'active' | 'inactive';

interface AllergyEntry {
  id: string;
  substance: string;
  type: AllergyType;
  severity: AllergySeverity;
  reaction: string;
  discoveredAt: string;
  status: AllergyStatus;
  lastUpdatedAt: string;
  notes?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const SEVERITY_CFG: Record<AllergySeverity, { label: string; color: string; bg: string; border: string; dot: string }> = {
  légère:   { label: 'Légère',   color: 'text-yellow-700', bg: 'bg-yellow-50',  border: 'border-yellow-300', dot: 'bg-yellow-400' },
  modérée:  { label: 'Modérée',  color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-300', dot: 'bg-orange-400' },
  sévère:   { label: 'Sévère',   color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-300',    dot: 'bg-red-500' },
  critique: { label: 'Critique', color: 'text-white',      bg: 'bg-red-600',    border: 'border-red-700',    dot: 'bg-white animate-pulse' },
};

const TYPE_LABELS: Record<AllergyType, string> = {
  médicament:     'Médicament',
  aliment:        'Aliment',
  environnemental: 'Environnemental',
  chimique:       'Chimique',
  autre:          'Autre',
};

const STATUS_CFG = {
  active:   { label: 'Active',   cls: 'bg-red-100 text-red-700 border-red-200' },
  inactive: { label: 'Inactive', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
};

// ─── Seed mock allergies from patient data ────────────────────────────────────

const ALLERGY_DB: Record<string, Partial<AllergyEntry>> = {
  'Pénicilline':  { type: 'médicament', severity: 'critique', reaction: 'Choc anaphylactique', discoveredAt: '2010-04-15', notes: 'Documenté suite à réaction sévère en 2010. Ne jamais prescrire.' },
  'Aspirine':     { type: 'médicament', severity: 'sévère',   reaction: 'Bronchospasme + urticaire', discoveredAt: '2015-08-20' },
  'AINS':         { type: 'médicament', severity: 'sévère',   reaction: 'Réaction cutanée étendue', discoveredAt: '2018-03-10' },
  'Sulfamides':   { type: 'médicament', severity: 'modérée',  reaction: 'Rash cutané + fièvre', discoveredAt: '2019-06-05' },
  'Latex':        { type: 'chimique',   severity: 'modérée',  reaction: 'Urticaire au contact', discoveredAt: '2020-01-12' },
  'Arachides':    { type: 'aliment',    severity: 'sévère',   reaction: 'Œdème de Quincke', discoveredAt: '2008-09-30' },
  'Iode':         { type: 'chimique',   severity: 'modérée',  reaction: 'Érythème local', discoveredAt: '2016-11-22' },
};

function buildAllergies(patient: Patient): AllergyEntry[] {
  return (patient.medical?.allergies ?? []).map((name, i) => {
    const db = ALLERGY_DB[name] ?? {};
    return {
      id: `al-${patient.id}-${i}`,
      substance:     name,
      type:          db.type ?? 'médicament',
      severity:      db.severity ?? 'modérée',
      reaction:      db.reaction ?? 'Réaction indéterminée',
      discoveredAt:  db.discoveredAt ?? patient.createdAt.split('T')[0],
      status:        'active' as AllergyStatus,
      lastUpdatedAt: patient.updatedAt.split('T')[0],
      notes:         db.notes,
    };
  });
}

// ─── Add form ─────────────────────────────────────────────────────────────────

const EMPTY_FORM: Omit<AllergyEntry, 'id' | 'lastUpdatedAt'> = {
  substance: '', type: 'médicament', severity: 'légère',
  reaction: '', discoveredAt: '', status: 'active',
};

function AddAllergyForm({ onSave, onCancel }: { onSave: (e: Omit<AllergyEntry, 'id' | 'lastUpdatedAt'>) => void; onCancel: () => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));
  const valid = form.substance.trim() && form.reaction.trim() && form.discoveredAt;

  return (
    <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-4 space-y-3">
      <h4 className="text-sm font-semibold text-blue-800">Nouvelle allergie</h4>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className="text-xs text-gray-500 mb-1 block">Substance / Allergène *</label>
          <input value={form.substance} onChange={e => set('substance', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="ex : Pénicilline" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Type *</label>
          <select value={form.type} onChange={e => set('type', e.target.value as AllergyType)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white">
            {(Object.keys(TYPE_LABELS) as AllergyType[]).map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Sévérité *</label>
          <select value={form.severity} onChange={e => set('severity', e.target.value as AllergySeverity)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white">
            {(['légère', 'modérée', 'sévère', 'critique'] as AllergySeverity[]).map(s =>
              <option key={s} value={s}>{SEVERITY_CFG[s].label}</option>)}
          </select>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="text-xs text-gray-500 mb-1 block">Type de réaction *</label>
          <input value={form.reaction} onChange={e => set('reaction', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="ex : Urticaire, Anaphylaxie…" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Date de découverte *</label>
          <input type="date" value={form.discoveredAt} onChange={e => set('discoveredAt', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={() => valid && onSave(form)} disabled={!valid}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors">
          <Save size={13} /> Enregistrer
        </button>
        <button onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
          <X size={13} /> Annuler
        </button>
      </div>
    </div>
  );
}

// ─── Allergy row ──────────────────────────────────────────────────────────────

function AllergyRow({ entry, onToggleStatus }: { entry: AllergyEntry; onToggleStatus: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const sev = SEVERITY_CFG[entry.severity];
  const sta = STATUS_CFG[entry.status];

  return (
    <div className={cn('border-b border-gray-50 last:border-0', entry.status === 'inactive' ? 'opacity-60' : '')}>
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 transition-colors cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Severity indicator */}
        <div className={cn('w-2 h-8 rounded-full flex-shrink-0', sev.bg, sev.dot === 'bg-white animate-pulse' ? 'bg-red-600' : '')} />

        {/* Substance */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">{entry.substance}</span>
            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{TYPE_LABELS[entry.type]}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{entry.reaction}</p>
        </div>

        {/* Severity badge */}
        <span className={cn('text-xs px-2 py-1 rounded-full border font-semibold flex-shrink-0',
          sev.color, sev.bg, sev.border)}>
          {sev.label}
        </span>

        {/* Status */}
        <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0', sta.cls)}>
          {sta.label}
        </span>

        {/* Date */}
        <span className="text-xs text-gray-400 flex-shrink-0 hidden sm:block">
          {formatDate(entry.discoveredAt)}
        </span>

        {/* Expand */}
        {expanded ? <ChevronUp size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-7 pb-3 bg-gray-50/30 border-t border-gray-100">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Découverte</p>
              <p className="text-sm text-gray-700 font-medium mt-0.5">{formatDate(entry.discoveredAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Dernier M.À.J</p>
              <p className="text-sm text-gray-700 font-medium mt-0.5">{formatDate(entry.lastUpdatedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Type</p>
              <p className="text-sm text-gray-700 font-medium mt-0.5">{TYPE_LABELS[entry.type]}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Statut</p>
              <button
                onClick={e => { e.stopPropagation(); onToggleStatus(entry.id); }}
                className={cn('text-xs px-2.5 py-1 rounded-full border font-medium mt-0.5 hover:opacity-80 transition-opacity', sta.cls)}
              >
                {entry.status === 'active' ? '● Active — cliquer pour désactiver' : '○ Inactive — cliquer pour activer'}
              </button>
            </div>
            {entry.notes && (
              <div className="col-span-2 sm:col-span-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Notes cliniques</p>
                <p className="text-sm text-gray-700 mt-0.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{entry.notes}</p>
              </div>
            )}
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

export function PatientAllergyManager({ patient }: Props) {
  const [allergies, setAllergies] = useState<AllergyEntry[]>(() => buildAllergies(patient));
  const [showAdd, setShowAdd]     = useState(false);
  const [filter, setFilter]       = useState<'all' | 'active' | 'inactive'>('all');

  const handleAdd = (data: Omit<AllergyEntry, 'id' | 'lastUpdatedAt'>) => {
    setAllergies(prev => [...prev, {
      ...data,
      id: `al-new-${Date.now()}`,
      lastUpdatedAt: new Date().toISOString().split('T')[0],
    }]);
    setShowAdd(false);
  };

  const handleToggleStatus = (id: string) => {
    setAllergies(prev => prev.map(a =>
      a.id === id ? { ...a, status: a.status === 'active' ? 'inactive' : 'active' } : a
    ));
  };

  const critiques = allergies.filter(a => a.severity === 'critique' && a.status === 'active');
  const filtered  = allergies.filter(a => filter === 'all' ? true : a.status === filter);

  return (
    <div className="space-y-4">
      {/* Critical alert */}
      {critiques.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-300 rounded-xl">
          <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-700">⚠ Allergie(s) critique(s) active(s) — vérifier avant toute prescription</p>
            <p className="text-sm text-red-600 mt-0.5">
              {critiques.map(c => c.substance).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <ShieldAlert size={16} className="text-red-600" />
          <div>
            <h3 className="font-semibold text-gray-800">Gestion des allergies</h3>
            <p className="text-xs text-gray-400 mt-0.5">{allergies.filter(a => a.status === 'active').length} active(s) · {allergies.length} au total</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter */}
          <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
            {(['all', 'active', 'inactive'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={cn('text-xs px-2.5 py-1 rounded-md font-medium transition-colors',
                  filter === f ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                {f === 'all' ? 'Toutes' : f === 'active' ? 'Actives' : 'Inactives'}
              </button>
            ))}
          </div>
          {!showAdd && (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Plus size={13} /> Ajouter
            </button>
          )}
        </div>
      </div>

      {/* Add form */}
      {showAdd && <AddAllergyForm onSave={handleAdd} onCancel={() => setShowAdd(false)} />}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Table head */}
        <div className="hidden sm:grid grid-cols-[8px_1fr_120px_90px_80px_100px] gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
          <span />
          <span>Substance / Réaction</span>
          <span>Sévérité</span>
          <span>Statut</span>
          <span className="hidden sm:block">Découverte</span>
          <span />
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <ShieldAlert size={32} className="opacity-20 mb-2" />
            <p className="text-sm">Aucune allergie {filter !== 'all' ? `(${filter})` : ''}</p>
          </div>
        ) : (
          filtered.map(entry => (
            <AllergyRow key={entry.id} entry={entry} onToggleStatus={handleToggleStatus} />
          ))
        )}
      </div>

      <p className="text-xs text-gray-400">
        Les allergies critiques génèrent automatiquement une alerte rouge en haut du dossier patient.
      </p>
    </div>
  );
}
