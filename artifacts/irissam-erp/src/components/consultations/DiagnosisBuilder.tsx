import { useState, useEffect } from 'react';
import { Brain, Save, RefreshCw, Lock } from 'lucide-react';

/**
 * Éditeur du diagnostic de la consultation.
 *
 * Champ RÉEL : lié à la colonne PostgreSQL `consultations.diagnosis` (TEXT).
 * L'enregistrement passe par PATCH /consultations/:id { diagnosis } — mise à
 * jour partielle, journalisée côté serveur dans `audit_logs` (ancienne et
 * nouvelle valeur). Aucune liste CIM-10 fictive, aucune donnée simulée.
 */
interface Props {
  /** Valeur actuelle de la colonne `consultations.diagnosis` (source : GET /consultations/:id). */
  value: string;
  /** Persiste le diagnostic (PATCH). Résout à `true` si l'enregistrement a réussi. */
  onSave: (diagnosis: string) => Promise<boolean>;
  saving: boolean;
  readOnly: boolean;
}

export function DiagnosisBuilder({ value, onSave, saving, readOnly }: Props) {
  const [draft, setDraft] = useState(value);

  // Re-synchronise le brouillon quand la valeur serveur change (PATCH réussi
  // ou chargement d'une autre consultation) — jamais pendant la frappe.
  useEffect(() => { setDraft(value); }, [value]);

  const dirty = draft !== value;

  if (readOnly) {
    return (
      <div className="space-y-3 max-w-2xl">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-purple-500" />
          <h3 className="font-semibold text-gray-800 text-sm">Diagnostic</h3>
          <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full ml-auto">
            <Lock size={10} /> Lecture seule
          </span>
        </div>
        {value.trim() ? (
          <p className="text-sm text-gray-800 whitespace-pre-wrap p-4 bg-gray-50 border border-gray-200 rounded-xl">
            {value}
          </p>
        ) : (
          <div className="text-center py-8 text-gray-400 text-sm">
            Aucun diagnostic renseigné pour cette consultation.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-2xl">
      <div className="flex items-center gap-2">
        <Brain size={16} className="text-purple-500" />
        <h3 className="font-semibold text-gray-800 text-sm">Diagnostic</h3>
      </div>

      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        rows={6}
        placeholder="Diagnostic retenu à l'issue de la consultation…"
        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 resize-y"
      />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-gray-400">
          Enregistré dans le dossier PostgreSQL de la consultation — chaque
          modification est tracée dans le journal d'audit serveur.
        </p>
        <button
          onClick={() => { void onSave(draft); }}
          disabled={saving || !dirty}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          Enregistrer le diagnostic
        </button>
      </div>
    </div>
  );
}
