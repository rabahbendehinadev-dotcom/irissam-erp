import { useState } from 'react';
import { ShieldAlert, AlertTriangle, Plus, X, Save, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/services/api/client';
import { usePermission } from '@/hooks/usePermission';
import type { Patient } from '@/types';

// ─── Real data only ───────────────────────────────────────────────────────────
// Le dossier patient (PostgreSQL) stocke les allergies comme une liste de
// substances (patients.allergies). Aucun détail fabriqué (sévérité, réaction,
// date de découverte) n'est affiché : seules les substances réellement
// enregistrées apparaissent. L'ajout / la suppression est persisté via
// PATCH /patients/:id/allergies — endpoint étroit qui ne touche que ce champ
// (jamais de full-PUT : risque d'écraser des modifications concurrentes).

interface Props {
  patient: Patient;
  onChanged?: () => void;
}

export function PatientAllergyManager({ patient, onChanged }: Props) {
  const { can } = usePermission();
  const canEdit = can('patients.edit');

  const allergies = (patient.medical?.allergies ?? []).filter(Boolean);

  const [showAdd, setShowAdd] = useState(false);
  const [newSubstance, setNewSubstance] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const persist = async (next: string[]) => {
    setSaving(true); setActionError(null);
    try {
      await apiClient.patch(`/patients/${encodeURIComponent(patient.id)}/allergies`, { allergies: next });
      setNewSubstance('');
      setShowAdd(false);
      onChanged?.();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => {
    const s = newSubstance.trim();
    if (!s || saving) return;
    if (allergies.some(a => a.toLowerCase() === s.toLowerCase())) {
      setActionError('Cette allergie est déjà enregistrée.');
      return;
    }
    void persist([...allergies, s]);
  };

  const handleRemove = (name: string) => {
    if (!window.confirm(`Retirer « ${name} » des allergies connues ?`)) return;
    void persist(allergies.filter(a => a !== name));
  };

  return (
    <div className="space-y-4">
      {/* Critical banner — real allergy names only */}
      {allergies.length > 0 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <ShieldAlert size={20} className="text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700">
              {allergies.length} allergie{allergies.length > 1 ? 's' : ''} connue{allergies.length > 1 ? 's' : ''} — à vérifier avant toute prescription
            </p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {allergies.map(a => (
                <span key={a} className="px-2 py-0.5 bg-white border border-red-200 text-red-700 rounded-full text-xs font-medium">
                  {a}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header + add */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-800">Allergies enregistrées</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Substances documentées dans le dossier patient — aucune donnée supposée.
          </p>
        </div>
        {canEdit && !showAdd && (
          <button
            onClick={() => { setShowAdd(true); setActionError(null); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} /> Ajouter une allergie
          </button>
        )}
      </div>

      {actionError && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertTriangle size={14} /> {actionError}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="bg-white border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-gray-800">Nouvelle allergie</h3>
            <button onClick={() => { setShowAdd(false); setNewSubstance(''); }} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>
          <div className="flex gap-2">
            <input
              value={newSubstance}
              onChange={e => setNewSubstance(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              placeholder="Substance (ex : Pénicilline)"
              autoFocus
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <button
              onClick={handleAdd}
              disabled={!newSubstance.trim() || saving}
              className={cn('flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg text-white transition-colors',
                !newSubstance.trim() || saving ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700')}
            >
              <Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {/* List / empty state */}
      {allergies.length === 0 ? (
        !showAdd && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 space-y-2 bg-white border border-gray-200 rounded-xl">
            <ShieldAlert size={36} className="opacity-20" />
            <p className="font-semibold text-sm">Aucune allergie connue enregistrée pour ce patient</p>
            <p className="text-xs">{canEdit ? 'Utilisez « Ajouter une allergie » pour documenter le dossier.' : 'Le dossier ne mentionne aucune allergie.'}</p>
          </div>
        )
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-50">
          {allergies.map(a => (
            <div key={a} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                <p className="font-medium text-sm text-gray-800">{a}</p>
              </div>
              {canEdit && (
                <button
                  onClick={() => handleRemove(a)}
                  disabled={saving}
                  title="Retirer cette allergie"
                  className="p-1.5 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-gray-400">
        Les détails cliniques (sévérité, réaction, date de découverte) ne sont pas encore stockés dans le
        dossier — seules les substances réellement enregistrées sont affichées. Modification via « Modifier le dossier » ou ce panneau.
      </p>
    </div>
  );
}
