/**
 * AttachPatientModal — rattache une consultation « patient de passage » à un
 * dossier patient permanent (POST /consultations/:id/attach-patient).
 *
 * Conversion propre côté serveur (transaction) : la consultation, ses
 * prescriptions et ses traitements sont rattachés au dossier — sans ressaisie
 * ni doublon. Audit `patient_attached` (traçabilité administration).
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Link2, Loader2, AlertTriangle } from 'lucide-react';
import { useGetPatientsList } from '@workspace/api-client-react';
import { PatientAvatar } from '@/components/shared/PatientAvatar';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import type { Consultation } from '@/types/consultation';

interface PatientHit {
  id: string;
  firstName: string;
  lastName: string;
  mpiId: string;
  phone: string;
  dateOfBirth?: string;
}

export function AttachPatientModal({
  consultation, onClose, onAttached,
}: {
  consultation: Consultation;
  onClose: () => void;
  onAttached: () => void;
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<PatientHit | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: apiPatients } = useGetPatientsList({} as any);
  const patientList = Array.isArray(apiPatients) ? (apiPatients as unknown as Record<string, unknown>[]) : [];

  const q = query.trim().toLowerCase();
  const results: PatientHit[] = q.length > 1
    ? patientList
        .filter(p => `${p.lastName} ${p.firstName} ${p.mpiId} ${p.phone}`.toLowerCase().includes(q))
        .slice(0, 6)
        .map(p => ({
          id:          p.id as string,
          firstName:   (p.firstName as string) ?? '',
          lastName:    (p.lastName as string) ?? '',
          mpiId:       (p.mpiId as string) ?? '',
          phone:       (p.phone as string) ?? '',
          dateOfBirth: p.dateOfBirth as string | undefined,
        }))
    : [];

  const handleAttach = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    try {
      await apiClient.post(`/consultations/${consultation.id}/attach-patient`, { patientId: selected.id });
      toast({
        title: 'Patient rattaché',
        description: `${consultation.number} est maintenant lié au dossier ${selected.mpiId} (prescriptions et traitements inclus).`,
      });
      onAttached();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error
        ?? (err instanceof Error ? err.message : 'Rattachement impossible');
      toast({ variant: 'destructive', title: 'Rattachement refusé', description: msg });
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[95dvh] flex flex-col overflow-hidden">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <Link2 size={16} className="text-blue-600" /> Rattacher au dossier patient
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            <p className="font-semibold mb-0.5">Patient de passage : {consultation.patientName}</p>
            <p>
              Identifiant provisoire <span className="font-mono">{consultation.patientMpi}</span> —
              la consultation, ses ordonnances et ses traitements seront rattachés au
              dossier sélectionné, sans ressaisie. Action définitive et auditée.
            </p>
          </div>

          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setSelected(null); }}
              placeholder="Nom, prénom, N° MPI, téléphone…"
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              autoFocus
            />
          </div>

          {results.length > 0 && !selected && (
            <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-50">
              {results.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-blue-50 transition-colors text-left"
                >
                  <PatientAvatar firstName={p.firstName} lastName={p.lastName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{p.lastName} {p.firstName}</p>
                    <p className="text-xs text-gray-500 font-mono">{p.mpiId}{p.phone ? ` · ${p.phone}` : ''}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {q.length > 1 && results.length === 0 && (
            <div className="text-center py-5 text-gray-400 bg-gray-50 rounded-xl text-sm space-y-1">
              <p>Aucun patient trouvé pour « {query} »</p>
              <p className="text-xs">
                Créez d'abord le dossier dans le module Patients, puis revenez rattacher cette consultation.
              </p>
            </div>
          )}

          {selected && (
            <div className="border-2 border-blue-500 rounded-xl p-4 bg-blue-50">
              <div className="flex items-start gap-3">
                <PatientAvatar firstName={selected.firstName} lastName={selected.lastName} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{selected.lastName} {selected.firstName}</p>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">{selected.mpiId}{selected.phone ? ` · ${selected.phone}` : ''}</p>
                  <p className="text-xs text-blue-700 mt-2 flex items-center gap-1">
                    <AlertTriangle size={11} />
                    {consultation.patientMpi} → {selected.mpiId} : vérifiez qu'il s'agit bien de la même personne.
                  </p>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 shrink-0">
                  <X size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-100 text-gray-600 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={() => void handleAttach()}
            disabled={!selected || submitting}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
            Rattacher définitivement
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
