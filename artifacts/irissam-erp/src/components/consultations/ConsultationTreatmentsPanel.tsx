/**
 * Onglet Traitements de l'espace consultation — 100 % PostgreSQL.
 *
 * Liste : GET /consultations/:id/treatments (table consultation_treatments).
 * Ajout : POST /consultations/:id/treatments — le serveur estampille
 * l'utilisateur connecté (recorded_by / recorded_by_name) et applique la
 * garde médecin (un médecin n'écrit que dans SES consultations).
 */
import { useMemo, useState } from 'react';
import { Syringe, Plus, RefreshCw, AlertTriangle, Loader2, X } from 'lucide-react';
import { useQuery } from '@/hooks/useQuery';
import { apiClient } from '@/lib/api-client';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import type { Consultation, ConsultationTreatment } from '@/types/consultation';

function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function nowLocalInput(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function ConsultationTreatmentsPanel({
  consultation, readOnly, onLog,
}: {
  consultation: Consultation;
  readOnly: boolean;
  onLog?: (action: string) => void;
}) {
  const { can } = usePermission();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [designation, setDesignation] = useState('');
  const [note, setNote] = useState('');
  const [performedAt, setPerformedAt] = useState(nowLocalInput());
  const [submitting, setSubmitting] = useState(false);

  const { data, loading, error, refetch } = useQuery<ConsultationTreatment[]>(
    `/consultations/${consultation.id}/treatments`,
  );
  const treatments = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const canEdit = can('consultations.edit') && !readOnly;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!designation.trim() || submitting) return;
    setSubmitting(true);
    try {
      await apiClient.post(`/consultations/${consultation.id}/treatments`, {
        designation: designation.trim(),
        note:        note.trim() || undefined,
        performedAt: performedAt ? new Date(performedAt).toISOString() : undefined,
      });
      toast({ title: 'Traitement enregistré', description: designation.trim() });
      onLog?.(`Traitement ajouté — ${designation.trim()}`);
      setDesignation(''); setNote(''); setPerformedAt(nowLocalInput());
      setShowForm(false);
      refetch();
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error
        ?? (err instanceof Error ? err.message : 'Enregistrement impossible');
      toast({ variant: 'destructive', title: 'Traitement refusé', description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-semibold text-gray-800">Traitements de la consultation</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Actes et traitements réalisés ou prescrits pendant la consultation —
            chaque ligne porte l'utilisateur et l'horodatage (traçabilité).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            title="Actualiser"
            className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={14} />
          </button>
          {canEdit && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} /> Ajouter un traitement
            </button>
          )}
        </div>
      </div>

      {showForm && canEdit && (
        <form onSubmit={handleSubmit} className="border border-blue-200 bg-blue-50/40 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
              <Syringe size={14} className="text-blue-600" /> Nouveau traitement
            </h4>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Désignation <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="text"
              maxLength={200}
              placeholder="Ex : Pansement, injection IM, nébulisation…"
              value={designation}
              onChange={e => setDesignation(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date / heure de réalisation</label>
              <input
                type="datetime-local"
                value={performedAt}
                max={nowLocalInput()}
                onChange={e => setPerformedAt(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Note / consignes</label>
              <input
                type="text"
                maxLength={1000}
                placeholder="Précisions éventuelles…"
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3.5 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting || !designation.trim()}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Enregistrer
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10 text-gray-400 text-sm">
          <Loader2 size={16} className="animate-spin mr-2" /> Chargement des traitements…
        </div>
      ) : error ? (
        <div className="text-center py-10">
          <AlertTriangle size={28} className="mx-auto mb-2 text-red-400" />
          <p className="text-sm text-gray-600 font-medium">Impossible de charger les traitements</p>
          <button onClick={() => refetch()} className="mt-3 px-3.5 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Réessayer
          </button>
        </div>
      ) : treatments.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Syringe size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium text-gray-500">Aucun traitement enregistré pour cette consultation</p>
          {canEdit && (
            <p className="text-xs mt-1 opacity-70">Cliquez sur « Ajouter un traitement » pour tracer un acte réalisé.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {treatments.map(t => (
            <div key={t.id} className="border border-gray-200 rounded-xl p-3.5 bg-white">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{t.designation}</p>
                  {t.note && <p className="text-xs text-gray-500 mt-0.5">{t.note}</p>}
                  <p className="text-[11px] text-gray-400 mt-1.5">
                    Réalisé le {fmtDateTime(t.performedAt)} · enregistré par {t.recordedByName}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
